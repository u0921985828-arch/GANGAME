// FX-404 native audio — low-latency voice core (milestone step 2).
//
// Scope of THIS engine: render DRY one-shot pad samples through an Oboe LowLatency stream so that,
// when the phone outputs through a wire/USB DAC, a live finger-drummed tap reaches the DAC at
// ~12–25 ms instead of the WebView's ~70 ms (Stage 0 measured this on the target device; the
// internal speaker has a ~47 ms hardware wall, so the JS layer only routes wired output here).
//
// Deliberately narrow: the WebView engine stays the source of truth for the sequencer, every FX,
// loops/pingpong, BPM-sync/keep-pitch stretch, DJ bend, groups and the master/limiter chain. The
// JS routing gate only sends a tap here when NONE of those apply, so this engine never has to
// reproduce them — it plays a pitched, trimmed, enveloped one-shot with per-voice gain, and that's it.
//
// Threading: JNI entry points (start/stop/load/noteOn/…) run on binder threads and are serialised by
// mLock. The audio callback (onAudioReady) runs on the RT thread; it owns the voice array and only
// try_locks mLock to drain the pending-command queue — a missed lock just defers a new note by one
// buffer (~5 ms, inaudible) and never blocks or glitches voices already sounding.

#include <jni.h>
#include <oboe/Oboe.h>
#include <android/log.h>
#include <atomic>
#include <mutex>
#include <memory>
#include <vector>
#include <string>
#include <fstream>
#include <cstdio>
#include <cmath>

#define LOG_TAG "FX404Audio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

using namespace oboe;

// A decoded sample, owned via shared_ptr so a playing Voice keeps it alive even if the slot is
// freed/replaced from the JNI thread mid-playback. PCM is interleaved float, `channels` wide.
struct SampleSlot {
    std::vector<float> data;
    int channels = 1;
    int frames = 0;
    int sampleRate = 48000;
};

// A start request handed from a JNI thread to the RT thread. Carries a shared_ptr so the slot can't
// be freed between enqueue and consumption.
struct StartCmd {
    std::shared_ptr<SampleSlot> slot;
    float gain;         // velocity * pad gain (linear)
    float pitch;        // semitones
    float startFrac, endFrac;
    bool reverse;
    float attackSec, releaseSec;
    int padId, groupId; // padId: self-retrigger / stopPad target. groupId: choke group (-1 = none)
};

class Fx404Engine : public AudioStreamDataCallback {
public:
    Result start() {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream) return Result::OK;

        AudioStreamBuilder b;
        b.setDirection(Direction::Output)
         ->setPerformanceMode(PerformanceMode::LowLatency)
         ->setSharingMode(SharingMode::Shared)
         ->setFormat(AudioFormat::Float)
         ->setChannelCount(2)
         ->setDataCallback(this)
         ->setErrorCallback(nullptr);

        Result r = b.openStream(mStream);
        if (r != Result::OK || !mStream) {
            LOGE("openStream failed: %s", convertToText(r));
            mStream.reset();
            return r;
        }
        mBurst = mStream->getFramesPerBurst();
        mSampleRate = mStream->getSampleRate();
        if (mBurst > 0) mStream->setBufferSizeInFrames(mBurst * 2);

