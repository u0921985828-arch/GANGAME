package com.artifacts.fx404

/**
 * Kotlin side of the native Oboe audio engine (Stage 1 scaffold).
 *
 * The .so is loaded lazily on first use so a device/WebView build without the native path (or a
 * load failure) degrades gracefully to the existing Web Audio engine instead of crashing at start.
 * All external methods are implemented in native_audio.cpp; their JNI names must match this
 * package + class exactly (Java_com_artifacts_fx404_NativeAudioBridge_*).
 */
object NativeAudioBridge {
    @Volatile private var loaded = false
    @Volatile private var loadFailed = false

    /** Loads libfx404audio.so once. Returns false (and never throws) if the lib is unavailable. */
    @Synchronized
    fun ensureLoaded(): Boolean {
        if (loaded) return true
        if (loadFailed) return false
        return try {
            System.loadLibrary("fx404audio")
            loaded = true
            true
        } catch (t: Throwable) {
            loadFailed = true
            false
        }
    }

    external fun nativeStart(): Int
    external fun nativeStop()
    external fun nativeSetBufferFrames(frames: Int)
    external fun nativeNoteClick()
    external fun nativeInfo(): String
}
