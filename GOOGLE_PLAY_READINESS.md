# Auditoría de preparación para Google Play — ARTiFACTS FX-404

App: sampler/groovebox estilo SP-404, **un solo fichero HTML autocontenido**
(`ARTiFACTSFX404_v54.html`). Este informe evalúa qué falta para publicarla en Google Play
como app Android, con severidades y un checklist accionable al final.

**Veredicto:** base excelente. La app ya es **100 % offline, sin red, sin permisos peligrosos y con
CSP estricta** — el trabajo pendiente es de *empaquetado* Android + activos de ficha, no de arreglar la
app. No hay bloqueantes técnicos de fondo.

---

## 1. Modelo de distribución — decisión de arquitectura

Dos vías válidas para llevar un web-app a Play:

| | WebView + `WebViewAssetLoader` **(recomendado)** | TWA / Bubblewrap |
|---|---|---|
| Hosting | **Ninguno** — el HTML va en `assets/` | Requiere servir el PWA en **HTTPS público** + Digital Asset Links |
| Origen | Seguro (`https://appassets.androidhost/…`) → habilita IndexedDB/localStorage/secure-context | El del dominio |
| Offline | Total (bundle) | Depende de service worker / caché |
| Encaje | **Ideal aquí** (la app es un fichero local sin red) | Solo si además quieres publicar el PWA en la web |

> **Recomendación:** WebView cargando el HTML desde `assets/` mediante `WebViewAssetLoader`.
> **No uses `file://`**: rompe el *secure context* y con él IndexedDB / localStorage (donde la app
> guarda los samples y el autosave). El asset-loader da un origen `https://` local que sí los habilita.

---

## 2. Requisitos técnicos de Play  (severidad: 🔴 bloqueante de publicación)

- **Formato:** Android App Bundle (**.aab**), no APK.
- **Firma:** **Play App Signing** (subes una *upload key*; Google gestiona la *signing key*).
- **Nivel de API objetivo:** `targetSdk`/`compileSdk` deben estar dentro de la ventana que exige Play
  (el proyecto ya apunta a **API 36 / Android 16**, la ventana vigente para apps nuevas y actualizaciones
  en 2026; **verifica el mínimo vigente** al publicar, Google lo sube cada año). `minSdk` sugerido
  **24 (Android 7)** — cubre WebView moderno y el `WebViewAssetLoader`.
- **64-bit:** cumplido automáticamente (no hay librerías nativas; todo es WebView).
- **Tamaño:** trivial (~930 KB de HTML) → sin problemas de límite.

## 3. Permisos  (severidad: 🟢 fortaleza — declarar el mínimo)

La app **no necesita ningún permiso peligroso**. Verificado en el código:

- **Grabación / RESAMPLE:** usa `MediaRecorder` sobre un **stream interno** (`recDest.stream` del
  AudioContext), **no el micrófono** → **NO declares `RECORD_AUDIO`**. (Declararlo sin usarlo es un
  motivo de rechazo y empeora el *data safety*.)
- **Importar audio:** `<input type=file>` → el WebView lo resuelve con `onShowFileChooser` (SAF) →
  **sin permiso de almacenamiento**.
- **Exportar (WAV/MP3/.fx404):** descargas *blob*; intercéptalas y escribe con **MediaStore →
  Downloads** (Android 10+, *scoped storage*) → **sin permiso**.
- **Red:** la app no hace `fetch`/XHR/WebSocket y sirve de `assets/` → **`INTERNET` innecesario**.
  Decláralo solo si una futura versión lo requiere.

> Resultado: manifiesto con **cero permisos peligrosos** → historia de privacidad inmejorable.

## 4. Data safety + política de privacidad  (severidad: 🔴 obligatorio en la ficha)

- **Formulario "Seguridad de los datos":** declara **no se recogen ni comparten datos**. Todo lo que
  crea el usuario (samples, patrones, proyectos, autosave) vive **local** en IndexedDB/localStorage del
  propio dispositivo; **nada sale del teléfono** (sin red, sin analítica, sin SDKs de terceros).
