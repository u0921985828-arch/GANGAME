# ARTiFACTS FX-404 — Guía de estilo / Design System

> Estilo detallado de la app (sampler/groovebox SP-404-style). Valores extraídos del CSS real
> (`ARTiFACTSFX404_v230.html`). Pensado como **especificación de UI para el rewrite nativo (JUCE)** y como
> referencia de diseño. Regla de oro del sistema: **todo cuelga de tokens por skin**; los componentes nunca
> hardcodean color — leen variables `--…`.

---

## 1. Ethos visual
- **Hardware SP-404**: chasis rígido de resolución fija (940 px de ancho de diseño), escalado a pantalla.
- **Casi todo CUADRADO** (`border-radius:0`) salvo el propio chasis (14 px) y micro-controles (6–8 px). Los
  pop-ups son paneles rectos con **bisel de 2 px + sombra + scanline CRT** opcional.
- **Dos tipografías**: `Oswald` (condensada, display) para números/etiquetas grandes; `JetBrains Mono`
  (monoespaciada) para overlays, datos, botones y LCD.
- **Theming por skin**: 4 acabados (ivory, ghost, midnight-neon, arctic-precision). Cada skin solo redefine
  tokens; el pop-up adopta la superficie de ESE skin (no una capa oscura ajena).
- **Fondo "estudio"**: la máquina va centrada y *letterboxed* sobre un backdrop con foco de acento
  (`--skin-glow`), textura de puntos y viñeta. El hueco alrededor es intencional (como el letterbox de vídeo).
- **Accesibilidad**: suelo WCAG-AA; tokens `--*-ink` / `--popup-accent-text` existen para garantizar
  contraste del acento como TEXTO en superficies claras.

---

## 2. Tokens base (`:root`)
Chasis y globales (no cambian entre skins):
```
--chassis1:#4a4d52  --chassis2:#3a3c40  --chassis3:#28292c   (degradado del chasis)
--panel:#3f4247     --panel-dark:#2c2e32
--key:#1c1d20       --key-lit:#2a2c30
--orange:#ff9a3d    --orange-dim:#c9772c                     (acento por defecto)
--lcd-bg:#0a0e13    --lcd-fg:#dfe6f0    --lcd-dim:#4a5768     (pantallas LCD)
--red:#ff3d6e       --red-ink:var(--red)                     (STOP/PÁNICO; se oscurece en skins claras)
--white:#e8e9eb     --screw:#1a1b1d     --text-dim:#aeb1b8
--accent:var(--orange)   --accent-dim:var(--orange-dim)
--padbtn-bg1/bg2/border/shadow/text/subtext                  (cara de los pads; la fija cada skin)
--skin-glow: 255,154,61   (RGB del foco de fondo; applySkin() lo pone = RGB del acento del skin)
--scrim: rgba(6,7,9,.72)  (oscurecido único de fondo modal)
```
Fondo de la app: `#0a0a0b`. Backdrop del stage: foco radial `rgba(--skin-glow,.20)` + lift central +
viñeta + dot-grid SVG + degradado carbón `#16181f→#0c0d12→#0a0b0f`.

---

## 3. Skins (tokens completos)

**Skin claves de contraste:** ivory/arctic = **placa clara** (pop-up CLARO, sin scanline); ghost/midnight =
**pop-up OSCURO** (con scanline). En pop-ups claros el acento como texto usa `--popup-accent-text` oscurecido.

### 3.1 IVORY (placa crema, pads oscuros, acento naranja) — el clásico
```
--accent:#ff9a3d  --accent-dim:#c9772c
pads:  bg1 #26282b  bg2 #111214  border #050506  shadow #050506  text #ff9a3d  subtext #c9772c
placa (klabel/logo/model…): #2a2926   logo span: #9a5410
lib-text #4a4740  sample-text #a8551a   red-ink = --red
POPUP (por defecto en :root):
  bg1 #efebe0  bg2 #ddd7c6  border #8a8470  border-soft rgba(42,41,38,.15)
  text #2a2926  text-dim #6b6558  key #d5cfbd  key-alt #c7c0ac
  accent-text #8f4712  scanline-opacity 0
```

