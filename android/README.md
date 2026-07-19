# ARTiFACTS FX-404 — Android (WebView wrapper)

Native shell that packages the single-file web app (`app/src/main/assets/index.html`, a copy of
`ARTiFACTSFX404_v64.html`) as an installable Android app for Google Play. Fully offline.
Third-party license notices are bundled at `app/src/main/assets/THIRD_PARTY_LICENSES.md`.

## Build — abrir y darle a Run (no hay que crear ni tocar nada)
Este proyecto es **autocontenido**: incluye el Gradle Wrapper completo (`gradlew`, `gradlew.bat` y
`gradle/wrapper/gradle-wrapper.jar`), todos los módulos, recursos e iconos.

1. Abre la carpeta `android/` en **Android Studio** (Giraffe o posterior).
2. Android Studio detecta el SDK y **crea `local.properties` automáticamente** (un clic; ver nota abajo),
   sincroniza Gradle y descarga las dependencias.
3. Pulsa **Run ▶** para instalarlo en un móvil/emulador. O desde terminal:
   ```
   ./gradlew assembleDebug       # → app/build/outputs/apk/debug/app-debug.apk  (para probar)
   ./gradlew bundleRelease       # → app/build/outputs/bundle/release/app-release.aab  (subir a Play)
   ```
4. Para publicar: configura **Play App Signing** en la Play Console y firma la clave de subida.

> **Único fichero que NO viene incluido — y es correcto que así sea:** `local.properties` (contiene la ruta
> del Android SDK de TU ordenador, `sdk.dir=...`). Es específico de cada máquina; si viniera relleno con una
> ruta ajena, fallaría. **Android Studio lo genera solo** la primera vez que abres el proyecto — no hay que
> programar nada. (Todo lo demás sí viene relleno.)
>
> Nota: el APK/AAB no se compiló en este entorno (no hay Android SDK aquí). El wrapper se verificó: arranca y
> resuelve Gradle 8.7 correctamente. La compilación final la hace tu Android Studio.

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

## Generado por Android Studio (no incluido a propósito)
Solo `local.properties` (tu `sdk.dir`), y las carpetas de caché/salida `.gradle/` y `build/`. Android Studio
los crea/recrea solo. El **Gradle Wrapper sí está incluido** (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`).
