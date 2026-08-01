# ARTiFACTS — Sampler nativo (JUCE/C++) · Arquitectura v1 (documento de diseño, sin código)

> Objetivo: sampler/groovebox tipo SP-404 / Koala, latencia ~10–25 ms real, DSP de calidad, en Android
> (y portable a desktop). Reescritura nativa; NO evoluciona el WebView actual. Este doc es para decidir con
> los ojos abiertos antes de escribir una línea de C++.

## 0. Veredicto de entrada (honesto)
- Es la arquitectura correcta para competir con Koala (Koala es nativo). El WebView actual no llega ahí
  (AudioWorklet bloqueado, ~55 ms).
- Coste real: **reescritura total** (UI + DSP + secuenciador + export) en C++/JUCE. Meses. Repo nuevo, CI
  nuevo, licencia JUCE (GPL o de pago).
- Recomendación de secuencia: **P0 prototipo** (validar latencia/flujo en tu Redmi) → sólo si convence, P1+.
  Igual que hicimos con Stage 0 de Oboe: comprar certeza barata antes de comprometer meses.

## 1. Módulos (mapa)
```
App (juce::AudioProcessor + Editor)
├─ core/            Transport, TempoClock, Scheduler (sample-accurate)
├─ engine/
│  ├─ VoiceMatrix   64 voces pre-asignadas; asignación robin/robo por prioridad
│  ├─ Voice         phase accumulator + interpolación + envolvente + choke
│  ├─ SampleStore   RAM (Tier1) + streaming (Tier2); ownership por ref-count
│  └─ Mixer         buses ch1/ch2 → dry → FX → master → limiter
├─ dsp/             Filter, Drive(OS), Delay, Resonator, Isolator, DJFX, MFX(reverb), TimeStretch
├─ fx-chain/        orden reconfigurable (APVTS), idéntico live y en render offline
├─ io/
│  ├─ SampleImport  decode (WAV/AIFF/MP3/FLAC) en background → AudioBuffer
│  ├─ Recorder      captura de mic (RECORD_AUDIO) → buffer → nuevo slot
│  ├─ Streamer      BufferingAudioReader para stems largos
│  └─ ProjectIO     serialización .artifacts (ValueTree) + assets
├─ sequencer/       patterns, p-locks, piano-roll, song/playlist
└─ ui/              PadGrid, WaveDisplay(mipmap), Editors, Skins, VBlank playhead
```

## 2. Modelo de hilos (la clave de todo)
- **Audio thread** (`processBlock`): determinista. **0 alloc, 0 lock, 0 I/O, 0 std::string**. Sólo lee estado
  atómico y consume comandos de FIFOs. Escribe audio.
- **Message thread** (UI/JUCE): parámetros vía APVTS (atómicos); envía eventos a audio por **FIFO lock-free**
  (`AbstractFifo`): `NoteOn{voiceId,slot,pitch,vel,startFrame}`, `NoteOff`, `SetParam` (los que no van por
  APVTS), `LoadSlot{ptr}` (puntero ref-counted ya preparado en background), `Panic`.
- **Background workers** (`juce::ThreadPool`): decode de samples, cálculo de mipmaps RMS, precarga de attack
  para streaming, render offline (bounce). Nunca tocan el audio thread salvo publicar un `ReferenceCountedObjectPtr`
  que el audio thread adopta vía swap atómico.
- **Regla de oro:** el audio thread jamás libera memoria. Los buffers viejos se drenan a un FIFO "to-delete"
  que el message thread vacía (retención diferida vía ref-count = sin data race, sin free en RT).

## 3. Voces (custom, NO juce::Synthesiser)
- `std::array<Voice, 64>` asignado en `prepareToPlay`. Estado por voz POD (sin heap).
- Asignación: buscar libre; si no, robar la de menor prioridad/más antigua con **fade-out 1–2 ms**.
- **Choke groups:** al disparar una voz de un grupo, las demás del grupo entran en fade-out de **1 ms**
  (rampa lineal a 0, luego libre) → sin clic por zero-crossing. Muestra-preciso: el choke se aplica en el
  frame exacto del NoteOn dentro del bloque.
- Envolvente por voz: AHDSR simple con rampas por-muestra (o `SmoothedValue`), sin ramas caras en el loop.

## 4. DSP
- **Playback/pitch:** phase accumulator fraccional. Δφ = (F_src/F_sys)·2^(S/12). `pos += Δφ` por muestra;
  parte entera+fracción para interpolar. Reverse = Δφ negativo; loop/pingpong por wrap del índice.
- **Interpolación conmutable:** ZOH (aliasing vintage, SP-style) ↔ Hermite 4 puntos (moderno). Sinc opcional
  para pitch extremos (más CPU). Selección por-pad.
- **FX no-lineales (drive/bitcrush):** `juce::dsp::Oversampling` (2–4×) alrededor del waveshaper para subir
  Nyquist y evitar foldback; downsample con el filtro polyphase de JUCE. Bypass de OS si el FX es lineal.