        r = mStream->requestStart();
        if (r != Result::OK) {
            LOGE("requestStart failed: %s", convertToText(r));
            mStream->close();
            mStream.reset();
            return r;
        }
        LOGI("stream started: burst=%d sr=%d perf=%d", mBurst, mSampleRate,
             static_cast<int>(mStream->getPerformanceMode()));
        return Result::OK;
    }

    void stop() {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream) { mStream->stop(); mStream->close(); mStream.reset(); }
        for (auto& v : mVoices) v.active = false;
        mCmds.clear();
    }

    void setBufferFrames(int frames) {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream && frames > 0) mStream->setBufferSizeInFrames(frames);
    }

    void setMasterGain(float g) {
        if (!(g >= 0.f)) g = 0.f;      // rejects NaN too
        if (g > 4.f) g = 4.f;
        mMaster.store(g, std::memory_order_relaxed);
    }

    // Decode a raw interleaved-float32 PCM file (little-endian, native byte order assumed LE on ARM)
    // into a slot. Runs on a binder thread; publishes the finished slot under the lock.
    bool loadSample(int slotId, const std::string& path, int sr, int ch, int frames) {
        if (slotId < 0 || slotId >= kMaxSlots || ch < 1 || ch > 2 || frames <= 0) return false;
        size_t count = static_cast<size_t>(frames) * static_cast<size_t>(ch);
        auto slot = std::make_shared<SampleSlot>();
        slot->channels = ch; slot->frames = frames; slot->sampleRate = sr > 0 ? sr : mSampleRate;
        slot->data.resize(count);
        std::ifstream f(path, std::ios::binary);
        if (!f) { LOGE("loadSample: cannot open %s", path.c_str()); return false; }
        f.read(reinterpret_cast<char*>(slot->data.data()),
               static_cast<std::streamsize>(count * sizeof(float)));
        if (static_cast<size_t>(f.gcount()) != count * sizeof(float)) {
            LOGE("loadSample: short read for slot %d", slotId);
            return false;
        }
        std::lock_guard<std::mutex> lock(mLock);
        mSlots[slotId] = slot;
        return true;
    }

    void freeSample(int slotId) {
        if (slotId < 0 || slotId >= kMaxSlots) return;
        std::lock_guard<std::mutex> lock(mLock);
        mSlots[slotId].reset();
    }

    bool hasSample(int slotId) {
        if (slotId < 0 || slotId >= kMaxSlots) return false;
        std::lock_guard<std::mutex> lock(mLock);
        return static_cast<bool>(mSlots[slotId]);
    }

    // Queue a one-shot. Returns false if the slot isn't loaded (caller then falls back to WebView).
    bool noteOn(int slotId, float gain, float pitch, float startFrac, float endFrac,
                bool reverse, float attackSec, float releaseSec, int padId, int groupId) {
        std::lock_guard<std::mutex> lock(mLock);
        if (slotId < 0 || slotId >= kMaxSlots || !mSlots[slotId]) return false;
        StartCmd c;
        c.slot = mSlots[slotId];
        c.gain = (std::isfinite(gain) && gain >= 0.f) ? gain : 1.f;
        c.pitch = std::isfinite(pitch) ? pitch : 0.f;
        c.startFrac = startFrac; c.endFrac = endFrac; c.reverse = reverse;
        c.attackSec = attackSec; c.releaseSec = releaseSec;
        c.padId = padId; c.groupId = groupId;
        mCmds.push_back(std::move(c));
        mHasCmds.store(true, std::memory_order_release);
        return true;
    }

    // Fast click-free stop of the voice(s) owned by a pad (self-retrigger / HOLD toggle in JS).
    void stopPad(int padId) {
        std::lock_guard<std::mutex> lock(mLock);
        mStops.push_back(padId);
        mHasCmds.store(true, std::memory_order_release);
    }

    void panic() {
        std::lock_guard<std::mutex> lock(mLock);
        mCmds.clear();
        mPanic.store(true, std::memory_order_release);
        mHasCmds.store(true, std::memory_order_release);
    }

    // Kept for the existing AJUSTES → Diagnóstico "TEST" button (audible native tap check).
    void noteClick() { mClicks.fetch_add(1, std::memory_order_relaxed); }

    std::string info() {
        std::lock_guard<std::mutex> lock(mLock);
        if (!mStream) return std::string("{\"open\":false}");
        double latMs = -1.0; auto lr = mStream->calculateLatencyMillis(); if (lr) latMs = lr.value();
        auto xr = mStream->getXRunCount(); int xruns = xr ? xr.value() : -1;
        const bool lowLatency = mStream->getPerformanceMode() == PerformanceMode::LowLatency;
        char buf[512];
        std::snprintf(buf, sizeof(buf),
            "{\"open\":true,\"lowLatency\":%s,\"perfMode\":%d,\"framesPerBurst\":%d,"
            "\"bufferSize\":%d,\"sampleRate\":%d,\"latencyMs\":%.2f,\"xruns\":%d}",
            lowLatency ? "true" : "false", static_cast<int>(mStream->getPerformanceMode()),
            mBurst, mStream->getBufferSizeInFrames(), mStream->getSampleRate(), latMs, xruns);
        return std::string(buf);
    }

    DataCallbackResult onAudioReady(AudioStream* stream, void* audioData, int32_t numFrames) override {
        float* out = static_cast<float*>(audioData);
        const int32_t samples = numFrames * 2;
        for (int32_t i = 0; i < samples; ++i) out[i] = 0.0f;

        const double sr = static_cast<double>(stream->getSampleRate());

        // Drain pending commands without ever blocking the RT thread.
        if (mHasCmds.load(std::memory_order_acquire) && mLock.try_lock()) {
            if (mPanic.exchange(false, std::memory_order_relaxed)) {
                for (auto& v : mVoices) v.active = false;
            }
            for (int padId : mStops) startFade(padId);
            mStops.clear();
            for (auto& c : mCmds) startVoice(c, sr);
            mCmds.clear();
            mHasCmds.store(false, std::memory_order_relaxed);
            mLock.unlock();
        }

        // Legacy click voices (TEST button).
        int clicks = mClicks.exchange(0, std::memory_order_relaxed);
        while (clicks-- > 0) {
            for (auto& c : mClickVoices) { if (!c.active) { c.active = true; c.pos = 0; break; } }
        }
        for (auto& c : mClickVoices) {
            if (!c.active) continue;
            for (int32_t f = 0; f < numFrames; ++f) {
                const float t = static_cast<float>(c.pos) / static_cast<float>(sr);
                const float s = 0.25f * std::exp(-t * 60.0f) * std::sin(2.0f * 3.14159265f * 1000.0f * t);
                out[f * 2] += s; out[f * 2 + 1] += s;
                if (++c.pos >= 2400) { c.active = false; break; }
            }
        }

        // Sample voices.
        const float master = mMaster.load(std::memory_order_relaxed);
        for (auto& v : mVoices) {
            if (!v.active) continue;
            const SampleSlot* s = v.slot.get();
            if (!s || s->frames <= 0) { v.active = false; continue; }
            const int ch = s->channels;
            const float* d = s->data.data();
            for (int32_t f = 0; f < numFrames; ++f) {
                // Envelope (linear attack → sustain → release), plus choke fade-out.
                float env;
                if (v.fade >= 0.f) {                       // fast choke/stop fade
                    env = v.fade; v.fade -= v.fadeDec;
                    if (v.fade <= 0.f) { v.active = false; }
                } else if (v.remaining > v.releaseFrames) { // attack / sustain
                    if (v.envGain < 1.f) { v.envGain += v.attackInc; if (v.envGain > 1.f) v.envGain = 1.f; }
                    env = v.envGain;
                } else {                                    // release ramp to the trimmed end
                    v.relGain -= v.releaseDec;
                    if (v.relGain < 0.f) v.relGain = 0.f;
                    env = v.envGain * v.relGain;
                }
                const float amp = env * v.gain * master;

                // Hermite (Catmull-Rom) 4-point interpolation at the fractional read position.
                const double p = v.pos;
                long i1 = static_cast<long>(std::floor(p));
                const float frac = static_cast<float>(p - static_cast<double>(i1));
                for (int c = 0; c < 2; ++c) {
                    const int sc = (ch == 2) ? c : 0;      // mono → both output channels
                    const float y0 = sampleAt(d, s->frames, ch, i1 - 1, sc);
                    const float y1 = sampleAt(d, s->frames, ch, i1,     sc);
                    const float y2 = sampleAt(d, s->frames, ch, i1 + 1, sc);
                    const float y3 = sampleAt(d, s->frames, ch, i1 + 2, sc);
                    const float c0 = y1;
                    const float c1 = 0.5f * (y2 - y0);
                    const float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
                    const float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
                    const float smp = ((c3 * frac + c2) * frac + c1) * frac + c0;
                    out[f * 2 + c] += smp * amp;
                }

                v.pos += v.step;                            // step is negative when reversed
                if (--v.remaining <= 0) { v.active = false; break; }
                if (!v.reverse && v.pos >= v.endPos) { v.active = false; break; }
                if (v.reverse && v.pos <= v.endPos) { v.active = false; break; }
            }
        }

        // Safety brickwall (the WebView path has masterGain + a limiter; this bypasses both).
        for (int32_t i = 0; i < samples; ++i) {
            float x = out[i];
            if (x > 1.f) x = 1.f; else if (x < -1.f) x = -1.f;
            out[i] = x;
        }
        return DataCallbackResult::Continue;
    }

