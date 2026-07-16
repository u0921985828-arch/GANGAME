# VistaViva 👁️ — Ejercicios diarios para los ojos

PWA (aplicación web progresiva) para relajar la vista y ejercitar los músculos
oculares con una rutina guiada diaria. **Instalable** en el móvil y **funciona
sin conexión**. Sin dependencias, sin backend, sin cuentas: todo se guarda en tu
dispositivo.

## Características

- **9 ejercicios guiados** con animación en pantalla:
  - Parpadeo consciente · Movimiento horizontal / vertical / diagonal
  - Círculos · Ocho infinito (∞) · Enfoque cerca–lejos (convergencia)
  - Regla 20-20-20 · Palming con guía de respiración
- **Reproductor** con temporizador, barra de progreso, pausa, anterior/siguiente
  y control por teclado (espacio, ← →, Esc).
- **Racha diaria** y estadísticas (rutinas totales, semana), guardadas en
  `localStorage`.
- **Ajustes**: sonidos, vibración, movimiento reducido y duración de la rutina
  (corta / normal / larga).
- **Accesible** (contraste AA, foco visible, respeta `prefers-reduced-motion`) y
  **tema oscuro** cómodo para la vista.

## Cómo usarla

Al ser una PWA, necesita servirse por HTTP(S) (el service worker no funciona con
`file://`). En local:

```bash
# cualquier servidor estático sirve, por ejemplo:
python3 -m http.server 8080
# luego abre http://localhost:8080
```

En el móvil, usa «Añadir a pantalla de inicio» para instalarla.

Para desplegarla basta con subir estos archivos estáticos a cualquier hosting
(GitHub Pages, Netlify, Vercel, etc.).

## Estructura

```
index.html              # interfaz y pantallas (inicio / reproductor / fin / ajustes)
styles.css              # estilos, tema oscuro, responsive
exercises.js            # definición de la rutina (datos + tipo de animación)
app.js                  # motor de canvas, temporizador, rachas, audio y PWA
manifest.webmanifest    # metadatos de instalación
sw.js                   # service worker (offline-first)
icons/                  # iconos SVG + PNG (192, 512, maskable, apple-touch)
```

## Aviso de salud

Estos ejercicios ayudan a **relajar la vista y reducir la fatiga visual** por
pantallas. **No** curan ni corrigen defectos refractivos (miopía, astigmatismo,
etc.) ni sustituyen la revisión de un profesional. Si notas dolor, mareo o
visión borrosa persistente, detente y consulta a tu oftalmólogo.
