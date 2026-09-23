/**
 * VistaViva — Programa de entrenamiento visual (coach).
 *
 * Diseñado a partir de la evidencia de terapia visual / optometría:
 *  - Motilidad ocular: seguimientos (pursuits) y sacádicos.
 *  - Acomodación: flexibilidad de enfoque cerca–lejos (accommodative rock/flippers).
 *  - Convergencia / binocular: cuerda de Brock y convergencia tipo "lápiz"
 *    (base del Convergence Insufficiency Treatment Trial del NEI).
 *  - Visión periférica: fijación central con detección periférica.
 *  - Higiene y descanso: parpadeo, regla 20-20-20 y palming.
 *
 * IMPORTANTE (honestidad clínica): estos ejercicios entrenan MÚSCULOS,
 * COORDINACIÓN, ENFOQUE y HÁBITOS visuales, y alivian la fatiga. NO reshapean
 * el ojo ni corrigen defectos refractivos (miopía, hipermetropía, astigmatismo),
 * así que no sustituyen tu graduación. Fuente: Academia Americana de Oftalmología.
 */

const CATEGORIES = {
  calentamiento: 'Calentamiento',
  seguimiento:   'Seguimiento (músculos oculares)',
  sacadicos:     'Saltos de mirada (sacádicos)',
  enfoque:       'Flexibilidad de enfoque',
  convergencia:  'Convergencia y visión binocular',
  periferia:     'Visión periférica',
  habitos:       'Descanso y hábitos',
};

/**
 * Programas (rutinas por objetivo). Declarativos y ampliables: añade uno nuevo
 * con `ids` (lista explícita, respeta ese orden) o `cats` (todas las de esas
 * categorías, en el orden de EXERCISES). Sin `ids` ni `cats` → rutina completa.
 */
const PROGRAMS = [
  { id: 'completa',  name: 'Completa',   desc: 'Entrenamiento visual integral' },
  { id: 'pantallas', name: 'Pantallas',  desc: 'Descanso rápido para la vista', ids: ['blink', 'pursuit-h', 'rule20', 'palming'] },
  { id: 'enfoque',   name: 'Enfoque',    desc: 'Acomodación y convergencia',    cats: ['enfoque', 'convergencia'] },
  { id: 'motilidad', name: 'Movimiento', desc: 'Seguimientos y sacádicos',      cats: ['seguimiento', 'sacadicos'] },
  { id: 'custom',    name: 'Personalizada', desc: 'Elige tus ejercicios',       custom: true },
];

