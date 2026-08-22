# VistaViva 👁️ — Coach de entrenamiento visual

PWA (aplicación web progresiva) de **entrenamiento visual guiado**: ejercita los
músculos oculares, la coordinación, el enfoque y los hábitos que protegen tu
vista, con base en la evidencia de la terapia visual. **Instalable** en el móvil
y **funciona sin conexión**. Sin dependencias, sin backend, sin cuentas: todo se
guarda en tu dispositivo.

> **Honestidad clínica.** Estos ejercicios entrenan músculos, coordinación,
> enfoque y hábitos, y alivian la fatiga visual. **No** reshapean el ojo ni
> corrigen defectos refractivos (miopía, hipermetropía, astigmatismo), así que
> **no sustituyen tu graduación** — la Academia Americana de Oftalmología es
> clara, y el “método Bates” está desmentido. La app lo explica sin humo en la
> ficha «¿Puedo dejar las gafas?».

## Programa (14 ejercicios en 7 categorías)

- **Calentamiento** — Parpadeo consciente (película lagrimal / ojo seco).
- **Seguimiento (pursuits)** — Horizontal · Vertical · Diagonales · Círculos · Ocho ∞.
- **Sacádicos** — Saltos horizontales · Saltos en rejilla (agilidad de fijación).
- **Flexibilidad de enfoque** — Cerca–lejos tipo *flippers* (acomodación).
- **Convergencia / binocular** — Cuerda de Brock · Convergencia (tipo *push-up*),
  la técnica con evidencia del *Convergence Insufficiency Treatment Trial* (NEI).
- **Visión periférica** — Fijación central con detección periférica.
- **Descanso y hábitos** — Regla 20-20-20 · Palming · recordatorio de luz natural
  (2 h/día al aire libre: lo único con evidencia sólida para retrasar la miopía
  infantil).

## Características

- **Reproductor** con motor de animación en canvas por tipo de ejercicio,
  temporizador, barra de progreso, pausa, anterior/siguiente y control por teclado
  (espacio, ← →, Esc).
- **Racha diaria** y estadísticas (rutinas totales, semana), guardadas en
  `localStorage`.
- **Ajustes**: sonidos, vibración, movimiento reducido y duración de la rutina
  (corta / normal / larga).
- **Responsive**: en móvil una columna a pantalla completa; en escritorio, inicio
  a dos columnas y reproductor inmersivo con escenario acotado.
- **Accesible** (contraste AA, foco visible, respeta `prefers-reduced-motion`) y
  **tema oscuro** cómodo para la vista.

## Fundamento (fuentes)

- Academia Americana de Oftalmología — los ejercicios no corrigen defectos
  refractivos ni el método Bates.
- *Convergence Insufficiency Treatment Trial* (CITT), National Eye Institute —
  eficacia de la terapia de convergencia.
- IMI / Myopia Institute — tiempo al aire libre y luz natural en la prevención de
  la miopía infantil.

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

### Despliegue gratuito desde repo privado (Netlify o Vercel)

GitHub Pages requiere plan de pago en repos privados. Alternativas gratuitas que
sí soportan repos privados (ya incluyen su config en la raíz):

- **Netlify** (`netlify.toml`): en app.netlify.com → «Add new site» → «Import from
  Git» → elige el repo → sin comando de build, publica la raíz. Deploy automático
  en cada push.
- **Vercel** (`vercel.json`): en vercel.com → «Add New… Project» → importa el repo
  → framework «Other», sin build. Deploy automático en cada push.

Ambos dan una URL HTTPS instalable como PWA. Los archivos de config fijan
`Cache-Control: no-cache` para `sw.js` (para que las actualizaciones lleguen) y el
tipo MIME correcto del manifest.

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

## Changelog

- **v5** — Personalización y accesibilidad:
  - **Rutina personalizada**: programa "Personalizada" con interruptores por
    ejercicio (mínimo 1; "Comenzar" se deshabilita si no hay ninguno); la
    selección se recuerda.
  - **Modo daltónico**: paleta accesible Okabe–Ito por categoría, aplicada a
    canvas, lista, anillo y estadísticas.
  - **Vista previa animada** de cada ejercicio en la lista (mini-lienzos, ~30 fps
    compartidos, en pausa con la pestaña oculta y estáticos en movimiento reducido).
- **v4** — Rutinas por objetivo:
  - Selector de programa en el inicio: **Completa** (14), **Pantallas** (descanso
    rápido, 4), **Enfoque** (acomodación + convergencia) y **Movimiento**
    (seguimientos + sacádicos). Declarativos y ampliables (`PROGRAMS` en
    `exercises.js`, por `ids` o `cats`); la elección se recuerda.
  - El reproductor, el resumen y las estadísticas operan sobre la rutina activa.
- **v3** — Pulido de reproductor:
  - Motor de audio WebAudio con envolventes suaves y cues con nombre (preparación,
    inicio, salto sacádico, acorde final); filtro paso-bajo para timbre agradable.
  - Overlay «En pausa» y respeto de *movimiento reducido* (sin estela ni fundido).
  - Pantalla final con resumen de habilidades entrenadas (chips por categoría).
- **v2** — Coach de entrenamiento visual: 14 ejercicios en 7 categorías basados en
  evidencia (pursuits, sacádicos, acomodación, convergencia/Brock, periferia,
  hábitos), ficha honesta «¿Puedo dejar las gafas?», cuenta atrás «Prepárate»,
  anillo de progreso, Wake Lock, layout de escritorio a dos columnas.
- **v1** — PWA inicial: 9 ejercicios, reproductor, rachas, ajustes, offline.