### 3.2 GHOST (grafito monocromo, pads claros)
```
--accent:#c9cdd2  --accent-dim:#8f949a
pads:  bg1 #e9eaec  bg2 #cfd1d4  border #a6a8ac  shadow #8d8f93  text #1a1b1d  subtext #55575a
placa: #c7c8ca   red-ink #c1123b   lib-text #6a6c70  sample-text #8f949a
POPUP (oscuro):
  bg1 #38393b  bg2 #232426  border #000000  border-soft rgba(255,255,255,.08)
  text #e8e8ea  text-dim #a9aaae  key #1c1d1f  key-alt #28292b
  row-active rgba(255,255,255,.06)  accent-text = --accent  scanline-opacity 1
```

### 3.3 MIDNIGHT-NEON (dub/soundsystem, cyan)
```
--accent:#00e5ff  --accent-dim:#0891a8
pads:  bg1 #12141a  bg2 #0a0c10  border #1c3d45  shadow #000  text #e8f9ff  subtext = --accent
placa: #8fd8e6   sample-text #ff3ddc (magenta)   lib-text = --accent
POPUP (oscuro):
  bg1 #0a0e13  bg2 #060a0e  border #050506  border-soft #1c232c
  text #dfe6f0  text-dim #6f8ba6  key #0f141b  key-alt #161d26
  accent-text = --accent  scanline-opacity 1
```

### 3.4 ARCTIC-PRECISION (lab blanco, azul frío)
```
--accent:#4fa3ff  --accent-dim:#2f7ad1
pads:  bg1 #ffffff  bg2 #eaf2fb  border #bcd4ee  shadow #a0c0e0  text #0d2438  subtext #3f6a8f
placa: #284a63   red-ink #c1123b   lib-text #3f6a8f  sample-text #2f7ad1
POPUP (claro):
  bg1 #ffffff  bg2 #e4eef8  border #7fa8cf  border-soft rgba(40,74,99,.15)
  text #0d2438  text-dim #3f6a8f  key #dceafb  key-alt #c8dcf0
  row-active rgba(79,163,255,.16)  accent-text #1f6fbf  scanline-opacity 0
```

**Semántica de roles de color:** `accent` = feedback/activo/selección/thumbs; `red`/`red-ink` = STOP/PÁNICO;
`popup-text` / `-dim` = texto principal / secundario; `popup-key` / `-alt` = celdas y superficies internas;
`popup-border` / `-soft` = marco fuerte / hairline; `lcd-*` = pantallas de datos; `padbtn-*` = cara de pad.

---

## 4. Tipografía
Fuentes (Google Fonts): **Oswald** (400/700, condensada) y **JetBrains Mono** (400/700, mono).
| Elemento | Fuente | Tamaño | Peso | Tracking | Notas |
|---|---|---|---|---|---|
| Nº de pad `.pad .num` | Oswald | 50px | 700 | — | color `--padbtn-text`, line-height 1 |
| Nombre de pad `.pad .fn` | JetBrains Mono | 16px | 400 | .3px | ellipsis, `--padbtn-text` |
| Título overlay `.utilTitle` | JetBrains Mono | 13px | 800 | 3px | UPPERCASE, `--popup-accent-text` |
| Cabecera sección `.setSecLabel` | mono | 10px | 800 | 2.5px | `--popup-accent-text` + border-bottom |
| Etiqueta tarjeta `.popupSectionLabel` | mono | 9.5px | 700 | 2px | barra izq. 2px `--accent` |
| Título sección `.pnSectionTitle` | mono | 9.5px | 700 | 1.6px | UPPERCASE, dim + hairline final |
| Label de campo `.setName` | mono | 12px | 700 | — | |
| Nota/ayuda `.setNote` | mono | 10px | 400 | — | `--popup-text-dim`, line-height 1.5 |
| Sub-knob `.knobsub` | mono | 12.5px | 400 | 1px | `--text-dim` |
| Toast/badge | mono | 12.5px | 700 | .5px | borde+texto `--accent`, radius 8px |
Cuerpo (`body`) = Oswald; **todos los overlays** = JetBrains Mono.

