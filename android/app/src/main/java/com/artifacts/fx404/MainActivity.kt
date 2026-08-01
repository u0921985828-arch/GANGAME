package com.artifacts.fx404

import android.content.Intent
import android.content.pm.ActivityInfo
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
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewFeature

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

    // Chunked-save reassembly state (see DownloadBridge.beginFile/appendBase64/endFile).
    private var chunkBuffer: java.io.ByteArrayOutputStream? = null
    private var chunkName: String = "export"
    private var chunkMime: String = "application/octet-stream"

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var saveDocLauncher: ActivityResultLauncher<Intent>
    private lateinit var openProjectLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()               // Android-12 splash (back-compat), before super/setContentView
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)  // edge-to-edge; the web app uses viewport-fit=cover

        registerLaunchers()

        webView = WebView(this)
        // v2.52 — el fondo por defecto del WebView es BLANCO hasta que la página oscura pinta → destello
        // blanco al arrancar. Se fija a negro (= theme-color/#0a0a0b del web app) para que no haya flash.
        webView.setBackgroundColor(0xFF0A0A0B.toInt())
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
        webView.addJavascriptInterface(NativeAudioJs(), "NativeAudio")

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
            // Safe Browsing OFF (refuerzo del meta-data del manifest): app offline, no navega a URLs
            // remotas → la comprobación de Safe Browsing no aporta y añade coste de init. API 26+.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                @Suppress("DEPRECATION")
                safeBrowsingEnabled = false
            }
            // v2.52 — offscreenPreRaster: rasteriza fuera de pantalla la zona contigua al viewport, así al
            // escalar/scrollear los tiles ya están listos y no aparece el patrón de "ajedrez"/parches en
            // blanco. Coste: ~1 pantalla extra de tiles en memoria; asumible para un WebView único a
            // pantalla completa con UI casi estática. API 23+ (minSdk 24). La ganancia de render segura.
            offscreenPreRaster = true
        }
        // v2.52 — Oscurecido algorítmico OFF: la app tiene su PROPIO tema oscuro. Si el sistema está en
        // modo oscuro, WebView podría intentar invertir colores (analiza+repinta+puede romper el chasis).
        // Le decimos "yo controlo el tema, no toques". API 33+ = algorithmic-darkening; 29-32 = force-dark.
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(wv.settings, false)
            } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                @Suppress("DEPRECATION")
                WebSettingsCompat.setForceDark(wv.settings, WebSettingsCompat.FORCE_DARK_OFF)
            }
        } catch (e: Exception) { /* best-effort: si la versión de WebView no lo soporta, el tema propio del HTML manda igualmente */ }
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

        // PROJECT LOAD: read the picked .fx404 and stream its bytes to the web app in base64 chunks
        // (begin → chunk* → end), symmetric to the chunked save. Reading + encoding runs off the UI
        // thread; each evaluateJavascript call is posted back to the UI thread in order.
        openProjectLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val uri = if (result.resultCode == RESULT_OK) result.data?.data else null
            if (uri == null) { webView.evaluateJavascript("window.__fx404RecvProjectCancel&&window.__fx404RecvProjectCancel()", null); return@registerForActivityResult }
            Thread {
                try {
                    val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
                    runOnUiThread { webView.evaluateJavascript("window.__fx404RecvProjectBegin&&window.__fx404RecvProjectBegin()", null) }
                    val chunk = 384 * 1024
                    var i = 0
                    while (i < bytes.size) {
                        val end = minOf(i + chunk, bytes.size)
                        val b64 = Base64.encodeToString(bytes.copyOfRange(i, end), Base64.NO_WRAP) // NO_WRAP → no newlines to break the JS string literal
                        runOnUiThread { webView.evaluateJavascript("window.__fx404RecvProjectChunk&&window.__fx404RecvProjectChunk('$b64')", null) }
                        i = end
                    }
                    runOnUiThread { webView.evaluateJavascript("window.__fx404RecvProjectEnd&&window.__fx404RecvProjectEnd()", null) }
                } catch (e: Exception) {
                    runOnUiThread { webView.evaluateJavascript("window.__fx404RecvProjectCancel&&window.__fx404RecvProjectCancel()", null) }
                }
            }.start()
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
                         'utilOverlay','settingsOverlay','sampleEditOverlay','editOverlay','chainOverlay','introOverlay'];
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

    /**
     * Bridge exposed to the page as `NativeAudio` — the JS side of the low-latency Oboe engine.
     * Every method degrades safely when the native lib is unavailable (older WebView build, load
     * failure): the page checks `available()` and falls back to its Web Audio engine.
     * Stage 1 scaffold: `start()` opens a silent low-latency stream and `info()` reports its real
     * latency, so the page can show the low-latency indicator and validate the chain on-device.
     */
    inner class NativeAudioJs {
        @JavascriptInterface
        fun available(): Boolean = NativeAudioBridge.ensureLoaded()

        @JavascriptInterface
        fun start(): Int =
            if (NativeAudioBridge.ensureLoaded()) NativeAudioBridge.nativeStart() else -999

        @JavascriptInterface
        fun stop() {
            if (NativeAudioBridge.ensureLoaded()) NativeAudioBridge.nativeStop()
        }

        @JavascriptInterface
        fun setBufferFrames(frames: Int) {
            if (NativeAudioBridge.ensureLoaded()) NativeAudioBridge.nativeSetBufferFrames(frames)
        }

        @JavascriptInterface
        fun noteClick() {
            if (NativeAudioBridge.ensureLoaded()) NativeAudioBridge.nativeNoteClick()
        }

        // Lock/unlock screen orientation from the web app (the "editores en horizontal" option). The
        // Activity already declares configChanges=orientation|screenSize… so this rotates WITHOUT
        // recreating the WebView. Runs on the UI thread (JS-bridge calls arrive off it).
        @JavascriptInterface
        fun setOrientation(mode: String) {
            this@MainActivity.runOnUiThread {
                this@MainActivity.requestedOrientation = when (mode) {
                    "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    "portrait"  -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    else         -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                }
            }
        }

        @JavascriptInterface
        fun info(): String =
            if (NativeAudioBridge.ensureLoaded()) NativeAudioBridge.nativeInfo()
            else "{\"open\":false,\"available\":false}"
    }

    /** Bridge exposed to the page as `AndroidDownloader`. */
    inner class DownloadBridge {
        // --- CHUNKED transfer (beginFile → appendBase64* → endFile) ---------------------------
        // A whole project/export (several MB of sample audio) passed as ONE @JavascriptInterface
        // string overruns the renderer transaction and hangs the WebView (ANR). The web app now
        // streams the file in ~256KB base64 pieces which we reassemble here, then open the SAF
        // picker once. @JavascriptInterface methods arrive on the JavaBridge thread and the web
        // app issues them strictly in order, so appending to a single buffer is safe.
        @JavascriptInterface
        fun beginFile(name: String, mime: String) {
            chunkBuffer = java.io.ByteArrayOutputStream()
            chunkName = name.replace('/', '_').replace('\\', '_').ifBlank { "export" }
            chunkMime = if (mime.matches(Regex("^[\\w.+-]+/[\\w.+-]+$"))) mime else "application/octet-stream"
        }

        @JavascriptInterface
        fun appendBase64(chunk: String) {
            val buf = chunkBuffer ?: return
            try { buf.write(Base64.decode(chunk, Base64.DEFAULT)) }
            catch (e: Exception) { chunkBuffer = null }   // abort the whole transfer on a bad chunk
        }

        @JavascriptInterface
        fun endFile() {
            val buf = chunkBuffer ?: return
            chunkBuffer = null
            launchSave(buf.toByteArray(), chunkName, chunkMime)
        }

        // Auto-save straight to a default, user-visible folder (Documents/FX-404) with NO picker —
        // used by PROJECT SAVE. Falls back to the SAF picker on any failure or on Android 9-, so a
        // save is never silently lost.
        @JavascriptInterface
        fun endFileToProjects() {
            val buf = chunkBuffer ?: return
            chunkBuffer = null
            val bytes = buf.toByteArray(); val name = chunkName; val mime = chunkMime
            if (!saveToDocumentsFX404(bytes, name, mime)) launchSave(bytes, name, mime)
        }

        // PROJECT LOAD: open the system file explorer STARTING at Documents/FX-404 (the default
        // projects folder), but the user can still browse anywhere (a downloaded/shared .fx404).
        @JavascriptInterface
        fun openProject() {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"                       // .fx404 has no registered MIME → don't filter it out
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        try {
                            val initial = android.provider.DocumentsContract.buildDocumentUri(
                                "com.android.externalstorage.documents",
                                "primary:" + android.os.Environment.DIRECTORY_DOCUMENTS + "/FX-404"
                            )
                            putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI, initial) // a hint; most file pickers honour it
                        } catch (e: Exception) { /* initial-folder hint is best-effort */ }
                    }
                }
                try { openProjectLauncher.launch(intent) }
                catch (e: Exception) { Toast.makeText(this@MainActivity, "No se pudo abrir el explorador", Toast.LENGTH_SHORT).show() }
            }
        }

        // --- Single-shot (kept for small files / older callers) -------------------------------
        @JavascriptInterface
        fun saveFile(name: String, mime: String, dataUrl: String) {
            val comma = dataUrl.indexOf(',')
            val b64 = if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl
            val bytes = try { Base64.decode(b64, Base64.DEFAULT) } catch (e: Exception) { return }
            val safeName = name.replace('/', '_').replace('\\', '_').ifBlank { "export" }
            val safeMime = if (mime.matches(Regex("^[\\w.+-]+/[\\w.+-]+$"))) mime else "application/octet-stream"
            launchSave(bytes, safeName, safeMime)
        }
    }

    /**
     * Write bytes to a fixed, user-visible folder (Documents/FX-404) via MediaStore — no picker,
     * no runtime permission (scoped storage, Android 10+/API 29). The folder is created on demand.
     * Returns false if it can't (older Android or any error) so the caller can fall back to SAF.
     */
    private fun saveToDocumentsFX404(bytes: ByteArray, safeNameIn: String, safeMime: String): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false   // pre-scoped-storage → let SAF handle it
        val safeName = safeNameIn.replace('/', '_').replace('\\', '_').ifBlank { "Proyecto FX-404.fx404" }
        return try {
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeName)
                put(android.provider.MediaStore.MediaColumns.MIME_TYPE, safeMime)
                put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOCUMENTS + "/FX-404")
                put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val collection = android.provider.MediaStore.Files.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri = contentResolver.insert(collection, values) ?: return false
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: run { contentResolver.delete(uri, null, null); return false }
            values.clear(); values.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0)
            contentResolver.update(uri, values, null, null)
            runOnUiThread { Toast.makeText(this@MainActivity, "Guardado en Documentos/FX-404", Toast.LENGTH_SHORT).show() }
            true
        } catch (e: Exception) { false }
    }

    /** Stash the bytes and open the system "Save as…" (SAF) picker. Shared by both transfer paths. */
    private fun launchSave(bytes: ByteArray, safeName: String, safeMime: String) {
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