const EXERCISES = [
  // ---- Calentamiento ----
  {
    id: 'blink', category: 'calentamiento',
    name: 'Parpadeo consciente', goal: 'Lágrima · ojo seco',
    instruction: 'Parpadea de forma completa y suave cada vez que el círculo se cierre. Renueva la película lagrimal y evita el ojo seco por pantallas.',
    duration: 24, accent: '#7dd3fc',
    motion: { type: 'blink', period: 2.4 },
  },

  // ---- Seguimiento (pursuits) ----
  {
    id: 'pursuit-h', category: 'seguimiento',
    name: 'Seguimiento horizontal', goal: 'Rectos laterales',
    instruction: 'Sigue el punto solo con los ojos, de lado a lado, sin mover la cabeza. Trabaja el seguimiento suave y los músculos horizontales.',
    duration: 28, accent: '#fbbf24',
    motion: { type: 'linear', axis: 'x', period: 3.2, span: 0.82 },
  },
  {
    id: 'pursuit-v', category: 'seguimiento',
    name: 'Seguimiento vertical', goal: 'Rectos verticales',
    instruction: 'Sigue el punto de arriba a abajo. Cabeza inmóvil; que trabajen solo los ojos.',
    duration: 28, accent: '#fbbf24',
    motion: { type: 'linear', axis: 'y', period: 3.2, span: 0.74 },
  },
  {
    id: 'pursuit-d', category: 'seguimiento',
    name: 'Diagonales', goal: 'Oblicuos',
    instruction: 'Recorre las esquinas siguiendo el punto en diagonal. Alterna las dos diagonales.',
    duration: 28, accent: '#fb923c',
    motion: { type: 'diagonal', period: 3.0, span: 0.78 },
  },
  {
    id: 'pursuit-c', category: 'seguimiento',
    name: 'Círculos', goal: 'Rotación completa',
    instruction: 'Acompaña al punto trazando un círculo amplio. Cambiará de sentido a la mitad.',
    duration: 34, accent: '#f472b6',
    motion: { type: 'circle', period: 4.0, radius: 0.4, reverseAt: 0.5 },
  },
  {
    id: 'pursuit-8', category: 'seguimiento',
    name: 'Ocho infinito', goal: 'Coordinación binocular',
    instruction: 'Sigue el recorrido en forma de ∞. Suaviza y coordina el movimiento de ambos ojos.',
    duration: 34, accent: '#a78bfa',
    motion: { type: 'figure8', period: 5.0, width: 0.8, height: 0.5 },
  },

  // ---- Sacádicos ----
  {
    id: 'saccade-h', category: 'sacadicos',
    name: 'Sacádicos horizontales', goal: 'Saltos de lectura',
    instruction: 'Salta la mirada de golpe al punto que se enciende, sin “barrer” por el medio. Entrena los movimientos sacádicos que usas al leer.',
    duration: 26, accent: '#22d3ee',
    motion: { type: 'saccade', pattern: 'horizontal', interval: 1.1 },
  },
  {
    id: 'saccade-grid', category: 'sacadicos',
    name: 'Sacádicos en rejilla', goal: 'Agilidad de fijación',
    instruction: 'Fija la mirada de un salto en cada punto que aparece. Amplía tu campo de exploración y la velocidad de fijación.',
    duration: 28, accent: '#2dd4bf',
    motion: { type: 'saccade', pattern: 'grid', interval: 1.0 },
  },

  // ---- Flexibilidad de enfoque (acomodación) ----
  {
    id: 'accommodation', category: 'enfoque',
    name: 'Enfoque cerca–lejos', goal: 'Flexibilidad acomodativa',
    instruction: 'Alterna el enfoque siguiendo la señal: nítido de CERCA y relajado de LEJOS. Entrena la flexibilidad acomodativa (tipo “flippers”).',
    duration: 40, accent: '#34d399',
    motion: { type: 'accommodation', period: 5.0 },
  },

  // ---- Convergencia / binocular ----
  {
    id: 'brock', category: 'convergencia',
    name: 'Cuerda de Brock', goal: 'Convergencia · fusión',
    instruction: 'Mira la cuenta iluminada; deberías percibir dos “cuerdas” que se cruzan en X justo sobre ella. Base de la terapia de convergencia (cuerda de Brock).',
    duration: 40, accent: '#f59e0b',
    motion: { type: 'brock', interval: 2.4 },
  },
  {
    id: 'convergence', category: 'convergencia',
    name: 'Convergencia (acercamiento)', goal: 'Punto próximo',
    instruction: 'Mantén el punto ÚNICO y nítido mientras se acerca; si se desdobla, para y vuelve a fusionarlo. Análogo digital del “push-up” con lápiz.',
    duration: 34, accent: '#fca5a5',
    motion: { type: 'convergence', period: 4.5 },
  },

  // ---- Visión periférica ----
  {
    id: 'peripheral', category: 'periferia',
    name: 'Visión periférica', goal: 'Campo visual',
    instruction: 'Mantén la vista CLAVADA en la cruz central y detecta los destellos con la visión periférica, SIN mover los ojos.',
    duration: 30, accent: '#c084fc',
    motion: { type: 'peripheral', interval: 1.3 },
  },

  // ---- Descanso y hábitos ----
  {
    id: 'rule20', category: 'habitos',
    name: 'Regla 20-20-20', goal: 'Descanso del enfoque',
    instruction: 'Mira algo a 6 metros (una ventana, el fondo de la sala) durante toda la cuenta. Cada 20 min de pantalla, 20 segundos a 20 pies. Si puedes, hazlo con luz natural.',
    duration: 20, accent: '#38bdf8',
    motion: { type: 'far' },
  },
  {
    id: 'palming', category: 'habitos',
    name: 'Palming y respiración', goal: 'Relajación profunda',
    instruction: 'Frota tus manos, cúbrete los ojos sin presionar y respira al ritmo del círculo. Oscuridad y calor para descargar la vista.',
    duration: 45, accent: '#94a3b8',
    motion: { type: 'rest', breath: 8 },
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EXERCISES, CATEGORIES, PROGRAMS };
}