---

## 5. Forma, espaciado, bordes
- **Radios**: chasis 14px · pop-ups y tarjetas **0** (cuadrado) · inputs 6px · toasts/badges 8px.
- **Chrome de tarjeta** (`.introCard/.editCard/.chainCard/.sampleEditCard/.utilCard/.pianoCard`):
  `border:2px solid var(--popup-border); border-radius:0; box-shadow:var(--popup-shadow)` + `::after` scanline
  (`repeating-linear-gradient` 1px, `mix-blend-mode:multiply`, opacidad `--popup-scanline-opacity`).
- **Sombras**: `--popup-shadow` por skin (claras: elevación + inset sutil; oscuras: inset profundo + drop).
- **Overlays** (`.utilOverlay` etc.): `position:fixed; inset:0; display:flex; center; padding:28px`; backdrop
  = `--scrim` + blur (capa de motion). z-index 60 base; export/rowTools 70; pLock 74; piano 72.
- **Tarjeta de sección** (`.popupSection`): `padding:9px 12px; background:var(--popup-key); border:1px solid`
  (soft por defecto; **reforzado a `--popup-border`** solo en Ajustes `.setPage .popupSection`).

---

## 6. Componentes (recetas)
- **Pads**: cara `linear-gradient(--padbtn-bg1→bg2)`, borde `--padbtn-border`, sombra `--padbtn-shadow`; nº en
  Oswald 50px + nombre mono 16px (`--padbtn-text`). Estados: `.hit` (brillo de acento estático, sin repintado
  por tap), `.muted` (atenuado), `.held` (HOLD/latch), `.toggle-active` (punto). En FX activo, glow `glowPulse`
  en `.pad::after`.
- **Knobs** (`.knob` 100px; `.jogwheel`/`.enterknob`/`.miniknob`): cuerpo
  `radial-gradient(#3c3e42→#1c1d1f→#0a0a0b)`, **doble bisel** vía box-shadow (`#050506` + `#45484d`) + lift,
  anillo de **moleteado** (`repeating-conic-gradient` enmascarado a un aro), brillo especular `::after`. La
  **aguja** la dibuja JS desde `offsetWidth` (escala sola). `--bezel`/`--lift` por variante.
- **Botones laterales** (`.sidebtn`) y **de banco/tecla** (`.keybtn`, `.bank`, `.stop`): cara clara/oscura
  según skin; estado `.on` = relleno `--accent` con texto oscuro (`#0a0b0d`); STOP usa `--red-ink`.
- **Segmentado** (`.segGroup`/`.segBtn`): botones de igual ancho; `.sel` = fondo `--accent`, texto oscuro.
- **Acción** (`.setRow`, `.stop`, `.chainTBtn`): botón pleno; `.stop`/reset en rojo (`ORDEN POR DEFECTO`).
- **Tabs** (`.setTab`): cuadrado, atenuado; `.sel` = acento/negro.
- **Scrollbar personalizada** (`.editScrollbar` + `.thumb`): track 14px alto, `--popup-key-alt` + borde
  `--popup-border`, thumb **naranja `--accent`** movido por JS (proporcional). Variante vertical `.vert` (piano
  roll). En apaisado se desactiva su arrastre (`pointer-events:none`) — sigue como indicador.
