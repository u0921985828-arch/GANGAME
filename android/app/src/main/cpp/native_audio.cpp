// FX-404 native audio — Stage 1 scaffold.
//
// Goal of THIS file (first milestone, step 1): prove the whole native chain builds, links Oboe,
// loads at runtime, opens a low-latency output stream and reports its real latency back to the
// WebView — WITHOUT yet rendering any voices (the callback outputs silence). The voice core
// (buffer playback, envelopes, choke…) lands on top of this in step 2.
//
// The engine is used ONLY for wired/USB output (see routing in the Kotlin/JS layer): Stage 0
// measured ~12–25 ms there vs a ~47 ms hardware wall on the internal speaker.

#include <jni.h>
#include <oboe/Oboe.h>
#include <android/log.h>
#include <atomic>
#include <mutex>
#include <string>
#include <cstdio>

#define LOG_TAG "FX404Audio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

using namespace oboe;

// Single global engine instance. All public entry points are serialised with mLock; the audio
// callback runs on the real-time thread and must never take a contended lock — for the scaffold it
// only writes silence, so it touches no shared mutable state.
class Fx404Engine : public AudioStreamDataCallback {
public:
    Result start() {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream) return Result::OK; // already running

        AudioStreamBuilder b;
        b.setDirection(Direction::Output)
         ->setPerformanceMode(PerformanceMode::LowLatency)
         ->setSharingMode(SharingMode::Shared)   // Shared is the portable default; the OS still grants
                                                  // the fast (MMAP) mixer path when available.
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
        // Default to a 2-burst buffer: a sane stability floor. Stage 0 proved buffer size does NOT
        // move latency on this device, so this is purely an anti-underrun margin, tunable from the UI.
        if (mBurst > 0) mStream->setBufferSizeInFrames(mBurst * 2);

        r = mStream->requestStart();
        if (r != Result::OK) {
            LOGE("requestStart failed: %s", convertToText(r));
            mStream->close();
            mStream.reset();
            return r;
        }
        LOGI("stream started: burst=%d sr=%d perf=%d", mBurst, mStream->getSampleRate(),
             static_cast<int>(mStream->getPerformanceMode()));
        return Result::OK;
    }

    void stop() {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream) {
            mStream->stop();
            mStream->close();
            mStream.reset();
        }
    }

    void setBufferFrames(int frames) {
        std::lock_guard<std::mutex> lock(mLock);
        if (mStream && frames > 0) mStream->setBufferSizeInFrames(frames);
    }

    std::string info() {
        std::lock_guard<std::mutex> lock(mLock);
        if (!mStream) return std::string("{\"open\":false}");

        double latMs = -1.0;
        auto lr = mStream->calculateLatencyMillis();
        if (lr) latMs = lr.value();

        auto xr = mStream->getXRunCount();
        int xruns = xr ? xr.value() : -1;

        const bool lowLatency = mStream->getPerformanceMode() == PerformanceMode::LowLatency;

        char buf[512];
        std::snprintf(buf, sizeof(buf),
            "{\"open\":true,\"lowLatency\":%s,\"perfMode\":%d,\"framesPerBurst\":%d,"
            "\"bufferSize\":%d,\"sampleRate\":%d,\"latencyMs\":%.2f,\"xruns\":%d}",
            lowLatency ? "true" : "false",
            static_cast<int>(mStream->getPerformanceMode()),
            mBurst,
            mStream->getBufferSizeInFrames(),
            mStream->getSampleRate(),
            latMs,
            xruns);
        return std::string(buf);
    }

    DataCallbackResult onAudioReady(AudioStream* /*stream*/, void* audioData,
                                    int32_t numFrames) override {
        // Scaffold: stereo float silence. The voice mixer replaces this in step 2.
        float* out = static_cast<float*>(audioData);
        const int32_t samples = numFrames * 2;
        for (int32_t i = 0; i < samples; ++i) out[i] = 0.0f;
        return DataCallbackResult::Continue;
    }

private:
    std::mutex mLock;
    std::shared_ptr<AudioStream> mStream;
    int mBurst = 0;
};

static Fx404Engine gEngine;

extern "C" {

JNIEXPORT jint JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeStart(JNIEnv*, jobject) {
    return static_cast<jint>(gEngine.start());
}

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeStop(JNIEnv*, jobject) {
    gEngine.stop();
}

JNIEXPORT void JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeSetBufferFrames(JNIEnv*, jobject, jint frames) {
    gEngine.setBufferFrames(static_cast<int>(frames));
}

JNIEXPORT jstring JNICALL
Java_com_artifacts_fx404_NativeAudioBridge_nativeInfo(JNIEnv* env, jobject) {
    return env->NewStringUTF(gEngine.info().c_str());
}

} // extern "C"
