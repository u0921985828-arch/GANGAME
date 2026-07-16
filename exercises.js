/**
 * VistaViva — definición de la rutina de ejercicios oculares.
 *
 * Cada ejercicio describe QUÉ hacer (nombre, instrucción, duración) y CÓMO
 * animarlo. El campo `motion.type` lo interpreta el renderizador del canvas
 * (app.js). Las duraciones son la base; el ajuste de intensidad las escala.
 *
 * Fundamento: los movimientos oculares amplios (sacádicos y de seguimiento),
 * el cambio de enfoque cerca-lejos y las pausas de relajación (palming,
 * regla 20-20-20, parpadeo consciente) son recomendaciones habituales para
 * aliviar la fatiga visual por pantallas. No corrigen defectos refractivos.
 */
const EXERCISES = [
  {
    id: 'blink',
    name: 'Parpadeo consciente',
    instruction: 'Parpadea con fuerza cada vez que el círculo se cierre. Hidrata y relaja el ojo.',
    duration: 25,
    accent: '#7dd3fc',
    motion: { type: 'blink', period: 2.4 },
  },
  {
    id: 'horizontal',
    name: 'Movimiento horizontal',
    instruction: 'Sigue el punto solo con los ojos, de lado a lado. Mantén la cabeza quieta.',
    duration: 30,
    accent: '#fbbf24',
    motion: { type: 'linear', axis: 'x', period: 3.2, span: 0.82 },
  },
  {
    id: 'vertical',
    name: 'Movimiento vertical',
    instruction: 'Sigue el punto de arriba a abajo. Cabeza inmóvil, solo mueve la mirada.',
    duration: 30,
    accent: '#fbbf24',
    motion: { type: 'linear', axis: 'y', period: 3.2, span: 0.72 },
  },
  {
    id: 'diagonal',
    name: 'Diagonales',
    instruction: 'Recorre las esquinas siguiendo el punto en diagonal.',
    duration: 30,
    accent: '#fb923c',
    motion: { type: 'diagonal', period: 3.0, span: 0.78 },
  },
  {
    id: 'circle',
    name: 'Círculos',
    instruction: 'Acompaña al punto trazando un círculo amplio. Cambiará de sentido a la mitad.',
    duration: 36,
    accent: '#f472b6',
    motion: { type: 'circle', period: 4.0, radius: 0.4, reverseAt: 0.5 },
  },
  {
    id: 'figure8',
    name: 'Ocho infinito',
    instruction: 'Sigue el recorrido en forma de ∞. Suaviza y coordina ambos ojos.',
    duration: 36,
    accent: '#a78bfa',
    motion: { type: 'figure8', period: 5.0, width: 0.8, height: 0.5 },
  },
  {
    id: 'convergence',
    name: 'Enfoque cerca–lejos',
    instruction: 'Enfoca el punto mientras se acerca y se aleja. Entrena la convergencia.',
    duration: 34,
    accent: '#34d399',
    motion: { type: 'convergence', period: 4.5 },
  },
  {
    id: 'rule20',
    name: 'Regla 20-20-20',
    instruction: 'Mira algo lejano (a 6 metros) durante toda la cuenta. Descansa el enfoque.',
    duration: 20,
    accent: '#38bdf8',
    motion: { type: 'far' },
  },
  {
    id: 'palming',
    name: 'Palming y respiración',
    instruction: 'Frota tus manos, cúbrete los ojos sin presionar y respira al ritmo del círculo.',
    duration: 45,
    accent: '#94a3b8',
    motion: { type: 'rest', breath: 8 },
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EXERCISES };
}