private:
    static constexpr int kMaxSlots = 160;   // 10 banks × 16 pads
    static constexpr int kMaxVoices = 32;

    struct Voice {
        std::shared_ptr<SampleSlot> slot;
        double pos = 0, step = 0, endPos = 0;
        bool reverse = false, active = false;
        int padId = -1, groupId = -1;
        float gain = 1.f;
        long remaining = 0, releaseFrames = 0;
        float envGain = 0.f, attackInc = 1.f;   // attack ramp 0→1
        float relGain = 1.f, releaseDec = 0.f;   // release ramp 1→0 over the last releaseFrames
        float fade = -1.f, fadeDec = 0.f;         // ≥0 → fast choke/stop fade active
    };
    struct ClickVoice { int pos = 0; bool active = false; };

    static inline float sampleAt(const float* d, int frames, int ch, long frame, int c) {
        if (frame < 0) frame = 0; else if (frame >= frames) frame = frames - 1;
        return d[static_cast<size_t>(frame) * ch + c];
    }

    // Both run on the RT thread while holding mLock (drained from onAudioReady).
    void startVoice(StartCmd& c, double sr) {
        Voice* slot = nullptr;
        for (auto& v : mVoices) { if (!v.active) { slot = &v; break; } }
        if (!slot) {                                   // steal the oldest-sounding voice
            long worst = -1; for (auto& v : mVoices) { if (v.remaining > worst) { worst = v.remaining; slot = &v; } }
        }
        if (!slot) return;

        const SampleSlot* s = c.slot.get();
        if (!s || s->frames <= 0) return;
        Voice& v = *slot;
        v.slot = c.slot;
        v.reverse = c.reverse;
        v.padId = c.padId; v.groupId = c.groupId;
        v.gain = c.gain;
        v.fade = -1.f; v.fadeDec = 0.f;

        float sf = c.startFrac, ef = c.endFrac;
        if (!(sf >= 0.f)) sf = 0.f; if (sf > 1.f) sf = 1.f;
        if (!(ef > sf)) ef = 1.f; if (ef > 1.f) ef = 1.f;
        const double startFrame = static_cast<double>(sf) * s->frames;
        const double endFrame   = static_cast<double>(ef) * s->frames;
        const double rate = std::pow(2.0, static_cast<double>(c.pitch) / 12.0);
        double step = (static_cast<double>(s->sampleRate) / sr) * rate;
        if (!(step > 0.0) || !std::isfinite(step)) step = 1.0;

        if (c.reverse) { v.pos = endFrame - 1.0; v.endPos = startFrame; v.step = -step; }
        else           { v.pos = startFrame;     v.endPos = endFrame;   v.step =  step; }

        const double srcSpan = std::abs(endFrame - startFrame);
        long outFrames = static_cast<long>(srcSpan / step);
        if (outFrames < 1) outFrames = 1;

        // Anti-click floor on trimmed edges (mirrors the WebView ~3 ms ramps), clamped to the note length.
        const double ANTI = 0.003;
        double atk = c.attackSec  > 0.001 ? c.attackSec  : (sf > 0.0001 ? ANTI : 0.0);
        double rel = c.releaseSec > 0.001 ? c.releaseSec : (ef < 0.9999 ? ANTI : 0.0);
        long atkF = static_cast<long>(atk * sr);
        long relF = static_cast<long>(rel * sr);
        const long budget = static_cast<long>(outFrames * 0.9);
        if (atkF > budget) atkF = budget;
        if (relF > budget - atkF) relF = (budget - atkF > 0) ? budget - atkF : 0;

        v.remaining = outFrames;
        v.releaseFrames = relF;
        v.envGain = atkF > 0 ? 0.f : 1.f;
        v.attackInc = atkF > 0 ? 1.f / static_cast<float>(atkF) : 1.f;
        v.relGain = 1.f;
        v.releaseDec = relF > 0 ? 1.f / static_cast<float>(relF) : 1.f;

        // Choke: same pad (mono retrigger) or same non-negative group → fast fade the old ones.
        for (auto& o : mVoices) {
            if (&o == &v || !o.active) continue;
            if (o.padId == c.padId || (c.groupId >= 0 && o.groupId == c.groupId)) startFadeVoice(o, sr);
        }
        v.active = true;
    }

    void startFade(int padId) {
        const double sr = mSampleRate > 0 ? mSampleRate : 48000;
        for (auto& v : mVoices) if (v.active && v.padId == padId) startFadeVoice(v, sr);
    }
    static void startFadeVoice(Voice& v, double sr) {
        if (v.fade < 0.f) {                    // ~2 ms click-free cutoff
            const long ff = static_cast<long>(0.002 * sr) + 1;
            v.fade = (v.envGain) * (v.relGain);
            v.fadeDec = v.fade / static_cast<float>(ff);
            if (v.fadeDec <= 0.f) v.fadeDec = 1.f;
        }
    }

    std::mutex mLock;
    std::shared_ptr<AudioStream> mStream;
    int mBurst = 0, mSampleRate = 48000;
    std::atomic<float> mMaster{0.85f};
    std::atomic<int> mClicks{0};
    std::atomic<bool> mHasCmds{false};
    std::atomic<bool> mPanic{false};

    std::shared_ptr<SampleSlot> mSlots[kMaxSlots];
    std::vector<StartCmd> mCmds;     // guarded by mLock
    std::vector<int> mStops;         // guarded by mLock
    Voice mVoices[kMaxVoices];       // RT-owned
    ClickVoice mClickVoices[8];      // RT-owned
};

