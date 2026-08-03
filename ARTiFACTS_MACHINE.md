# ARTiFACTS FX-404 — La máquina y sus botones (desglose)

> Todos los controles físicos/UI del chasis (fuera de los pop-ups): qué es cada botón/knob, qué hace y su
> comportamiento (momentáneo / toggle / con SHIFT). Fuente: `ARTiFACTSFX404_v230.html` (`.unit#unit`).
> El chasis es un bloque rígido de 940px escalado a pantalla; 4 tornillos decorativos en las esquinas.

---

## 1. Cabecera
- **Logo** `ART·i·FACTS` (serigrafía; la "i" en acento).
- **Modelo** `FX-404 · SAMPLER`.
- **⚙ UTILITY** (`btnSettings`) — abre AJUSTES (Proyecto / Audio / Pads / Chasis).

## 2. Fila de knobs (`knobrow`)
Knobs de 100px con aguja dibujada por JS (arrastre vertical).
- **VOLUME** (`kVolume`) — volumen máster (MIN→MAX).
- **CTRL 1 / CTRL 2 / CTRL 3** (`kCutoff`/`kReso`/`kDrive`) — **contextuales**: controlan los parámetros del
  FX activo (por defecto Cutoff / Resonance / Drive). La etiqueta y el sub-texto cambian según el efecto
  seleccionado (`ctrlLbl1-3` / `ctrlSub1-3`).

## 3. Pantalla central (`screenblock`)
- **JOGWHEEL** (`jogwheel`) — rueda de desplazamiento/zoom (encoder visual).
- **LCD** (`lcd`):
  - Línea superior: **C1 / C2 / C3** = valores en vivo de los tres CTRL.
  - **Forma de onda** (`lcd-wave`) + **pasos** (`lcd-steps`).
  - Línea inferior: **ENC** (función del encoder, p. ej. ZOOM 1x), **BANK** (banco·pad, p. ej. A-1),
    **MODE** (estado: MENU/…).
- **ZOOM RESET / ENTER** (`pushEnter`) — restablece el zoom a 1x y confirma la opción del menú.

## 4. Efectos (6 botones `fxbtn`) — toggles
Columna izquierda: **FILTER+DRIVE** (`fxFilterDrive`), **RESONATOR** (`fxResonator`), **DELAY** (`fxDelay`).
Columna derecha: **ISOLATOR** (`fxIsolator`), **DJFX LOOPER** (`fxDjfx`), **MFX** (`fxMfx`, abre MFX TYPE).
Activar un FX enruta los CTRL 1–3 a sus parámetros. El orden de la cadena se reordena en Ajustes → Audio.

## 5. PATTERN SEQUENCER (`subrow` izq.)
- **PLAY / STOP** (`btnPatSelect`) — inicia/detiene el patrón.
- **PATTERN EDIT** (`btnPatEdit`) — abre el secuenciador de pasos.
- **PATTERN CHAIN** (`btnRecSet`) — abre la PLAYLIST (song mode).
- **UNDO ↶ / REDO ↷** (`histUndo`/`histRedo`) — deshacer/rehacer del arreglo (Ctrl+Z / Ctrl+Y).

## 6. SAMPLE EDIT (`subrow` der.)
- **PAD SETTINGS** (`btnStartEnd`) — editor del pad tocado (recorte START/END, pitch, envolvente, loop).
- **PIANO ROLL** (`btnPitchSpeed`) — editor de melodía por pasos del pad.
- **CHOP** (`btnMark`) — abre SAMPLE CHOP (trocea el sample y reparte cortes por los pads).

## 7. SAMPLING (`samplingrow`)
- **DEL** (`btnDel`) — borra el sample del pad.
- **REC** (`btnRec`) — graba. **SHIFT+REC** alterna **QUANTIZE** (borde de acento = activo).
- **RESMPL** (`btnResample`) — resamplea (captura la salida a un nuevo sample).

## 8. SAMPLE MODE (`samplingrow` der.) — modo de reproducción del pad
- **BPM SYNC** (`modeBpmSync`) — estira el sample al tempo.
- **GATE** (`modeGate`) — suena mientras se mantiene.
- **LOOP** (`modeLoop`) — bucle.
- **REVERSE** (`modeReverse`) — reproducción invertida (actúa también como modificador al mantener).
- **ROLL** (`modeRoll`) — redisparo/roll.

## 9. PAD TOOLS (`bankrow` izq.)
- **STOP / PÁNICO** (`btnExit`) — un toque silencia todo (transporte, voces, rolls); **doble pulsación** o
  **Ctrl+.** = PÁNICO (además apaga los efectos y suelta HOLD).
- **COPY · CURRENT PAD** (`btnCopy`) — copia el pad actual (para pegar en otro).
- **REMAIN** (`btnRemain`) — mantener 3s / Shift+Enter → **LIVE MODE** (oculta filas para directo).

## 10. BANK (`bankrow` der.)
- **5 botones de banco** dobles: **A/F, B/G, C/H, D/I, E/J** → 10 bancos (la cara activa se togglea).
- **SHIFT** (`btnShift`) — capa alternativa de funciones (p. ej. SHIFT+7 = grupo LINK, SHIFT+8 = grupo MUTE).
- **DJ MODE** (`djModeBtn`) — modo DJ (pausa/reanudación tipo scratch/transport por pad).

## 11. Pads y columna lateral (`padSection`)
- **16 pads** en rejilla 4×4 (número Oswald 50px + nombre del sample). Tap = dispara; el **SAMPLE MODE** y los
  ajustes del pad rigen la reproducción; **HOLD** enclava; **REVERSE** invierte.
  Estados visibles: golpeado (`.hit`), silenciado (`.muted`), enclavado (`.held`).
- **Columna lateral** (4 botones, uno por fila): **MUTE BUS · CH2**, **HOLD** (latch), **EXT SOURCE · INPUT
  SETTING** (atenuado — sin micrófono en esta versión), **PROJECT · INFO**.
- **CH1 / CH2** (`chlabel`) — los dos canales/buses de la máquina.

## 12. Entradas/salidas (`iorow`) — serigrafía
- **PHONES** — auriculares.
- **GAIN** (`kGain`, miniknob) — nivel de la entrada externa; **inactivo** (la app no pide permiso de micro).
- **MIC / GUITAR** — entrada externa (deshabilitada).
- **INPUT** + LED (`extLed`) — estado de la entrada externa (apagado por defecto).

---

## Notas
- **Momentáneos** (disparo puntual): PLAY/STOP, PATTERN EDIT/CHAIN, PAD SETTINGS/PIANO ROLL/CHOP, DEL, REC,
  RESMPL, STOP, COPY, UNDO/REDO, ZOOM RESET, ⚙ UTILITY.
- **Toggles / de estado**: los 6 FX, SAMPLE MODE (GATE/LOOP/REVERSE/ROLL/BPM SYNC), HOLD, MUTE BUS, DJ MODE,
  QUANTIZE (vía SHIFT+REC), bancos.
- **Contextuales**: CTRL 1–3 (siguen al FX activo).
- La entrada de audio externa (MIC/GUITAR/INPUT/GAIN) está **deshabilitada a propósito** (cero permisos
  peligrosos para Google Play). Se reactivará, si procede, en la versión nativa.
