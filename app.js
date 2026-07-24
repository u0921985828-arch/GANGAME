/* ============ VistaViva — lógica de la aplicación ============ */
(function () {
  'use strict';

  // ---------- Utilidades ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const STORE_KEY = 'vistaviva.v1';

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayDiff = (a, b) => {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
    const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------- Estado persistente ----------
  const DEFAULT_STATE = {
    streak: 0,
    lastDone: null,     // clave de día de la última rutina completada
    total: 0,           // rutinas totales
    history: [],        // claves de día completadas (para la semana)
    settings: { sound: true, haptics: true, reduced: false, intensity: 1 },
  };

  const prefersReducedMotion = () => {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  };
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        // Primer arranque: respeta la preferencia del sistema.
        const s = structuredClone(DEFAULT_STATE);
        s.settings.reduced = prefersReducedMotion();
        return s;
      }
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* almacenamiento no disponible */ }
  }

  let state = loadState();

  // ---------- Audio (motor de cues suaves con WebAudio) ----------
  let audioCtx = null, masterGain = null;
  function ensureAudio() {
    if (!state.settings.sound) return null;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5;
        // suavizado de agudos para un timbre menos “pitido”
        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.6;
        masterGain.connect(lp).connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch { return null; }
  }
  // Una nota con envolvente suave (ataque corto, caída exponencial).
  function tone(freq, dur, vol, type = 'triangle', delay = 0) {
    const ac = ensureAudio();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch { /* audio no disponible */ }
  }
  // Cues con nombre (timbre y musicalidad cuidados).
  function sfx(name) {
    switch (name) {
      case 'tick':  tone(392, 0.06, 0.05, 'sine'); break;                 // preparación (sol)
      case 'count': tone(523, 0.07, 0.05, 'sine'); break;                 // últimos 3 s (do)
      case 'go':    tone(587, 0.10, 0.06, 'triangle'); tone(880, 0.14, 0.05, 'triangle', 0.09); break; // re→la
      case 'jump':  tone(680, 0.045, 0.045, 'sine'); break;               // salto sacádico
      case 'win':   [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 0.06, 'triangle', i * 0.11)); break; // do-mi-sol-do
      case 'toggle': tone(523, 0.05, 0.04, 'sine'); break;
    }
  }
  // Compatibilidad: llamadas antiguas beep(freq,dur,vol).
  function beep(freq = 660, dur = 0.12, vol = 0.06) { tone(freq, dur, vol, 'sine'); }
  function haptic(ms = 20) {
    if (state.settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  }

  // ---------- Referencias DOM ----------
  const screens = { home: $('#home'), player: $('#player'), done: $('#done') };
  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  // Fuente del canvas cacheada (leerla por frame forzaría reflow).
  let FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const el = {
    streakCount: $('#streak-count'), streakStatus: $('#streak-status'), weekDots: $('#week-dots'),
    routineSummary: $('#routine-summary'), exerciseList: $('#exercise-list'),
    exIndex: $('#ex-index'), exName: $('#ex-name'), exInstruction: $('#ex-instruction'),
    exTimer: $('#ex-timer'), progressBar: $('#progress-bar'), ringFg: $('#ring-fg'),
    icPause: $('#ic-pause'), icPlay: $('#ic-play'),
    doneStreak: $('#done-streak'), doneTotal: $('#done-total'), doneMins: $('#done-mins'), doneSub: $('#done-sub'),
    doneSkills: $('#done-skills'),
  };

  // ---------- Navegación de pantallas ----------
  function show(name) {
    Object.entries(screens).forEach(([k, node]) => {
      const active = k === name;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  // ---------- Duración efectiva ----------
  const effDuration = (ex) => Math.round(ex.duration * state.settings.intensity);
  const totalRoutineSeconds = () => EXERCISES.reduce((s, ex) => s + effDuration(ex), 0);

  // ---------- Render de inicio ----------
  function renderHome() {
    el.streakCount.textContent = state.streak;
    const doneToday = state.lastDone === todayKey();
    el.streakStatus.textContent = doneToday
      ? '¡Hecho por hoy! Vuelve mañana'
      : state.streak > 0 ? 'Mantén viva tu racha hoy' : 'Empieza tu racha hoy';

    // semana (7 días, hoy al final)
    el.weekDots.innerHTML = '';
    const set = new Set(state.history);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const span = document.createElement('span');
      if (set.has(key)) span.classList.add('on');
      if (i === 0) span.classList.add('today');
      el.weekDots.appendChild(span);
    }

    const mins = Math.round(totalRoutineSeconds() / 60);
    el.routineSummary.textContent = `${EXERCISES.length} ejercicios · ~${mins} min`;

    el.exerciseList.innerHTML = '';
    let currentCat = null;
    EXERCISES.forEach((ex) => {
      if (ex.category !== currentCat) {
        currentCat = ex.category;
        const head = document.createElement('li');
        head.className = 'ex-cat';
        head.textContent = (typeof CATEGORIES !== 'undefined' && CATEGORIES[currentCat]) || currentCat;
        el.exerciseList.appendChild(head);
      }
      const li = document.createElement('li');
      li.className = 'ex-item';
      li.innerHTML = `
        <span class="ex-dot" style="background:${ex.accent}"></span>
        <span class="ex-body"><b></b><small></small></span>
        <span class="ex-time">${effDuration(ex)}s</span>`;
      li.querySelector('b').textContent = ex.name;
      li.querySelector('small').textContent = ex.goal || ex.instruction.split('.')[0] + '.';
      el.exerciseList.appendChild(li);
    });
  }

  // ============================================================
  //  MOTOR DE ANIMACIÓN (canvas)
  // ============================================================
  const READY_SECS = 3;              // cuenta atrás "prepárate" antes de cada ejercicio
  const player = {
    index: 0,
    phase: 'ready',                  // 'ready' | 'active'
    exElapsed: 0,                    // segundos transcurridos (fase activa)
    readyElapsed: 0,                 // segundos transcurridos (cuenta atrás)
    paused: false,
    running: false,
    lastTs: 0,
    rafId: 0,
    lastWholeSec: -1,
    lastReadyTick: -1,
    saccadeIdx: -1,                  // para el tic al saltar en sacádicos
    trail: [],                       // estela del objetivo (seguimientos)
  };

  let cssW = 0, cssH = 0;
  function resizeCanvas() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width; cssH = rect.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Evalúa la posición/estado del objetivo. Devuelve coords normalizadas [-1,1],
  // escala de radio y un modo opcional para renderizados especiales.
  function evaluate(ex, t) {
    const m = ex.motion;
    const slow = state.settings.reduced ? 1.4 : 1;
    switch (m.type) {
      case 'blink': {
        const phase = (t % (m.period * slow)) / (m.period * slow); // 0..1
        // cierre rápido cerca de phase 0.5
        const d = Math.abs(phase - 0.5);
        const close = clamp(1 - d / 0.12, 0, 1); // 1 = cerrado
        return { mode: 'blink', close };
      }
      case 'linear': {
        const s = Math.sin((t / (m.period * slow)) * TAU) * m.span;
        return m.axis === 'x' ? { x: s, y: 0, r: 1 } : { x: 0, y: s, r: 1 };
      }
      case 'diagonal': {
        const s = Math.sin((t / (m.period * slow)) * TAU) * m.span;
        const flip = Math.floor(t / (m.period * slow)) % 2 === 0 ? 1 : -1;
        return { x: s, y: s * flip, r: 1 };
      }
      case 'circle': {
        const prog = t / (effDuration(ex));
        const dir = prog >= (m.reverseAt || 1) ? -1 : 1;
        const ang = (t / (m.period * slow)) * TAU * dir;
        return { x: Math.cos(ang) * m.radius / 0.5 * 0.85, y: Math.sin(ang) * m.radius / 0.5 * 0.85, r: 1 };
      }
      case 'figure8': {
        const a = (t / (m.period * slow)) * TAU;
        return { x: Math.sin(a) * m.width, y: Math.sin(a) * Math.cos(a) * 2 * m.height, r: 1 };
      }
      case 'convergence': {
        const p = (Math.sin((t / (m.period * slow)) * TAU) + 1) / 2; // 0..1
        return { x: 0, y: 0, r: 0.55 + p * 1.7, mode: 'convergence', near: p };
      }
      case 'far':
        return { mode: 'far' };
      case 'rest':
        return { mode: 'rest', breath: m.breath * (state.settings.reduced ? 1.25 : 1) };
      default:
        return { x: 0, y: 0, r: 1 };
    }
  }

  // Convierte coordenadas normalizadas [-1,1] a píxeles del lienzo, dejando
  // márgenes (más grande abajo, donde están los controles y el texto).
  function norm2px(nx, ny) {
    // Reservamos abajo el espacio del texto/controles para que ningún objetivo
    // los invada; el campo de juego se centra en la mitad superior visible.
    const marginX = 48, marginTop = 54;
    const marginBot = Math.min(cssH * 0.30, 240);
    const halfX = (cssW - marginX * 2) / 2;
    const cx = cssW / 2 + nx * halfX;
    const midY = (marginTop + (cssH - marginBot)) / 2;
    const halfY = (cssH - marginBot - marginTop) / 2;
    const cy = midY + ny * halfY;
    return { cx, cy };
  }

  function drawTarget(nx, ny, rScale, accent, alpha) {
    const { cx, cy } = norm2px(nx, ny);
    const base = Math.min(cssW, cssH) * 0.05;
    const r = base * rScale;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    // halo
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
    g.addColorStop(0, accent + 'aa');
    g.addColorStop(1, accent + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3, 0, TAU); ctx.fill();
    // núcleo
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffffcc';
    ctx.beginPath(); ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Marcador tenue (posición candidata en sacádicos/Brock).
  function drawGhostDot(nx, ny, rScale, accent) {
    const { cx, cy } = norm2px(nx, ny);
    const r = Math.min(cssW, cssH) * 0.05 * rScale;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  const slowFactor = () => (state.settings.reduced ? 1.4 : 1);

  // Sacádicos: dos o cinco dianas fijas; se ilumina una a saltos.
  function drawSaccade(ex, t) {
    const m = ex.motion;
    const interval = m.interval * slowFactor();
    const idx = Math.floor(t / interval);
    let pts, order;
    if (m.pattern === 'horizontal') {
      pts = [[-0.82, 0], [0.82, 0]];
      order = [0, 1];
    } else {
      pts = [[-0.78, -0.58], [0.78, 0.58], [0.78, -0.58], [-0.78, 0.58], [0, 0]];
      order = [0, 1, 2, 3, 4, 2, 0, 3, 1, 4];
    }
    const active = order[idx % order.length];
    if (idx !== player.saccadeIdx) { player.saccadeIdx = idx; sfx('jump'); }
    pts.forEach((p, i) => { if (i !== active) drawGhostDot(p[0], p[1], 0.7, ex.accent); });
    // pulso al aparecer
    const frac = (t % interval) / interval;
    const pulse = 1 + Math.max(0, 0.5 - frac) * 0.8;
    drawTarget(pts[active][0], pts[active][1], pulse, ex.accent);
  }

  // Cuerda de Brock: línea en perspectiva con 3 cuentas; se ilumina una.
  function drawBrock(ex, t) {
    const m = ex.motion;
    const interval = m.interval * slowFactor();
    const nearY = 0.62, farY = -0.82;
    const fracs = [0.16, 0.5, 0.86]; // near, media, lejos (0=near)
    const labels = ['Cerca', 'Media', 'Lejos'];
    const active = Math.floor(t / interval) % 3;
    const near = norm2px(0, nearY), far = norm2px(0, farY);
    // cuerda
    ctx.save();
    ctx.strokeStyle = ex.accent + '66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(near.cx, near.cy); ctx.lineTo(far.cx, far.cy); ctx.stroke();
    ctx.restore();
    fracs.forEach((f, i) => {
      const ny = nearY + (farY - nearY) * f;
      const sizeScale = 1.15 - f * 0.7; // más grande cerca (abajo)
      if (i === active) drawTarget(0, ny, sizeScale * 1.1, ex.accent);
      else drawGhostDot(0, ny, sizeScale, ex.accent);
    });
    drawCenterTextBelow(labels[active], ex.accent);
  }

  // Flexibilidad de enfoque: alterna una diana LEJOS (aro grande) y CERCA (punto).
  function drawAccommodation(ex, t) {
    const m = ex.motion;
    const half = (m.period * slowFactor()) / 2;
    const far = Math.floor(t / half) % 2 === 0;
    const { cx, cy } = norm2px(0, 0);
    if (far) {
      const R = Math.min(cssW, cssH) * 0.22;
      ctx.save();
      ctx.strokeStyle = ex.accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, TAU); ctx.stroke();
      ctx.restore();
      drawCenterTextBelow('Lejos · relaja', ex.accent);
    } else {
      drawTarget(0, 0, 0.72, ex.accent);
      drawCenterTextBelow('Cerca · enfoca', ex.accent);
    }
  }

  // Visión periférica: cruz central fija + destellos en la periferia.
  function drawPeripheral(ex, t) {
    const m = ex.motion;
    const interval = m.interval * slowFactor();
    const idx = Math.floor(t / interval);
    // cruz central
    const c = norm2px(0, 0);
    ctx.save();
    ctx.strokeStyle = ex.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    const s = Math.min(cssW, cssH) * 0.03;
    ctx.beginPath();
    ctx.moveTo(c.cx - s, c.cy); ctx.lineTo(c.cx + s, c.cy);
    ctx.moveTo(c.cx, c.cy - s); ctx.lineTo(c.cx, c.cy + s);
    ctx.stroke();
    ctx.restore();
    // destello periférico (ángulo áureo para repartir; aparece y se desvanece)
    const ang = idx * 2.39996;
    const rad = 0.82;
    const frac = (t % interval) / interval;
    const alpha = Math.max(0, 1 - frac * 1.1);
    if (alpha > 0.02) {
      drawTarget(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.9, 0.9, ex.accent, alpha);
    }
  }

  function drawBlink(close, accent) {
    const cx = cssW / 2, cy = cssH / 2;
    // Acotado para que en pantallas grandes no invada el texto inferior.
    const w = Math.min(Math.min(cssW, cssH) * 0.34, 230);
    const openH = w * 0.6 * (1 - close * 0.92);
    ctx.save();
    ctx.translate(cx, cy);
    // globo/esclera
    ctx.fillStyle = '#0a1022';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, Math.max(openH, 3), 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    if (close < 0.6) {
      // iris
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w * 0.34, openH), 0, TAU); ctx.fill();
      ctx.fillStyle = '#04070f';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w * 0.16, openH * 0.5), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawBreath(breath, t, accent) {
    const phase = (t % breath) / breath;
    const inhale = phase < 0.5;
    const p = inhale ? phase / 0.5 : 1 - (phase - 0.5) / 0.5; // 0..1..0
    const eased = 0.5 - 0.5 * Math.cos(p * Math.PI);
    const cx = cssW / 2, cy = cssH / 2;
    const rMin = Math.min(cssW, cssH) * 0.12;
    const rMax = Math.min(cssW, cssH) * 0.30;
    const r = rMin + (rMax - rMin) * eased;
    ctx.strokeStyle = accent + '55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rMax, 0, TAU); ctx.stroke();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, accent + '55'); g.addColorStop(1, accent + '10');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    return inhale ? 'Inspira' : 'Espira';
  }

  function drawCenterText(text, accent) {
    ctx.fillStyle = '#eef2fb';
    ctx.font = `600 ${Math.min(cssW, cssH) * 0.06}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cssW / 2, cssH / 2);
  }

  // Tinte ambiental sutil del color del ejercicio (profundidad).
  function drawAmbient(accent) {
    const { cx, cy } = norm2px(0, 0);
    const R = Math.max(cssW, cssH) * 0.7;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, accent + '14');
    g.addColorStop(1, accent + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  // Estela del objetivo en los seguimientos (facilita el seguimiento suave).
  function drawTrail(accent) {
    const n = player.trail.length;
    const base = Math.min(cssW, cssH) * 0.05;
    for (let i = 0; i < n; i++) {
      const p = player.trail[i];
      const k = (i + 1) / n;             // 0 (viejo) → 1 (reciente)
      const { cx, cy } = norm2px(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = 0.10 * k;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, cy, base * (0.35 + 0.5 * k), 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function renderFrame(ex, t) {
    ctx.clearRect(0, 0, cssW, cssH);
    drawAmbient(ex.accent);
    // Tipos con dibujo propio (no pasan por evaluate).
    switch (ex.motion.type) {
      case 'saccade': drawSaccade(ex, t); return;
      case 'brock': drawBrock(ex, t); return;
      case 'accommodation': drawAccommodation(ex, t); return;
      case 'peripheral': drawPeripheral(ex, t); return;
    }
    const s = evaluate(ex, t);
    if (s.mode === 'blink') {
      drawBlink(s.close, ex.accent);
      if (s.close > 0.6) { ctx.save(); drawCenterTextBelow('Parpadea', ex.accent); ctx.restore(); }
      return;
    }
    if (s.mode === 'far') {
      const remain = Math.ceil(effDuration(ex) - t);
      drawCenterText(String(Math.max(remain, 0)), ex.accent);
      drawCenterTextBelow('Mira a lo lejos (6 m)', ex.accent);
      return;
    }
    if (s.mode === 'rest') {
      const word = drawBreath(s.breath, t, ex.accent);
      drawCenterTextBelow(word, ex.accent);
      return;
    }
    if (s.mode === 'convergence') {
      drawTarget(0, 0, s.r, ex.accent);
      drawCenterTextBelow(s.near > 0.5 ? 'Cerca' : 'Lejos', ex.accent);
      return;
    }
    // Seguimientos: estela (salvo movimiento reducido) + objetivo.
    if (!state.settings.reduced) {
      player.trail.push({ x: s.x, y: s.y });
      if (player.trail.length > 16) player.trail.shift();
      drawTrail(ex.accent);
    }
    drawTarget(s.x, s.y, s.r || 1, ex.accent);
  }

  // Superposición al pausar.
  function drawPausedOverlay() {
    const { cx, cy } = norm2px(0, 0);
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.6)';
    ctx.fillRect(0, 0, cssW, cssH);
    const s = Math.min(cssW, cssH) * 0.05;
    ctx.fillStyle = '#eef2fb';
    ctx.fillRect(cx - s * 0.7, cy - s, s * 0.5, s * 2);
    ctx.fillRect(cx + s * 0.2, cy - s, s * 0.5, s * 2);
    ctx.font = `700 ${Math.min(cssW, cssH) * 0.045}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('En pausa', cx, cy + s * 3);
    ctx.restore();
  }

  // Pantalla de preparación: aro que se llena + cuenta atrás.
  function renderReady(ex, prog) {
    ctx.clearRect(0, 0, cssW, cssH);
    drawAmbient(ex.accent);
    const { cx, cy } = norm2px(0, 0);
    const R = Math.min(Math.min(cssW, cssH) * 0.16, 118);
    const font = FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // "Prepárate" encima del aro (zona despejada, no invade la cabecera)
    ctx.fillStyle = ex.accent;
    ctx.font = `700 ${R * 0.34}px ${font}`;
    ctx.fillText('Prepárate', cx, cy - R - R * 0.5);
    ctx.save();
    ctx.strokeStyle = '#ffffff1f'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ex.accent; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1)); ctx.stroke();
    ctx.restore();
    const n = Math.max(1, Math.ceil(READY_SECS - prog * READY_SECS));
    ctx.fillStyle = '#eef2fb';
    ctx.font = `800 ${R * 0.9}px ${font}`;
    ctx.fillText(String(n), cx, cy + 2);
  }

  function drawCenterTextBelow(text, accent) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.min(cssW, cssH) * 0.055}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cssW / 2, cssH * 0.78);
  }

  // ---------- Wake Lock (evita que la pantalla se apague al entrenar) ----------
  let wakeLock = null;
  async function acquireWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* no disponible */ }
  }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch {} wakeLock = null; }

  // ---------- Anillo de progreso del ejercicio (alrededor del botón) ----------
  const RING_C = 2 * Math.PI * 46;
  function setRing(p, accent) {
    if (!el.ringFg) return;
    el.ringFg.style.stroke = accent;
    el.ringFg.style.strokeDashoffset = String(RING_C * (1 - clamp(p, 0, 1)));
  }
  const overallPct = (frac) => ((player.index + frac) / EXERCISES.length) * 100;

  // ---------- Bucle principal ----------
  function loop(ts) {
    if (!player.running) return;
    if (!player.lastTs) player.lastTs = ts;
    const dt = Math.min((ts - player.lastTs) / 1000, 0.1);
    player.lastTs = ts;

    const ex = EXERCISES[player.index];
    const readySecs = state.settings.reduced ? READY_SECS + 0.5 : READY_SECS;

    // --- Fase: prepárate (cuenta atrás) ---
    if (player.phase === 'ready') {
      if (!player.paused) player.readyElapsed += dt;
      const n = Math.max(1, Math.ceil(readySecs - player.readyElapsed));
      if (n !== player.lastReadyTick) { player.lastReadyTick = n; sfx('tick'); }
      renderReady(ex, player.readyElapsed / readySecs);
      el.exTimer.textContent = '···';
      el.progressBar.style.width = `${overallPct(0)}%`;
      setRing(0, ex.accent);
      if (player.paused) drawPausedOverlay();
      if (player.readyElapsed >= readySecs) enterActive();
      player.rafId = requestAnimationFrame(loop);
      return;
    }

    // --- Fase: activo ---
    const dur = effDuration(ex);
    if (!player.paused) player.exElapsed += dt;

    const remain = dur - player.exElapsed;
    const wholeRemain = Math.ceil(remain);
    if (wholeRemain !== player.lastWholeSec) {
      player.lastWholeSec = wholeRemain;
      if (wholeRemain <= 3 && wholeRemain >= 1) sfx('count');
    }

    renderFrame(ex, player.exElapsed);
    // transición de entrada (aparición desde negro), salvo movimiento reducido
    const fade = clamp(player.exElapsed / 0.45, 0, 1);
    if (fade < 1 && !state.settings.reduced) { ctx.save(); ctx.fillStyle = `rgba(5,7,15,${1 - fade})`; ctx.fillRect(0, 0, cssW, cssH); ctx.restore(); }

    el.exTimer.textContent = fmtTime(Math.max(remain, 0));
    el.progressBar.style.width = `${overallPct(clamp(player.exElapsed / dur, 0, 1))}%`;
    setRing(player.exElapsed / dur, ex.accent);
    if (player.paused) drawPausedOverlay();

    if (player.exElapsed >= dur) { advance(1); }

    player.rafId = requestAnimationFrame(loop);
  }

  function enterActive() {
    player.phase = 'active';
    player.exElapsed = 0;
    player.lastWholeSec = -1;
    player.trail.length = 0;
    player.saccadeIdx = -1;
    sfx('go');
    haptic(20);
  }

  function loadExercise(i) {
    const ex = EXERCISES[i];
    el.exIndex.textContent = `${i + 1} / ${EXERCISES.length}`;
    el.exName.textContent = ex.name;
    el.exInstruction.textContent = ex.instruction;
    el.progressBar.style.background = ex.accent;
    player.phase = 'ready';
    player.readyElapsed = 0;
    player.exElapsed = 0;
    player.lastReadyTick = -1;
    player.lastWholeSec = -1;
    player.trail.length = 0;
    player.saccadeIdx = -1;
    el.exTimer.textContent = '···';
    setRing(0, ex.accent);
    haptic(15);
  }

  function advance(dir) {
    const next = player.index + dir;
    if (next >= EXERCISES.length) { finishRoutine(); return; }
    if (next < 0) { player.exElapsed = 0; player.phase = 'active'; return; }
    player.index = next;
    loadExercise(next);
  }

  // Salta la cuenta atrás y empieza ya el ejercicio.
  function skipReady() { if (player.running && player.phase === 'ready') enterActive(); }

  function startRoutine() {
    player.index = 0;
    player.paused = false;
    player.running = true;
    player.lastTs = 0;
    show('player');
    resizeCanvas();
    loadExercise(0);
    setPaused(false);
    acquireWake();
    cancelAnimationFrame(player.rafId);
    player.rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    player.running = false;
    cancelAnimationFrame(player.rafId);
    player.rafId = 0;
    player.lastTs = 0;
  }

  function setPaused(p) {
    player.paused = p;
    el.icPause.style.display = p ? 'none' : 'block';
    el.icPlay.style.display = p ? 'block' : 'none';
    $('#btn-pause').setAttribute('aria-label', p ? 'Reanudar' : 'Pausar');
  }

  function exitToHome() {
    stopLoop();
    releaseWake();
    renderHome();
    show('home');
  }

  function finishRoutine() {
    stopLoop();
    releaseWake();
    recordCompletion();
    renderDone();
    show('done');
    haptic([30, 40, 60]);
    sfx('win');
  }

  // ---------- Registro de progreso ----------
  function recordCompletion() {
    const today = todayKey();
    if (state.lastDone === today) {
      // ya contaba hoy: no duplicar racha ni total
      renderHome();
      return;
    }
    if (state.lastDone && dayDiff(state.lastDone, today) === 1) state.streak += 1;
    else state.streak = 1;
    state.lastDone = today;
    state.total += 1;
    if (!state.history.includes(today)) state.history.push(today);
    if (state.history.length > 60) state.history = state.history.slice(-60);
    saveState();
  }

  const SKILL_LABEL = {
    calentamiento: 'Calentamiento', seguimiento: 'Seguimiento', sacadicos: 'Sacádicos',
    enfoque: 'Enfoque', convergencia: 'Convergencia', periferia: 'Periferia', habitos: 'Descanso',
  };
  function renderDone() {
    el.doneStreak.textContent = state.streak;
    el.doneTotal.textContent = state.total;
    el.doneMins.textContent = Math.max(1, Math.round(totalRoutineSeconds() / 60));
    el.doneSub.textContent = state.streak > 1
      ? `¡${state.streak} días seguidos! Sigue así.`
      : 'Tus ojos te lo agradecen.';

    // Resumen de habilidades entrenadas (categorías presentes + conteo).
    const order = [], byCat = {};
    EXERCISES.forEach((ex) => {
      if (!byCat[ex.category]) { byCat[ex.category] = { n: 0, accent: ex.accent }; order.push(ex.category); }
      byCat[ex.category].n += 1;
    });
    el.doneSkills.innerHTML = '';
    order.forEach((cat) => {
      const chip = document.createElement('span');
      chip.className = 'skill';
      chip.innerHTML = `<span class="skill__dot" style="background:${byCat[cat].accent}"></span>`;
      chip.appendChild(document.createTextNode(`${SKILL_LABEL[cat] || cat} · ${byCat[cat].n}`));
      el.doneSkills.appendChild(chip);
    });
  }

  // ============================================================
  //  AJUSTES
  // ============================================================
  const dlg = $('#settings');
  const setInputs = {
    sound: $('#set-sound'), haptics: $('#set-haptics'),
    reduced: $('#set-reduced'), intensity: $('#set-intensity'),
  };
  function syncSettingsUI() {
    setInputs.sound.checked = state.settings.sound;
    setInputs.haptics.checked = state.settings.haptics;
    setInputs.reduced.checked = state.settings.reduced;
    setInputs.intensity.value = String(state.settings.intensity);
  }
  function bindSettings() {
    setInputs.sound.addEventListener('change', (e) => { state.settings.sound = e.target.checked; saveState(); if (e.target.checked) sfx('toggle'); });
    setInputs.haptics.addEventListener('change', (e) => { state.settings.haptics = e.target.checked; saveState(); haptic(); });
    setInputs.reduced.addEventListener('change', (e) => { state.settings.reduced = e.target.checked; saveState(); });
    setInputs.intensity.addEventListener('change', (e) => { state.settings.intensity = parseFloat(e.target.value) || 1; saveState(); renderHome(); });
    $('#set-reset').addEventListener('click', () => {
      if (confirm('¿Reiniciar tu racha y estadísticas? Esta acción no se puede deshacer.')) {
        const settings = state.settings;
        state = structuredClone(DEFAULT_STATE);
        state.settings = settings;
        saveState(); renderHome();
        dlg.close();
      }
    });
  }

  // ============================================================
  //  EVENTOS
  // ============================================================
  function bindEvents() {
    $('#btn-start').addEventListener('click', startRoutine);
    $('#btn-exit').addEventListener('click', exitToHome);
    $('#btn-home').addEventListener('click', exitToHome);
    $('#btn-pause').addEventListener('click', () => { setPaused(!player.paused); haptic(); });
    $('#btn-next').addEventListener('click', () => advance(1));
    $('#btn-prev').addEventListener('click', () => {
      // en cuenta atrás o en los primeros 2s → retrocede; si no, reinicia el actual
      if (player.phase === 'active' && player.exElapsed > 2) {
        player.exElapsed = 0; player.lastWholeSec = -1; player.trail.length = 0; player.saccadeIdx = -1;
      } else advance(-1);
    });
    // tocar el lienzo salta la cuenta atrás
    canvas.addEventListener('pointerdown', skipReady);
    $('#btn-settings').addEventListener('click', () => { syncSettingsUI(); dlg.showModal(); });

    const coach = $('#coach');
    $('#btn-coach').addEventListener('click', () => coach.showModal());
    $('#coach-close').addEventListener('click', () => coach.close());
    // cerrar diálogos al tocar fuera del contenido
    [coach, dlg].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

    window.addEventListener('resize', () => { if (player.running) resizeCanvas(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (player.running && !player.paused) setPaused(true);
      } else if (player.running) {
        acquireWake();               // el Wake Lock se libera al ocultar: re-adquirir
      }
    });
    // teclado (accesibilidad de escritorio)
    document.addEventListener('keydown', (e) => {
      if (!player.running) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (player.phase === 'ready') skipReady(); else setPaused(!player.paused);
      } else if (e.key === 'ArrowRight') advance(1);
      else if (e.key === 'ArrowLeft') advance(-1);
      else if (e.key === 'Escape') exitToHome();
    });
  }

  // ============================================================
  //  PWA / Service worker
  // ============================================================
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline no disponible */ });
      });
    }
  }

  // ---------- Init ----------
  function init() {
    try { FONT = getComputedStyle(document.body).fontFamily || FONT; } catch {}
    renderHome();
    bindEvents();
    bindSettings();
    registerSW();
  }
  init();
})();
