# The JS bridge is referenced only from injected JavaScript (via @JavascriptInterface),
# so R8 can't see the call sites — keep the interface methods.
-keepclassmembers class com.artifacts.fx404.MainActivity$DownloadBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
