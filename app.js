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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
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

  // ---------- Audio (cue corto) ----------
  let audioCtx = null;
  function beep(freq = 660, dur = 0.12, vol = 0.06) {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur + 0.02);
    } catch { /* audio no disponible */ }
  }
  function haptic(ms = 20) {
    if (state.settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  }

  // ---------- Referencias DOM ----------
  const screens = { home: $('#home'), player: $('#player'), done: $('#done') };
  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  const el = {
    streakCount: $('#streak-count'), streakStatus: $('#streak-status'), weekDots: $('#week-dots'),
    routineSummary: $('#routine-summary'), exerciseList: $('#exercise-list'),
    exIndex: $('#ex-index'), exName: $('#ex-name'), exInstruction: $('#ex-instruction'),
    exTimer: $('#ex-timer'), progressBar: $('#progress-bar'),
    icPause: $('#ic-pause'), icPlay: $('#ic-play'),
    doneStreak: $('#done-streak'), doneTotal: $('#done-total'), doneMins: $('#done-mins'), doneSub: $('#done-sub'),
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
    EXERCISES.forEach((ex) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="ex-dot" style="background:${ex.accent}"></span>
        <span class="ex-body"><b>${ex.name}</b><small></small></span>
        <span class="ex-time">${effDuration(ex)}s</span>`;
      li.querySelector('small').textContent = ex.instruction.split('.')[0] + '.';
      el.exerciseList.appendChild(li);
    });
  }

  // ============================================================
  //  MOTOR DE ANIMACIÓN (canvas)
  // ============================================================
  const player = {
    index: 0,
    exElapsed: 0,    // segundos transcurridos del ejercicio actual
    paused: false,
    running: false,
    lastTs: 0,
    rafId: 0,
    lastWholeSec: -1,
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

  function drawTarget(nx, ny, rScale, accent) {
    const margin = 46;
    const cx = cssW / 2 + nx * (cssW / 2 - margin);
    const cy = cssH / 2 + ny * (cssH / 2 - margin - 40);
    const base = Math.min(cssW, cssH) * 0.05;
    const r = base * rScale;
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
  }

  function drawBlink(close, accent) {
    const cx = cssW / 2, cy = cssH / 2;
    const w = Math.min(cssW, cssH) * 0.34;
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
    ctx.font = `600 ${Math.min(cssW, cssH) * 0.06}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cssW / 2, cssH / 2);
  }

  function renderFrame(ex, t) {
    ctx.clearRect(0, 0, cssW, cssH);
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
    drawTarget(s.x, s.y, s.r || 1, ex.accent);
  }

  function drawCenterTextBelow(text, accent) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.min(cssW, cssH) * 0.055}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cssW / 2, cssH * 0.78);
  }

  // ---------- Bucle principal ----------
  function loop(ts) {
    if (!player.running) return;
    if (!player.lastTs) player.lastTs = ts;
    const dt = Math.min((ts - player.lastTs) / 1000, 0.1);
    player.lastTs = ts;

    const ex = EXERCISES[player.index];
    const dur = effDuration(ex);

    if (!player.paused) player.exElapsed += dt;

    // aviso sonoro en los últimos 3 segundos
    const remain = dur - player.exElapsed;
    const wholeRemain = Math.ceil(remain);
    if (wholeRemain !== player.lastWholeSec) {
      player.lastWholeSec = wholeRemain;
      if (wholeRemain <= 3 && wholeRemain >= 1) beep(520, 0.08, 0.05);
    }

    renderFrame(ex, player.exElapsed);
    el.exTimer.textContent = fmtTime(Math.max(remain, 0));
    el.progressBar.style.width = `${clamp((player.exElapsed / dur) * 100, 0, 100)}%`;

    if (player.exElapsed >= dur) { advance(1); }

    player.rafId = requestAnimationFrame(loop);
  }

  function loadExercise(i) {
    const ex = EXERCISES[i];
    el.exIndex.textContent = `${i + 1} / ${EXERCISES.length}`;
    el.exName.textContent = ex.name;
    el.exInstruction.textContent = ex.instruction;
    el.progressBar.style.background = ex.accent;
    player.exElapsed = 0;
    player.lastWholeSec = -1;
    beep(700, 0.1, 0.06);
    haptic(25);
  }

  function advance(dir) {
    const next = player.index + dir;
    if (next >= EXERCISES.length) { finishRoutine(); return; }
    if (next < 0) { player.exElapsed = 0; return; }
    player.index = next;
    loadExercise(next);
  }

  function startRoutine() {
    player.index = 0;
    player.paused = false;
    player.running = true;
    player.lastTs = 0;
    show('player');
    resizeCanvas();
    loadExercise(0);
    setPaused(false);
    cancelAnimationFrame(player.rafId);
    player.rafId = requestAnimationFrame(loop);
    if (screen.orientation) { /* sin bloqueo forzado */ }
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
    renderHome();
    show('home');
  }

  function finishRoutine() {
    stopLoop();
    recordCompletion();
    renderDone();
    show('done');
    haptic([30, 40, 60]);
    beep(880, 0.18, 0.07);
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

  function renderDone() {
    el.doneStreak.textContent = state.streak;
    el.doneTotal.textContent = state.total;
    el.doneMins.textContent = Math.max(1, Math.round(totalRoutineSeconds() / 60));
    el.doneSub.textContent = state.streak > 1
      ? `¡${state.streak} días seguidos! Sigue así.`
      : 'Tus ojos te lo agradecen.';
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
    setInputs.sound.addEventListener('change', (e) => { state.settings.sound = e.target.checked; saveState(); if (e.target.checked) beep(); });
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
      // si llevamos >2s, reinicia el actual; si no, retrocede
      if (player.exElapsed > 2) { player.exElapsed = 0; player.lastWholeSec = -1; }
      else advance(-1);
    });
    $('#btn-settings').addEventListener('click', () => { syncSettingsUI(); dlg.showModal(); });

    window.addEventListener('resize', () => { if (player.running) resizeCanvas(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && player.running && !player.paused) setPaused(true);
    });
    // teclado (accesibilidad de escritorio)
    document.addEventListener('keydown', (e) => {
      if (!player.running) return;
      if (e.key === ' ') { e.preventDefault(); setPaused(!player.paused); }
      else if (e.key === 'ArrowRight') advance(1);
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
    renderHome();
    bindEvents();
    bindSettings();
    registerSW();
  }
  init();
})();