static Fx404Engine gEngine;

extern "C" {

JNIEXPORT jint JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeStart(JNIEnv*, jobject) { return static_cast<jint>(gEngine.start()); }

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeStop(JNIEnv*, jobject) { gEngine.stop(); }

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeSetBufferFrames(JNIEnv*, jobject, jint frames) { gEngine.setBufferFrames(static_cast<int>(frames)); }

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeNoteClick(JNIEnv*, jobject) { gEngine.noteClick(); }

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeSetMasterGain(JNIEnv*, jobject, jfloat g) { gEngine.setMasterGain(static_cast<float>(g)); }

JNIEXPORT jboolean JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeLoadSample(JNIEnv* env, jobject, jint slotId, jstring path, jint sr, jint ch, jint frames) {
    const char* p = env->GetStringUTFChars(path, nullptr);
    bool ok = gEngine.loadSample(static_cast<int>(slotId), std::string(p ? p : ""), sr, ch, frames);
    if (p) env->ReleaseStringUTFChars(path, p);
    return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeFreeSample(JNIEnv*, jobject, jint slotId) { gEngine.freeSample(static_cast<int>(slotId)); }

JNIEXPORT jboolean JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeHasSample(JNIEnv*, jobject, jint slotId) { return gEngine.hasSample(static_cast<int>(slotId)) ? JNI_TRUE : JNI_FALSE; }

JNIEXPORT jboolean JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeNoteOn(JNIEnv*, jobject, jint slotId, jfloat gain, jfloat pitch,
        jfloat startFrac, jfloat endFrac, jboolean reverse, jfloat attackSec, jfloat releaseSec, jint padId, jint groupId) {
    return gEngine.noteOn(static_cast<int>(slotId), gain, pitch, startFrac, endFrac,
                          reverse == JNI_TRUE, attackSec, releaseSec, static_cast<int>(padId), static_cast<int>(groupId))
        ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeStopPad(JNIEnv*, jobject, jint padId) { gEngine.stopPad(static_cast<int>(padId)); }

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativePanic(JNIEnv*, jobject) { gEngine.panic(); }

JNIEXPORT jstring JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeInfo(JNIEnv* env, jobject) { return env->NewStringUTF(gEngine.info().c_str()); }

} // extern "C"
