package com.artifacts.fx404

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Thin native shell around the single-file web app (assets/index.html).
 *
 * Design notes:
 *  - Content is served from assets/ through WebViewAssetLoader at a SECURE origin
 *    (https://appassets.androidhost/…). A secure origin is required for the web app's
 *    IndexedDB/localStorage and other secure-context APIs — file:// would break them.
 *  - No permissions: import uses the WebView file chooser (SAF), export uses ACTION_CREATE_DOCUMENT
 *    (SAF — the user picks the destination), recording uses the app's internal audio bus (not the mic).
 *  - High refresh rate: the WebView renders at the window's refresh rate, so we ask the window for the
 *    device's highest mode (many devices pin apps to 60Hz otherwise).
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    // --- SAF plumbing -------------------------------------------------------
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingBytes: ByteArray? = null
    private var pendingMime: String = "application/octet-stream"

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var saveDocLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()               // Android-12 splash (back-compat), before super/setContentView
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)  // edge-to-edge; the web app uses viewport-fit=cover

        registerLaunchers()

        webView = WebView(this)
        setContentView(webView)
        configureWebView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            // MUST match the host in loadUrl() below. Without this, the loader defaults to
            // "appassets.androidplatform.net", so a request to appassets.androidhost is NOT
            // intercepted → the WebView tries to resolve that fake host over the network
            // (net::ERR_NAME_NOT_RESOLVED, or ERR_CACHE_MISS with no INTERNET permission).
            .setDomain("appassets.androidhost")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            // Lock main-frame navigation to the app's own asset origin. The AndroidDownloader JS bridge is
            // attached to this WebView globally, so if any content/link ever navigated it off-origin, that
            // remote page would run in the privileged context with the bridge exposed. Keep in-app asset
            // navigation in the WebView; hand anything else to the system browser (or just refuse it).
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == "appassets.androidhost") return false   // our own origin → load normally
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) { /* no handler → just refuse */ }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                injectBridge(view)          // download + back-button helpers
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)   // drop any stale one
                filePathCallback = callback
                return try {
                    fileChooserLauncher.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    filePathCallback = null
                    false
                }
            }

            // Deny popups / window.open — the app never opens secondary windows; a new WebView window would
            // not carry our WebViewClient (no navigation lockdown) and must never be created.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean = false
        }

        webView.addJavascriptInterface(DownloadBridge(), "AndroidDownloader")

        setupBackHandling()

        if (savedInstanceState == null) {
            webView.loadUrl("https://appassets.androidhost/assets/index.html")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onResume() {
        super.onResume()
        applyHighRefreshRate()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    // ------------------------------------------------------------------------
    private fun configureWebView(wv: WebView) {
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false   // the app still resumes AudioContext on first gesture
            allowFileAccess = false                    // assets come via the loader, not file://
            allowContentAccess = false
            // Allow pinch-zoom for accessibility (WCAG 1.4.4 resize-text): the chassis is scaled down a lot
            // on small phones, so low-vision users need to be able to magnify. builtInZoomControls enables
            // the pinch gesture; displayZoomControls=false hides the legacy on-screen +/- buttons.
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        // Allow devtools (chrome://inspect) only on debuggable builds.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    private fun registerLaunchers() {
        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

        saveDocLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val uri = result.data?.data
            val bytes = pendingBytes
            pendingBytes = null
            if (result.resultCode == RESULT_OK && uri != null && bytes != null) {
                try {
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    Toast.makeText(this, "Guardado", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "No se pudo guardar", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun setupBackHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Ask the web app to close its topmost overlay / rear panel first.
                webView.evaluateJavascript(
                    "(window.__fx404Back && window.__fx404Back()) ? '1' : '0'"
                ) { result ->
                    if (result?.trim('"') != "1") {
                        // Nothing was open → perform the real back (exit).
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    /** Ask the window for the device's highest refresh-rate mode at the current resolution. */
    private fun applyHighRefreshRate() {
        val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display
        else @Suppress("DEPRECATION") windowManager.defaultDisplay
        display ?: return
        val current = display.mode ?: return
        val best = display.supportedModes
            .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
            .maxByOrNull { it.refreshRate } ?: return
        val lp: WindowManager.LayoutParams = window.attributes
        lp.preferredDisplayModeId = best.modeId
        lp.preferredRefreshRate = best.refreshRate
        window.attributes = lp
    }

    /**
     * Injected once per page load:
     *  1) blob-download interception — CSP (connect-src 'self') blocks fetch(blob:), so we capture the
     *     Blob object at URL.createObjectURL time and read it with FileReader (no network), then hand the
     *     base64 to the native side, which writes it wherever the user chooses via SAF.
     *  2) window.__fx404Back() — closes the topmost overlay / rear panel (via the app's own Escape path),
     *     returning true if it consumed the back press.
     *
     *  NOTE (known limitation): base64 crosses the JS↔native boundary as one string; very large exports
     *  (long bounces) can exceed the renderer-process transaction size. For those, chunk the transfer.
     */
    private fun injectBridge(view: WebView) {
        val js = """
        (function(){
          if (window.__fx404BridgeInstalled) return;
          window.__fx404BridgeInstalled = true;

          var blobMap = new Map();
          var origCreate = URL.createObjectURL;
          URL.createObjectURL = function(obj){
            var url = origCreate.call(URL, obj);
            try { if (obj instanceof Blob) blobMap.set(url, obj); } catch(e){}
            return url;
          };
          var origRevoke = URL.revokeObjectURL;
          URL.revokeObjectURL = function(url){ try { blobMap.delete(url); } catch(e){} return origRevoke.call(URL, url); };

          // Intercept anchor downloads whether or not the <a> is attached to the DOM.
          var origClick = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function(){
            try {
              var href = this.getAttribute('href') || '';
              if (this.hasAttribute('download') && blobMap.has(href)) {
                var blob = blobMap.get(href);
                var name = this.getAttribute('download') || 'export';
                var reader = new FileReader();
                reader.onload = function(){
                  try { AndroidDownloader.saveFile(name, blob.type || 'application/octet-stream', String(reader.result)); } catch(e){}
                };
                reader.readAsDataURL(blob);
                return;
              }
            } catch(e){}
            return origClick.apply(this, arguments);
          };

          window.__fx404Back = function(){
            try {
              var ids = ['pianoOverlay','exportOverlay','rowToolsOverlay','mfxOverlay','groupsOverlay',
                         'utilOverlay','sampleEditOverlay','editOverlay','chainOverlay','introOverlay'];
              for (var i=0;i<ids.length;i++){
                var el = document.getElementById(ids[i]);
                if (el && el.classList.contains('show')) {
                  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
                  return true;
                }
              }
              var unit = document.getElementById('unit');
              if (unit && unit.classList.contains('rear-active')) {
                document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
                return true;
              }
            } catch(e){}
            return false;
          };
        })();
        """.trimIndent()
        view.evaluateJavascript(js, null)
    }

    /** Bridge exposed to the page as `AndroidDownloader`. */
    inner class DownloadBridge {
        @JavascriptInterface
        fun saveFile(name: String, mime: String, dataUrl: String) {
            val comma = dataUrl.indexOf(',')
            val b64 = if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl
            val bytes = try { Base64.decode(b64, Base64.DEFAULT) } catch (e: Exception) { return }
            // Defensive normalisation of the JS-supplied strings before they reach the system file picker:
            // strip any path separators from the suggested filename, and only honour a well-formed MIME type.
            val safeName = name.replace('/', '_').replace('\\', '_').ifBlank { "export" }
            val safeMime = if (mime.matches(Regex("^[\\w.+-]+/[\\w.+-]+$"))) mime else "application/octet-stream"
            runOnUiThread {
                pendingBytes = bytes
                pendingMime = safeMime
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = pendingMime
                    putExtra(Intent.EXTRA_TITLE, safeName)
                }
                try {
                    saveDocLauncher.launch(intent)
                } catch (e: Exception) {
                    pendingBytes = null
                    Toast.makeText(this@MainActivity, "No hay app para guardar archivos", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
