# Gráficos de ficha — Google Play

Generados a partir del diseño real de la app (v73) y del icono del launcher, a resolución exacta y
dentro de los límites de Play. Todo listo para pegar en **Play Console ▸ Presencia en la tienda ▸
Ficha principal de la tienda**.

| Archivo | Tamaño | Dónde va en Play Console | Requisito Play |
|---|---|---|---|
| `icon-512.png` | 512×512 | **Icono de la app** | PNG 32-bit, 512×512, ≤1 MB ✓ |
| `feature-graphic-1024x500.png` | 1024×500 | **Gráfico de función** (feature graphic) | PNG/JPG, 1024×500 ✓ |
| `screenshot-1-main.png` | 1080×2160 | **Capturas de teléfono** | 2–8 imágenes, lado 320–3840 px, ratio ≤ 2:1 ✓ |
| `screenshot-2-pattern-edit.png` | 1080×2160 | Capturas de teléfono | (ratio exacto 2:1) |
| `screenshot-3-piano-roll.png` | 1080×2160 | Capturas de teléfono | muestra los acordes del piano roll |
| `screenshot-4-sample-edit.png` | 1080×2160 | Capturas de teléfono | muestra el editor + la barra de reproducción |

Notas:
- El **icono del launcher** (adaptive/monochrome + PNGs por densidad) ya está en
  `android/app/src/main/res/mipmap-*`; este `icon-512.png` es solo para la **ficha** de la tienda.
- Los textos (descripción corta ≤80, larga, privacidad, data safety) están en
  `../../GOOGLE_PLAY_READINESS.md` y `../PRIVACY_POLICY_es.md`.
- Regenerables con `scratchpad/plstore.mjs` (rasteriza los HTML del icono/feature y captura la app
  real en Chromium headless).