- **Política de privacidad (URL):** Play la exige aunque no recojas datos. Texto base suficiente:

  > *ARTiFACTS FX-404 no recopila, transmite ni comparte datos personales. Todo el contenido que creas
  > (samples, patrones y proyectos) se almacena únicamente en el almacenamiento local de tu dispositivo
  > y nunca se envía a ningún servidor. La app funciona completamente sin conexión. No se usan servicios
  > de analítica, publicidad ni de terceros. Contacto: eddierealting@gmail.com.*

  Publícalo en cualquier URL estable (una página, un Gist, GitHub Pages) y pégala en la ficha.

## 5. Clasificación de contenido (IARC)  (🟡 obligatorio, trivial)

Cuestionario IARC → previsible **"Para todos / Everyone"** (herramienta musical, sin contenido
sensible, sin compras, sin contenido generado compartido en línea).

## 6. Configuración del WebView  (severidad: 🟡 calidad — evita rechazos por UX)

- `settings.javaScriptEnabled = true`, `domStorageEnabled = true`.
- Cargar vía `WebViewAssetLoader` (origen seguro, ver §1).
- **Botón "Atrás" de Android:** intercéptalo (`onBackPressed`) → si hay un overlay/tour abierto,
  ciérralo (la app **ya tiene** esa lógica: `Escape` cierra el overlay superior y el panel trasero; se
  puede puentear el back a un `KeyboardEvent('Escape')` o a `closeTopmostOverlay()`); solo sal de la
  app cuando no quede nada abierto. Sin esto, Atrás cierra la app de golpe (mala nota de calidad).
- `setMediaPlaybackRequiresUserGesture(false)` **solo si** quieres audio sin gesto previo; la app ya
  reanuda el AudioContext con el primer toque, así que puede dejarse en el valor por defecto.
- `onShowFileChooser` implementado para que funcione el import de audio.
- Bloquea el zoom del sistema si molesta (`setSupportZoom(false)`) — la app ya gestiona su propio
  layout/zoom.

## 7. Splash nativo (Android 12+) + activos de ficha  (severidad: 🟡)

- **Splash del SO (SplashScreen API):** fondo `#0a0a0b` + icono monocromo. Así se encadena
  **splash del SO → pantalla de inicio HTML (ya incluida en v36) → app** sin saltos de color
  (la HTML usa el mismo `#0a0a0b`).
- **Icono de app:** **512×512** (32-bit PNG) para la ficha + **adaptive icon** (foreground/background)
  y **maskable** para el launcher. *(La app trae un icono 192×192 en el manifest; para el launcher
  Android el icono real vive en `res/mipmap-*`.)*
- **Feature graphic:** 1024×500.
- **Capturas:** ≥2 de teléfono (usa la app real: pads + PAD SETTINGS/piano roll quedan vistosos).
- **Textos:** descripción corta (≤80) y larga (es). La `<meta name="description">` de v36 sirve de base.

## 7-bis. Alta tasa de refresco (120Hz / ProMotion)  (severidad: 🟡 calidad — el WebView se pinea a 60Hz)

- **Lado web (ya resuelto):** el navegador/WebView renderiza `requestAnimationFrame` y las animaciones
  CSS **a la tasa del display** — en un panel 120Hz ya van a 120fps. **No hay ninguna API web para
  "forzar" 120fps** y la app **no tiene ningún cap** de framerate. Los movimientos de alta frecuencia
  (playhead, barra de progreso, jog, scrollbar, pads) usan `transform`/`opacity` (compositados en GPU);
  desde v38 también las animaciones "de respiración" (glow de pads en FX-active, LEDs) animan opacidad
  en vez de repintar `box-shadow` cada frame → **sostienen 120fps sin frames perdidos**.
- **Lado Android (pendiente en el wrapper):** por defecto muchos dispositivos **fijan el WebView a
  60Hz** aunque el panel sea de 120. Para desbloquear la tasa alta, la Activity debe pedirla:
  - `WindowManager.LayoutParams.preferredRefreshRate = <hz más alto>` **o**
    `preferredDisplayModeId = <modo de mayor Hz de `Display.getSupportedModes()`>` (elige el modo cuya
    resolución coincide con la actual y mayor `refreshRate`).
  - En **Android 11+**: `Surface.setFrameRate(hz, FRAME_RATE_COMPATIBILITY_DEFAULT)` sobre la surface
    del WebView (o `SurfaceControl.Transaction#setFrameRate`) para señalar la cadencia deseada.
  - Opcional: mantener la pantalla despierta durante uso activo (`FLAG_KEEP_SCREEN_ON`).