- **LCD / status** (`.utilStatus`, transporte): chip oscuro `--lcd-bg` con texto mono `--lcd-fg`/`--lcd-dim`.
- **Rejilla secuenciador** (`.editCell` ~24×24): sombreado por velocidad; `.beat` = divisoria de tiempo;
  `.plocked` = punto. Cabecera de pasos `.editColHead` + columna de nombres `.editRowLabel` (sticky-left).
- **Piano roll** (`.pnCell` 24×24): carriles de tecla negra más oscuros, línea en el carril ROOT; cabecera de
  beats `.pnColHead` (sticky top, z6) + columna de notas `.pnRowLabel` (sticky left, z6) + esquina `.pnCorner`
  (sticky ambos, z7). Píldoras de nota `.pnBars` (z2).
- **Playhead** (`.pnPlayhead`/`.editPlayhead`): barra 2px `rgba(--skin-glow,.92)` con glow del skin (z3).
- **Badges/toasts**: mono 12.5/700, borde+texto acento, `pendingPulse` (solo opacidad, GPU).

---

## 7. Movimiento y niveles de rendimiento
- **Tiers** (`localStorage.fx404_perf` → `perf-high/mid/low` + `perf-flat` = "PLANO"). `html.perf-flat *{
  animation:none; transition:none }` desactiva animaciones/transiciones CSS (no las WAAPI). PLANO da al
  backdrop una versión estática (foco + dot-grid).
- **prefers-reduced-motion**: respetado (badges/knobs sin animación).
- **Entrada de overlay**: `translateY(10px) scale(.975)` → `none` + `backdrop-filter` blur.
- **Golpe de pad**: brillo **estático** de `.hit` (no repinta por tap) — clave para 120 Hz sin drops.
- **FX activo**: `glowPulse` (2.4s) en una capa `::after` de los pads.

---

## 8. Iconografía
Sprites **pixel-art** en SVG en línea: `viewBox="0 0 16 16"`, `shape-rendering:crispEdges`, monocromo por
`currentColor` (heredan color/tema). Transporte (play/stop/prev/next) y herramientas (goma/tijeras) siguen
este estilo — nada de iconos vectoriales suaves.

---

## 9. Layout
- **Chasis** `.unit`: ancho fijo **940px** de diseño, `position:absolute`, `transform-origin:top left`,
  escalado a pantalla por `fitStage()`. Fondo = capas (dim de skin + patrón grabado + rayas finas + brillo
  superior + degradado `--chassis1/2/3`). `border-radius:14px`, sombra profunda + inset.
- **Rejilla de pads**: 4×4 + columna lateral de botones (MUTE BUS / HOLD / EXT SOURCE / PROJECT…).
- **Stage**: `.stage-outer` fija a viewport, centra y *letterboxes* el chasis; scrollbars ocultas.
- **Orientación**: la app está **bloqueada en vertical** (manifest). Opción "Editores en horizontal" rota el
  POP-UP 90° por CSS (`body.fx404-editors-landscape`), sin rotar el SO; en apaisado la cabecera de PATTERN
  EDIT/PIANO ROLL se compacta a una banda y la rejilla ocupa todo el ancho.

---

## 10. Notas para el rewrite nativo (JUCE)
- Portar los **tokens por skin** a un `LookAndFeel`/tema con las mismas 4 paletas y la misma semántica de
  roles (accent/red/lcd/popup-key/border). Mantener el patrón "componentes leen tokens, no hardcodean".
- Respetar el **look cuadrado** (radios 0) y el bisel 2px + scanline opcional (los skins oscuros lo usan).
- Tipografía: Oswald (display) + JetBrains Mono (datos/UI) con las escalas de la tabla §4.
- Knobs, pads, LCD y grids con las recetas §6 (el knob con moleteado + doble bisel + especular es marca de la
  casa; la aguja se dibuja, no es sprite).
- El "modo PLANO" equivale a desactivar animaciones para equipos flojos → en nativo, un flag de calidad.
