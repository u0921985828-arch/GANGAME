# C40 Artifacts — Caja de Ritmos Sostenible

Caja de ritmos de 16 pads, 100% síntesis Web Audio (sin muestras externas), con
secuenciador de 16 pasos, grabación en vivo, control de tempo/volumen y estética
de cassette reciclado. Un solo archivo, sin dependencias.

**Entregable:** [`c40_artifacts_v3.html`](./c40_artifacts_v3.html) — ábrelo en el navegador.
(`c40_artifacts_v2.html` se conserva como versión anterior; no se sobrescribe.)

## Uso

- **Pads:** clic/toque o teclas `1 2 3 4 · Q W E R · A S D F · Z X C V`.
- **REPRODUCIR / DETENER:** botón o barra espaciadora.
- **GRABAR PASO:** actívalo y toca pads mientras suena; los golpes se cuantizan
  al paso audible más cercano.
- **SECUENCIADOR:** despliega la rejilla de 16 pasos y activa celdas manualmente.
- **BPM / VOL:** tempo 60–200, volumen general.
- Tu patrón, tempo y volumen se guardan automáticamente (localStorage).

## Verificación

`c40_artifacts_v3.html` se validó en Chromium real (Playwright) — 13 comprobaciones,
todas en verde: render de 16 pads y 256 pasos, patrón demo, cuantización de grabación
alineada al reloj de audio (incluido **cambio de BPM en vivo**), persistencia tras
recarga, accesibilidad del viewport/slider y ausencia de errores de consola. Test
diferencial: la comprobación de cambio de BPM en vivo falla contra v2 y pasa contra v3.
El arnés está en `verify.mjs` (no incluido en el entregable).

## Changelog

- **v3** — Cierre de PENDIENTES sobre v2:
  - **[correctness]** La cuantización de grabación deriva el paso audible de los
    tiempos absolutos que programa el scheduler (fuente única de verdad), no de
    `elapsed/stepDuration`. Ahora es correcta también al **cambiar el BPM durante
    la reproducción**, donde la fórmula anterior se desalineaba 2–3 pasos.
  - **[wontfix]** Los 2 carretes son la metáfora del cassette (un cassette tiene
    2 carretes), no una cobertura incompleta de los 16 pads. Se conserva el diseño.
- **v2** — Auditoría + endurecimiento sobre v1:
  - **[correctness]** La grabación en vivo cuantiza al paso *audible* (reloj de audio)
    en lugar del puntero de look-ahead del planificador, que iba 1–2 pasos por delante
    y hacía que los golpes cayeran antes de tiempo.
  - **[a11y / WCAG-AA]** Viewport sin bloqueo de zoom; `aria-label`/`aria-pressed`/
    `aria-expanded`/`role=status` en controles; `<label>` para el volumen; foco visible;
    respeto de `prefers-reduced-motion`.
  - **[feature]** Persistencia automática de patrón, BPM y volumen (localStorage,
    tolerante a modo privado).
  - **[audio]** El hi-hat cerrado corta (choke) al hi-hat abierto, como una caja real.
  - **[fix]** La barra espaciadora ya no dispara toggles en cascada al mantenerla pulsada.
  - **[perf]** El volumen persiste al soltar el deslizador, no en cada frame del arrastre.
- **v1** — Versión inicial (artefacto de origen).