- **Verificación en dispositivo:** activar *Debug GPU overdraw / Show refresh rate* en Opciones de
  desarrollador, o `adb shell dumpsys SurfaceFlinger | grep refresh`, y confirmar que la app corre al
  modo alto mientras se anima.

## 8. Estado actual de la app (lo que YA está bien)

- ✅ **Offline total**, self-contained (fuentes y librerías JSZip/lamejs embebidas en `data:`).
- ✅ **CSP estricta same-origin** (`default-src 'self'` … `object-src 'none'`, sin orígenes remotos).
- ✅ **Sin red**: sin `fetch`/XHR/WebSocket/analítica/CDN.
- ✅ `viewport` con `viewport-fit=cover`, `theme-color #0a0a0b`, apple-mobile-web-app metas (modo standalone en iOS). El icono/nombre de la app Android vienen de `res/mipmap` + `strings.xml`, no de un web-manifest.
- ✅ **0 errores de consola**; accesibilidad de teclado/foco trabajada (overlays, panel trasero).
- ✅ **v36 añade**: `<meta name="description">`, `<meta name="application-name">`, icono del manifest
  marcado `purpose: "any maskable"`, y la **pantalla de inicio**.

## 9. Gaps que NO son de la app (se resuelven en el proyecto Android)

Ninguno requiere tocar el HTML: son parte del wrapper (Gradle, Manifest, `res/`, MainActivity,
firma, ficha). Ver checklist.

---

## Checklist accionable

**App (HTML) — hecho en v36**
- [x] Sin red / CSP estricta / offline
- [x] Sin permisos peligrosos (REC = stream interno, no micro)
- [x] `meta description` + `application-name`
- [x] Manifest `purpose: any maskable`
- [x] Pantalla de inicio (splash) en estilo del aparato

**Proyecto Android (wrapper) — CÓDIGO LISTO en `android/` (compilar en Android Studio)**
- [x] Módulo Gradle: `minSdk 24`, `targetSdk`/`compileSdk 36`, `applicationId com.artifacts.fx404`, `versionCode/Name`
- [x] `MainActivity` + `WebViewAssetLoader` (origen seguro) cargando el HTML de `assets/` (v59 embebido)
- [x] WebView: JS + DOM storage ON; `onShowFileChooser`; **back → cierra overlays antes de salir** (`__fx404Back`)
- [x] Descargas *blob* → **SAF `ACTION_CREATE_DOCUMENT`** (el usuario elige destino; sin permiso en ninguna API)
- [x] `AndroidManifest.xml` con **cero permisos** (ni `RECORD_AUDIO` ni almacenamiento)
- [x] SplashScreen API (fondo `#0A0A0B` + icono monocromo) — `Theme.App.Starting`
- [x] Opt-in de alta tasa de refresco (`preferredDisplayModeId`/`preferredRefreshRate`)
- [x] `res/mipmap` adaptive + maskable + monochrome; PNG legacy (API 24-25) en todas las densidades
- [ ] Generar el `gradle-wrapper.jar` (lo hace Android Studio al importar) y compilar el **.aab**

**Activos de ficha — GENERADOS en `store/`**
- [x] Icono **512×512** 32-bit (`store/icon_512.png`)
- [x] **Feature graphic** 1024×500 (`store/feature_graphic.png`)
- [x] Capturas de teléfono 1080×1920 (`store/screenshots/`)
- [x] Descripción corta/larga (es) — `store/LISTING_es.md`
- [x] **Política de privacidad** (es) lista para publicar — `store/PRIVACY_POLICY_es.md`

**Consola de Play — pasos que haces tú (con lo anterior ya preparado)**
- [ ] Build **.aab** + activar **Play App Signing**
- [ ] Formulario **Data safety** = "no se recogen datos"
- [ ] **Publicar** la política de privacidad (URL) y pegarla en la ficha
- [ ] **Clasificación IARC** (previsible "Para todos")
- [ ] Subir icono 512, feature graphic, capturas y textos a la ficha

---
*Empaquetado Android = siguiente paso (código para Android Studio; no compilable/verificable en este
entorno web). Nada de lo anterior exige cambiar la app: v36 ya está lista para bundle.*