- **Time-stretch:** dos motores — **STFT/phase-vocoder** (`juce::dsp::FFT`, fase acumulada por bin, alta
  fidelidad) para BPM-sync limpio, y **WSOLA** (solape por correlación) para el grano/artefacto hardware.
  Se computa **offline** (en background, al fijar BPM) y la voz reproduce el buffer resultante → 0 coste RT.
- **SIMD:** loops de mezcla/ganancia/pan con `juce::FloatVectorOperations`; biquads y delays vectorizables.
- **Máster:** limiter con lookahead corto (aquí sí, en nativo, sin la limitación del worklet).

## 5. Estado y UI desacoplada
- **APVTS** como única fuente de verdad de parámetros (knobs, FX, mezcla) → sincronización atómica y
  undo/serialización gratis. Eventos musicales (notas) van por FIFO, no por APVTS.
- **Waveform:** mipmaps min/max RMS multi-resolución precomputados en background; se rasteriza con `juce::Path`
  al zoom pedido. `processBlock` nunca toca gráficos.
- **Playhead:** `juce::VBlankAttachment` (sincronizado al refresco del panel, 120 Hz en tu Redmi) en vez de
  Timer → cursor fluido sin tearing.

## 6. Memoria por tiers
- **Tier 1 (RAM):** one-shots y loops cortos enteros en `AudioBuffer<float>` (ref-counted).
- **Tier 2 (disco):** stems largos → precargar el **attack (~100 ms)** en RAM para disparo instantáneo; el
  resto lo sirve un `BufferingAudioReader` desde un hilo. Cross-fade RAM→stream transparente. Presupuesto de
  RAM configurable; LRU para descargar slots no usados.

## 7. Sampling / mic (lo que hoy NO tenemos)
- Requiere permiso **RECORD_AUDIO** (runtime) + declararlo en Data Safety de Play. Es el núcleo de un sampler
  real (resample de cualquier fuente).
- Ruta: input Oboe → ring buffer → al parar, decode/normalize en background → nuevo slot. Monitorización
  opcional con aviso de latencia. Auto-trim por umbral. (En JUCE Android, entrada por Oboe/AAudio igual que
  la salida.)

## 8. Build / plataforma / legal
- **JUCE + CMake** (no Projucer para CI). Android: toolchain NDK, salida `.so` + APK/AAB. Oboe como backend de
  audio de JUCE en Android (baja latencia real). Alinear a **16 KB** (Play).
- **Licencia JUCE:** GPLv3 (open-source) o comercial. Decisión de negocio antes de empezar.
- **CI nuevo:** Android Studio/CMake build + firma (reusar la clave `c171817…` para continuidad de instalación
  si se publica bajo el mismo package, o package nuevo). El CI WebView actual no sirve.
- **Permisos:** pasa de "cero peligrosos" a pedir RECORD_AUDIO → nueva revisión de privacidad.

## 9. Qué se REUSA de FX-404 (no todo se tira)
- **Diseño/UX y decisiones**: layout de pads, flujo CHOP, piano roll, song mode, skins, textos, tour — todo
  el know-how de producto se porta como especificación de UI.
- **Formato de datos**: los AudioBuffers y la estructura de proyecto `.fx404` sirven de base para el importador
  y el `.artifacts` (ValueTree). Migrador opcional .fx404 → nativo.
- **Recetas de FX**: los 6 FX ya están afinados en JS; sus coeficientes/topología guían el port a `juce::dsp`.
- Lo que se **reescribe**: absolutamente todo el runtime (UI JUCE + DSP C++ + scheduler).

## 10. Riesgos
- Esfuerzo (meses) y superficie de bugs de C++ RT (data races, priority inversion, denormals → usar FTZ/DAZ).
- Mantener paridad de sonido con lo que el usuario ya conoce.
- Fragmentación Android (HAL de audio variable; ya vimos el muro de ~47 ms del altavoz — el nativo brilla por
  cable/línea, en altavoz el suelo de hardware sigue).
- Licencia/negocio JUCE.

## 11. Roadmap por fases (cada una decide la siguiente)
- **P0 — Prototipo (1–2 sem):** proyecto JUCE Android mínimo; 1–2 pads; import de 1 sample; Voice (phase acc +
  Hermite); salida Oboe; medir latencia real toque→sonido en tu Redmi por cable. Gate: ¿se siente Koala-tight?
- **P1 — Núcleo:** VoiceMatrix 64 + choke + envolventes + SampleStore Tier1 + mezcla/máster + APVTS. Grabación
  de mic. PadGrid + WaveDisplay mipmap + VBlank.
- **P2 — DSP:** los 6 FX con Oversampling donde toque; time-stretch STFT+WSOLA; interpolación conmutable.
- **P3 — Secuenciador/song:** patterns, p-locks, piano roll, playlist; export offline (render == live).
- **P4 — Tier2 streaming, pulido, skins, tienda:** Data Safety, ficha Play, QA, beta.

## 12. Decisión pendiente (cuando quieras pasar de diseño a código)
1) ¿GPL o licencia comercial de JUCE? 2) ¿package nuevo o continuidad del actual? 3) ¿arrancamos por P0
(prototipo de latencia) — recomendado — o directo a P1?
