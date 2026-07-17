# ARTiFACTS FX-404 — Android (WebView wrapper)

Native shell that packages the single-file web app (`app/src/main/assets/index.html`, a copy of
`ARTiFACTSFX404_v51.html`) as an installable Android app for Google Play. Fully offline.

## Build
1. Open the `android/` folder in **Android Studio** (Giraffe or newer).
2. Android Studio will sync Gradle and generate the Gradle wrapper JAR automatically. (From a terminal
   with a system Gradle you can instead run `gradle wrapper` once, then `./gradlew`.)
3. Run on a device/emulator, or build the release bundle:
   ```
   ./gradlew bundleRelease      # → app/build/outputs/bundle/release/app-release.aab  (upload to Play)
   ```
4. Configure **Play App Signing** in the Play Console (recommended) and sign the upload key.

> The build was authored but **not compiled in this environment** (no Android SDK here). Open it in
> Android Studio to build; the Kotlin/XML is idiomatic and self-contained.

## What it does
- Serves the HTML from `assets/` via **`WebViewAssetLoader`** at a secure origin
  (`https://appassets.androidhost/…`) so IndexedDB/localStorage/secure-context APIs work.
- **Zero dangerous permissions** (see `AndroidManifest.xml`): import via the WebView file chooser (SAF),
  export via `ACTION_CREATE_DOCUMENT` (SAF — the user picks where to save), recording uses the app's
  internal audio bus (not the mic).
- **High refresh rate:** `MainActivity.applyHighRefreshRate()` asks the window for the device's highest
  mode at the current resolution (otherwise the WebView is often pinned to 60Hz).
- **Back button** closes the topmost overlay / rear panel before exiting (`window.__fx404Back`).
- **Android 12 splash** (`Theme.App.Starting`) chains into the in-app HTML splash (same `#0A0A0B`).

## Updating the bundled app
Replace `app/src/main/assets/index.html` with the newest delivered `ARTiFACTSFX404_vN.html`, bump
`versionCode`/`versionName` in `app/build.gradle.kts`, rebuild.

## Known limitation
Blob exports cross the JS↔native boundary as base64 in one call; very large exports (long bounces) can
exceed the renderer transaction size. If you hit that, chunk the transfer in `injectBridge()` /
`DownloadBridge.saveFile()`. Typical samples/loops/patterns are well within limits.

## Not committed
`local.properties` (your `sdk.dir`), `.gradle/`, `build/`, and the generated `gradle-wrapper.jar` —
Android Studio recreates these.
