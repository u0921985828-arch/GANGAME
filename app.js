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
    settings: { sound: true, haptics: true, reduced: false, intensity: 1, program: 'completa', colorblind: false, custom: null },
  };

  // Paleta segura para daltonismo (Okabe–Ito) por categoría.
  const CVD_CAT = {
    calentamiento: '#56b4e9', seguimiento: '#e69f00', sacadicos: '#009e73',
    enfoque: '#f0e442', convergencia: '#d55e00', periferia: '#cc79a7', habitos: '#0072b2',
  };
  const accentOf = (ex) => (state.settings.colorblind ? (CVD_CAT[ex.category] || ex.accent) : ex.accent);

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

  // ---------- Rutina activa (según el programa elegido) ----------
  const customIds = () => (Array.isArray(state.settings.custom) ? state.settings.custom : EXERCISES.map((e) => e.id));
  function resolveRoutine(id) {
    if (id === 'custom') {
      const sel = new Set(customIds());
      return EXERCISES.filter((e) => sel.has(e.id));   // puede quedar vacío → se deshabilita "Comenzar"
    }
    const prog = (typeof PROGRAMS !== 'undefined' && PROGRAMS.find((p) => p.id === id)) || null;
    let list;
    if (prog && prog.ids) list = prog.ids.map((x) => EXERCISES.find((e) => e.id === x)).filter(Boolean);
    else if (prog && prog.cats) list = EXERCISES.filter((e) => prog.cats.includes(e.category));
    else list = EXERCISES.slice();
    return list.length ? list : EXERCISES.slice();
  }
  let routine = resolveRoutine(state.settings.program);

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
    routineSummary: $('#routine-summary'), exerciseList: $('#exercise-list'), programs: $('#programs'),
    exIndex: $('#ex-index'), exName: $('#ex-name'), exInstruction: $('#ex-instruction'),
    exTimer: $('#ex-timer'), progressBar: $('#progress-bar'), ringFg: $('#ring-fg'),
    icPause: $('#ic-pause'), icPlay: $('#ic-play'),
    doneStreak: $('#done-streak'), doneTotal: $('#done-total'), doneMins: $('#done-mins'), doneSub: $('#done-sub'),
    doneMilestone: $('#done-milestone'),
    doneSkills: $('#done-skills'), btnStart: $('#btn-start'),
  };
  let previewItems = [];   // {ctx, ex, size} de las vistas previas animadas del inicio

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
  const totalRoutineSeconds = () => routine.reduce((s, ex) => s + effDuration(ex), 0);

  // ---------- Selector de programa (rutinas por objetivo) ----------
  function setProgram(id) {
    state.settings.program = id;
    routine = resolveRoutine(id);
    saveState();
    renderHome();
  }
  function renderPrograms() {
    if (!el.programs || typeof PROGRAMS === 'undefined') return;
    el.programs.innerHTML = '';
    PROGRAMS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prog' + (p.id === state.settings.program ? ' is-on' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', p.id === state.settings.program ? 'true' : 'false');
      btn.innerHTML = '<b></b><small></small>';
      btn.querySelector('b').textContent = p.name;
      btn.querySelector('small').textContent = p.desc;
      btn.addEventListener('click', () => setProgram(p.id));
      el.programs.appendChild(btn);
    });
  }

  // ---------- Render de inicio ----------
  function renderHome() {
    renderPrograms();
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

    const isCustom = state.settings.program === 'custom';
    const sel = new Set(customIds());
    updateStartState();

    // En "Personalizada" se muestran TODOS los ejercicios con interruptor.
    const listSource = isCustom ? EXERCISES : routine;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    el.exerciseList.innerHTML = '';
    previewItems = [];
    let currentCat = null;
    listSource.forEach((ex) => {
      if (ex.category !== currentCat) {
        currentCat = ex.category;
        const head = document.createElement('li');
        head.className = 'ex-cat';
        head.textContent = (typeof CATEGORIES !== 'undefined' && CATEGORIES[currentCat]) || currentCat;
        el.exerciseList.appendChild(head);
      }
      const li = document.createElement('li');
      li.className = 'ex-item' + (isCustom ? ' ex-item--toggle' : '');

      // Vista previa animada (mini-lienzo por ejercicio).
      const prev = document.createElement('canvas');
      prev.className = 'ex-prev'; prev.setAttribute('aria-hidden', 'true');
      prev.width = Math.round(44 * dpr); prev.height = Math.round(44 * dpr);
      const pctx = prev.getContext('2d');
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const body = document.createElement('span'); body.className = 'ex-body';
      const b = document.createElement('b'); b.textContent = ex.name;
      const sm = document.createElement('small'); sm.textContent = ex.goal || ex.instruction.split('.')[0] + '.';
      body.appendChild(b); body.appendChild(sm);
      const time = document.createElement('span'); time.className = 'ex-time'; time.textContent = `${effDuration(ex)}s`;

      li.appendChild(prev); li.appendChild(body); li.appendChild(time);

      if (isCustom) {
        const on = sel.has(ex.id);
        const chk = document.createElement('span');
        chk.className = 'ex-check' + (on ? ' is-on' : '');
        chk.setAttribute('aria-hidden', 'true');
        li.appendChild(chk);
        li.setAttribute('role', 'button');
        li.setAttribute('aria-pressed', on ? 'true' : 'false');
        li.tabIndex = 0;
        // Actualiza SOLO esta fila (sin re-render: conserva el scroll).
        const toggle = () => {
          const cur = new Set(customIds());
          const nowOn = !cur.has(ex.id);
          if (nowOn) cur.add(ex.id); else cur.delete(ex.id);
          state.settings.custom = EXERCISES.filter((e) => cur.has(e.id)).map((e) => e.id);
          routine = resolveRoutine('custom');
          saveState();
          chk.classList.toggle('is-on', nowOn);
          li.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
          updateStartState();
          haptic(10);
        };
        li.addEventListener('click', toggle);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      }

      previewItems.push({ ctx: pctx, ex, size: 44 });
      el.exerciseList.appendChild(li);
    });
    startPreviews();
  }

  function updateStartState() {
    const mins = Math.max(1, Math.round(totalRoutineSeconds() / 60));
    el.routineSummary.textContent = routine.length === 0
      ? 'Elige al menos 1 ejercicio'
      : `${routine.length} ejercicios · ~${mins} min`;
    if (el.btnStart) el.btnStart.disabled = routine.length === 0;
  }

  // ---------- Vistas previas animadas del inicio ----------
  // Posición/escala normalizada [-1,1] representativa de cada tipo de ejercicio.
  function previewPos(ex, t) {
    const m = ex.motion;
    switch (m.type) {
      case 'linear':       { const s = Math.sin(t * 2) * 0.72; return m.axis === 'x' ? { x: s, y: 0 } : { x: 0, y: s }; }
      case 'diagonal':     { const s = Math.sin(t * 2) * 0.72; return { x: s, y: s }; }
      case 'circle':       { const a = t * 2; return { x: Math.cos(a) * 0.72, y: Math.sin(a) * 0.72 }; }
      case 'figure8':      { const a = t * 2; return { x: Math.sin(a) * 0.76, y: Math.sin(a) * Math.cos(a) * 1.4 }; }
      case 'saccade':      { const idx = Math.floor(t / 0.5) % 2; return { x: idx ? 0.72 : -0.72, y: 0 }; }
      case 'brock':        { const s = Math.sin(t * 1.5) * 0.7; return { x: 0, y: s, scale: 0.8 + (s + 0.7) * 0.35 }; }
      case 'peripheral':   { const a = t * 2.2; return { x: Math.cos(a) * 0.72, y: Math.sin(a) * 0.72 }; }
      case 'convergence':  { const p = (Math.sin(t * 2) + 1) / 2; return { x: 0, y: 0, scale: 0.5 + p * 0.9 }; }
      case 'accommodation':{ const far = Math.floor(t / 1.2) % 2 === 0; return { x: 0, y: 0, scale: far ? 1.15 : 0.55, ring: far }; }
      case 'blink':        { const c = Math.abs(Math.sin(t * 2.2)); return { x: 0, y: 0, scale: 0.45 + (1 - c) * 0.75 }; }
      case 'far':          return { x: 0, y: 0, scale: 0.7 };
      case 'rest':         { const p = (Math.sin(t * 1.3) + 1) / 2; return { x: 0, y: 0, scale: 0.5 + p * 0.8 }; }
      default:             return { x: 0, y: 0 };
    }
  }
  function drawPreview(pctx, ex, t, size) {
    pctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, R = size * 0.32, col = accentOf(ex);
    const p = previewPos(ex, t);
    if (p.ring) {
      pctx.strokeStyle = col; pctx.lineWidth = 2;
      pctx.beginPath(); pctx.arc(cx, cy, R * 0.85, 0, TAU); pctx.stroke();
      return;
    }
    const px = cx + (p.x || 0) * R, py = cy + (p.y || 0) * R;
    const base = size * 0.11 * (p.scale || 1);
    const g = pctx.createRadialGradient(px, py, 0, px, py, base * 2.4);
    g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    pctx.fillStyle = g; pctx.beginPath(); pctx.arc(px, py, base * 2.4, 0, TAU); pctx.fill();
    pctx.fillStyle = col; pctx.beginPath(); pctx.arc(px, py, base, 0, TAU); pctx.fill();
  }
  let previewRaf = 0, previewStart = 0, previewLast = 0;
  function stopPreviews() { cancelAnimationFrame(previewRaf); previewRaf = 0; }
  function startPreviews() {
    stopPreviews();
    if (!previewItems.length) return;
    if (state.settings.reduced) {                       // reducido: fotograma estático
      previewItems.forEach((it) => drawPreview(it.ctx, it.ex, 0, it.size));
      return;
    }
    previewStart = 0; previewLast = 0;
    function tick(now) {
      if (!previewStart) previewStart = now;
      if (now - previewLast >= 33) {                     // ~30 fps (ahorro de batería)
        previewLast = now;
        const t = (now - previewStart) / 1000;
        for (const it of previewItems) drawPreview(it.ctx, it.ex, t, it.size);
      }
      previewRaf = requestAnimationFrame(tick);
    }
    previewRaf = requestAnimationFrame(tick);
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
    // núcleo con brillo neón
    ctx.shadowColor = accent; ctx.shadowBlur = r * 1.5;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();   // segunda pasada refuerza el halo
    ctx.shadowBlur = 0;
    // reflejo especular
    ctx.fillStyle = '#ffffffdd';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, TAU); ctx.fill();
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
    pts.forEach((p, i) => { if (i !== active) drawGhostDot(p[0], p[1], 0.7, accentOf(ex)); });
    // pulso al aparecer
    const frac = (t % interval) / interval;
    const pulse = 1 + Math.max(0, 0.5 - frac) * 0.8;
    drawTarget(pts[active][0], pts[active][1], pulse, accentOf(ex));
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
    ctx.strokeStyle = accentOf(ex) + '66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(near.cx, near.cy); ctx.lineTo(far.cx, far.cy); ctx.stroke();
    ctx.restore();
    fracs.forEach((f, i) => {
      const ny = nearY + (farY - nearY) * f;
      const sizeScale = 1.15 - f * 0.7; // más grande cerca (abajo)
      if (i === active) drawTarget(0, ny, sizeScale * 1.1, accentOf(ex));
      else drawGhostDot(0, ny, sizeScale, accentOf(ex));
    });
    drawCenterTextBelow(labels[active], accentOf(ex));
  }

  // Flexibilidad de enfoque: alterna una diana LEJOS (aro grande) y CERCA (punto).
  function drawAccommodation(ex, t) {
    const m = ex.motion;
    const half = (m.period * slowFactor()) / 2;
    const far = Math.floor(t / half) % 2 === 0;
    const { cx, cy } = norm2px(0, 0);
    if (far) {
      const R = Math.min(Math.min(cssW, cssH) * 0.22, 140);
      ctx.save();
      ctx.strokeStyle = accentOf(ex); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, TAU); ctx.stroke();
      ctx.restore();
      drawCenterTextBelow('Lejos · relaja', accentOf(ex));
    } else {
      drawTarget(0, 0, 0.72, accentOf(ex));
      drawCenterTextBelow('Cerca · enfoca', accentOf(ex));
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
    ctx.strokeStyle = accentOf(ex); ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
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
      drawTarget(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.9, 0.9, accentOf(ex), alpha);
    }
  }

  function drawBlink(close, accent) {
    const { cx, cy } = norm2px(0, 0);   // centro del campo (reserva el texto inferior)
    // Acotado para que en pantallas grandes no invada el texto inferior.
    const w = Math.min(Math.min(cssW, cssH) * 0.34, 230);
    const openH = w * 0.6 * (1 - close * 0.92);
    ctx.save();
    ctx.translate(cx, cy);
    // globo/esclera
    ctx.fillStyle = '#0a1022';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, Math.max(openH, 3), 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
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
    const { cx, cy } = norm2px(0, 0);   // centro del campo (reserva el texto inferior)
    const rMin = Math.min(cssW, cssH) * 0.11;
    const rMax = Math.min(Math.min(cssW, cssH) * 0.24, 210);
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
    const { cx, cy } = norm2px(0, 0);
    ctx.fillStyle = '#eef2fb';
    ctx.font = `600 ${Math.min(cssW, cssH) * 0.06}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
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
    drawAmbient(accentOf(ex));
    // Tipos con dibujo propio (no pasan por evaluate).
    switch (ex.motion.type) {
      case 'saccade': drawSaccade(ex, t); return;
      case 'brock': drawBrock(ex, t); return;
      case 'accommodation': drawAccommodation(ex, t); return;
      case 'peripheral': drawPeripheral(ex, t); return;
    }
    const s = evaluate(ex, t);
    if (s.mode === 'blink') {
      drawBlink(s.close, accentOf(ex));
      if (s.close > 0.6) { ctx.save(); drawCenterTextBelow('Parpadea', accentOf(ex)); ctx.restore(); }
      return;
    }
    if (s.mode === 'far') {
      const remain = Math.ceil(effDuration(ex) - t);
      drawCenterText(String(Math.max(remain, 0)), accentOf(ex));
      drawCenterTextBelow('Mira a lo lejos (6 m)', accentOf(ex));
      return;
    }
    if (s.mode === 'rest') {
      const word = drawBreath(s.breath, t, accentOf(ex));
      drawCenterTextBelow(word, accentOf(ex));
      return;
    }
    if (s.mode === 'convergence') {
      drawTarget(0, 0, s.r, accentOf(ex));
      drawCenterTextBelow(s.near > 0.5 ? 'Cerca' : 'Lejos', accentOf(ex));
      return;
    }
    // Seguimientos: estela (salvo movimiento reducido) + objetivo.
    if (!state.settings.reduced) {
      player.trail.push({ x: s.x, y: s.y });
      if (player.trail.length > 16) player.trail.shift();
      drawTrail(accentOf(ex));
    }
    drawTarget(s.x, s.y, s.r || 1, accentOf(ex));
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
    drawAmbient(accentOf(ex));
    const { cx, cy } = norm2px(0, 0);
    const R = Math.min(Math.min(cssW, cssH) * 0.16, 118);
    const font = FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // "Prepárate" encima del aro (zona despejada, no invade la cabecera)
    ctx.fillStyle = accentOf(ex);
    ctx.font = `700 ${R * 0.34}px ${font}`;
    ctx.fillText('Prepárate', cx, cy - R - R * 0.5);
    ctx.save();
    ctx.strokeStyle = '#ffffff1f'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = accentOf(ex); ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.shadowColor = accentOf(ex); ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1)); ctx.stroke();
    ctx.restore();
    const n = Math.max(1, Math.ceil(READY_SECS - prog * READY_SECS));
    ctx.fillStyle = '#eef2fb';
    ctx.font = `800 ${R * 0.9}px ${font}`;
    ctx.fillText(String(n), cx, cy + 2);
  }

  // Rótulo de estado dinámico (Cerca/Lejos, Inspira/Espira…): anclado al borde
  // superior del campo — siempre bajo la barra y sobre el elemento, en cualquier
  // proporción de pantalla, sin invadir el texto del DOM.
  function drawCenterTextBelow(text, accent) {
    const top = norm2px(0, -1);   // borde superior del campo de juego
    const fs = Math.min(cssW, cssH) * 0.05;
    ctx.fillStyle = accent;
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, top.cx, top.cy + fs * 0.9);
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
  const overallPct = (frac) => ((player.index + frac) / routine.length) * 100;

  // ---------- Bucle principal ----------
  function loop(ts) {
    if (!player.running) return;
    if (!player.lastTs) player.lastTs = ts;
    const dt = Math.min((ts - player.lastTs) / 1000, 0.1);
    player.lastTs = ts;

    const ex = routine[player.index];
    const readySecs = state.settings.reduced ? READY_SECS + 0.5 : READY_SECS;

    // --- Fase: prepárate (cuenta atrás) ---
    if (player.phase === 'ready') {
      if (!player.paused) player.readyElapsed += dt;
      const n = Math.max(1, Math.ceil(readySecs - player.readyElapsed));
      if (n !== player.lastReadyTick) { player.lastReadyTick = n; sfx('tick'); }
      renderReady(ex, player.readyElapsed / readySecs);
      el.exTimer.textContent = '···';
      el.progressBar.style.width = `${overallPct(0)}%`;
      setRing(0, accentOf(ex));
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
    setRing(player.exElapsed / dur, accentOf(ex));
    if (player.paused) drawPausedOverlay();

    if (player.exElapsed >= dur) { advance(1); }

    player.rafId = requestAnimationFrame(loop);
  }

  function enterActive() {
    player.phase = 'active';
    player.exElapsed = 0;
    player.lastWholeSec = -1;
    player.trail.length = 0;
    player.saccadeIdx = 0;   // evita un tic extra en el primer fotograma de sacádicos
    sfx('go');
    haptic(20);
  }

  function loadExercise(i) {
    const ex = routine[i];
    el.exIndex.textContent = `${i + 1} / ${routine.length}`;
    el.exName.textContent = ex.name;
    el.exInstruction.textContent = ex.instruction;
    el.progressBar.style.background = accentOf(ex);
    player.phase = 'ready';
    player.readyElapsed = 0;
    player.exElapsed = 0;
    player.lastReadyTick = -1;
    player.lastWholeSec = -1;
    player.trail.length = 0;
    player.saccadeIdx = -1;
    el.exTimer.textContent = '···';
    setRing(0, accentOf(ex));
    haptic(15);
  }

  function advance(dir) {
    const next = player.index + dir;
    if (next >= routine.length) { finishRoutine(); return; }
    if (next < 0) { loadExercise(0); return; }   // en el primer ejercicio, reinicia su cuenta atrás
    player.index = next;
    loadExercise(next);
  }

  // Salta la cuenta atrás y empieza ya el ejercicio.
  function skipReady() { if (player.running && player.phase === 'ready') enterActive(); }

  function startRoutine() {
    if (!routine.length) return;   // rutina personalizada vacía
    stopConfetti();
    stopCounts();
    stopPreviews();
    player.index = 0;
    player.paused = false;
    player.running = true;
    player.lastTs = 0;
    show('player');
    resizeCanvas();
    loadExercise(0);
    setPaused(false);
    ensureAudio();     // desbloquea el audio dentro del gesto (necesario en iOS)
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
    stopConfetti();
    stopCounts();
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
    const milestone = milestoneFor(state.streak);
    haptic(milestone ? [30, 40, 60, 40, 90] : [30, 40, 60]);
    sfx('win');
    launchConfetti(!!milestone);
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
  // Conteo animado (0 → valor) con easeOutCubic; instantáneo en movimiento reducido.
  let countRafs = [];
  function stopCounts() { countRafs.forEach((id) => cancelAnimationFrame(id)); countRafs = []; }
  function countUp(node, to) {
    if (!node) return;
    if (state.settings.reduced || to <= 0) { node.textContent = String(to); return; }
    const dur = 850; let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const p = clamp((now - start) / dur, 0, 1);
      node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) countRafs.push(requestAnimationFrame(step));
    };
    countRafs.push(requestAnimationFrame(step));
  }
  // Hitos de racha: se celebran exactamente el día en que se alcanzan.
  const MILESTONES = [
    { days: 3, emoji: '🌱', text: '3 días seguidos. El hábito echa raíces.' },
    { days: 7, emoji: '🔥', text: '¡Una semana completa! Racha en marcha.' },
    { days: 14, emoji: '⚡', text: '14 días. Tu constancia se nota.' },
    { days: 21, emoji: '💪', text: '21 días: el hábito ya es tuyo.' },
    { days: 30, emoji: '🏆', text: '¡Un mes entero! Eres imparable.' },
    { days: 50, emoji: '💎', text: '50 días. Disciplina de diamante.' },
    { days: 100, emoji: '👑', text: '¡100 días! Leyenda del entrenamiento visual.' },
  ];
  function milestoneFor(streak) {
    return MILESTONES.find((m) => m.days === streak) || null;
  }
  function renderDone() {
    stopCounts();
    countUp(el.doneStreak, state.streak);
    countUp(el.doneTotal, state.total);
    countUp(el.doneMins, Math.max(1, Math.round(totalRoutineSeconds() / 60)));

    const milestone = milestoneFor(state.streak);
    if (el.doneMilestone) {
      if (milestone) {
        el.doneMilestone.querySelector('.milestone__emoji').textContent = milestone.emoji;
        el.doneMilestone.querySelector('.milestone__text').textContent = milestone.text;
        el.doneMilestone.hidden = false;
      } else {
        el.doneMilestone.hidden = true;
      }
    }
    el.doneSub.textContent = milestone
      ? '¡Nuevo hito desbloqueado!'
      : state.streak > 1
        ? `¡${state.streak} días seguidos! Sigue así.`
        : 'Tus ojos te lo agradecen.';

    // Resumen de habilidades entrenadas (categorías de la rutina + conteo).
    const order = [], byCat = {};
    routine.forEach((ex) => {
      if (!byCat[ex.category]) { byCat[ex.category] = { n: 0, accent: accentOf(ex) }; order.push(ex.category); }
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

  // ---------- Celebración (confeti al completar) ----------
  let confettiRaf = 0;
  function stopConfetti() {
    cancelAnimationFrame(confettiRaf); confettiRaf = 0;
    const cv = $('#confetti');
    if (cv) { const c = cv.getContext('2d'); if (c) c.clearRect(0, 0, cv.width, cv.height); }
  }
  function launchConfetti(intense) {
    if (state.settings.reduced) return;               // respeta movimiento reducido
    const cv = $('#confetti'); if (!cv) return;
    const cctx = cv.getContext('2d'); if (!cctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const W = cv.clientWidth || window.innerWidth, H = cv.clientHeight || window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c', '#fca5a5'];
    // En un hito, añade dorados para un estallido más festivo.
    const colors = intense ? base.concat(['#ffd700', '#fde68a', '#f59e0b']) : base;
    const shapes = ['rect', 'rect', 'square', 'circle'];   // mezcla estilo canvas-confetti
    const N = intense ? 240 : 150;                     // más partículas en un hito
    // Dos focos (izquierda y derecha) para un estallido más lleno.
    const parts = Array.from({ length: N }, (_, i) => {
      const left = i % 2 === 0;
      return {
        x: W * (left ? 0.34 : 0.66) + (Math.random() * 40 - 20),
        y: H * 0.28 + (Math.random() * 30 - 15),
        vx: (left ? 1 : -1) * (1 + Math.random() * 3) + (Math.random() - 0.5) * 4,
        vy: (intense ? -8 : -7) - Math.random() * (intense ? 7 : 6),
        g: 0.17 + Math.random() * 0.09, size: 5 + Math.random() * (intense ? 7 : 6),
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.34,
        wob: Math.random() * TAU, wv: 0.12 + Math.random() * 0.12,   // bamboleo (giro 3D simulado)
        shape: shapes[(Math.random() * shapes.length) | 0],
        color: colors[(Math.random() * colors.length) | 0], life: 1,
      };
    });
    const DUR = intense ? 2.6 : 2.1;
    let start = 0;
    cancelAnimationFrame(confettiRaf);
    function tick(now) {
      if (!start) start = now;
      const t = (now - start) / 1000;
      cctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        p.vy += p.g; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.wob += p.wv;
        p.life = clamp(1 - t / DUR, 0, 1);
        if (p.y < H + 24 && p.life > 0) alive++;
        const sx = Math.cos(p.wob);              // aplasta/estira para simular volteo
        cctx.save(); cctx.globalAlpha = p.life; cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.scale(sx, 1);
        cctx.fillStyle = p.color;
        if (p.shape === 'circle') { cctx.beginPath(); cctx.arc(0, 0, p.size / 2, 0, TAU); cctx.fill(); }
        else if (p.shape === 'square') { cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); }
        else { cctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); }
        cctx.restore();
      }
      if (t < DUR && alive > 0) confettiRaf = requestAnimationFrame(tick);
      else { cctx.clearRect(0, 0, W, H); confettiRaf = 0; }
    }
    confettiRaf = requestAnimationFrame(tick);
  }

  // ============================================================
  //  AJUSTES
  // ============================================================
  const dlg = $('#settings');
  const setInputs = {
    sound: $('#set-sound'), haptics: $('#set-haptics'),
    reduced: $('#set-reduced'), intensity: $('#set-intensity'), colorblind: $('#set-colorblind'),
  };
  function syncSettingsUI() {
    setInputs.sound.checked = state.settings.sound;
    setInputs.haptics.checked = state.settings.haptics;
    setInputs.reduced.checked = state.settings.reduced;
    setInputs.colorblind.checked = state.settings.colorblind;
    setInputs.intensity.value = String(state.settings.intensity);
  }
  function bindSettings() {
    setInputs.sound.addEventListener('change', (e) => { state.settings.sound = e.target.checked; saveState(); if (e.target.checked) sfx('toggle'); });
    setInputs.haptics.addEventListener('change', (e) => { state.settings.haptics = e.target.checked; saveState(); haptic(); });
    setInputs.reduced.addEventListener('change', (e) => { state.settings.reduced = e.target.checked; saveState(); applyReduceClass(); renderHome(); });
    setInputs.colorblind.addEventListener('change', (e) => { state.settings.colorblind = e.target.checked; saveState(); renderHome(); });
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
        stopPreviews();              // ahorra batería con la pestaña oculta
        if (player.running && !player.paused) setPaused(true);
      } else if (player.running) {
        acquireWake();               // el Wake Lock se libera al ocultar: re-adquirir
      } else if (screens.home.classList.contains('is-active')) {
        startPreviews();             // reanudar previews al volver al inicio
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
  function applyReduceClass() {
    document.documentElement.classList.toggle('reduce-motion', !!state.settings.reduced);
  }
  function init() {
    try { FONT = getComputedStyle(document.body).fontFamily || FONT; } catch {}
    applyReduceClass();
    renderHome();
    bindEvents();
    bindSettings();
    registerSW();
  }
  init();
})();
