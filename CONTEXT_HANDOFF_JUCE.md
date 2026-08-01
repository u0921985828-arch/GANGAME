# Handoff — arranque del sampler nativo JUCE (leer esto primero en la nueva conversación)

> Propósito: retomar en una conversación NUEVA, ordenada, el salto de FX-404 (WebView) a un sampler
> **nativo C++/JUCE**. Todo lo necesario para empezar por **P0** está aquí. Diseño completo en
> `ARTiFACTS_JUCE_ARCHITECTURE_v1.md` (mismo repo).

## 1. Estado actual (de dónde venimos)
- **FX-404** = sampler SP-404 de un solo fichero HTML/JS en un WebView Android, APK firmado. Fuente:
  `ARTiFACTSFX404_v225.html` (última). Build: `tools/obfuscate-build.mjs` → `android/app/src/main/assets/index.html`;
  CI `.github/workflows/build-release.yml` firma y publica el APK en el release tag `apk-latest`.
- Rama de trabajo: `claude/new-session-q3zb92`. Última versión entregada: **APK 2.57 / versionCode 158**.
- Firma (continuidad de instalación): cert SHA-256 `c171817b0130a1519272080299c6d333b87af32a746e727ad609f31073f6780a`.
- Ya lleva un **andamiaje de audio nativo Oboe** dentro del APK WebView (`android/app/src/main/cpp/native_audio.cpp`,
  `NativeAudioBridge.kt`, puente JS `NativeAudio`), pero SOLO como test de latencia (un click); no reproduce
  samples. Esa vía híbrida queda **congelada** a favor del producto nativo JUCE.

## 2. Decisión tomada
Reescribir el producto en **JUCE nativo** (UI + DSP en C++), reusando el diseño/layout de FX-404 como
especificación. Objetivo: batir a Koala en latencia/DSP/mic y ser multiplataforma. El WebView **sigue vivo y
enviándose en paralelo** como beta; NO se toca al empezar JUCE.

## 3. Datos duros medidos (Stage 0, OboeTester en el Redmi Note 13 Pro+ — no re-medir)
- Altavoz interno: LOW_LATENCY/MMAP concedido, pero salida **~47–62 ms** (muro del smart-amp de HyperOS),
  independiente del buffer (256/512/768 igual).
- **Cable/USB: ~12–25 ms.** → el nativo SOLO gana de verdad por cable/línea. Suelo de toque del WebView
  ~10–25 ms se suma aparte (por eso el WebView topa ~55–70 ms sentidos).

## 4. Camino "alisado" para P0 (acordado — menos problemas)
1. **Repo GitHub NUEVO**, aparte del WebView (no mezclar dos build systems).
2. **JUCE por CMake + FetchContent** (versión fijada), no Projucer.
3. **Desktop-first**: compila en el portátil en minutos (verifica el código), LUEGO export/build Android en
   Android Studio del usuario para medir latencia real en el Redmi por cable.
4. Target **standalone** (plugin VST/AU más tarde).
5. Este entorno cloud NO compila JUCE-Android → P0 se entrega/edita como proyecto en el repo nuevo; el
   build/medición los hace el usuario en su equipo.

## 5. Decisiones pendientes (resolver antes de P1; NO bloquean P0 en modo prueba GPL)
- **Licencia JUCE**: GPLv3 (app open-source) vs comercial (de pago).
- **Package/identidad**: `com.artifacts.fx404` (continuidad) vs applicationId nuevo.

## 6. P0 — alcance (primer entregable, es una PUERTA)
Proyecto JUCE mínimo: 1–2 pads (UI básica), importar 1 sample a `AudioBuffer<float>`, `Voice` con **phase
accumulator fraccional** (Δφ=(F_src/F_sys)·2^(S/12)) + **interpolación Hermite 4p**, disparo por **FIFO
lock-free** (`juce::AbstractFifo`) UI→audio, `processBlock` **sin alloc/lock**, salida por Oboe/AAudio.
Ficheros: `CMakeLists.txt`, `Source/Main.cpp`, `MainComponent`, `AudioEngine`, `Voice.h`, `README`
(pasos desktop + export Android).
**GATE:** medir toque→sonido en el Redmi por cable (OboeTester/loopback + oído). ¿"Koala-tight" ~10–25 ms?
Sí → P1. No → revisar antes de escalar.

## 7. Reuso de FX-404 (no se tira el know-how)
Diseño/UX y layout como spec de UI; formato de proyecto `.fx404` → importador/migrador; recetas/coeficientes
de los 6 FX ya afinados (FILTER+DRIVE, RESONATOR, DELAY, ISOLATOR, DJFX LOOPER, MFX+reverb); textos/tour.
Se reescribe TODO el runtime. Roadmap P1–P4 en el doc de arquitectura.

## 8. Cómo arrancar la conversación nueva
Pídelo así: *"Crea el esqueleto P0 del sampler JUCE según CONTEXT_HANDOFF_JUCE.md y ARTiFACTS_JUCE_ARCHITECTURE_v1.md,
en un repo nuevo, CMake+FetchContent, desktop-first."* Y ten a mano: decisión de **licencia JUCE** y **package**.
Recuerda que el build/medición Android los harás tú en Android Studio con el móvil por cable.
