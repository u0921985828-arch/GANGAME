# The JS bridge is referenced only from injected JavaScript (via @JavascriptInterface),
# so R8 can't see the call sites — keep the interface methods.
-keepclassmembers class com.artifacts.fx404.MainActivity$DownloadBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
# R8 full mode (android.enableR8.fullMode=true) es más agresivo: fijamos también la CLASE del bridge
# (no solo sus miembros) para que el enlace addJavascriptInterface(...,"AndroidDownloader") no se vea
# afectado por optimizaciones de clase. Los nombres de método deben conservarse porque el JS los llama
# por nombre (AndroidDownloader.saveFile/beginFile/appendBase64/endFile/endFileToProjects/openProject).
-keep class com.artifacts.fx404.MainActivity$DownloadBridge { *; }

# Native audio (Oboe) bridge. JNI links the external methods BY NAME
# (Java_com_artifacts_fx404_NativeAudioBridge_*), so their names must survive R8 full mode; and the
# NativeAudio JS bridge is called by name from injected JavaScript, same as DownloadBridge.
-keepclasseswithmembernames class * { native <methods>; }
-keep class com.artifacts.fx404.NativeAudioBridge { *; }
-keep class com.artifacts.fx404.MainActivity$NativeAudioJs { *; }
