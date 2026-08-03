# ARTiFACTS FX-404 — Desglose de pop-ups (funcionamiento y descripción)

> Todos los overlays/pop-ups de la app, para qué sirven, cómo se abren y sus controles. Referencia de
> producto (y spec para el rewrite JUCE). Fuente: `ARTiFACTSFX404_v230.html`. Los overlays cuelgan de
> `<body>` (fuera de `.unit`) y se muestran con la clase `.show`; comparten chrome (bisel 2px + sombra +
> scanline) y toman los tokens `--popup-*` del skin activo.

---

## Editores principales

### PATTERN EDIT — `editOverlay` ("PATTERN EDIT · BANCO X")
Secuenciador de pasos por patrón/banco. Rejilla: filas = los 16 pads, columnas = pasos.
- **Rejilla**: toca una celda para poner el golpe; el tap cicla la velocidad; mantén pulsado para borrar.
- **Cabecera**: transporte (play/stop) + navegación de patrón; **STEPS/BEAT** (subdivisión 1/8–1/64 con
  tresillos); **SWING**; **STEP SHIFT**; **HUMANIZE**; **P-LOCK** (abre bloqueos por paso); **VISTA**
  (SEGUIR/FIJO = auto-scroll del cursor de reproducción).
- Long-press en el nombre de una fila → **ROW TOOLS**. Barra de scroll horizontal.

### PIANO ROLL — `pianoOverlay` ("PAD n")
Editor melódico de un pad: cada fila = un semitono (rango C0–C10, ▲/▼ octava), cada columna = un paso.
- Toca para añadir notas; varias en el mismo paso = **acorde**. El tono se aplica a los samples cargados.
- Modos **CELDAS** (una nota/celda) y **BARRA** (arrastra la longitud); **LONGITUD** (iguala duraciones);
  herramientas **GOMA/TIJERAS**; transporte, STEPS/BEAT, SWING, HUMANIZE, VISTA.
- Barras de scroll H y V (indicador de posición).

### PLAYLIST (song mode) — `chainOverlay` ("PLAYLIST")
Arreglo/canción por bloques.
- Elige un patrón en el desplegable y tócalo sobre una pista (**TRACK 1–10**) para colocarlo; toca un bloque
  para cambiar su duración, mantenlo pulsado para borrarlo. ✎ renombra el patrón elegido.
- **EXPORT** (arriba) renderiza todo el arreglo (abre EXPORT FORMAT). Reloj de tiempo + scroll.

### PAD SETTINGS / SAMPLE CHOP — `sampleEditOverlay` (un overlay, dos modos)
- **PAD SETTINGS**: editor del sample del pad — recorte **START/END** sobre la onda, **PITCH**, envolvente
  **ATK/REL**, punto de **loop (MARK)**, **GAIN**, interruptor **CINTA/TONO** (modo de pitch) y **ruteo**
  (POR FX / DIRECTO). Zoom de onda con su barra.
- **SAMPLE CHOP (AUTO-CHOP)**: trocea el sample — toca la onda para añadir un corte, mantén para borrarlo;
  **AUTO-CHOP** por transientes; **CHOP→PADS** reparte los cortes por los pads.

---

## Utilidad y ajustes

### UTILITY / AJUSTES — `settingsOverlay` ("UTILITY") · 4 pestañas
- **Proyecto**: nombre del archivo `.fx404`, proyectos recientes.
- **Audio**: Sample rate (motor de audio/exportación), Calidad MP3 (kbps), Dinámica del máster
  (Classic/ARTiFACTS), **Cadena de FX** (reordenar los 6 procesadores), **Diagnóstico** (latencia de salida,
  motor kHz, **Audio nativo Oboe** con botón **TEST**, dispositivos MIDI y envío MIDI OUT).
- **Pads**: Grupos de pads, **Editores en horizontal** (toggle: rota los editores por CSS al girar el móvil).
- **Chasis**: skin (ivory/ghost/midnight/arctic) y modo de rendimiento (Calidad / Fluido / PLANO…).

### EXPORT FORMAT — `exportOverlay` ("EXPORT FORMAT")
Toca un formato (**WAV / MP3 / STEMS**) para renderizar la Playlist y descargarla al momento.

### MFX TYPE — `mfxOverlay` ("MFX TYPE")
Elige uno de los **7 sub-tipos** del MFX; el cambio es instantáneo y sin clicks.

### GROUPS — `groupsOverlay` ("GROUPS")
Gestiona los grupos **LINK / MUTE** de pads: desenlazar un pad (uno a uno), desactivar (pausa el grupo) o
borrar un grupo entero. Los grupos se crean con **SHIFT+7 (LINK)** / **SHIFT+8 (MUTE)** y tocando pads.

### ROW TOOLS — `rowToolsOverlay` ("ROW TOOLS")
Se abre manteniendo pulsada la etiqueta de un pad en PATTERN EDIT: **PIANO ROLL** (editor de melodía del pad),
**EUCLIDEAN** (rellena la fila con un patrón euclídeo) y utilidades de la fila.

### P-LOCK — `pLockOverlay` ("P-LOCK")
Bloqueos por paso: ajusta **SOLO** ese paso (PITCH, ATK, REL…). "—" = usa el ajuste del pad. Un punto marca
los pasos que llevan bloqueos.

---

## Sistema / onboarding

### TOUR / INTRO — `introOverlay` ("ARTiFACTS FX-404")
Onboarding paso a paso al primer arranque (con puntos de navegación y SALTAR). No reaparece una vez visto
(`localStorage.fx404_intro_seen`).

### SUELTA AQUÍ — `dropOverlay`
Destino visible al arrastrar ficheros de audio a la app (drag-and-drop de import).

### Restaurar autoguardado (prompt JS)
Al abrir, si hay una sesión sin guardar, ofrece restaurarla.

### Puerta de licencia — `licGate`
Comprobación de licencia al inicio.

---

## Notas
- **EXT SOURCE / INPUT (mic)** aparece **atenuado/desactivado** a propósito: la app no pide permiso de
  micrófono (decisión para la Data Safety de Play). Por eso no hay panel de captura activo.
- **Apilado (z-index)**: base 60; EXPORT/ROW TOOLS 70; PIANO ROLL 72; P-LOCK 74; drag-drop 1000; autosave 999.
  PIANO ROLL puede abrirse sobre PATTERN EDIT o PAD SETTINGS.
- **Escape / atrás / ×** cierran el overlay superior (orden en `CLOSEABLE_OVERLAY_IDS`).
