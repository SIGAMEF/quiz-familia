// ============================================================
// Fondos animados (dibujados con canvas, sin descargar nada)
// Cada fondo: p (colores por defecto), init(p, azar) → estado, draw(ctx, w, h, t, estado, p).
// Motor: un solo requestAnimationFrame para todos los fondos de la página; se pausa cuando el
// fondo no se ve (IntersectionObserver) o la pestaña está oculta, y con prefers-reduced-motion
// se dibuja un solo cuadro quieto.
// Lo usan el lienzo de Proyectos y Cultos (fondo { tipo: 'animado', valor: 'aurora', p: {…} }).
// ============================================================

const TAU = Math.PI * 2;
const ciclo = (v) => ((v % 1) + 1) % 1;
const HEX = /^#([0-9a-f]{6})$/i;
const hexOk = (c, d) => (HEX.test(c || '') ? c : d);
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
// números al azar repetibles (cada fondo se ve igual cada vez)
function crearAzar(semilla) {
  let s = semilla % 2147483647 || 20261028;
  const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return { R: (a, b) => a + azar() * (b - a), elegir: (arr) => arr[Math.floor(azar() * arr.length)] };
}
const sprites = new Map();
function sprite(hex) {   // luz suave reutilizable (más barato que shadowBlur)
  if (sprites.has(hex)) return sprites.get(hex);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(0.35, rgba(hex, 0.45)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); sprites.set(hex, c); return c;
}
function degradadoV(ctx, w, h, colores) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  colores.forEach((c, i) => g.addColorStop(i / Math.max(1, colores.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function mancha(ctx, x, y, r, hex, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Colores que se pueden cambiar en cada fondo: base (lista de 1–3), colores (lista de 2–5) y un color suelto (luz, linea…)
export const FONDOS = {
  aurora: { nombre: 'Aurora', p: { base: ['#050816', '#0b1033'], colores: ['#2dd4bf', '#6366f1', '#a855f7', '#22c55e'] },
    init: (p, { R }) => ({ b: p.colores.map(c => ({ c, fx: R(0.05, 0.11), fy: R(0.04, 0.09), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); ctx.globalCompositeOperation = 'lighter';
      for (const b of st.b) mancha(ctx, w * (0.5 + 0.42 * Math.sin(t * b.fx + b.ph)), h * (0.5 + 0.38 * Math.cos(t * b.fy + b.ph * 1.3)), Math.max(w, h) * 0.55, b.c, 0.38);
      ctx.globalCompositeOperation = 'source-over';
    } },
  bokeh: { nombre: 'Bokeh', p: { base: ['#0f172a', '#1e1b4b'], colores: ['#fbbf24', '#f472b6', '#60a5fa', '#fde68a'], n: 46 },
    init: (p, { R, elegir }) => ({ c: Array.from({ length: p.n }, () => ({ x: R(0, 1), y: R(0, 1.2), r: R(0.025, 0.11), v: R(0.008, 0.025), a: R(0.12, 0.4), ph: R(0, TAU), c: elegir(p.colores) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); ctx.globalCompositeOperation = 'lighter';
      for (const o of st.c) {
        const y = ciclo(o.y - t * o.v) * 1.3 - 0.15, x = o.x + Math.sin(t * 0.3 + o.ph) * 0.02, r = o.r * w;
        ctx.globalAlpha = o.a * (0.7 + 0.3 * Math.sin(t * 0.8 + o.ph)); ctx.drawImage(sprite(o.c), x * w - r, y * h - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },
  chispas: { nombre: 'Chispas de luz', p: { base: ['#07080d', '#1a1206'], colores: ['#fde68a', '#fbbf24', '#ffffff'], n: 110 },
    init: (p, { R, elegir }) => ({ c: Array.from({ length: p.n }, () => ({ x: R(0, 1), y: R(0, 1), v: R(0.02, 0.07), s: R(0.003, 0.009), ph: R(0, TAU), sw: R(0.005, 0.03), c: elegir(p.colores) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); mancha(ctx, w / 2, h * 1.05, w * 0.7, p.colores[1] || p.colores[0], 0.28 + 0.05 * Math.sin(t));
      ctx.globalCompositeOperation = 'lighter';
      for (const o of st.c) {
        const y = 1.05 - ciclo(o.y + t * o.v) * 1.1, x = o.x + Math.sin(t * 0.9 + o.ph) * o.sw, r = o.s * w * (2 + Math.sin(t * 3 + o.ph));
        ctx.globalAlpha = Math.max(0, Math.min(1, y * 1.6)) * (0.6 + 0.4 * Math.sin(t * 4 + o.ph)); ctx.drawImage(sprite(o.c), x * w - r, y * h - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },
  estrellas: { nombre: 'Cielo estrellado', p: { base: ['#02030a', '#0c0a2a', '#1b1145'], colores: ['#7c3aed', '#2563eb'] },
    init: (p, { R }) => ({ s: Array.from({ length: 240 }, () => ({ x: R(0, 1), y: R(0, 1), z: R(0.4, 1.6), ph: R(0, TAU), v: R(0.6, 2.2) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); ctx.globalCompositeOperation = 'lighter';
      mancha(ctx, w * (0.7 + 0.03 * Math.sin(t * 0.05)), h * 0.3, w * 0.5, p.colores[0], 0.22); mancha(ctx, w * 0.25, h * 0.75, w * 0.45, p.colores[1] || p.colores[0], 0.16);
      ctx.fillStyle = '#ffffff';
      for (const s of st.s) { ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * s.v * 0.5 + s.ph)); const z = Math.max(1, s.z * w / 900); ctx.fillRect(ciclo(s.x + t * 0.002 * s.z) * w, s.y * h, z, z); }
      const f = (t % 9) / 9;   // estrella fugaz cada 9 s
      if (f < 0.12) {
        const k = f / 0.12, x = w * 0.15 + k * w * 0.45, y = h * 0.12 + k * h * 0.25;
        const g = ctx.createLinearGradient(x - w * 0.12, y - h * 0.065, x, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.9)');
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, w / 700); ctx.beginPath(); ctx.moveTo(x - w * 0.12, y - h * 0.065); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },
  ondas: { nombre: 'Ondas', p: { base: ['#0b1d3a', '#132a5e'], colores: ['#38bdf8', '#818cf8', '#c084fc', '#22d3ee'] },
    init: (p, { R }) => ({ l: p.colores.map((c, i) => ({ c, y: 0.5 + i * 0.1, a: R(0.04, 0.08), f: R(1, 2.2), v: R(0.25, 0.5), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base);
      const paso = Math.max(4, w / 120);
      for (const l of st.l) {
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + paso; x += paso) { const u = x / w; ctx.lineTo(x, h * (l.y + l.a * Math.sin(u * TAU * l.f + t * l.v + l.ph) + 0.02 * Math.sin(u * TAU * 3.1 - t * 0.7))); }
        ctx.lineTo(w, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, h * (l.y - 0.1), 0, h); g.addColorStop(0, rgba(l.c, 0.35)); g.addColorStop(1, rgba(l.c, 0.05)); ctx.fillStyle = g; ctx.fill();
      }
    } },
  rayos: { nombre: 'Rayos de luz', p: { base: ['#1a1033', '#3b1d5a', '#7a4a2a'], colores: ['#ffe7b0'] },
    init: (p, { R }) => ({ r: Array.from({ length: 15 }, (_, i) => ({ a: -0.55 + i * (1.1 / 14) + R(-0.03, 0.03), w: R(0.025, 0.07), v: R(0.3, 0.9), ph: R(0, TAU) })),
      d: Array.from({ length: 50 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(0.005, 0.02), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      const luz = p.colores[0];
      degradadoV(ctx, w, h, p.base); const ox = w * 0.5, oy = -h * 0.25, L = h * 1.6, giro = Math.sin(t * 0.12) * 0.12;
      ctx.globalCompositeOperation = 'lighter';
      for (const r of st.r) {
        const a = Math.PI / 2 + r.a + giro, g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L);
        const al = 0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * r.v + r.ph)); g.addColorStop(0, rgba(luz, al * 2)); g.addColorStop(1, rgba(luz, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a - r.w) * L, oy + Math.sin(a - r.w) * L); ctx.lineTo(ox + Math.cos(a + r.w) * L, oy + Math.sin(a + r.w) * L); ctx.fill();
      }
      mancha(ctx, ox, 0, w * 0.45, luz, 0.25);
      for (const d of st.d) { const r = w * 0.004; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t + d.ph); ctx.drawImage(sprite(luz), ciclo(d.x + Math.sin(t * 0.2 + d.ph) * 0.01) * w - r * 3, ciclo(d.y - t * d.v) * h - r * 3, r * 6, r * 6); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },
  nubes: { nombre: 'Nubes al amanecer', p: { base: ['#93c5fd', '#e0e7ff', '#fbcfe8', '#fde2c8'], colores: ['#ffffff', '#fff7ed'] },
    init: (p, { R }) => ({ n: Array.from({ length: 13 }, () => ({ x: R(0, 1), y: R(0.1, 0.9), v: R(0.004, 0.012), s: R(0.12, 0.26), p: Array.from({ length: 6 }, () => [R(-1, 1), R(-0.35, 0.35), R(0.5, 1)]) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); mancha(ctx, w * 0.5, h * 0.95, w * 0.6, p.colores[1] || '#fff7ed', 0.55);
      const blanco = sprite(p.colores[0]);
      for (const n of st.n) {
        const cx = (ciclo(n.x + t * n.v) * 1.5 - 0.25) * w, cy = n.y * h, s = n.s * w;
        ctx.globalAlpha = 0.35; for (const [dx, dy, k] of n.p) ctx.drawImage(blanco, cx + dx * s - s * k, cy + dy * s - s * k * 0.6, s * k * 2, s * k * 1.2);
      }
      ctx.globalAlpha = 1;
    } },
  malla: { nombre: 'Malla de color', p: { base: ['#ff7a59'], colores: ['#ffd166', '#ef476f', '#a855f7', '#ff9f1c'] },
    init: (p, { R }) => ({ b: p.colores.map(c => ({ c, fx: R(0.08, 0.16), fy: R(0.06, 0.14), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      ctx.fillStyle = p.base[0]; ctx.fillRect(0, 0, w, h);
      for (const b of st.b) mancha(ctx, w * (0.5 + 0.45 * Math.sin(t * b.fx + b.ph)), h * (0.5 + 0.45 * Math.cos(t * b.fy + b.ph)), Math.max(w, h) * 0.6, b.c, 0.85);
    } },
  confeti: { nombre: 'Confeti festivo', p: { base: ['#7c3aed', '#f472b6', '#fb923c', '#facc15'], colores: ['#fde047', '#f472b6', '#22d3ee', '#ffffff', '#fb923c'] },
    // base[0]: color de fondo; base[1..]: manchas que se mueven detrás del confeti
    init: (p, a) => ({ m: FONDOS.malla.init({ colores: p.base.slice(1).length ? p.base.slice(1) : ['#f472b6'] }, a),
      c: Array.from({ length: 80 }, () => ({ x: a.R(0, 1), y: a.R(0, 1), v: a.R(0.04, 0.1), r: a.R(1, 3), ph: a.R(0, TAU), w: a.R(0.006, 0.012), c: a.elegir(p.colores) })) }),
    draw(ctx, w, h, t, st, p) {
      FONDOS.malla.draw(ctx, w, h, t, st.m, { base: [p.base[0]] });
      for (const o of st.c) {
        ctx.save(); ctx.translate((o.x + Math.sin(t * 1.3 + o.ph) * 0.02) * w, (ciclo(o.y + t * o.v) * 1.2 - 0.1) * h);
        ctx.rotate(t * o.r + o.ph); ctx.scale(1, Math.cos(t * 2.4 + o.ph)); ctx.fillStyle = o.c; ctx.fillRect(-o.w * w, -o.w * w * 0.45, o.w * w * 2, o.w * w * 0.9); ctx.restore();
      }
    } },
  brasas: { nombre: 'Brasas', p: { base: ['#0c0a09', '#1c0f08', '#3b1206'], colores: ['#f97316', '#fbbf24', '#ef4444'] },
    init: (p, { R, elegir }) => ({ c: Array.from({ length: 130 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(0.03, 0.09), s: R(0.002, 0.006), ph: R(0, TAU), sw: R(0.01, 0.05), c: elegir(p.colores) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); ctx.globalCompositeOperation = 'lighter';
      mancha(ctx, w * 0.5, h * 1.1, w * 0.8, p.colores[0], 0.35 + 0.08 * Math.sin(t * 1.7) + 0.04 * Math.sin(t * 4.3));
      for (const o of st.c) {
        const y = 1.05 - ciclo(o.y + t * o.v) * 1.15, x = o.x + Math.sin(t * 1.4 + o.ph) * o.sw * (1 - y), r = o.s * w * 3;
        ctx.globalAlpha = Math.max(0, Math.min(1, y * 1.4)) * (0.5 + 0.5 * Math.sin(t * 6 + o.ph)); ctx.drawImage(sprite(o.c), x * w - r, y * h - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },
  agua: { nombre: 'Agua', p: { base: ['#0e7490', '#0c4a6e', '#082f49'], colores: ['#bae6fd', '#7dd3fc'] },
    init: (p, { R }) => ({ b: Array.from({ length: 28 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(0.03, 0.08), r: R(0.003, 0.01), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      degradadoV(ctx, w, h, p.base); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(1, w / 500);
      const paso = Math.max(5, w / 100);
      for (let i = 0; i < 22; i++) {
        ctx.strokeStyle = rgba(p.colores[0], 0.05 + 0.03 * Math.sin(t + i)); ctx.beginPath();
        for (let x = 0; x <= w + paso; x += paso) { const u = x / w; const y = h * (i / 22) * 0.75 + h * 0.03 * Math.sin(u * 9 + t * 0.9 + i * 1.7) + h * 0.02 * Math.sin(u * 17 - t * 1.3 + i); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      mancha(ctx, w * (0.5 + 0.1 * Math.sin(t * 0.2)), -h * 0.1, w * 0.55, p.colores[1] || p.colores[0], 0.35);
      ctx.strokeStyle = 'rgba(224,242,254,.5)';
      for (const o of st.b) { const y = 1.05 - ciclo(o.y + t * o.v) * 1.1; ctx.beginPath(); ctx.arc((o.x + Math.sin(t * 2 + o.ph) * 0.008) * w, y * h, o.r * w, 0, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    } },
  neon: { nombre: 'Neón', p: { base: ['#0b0420', '#1a0b3d', '#2e0f4f'], colores: ['#f0abfc', '#22d3ee', '#ec4899'] },
    init: () => ({}),
    draw(ctx, w, h, t, st, p) {
      const [l1, l2 = l1, sol = l1] = p.colores;
      degradadoV(ctx, w, h, p.base); const hz = h * 0.58, vx = w / 2;
      ctx.globalCompositeOperation = 'lighter'; mancha(ctx, vx, hz, w * 0.35, sol, 0.35);
      const trazo = (col, a, lw) => { ctx.strokeStyle = rgba(col, a); ctx.lineWidth = lw; ctx.stroke(); };
      ctx.beginPath(); for (let i = 0; i < 14; i++) { const k = ciclo(i / 14 + t * 0.08), y = hz + (h - hz) * k * k; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      trazo(l1, 0.12, w / 180); trazo(l1, 0.7, Math.max(1, w / 900));
      ctx.beginPath(); for (let i = -12; i <= 12; i++) { ctx.moveTo(vx + i * w * 0.012, hz); ctx.lineTo(vx + i * w * 0.16, h); }
      trazo(l2, 0.1, w / 180); trazo(l2, 0.55, Math.max(1, w / 900));
      ctx.globalCompositeOperation = 'source-over';
    } }
};

// Colores del fondo (los por defecto + los que eligió el profesor), siempre válidos
export function parametros(f) {
  const F = FONDOS[f?.valor] || FONDOS.aurora, d = F.p, q = f?.p || {};
  const lista = (v, def, min, max) => {
    const l = Array.isArray(v) ? v.slice(0, max).map((c, i) => hexOk(c, def[i % def.length])) : def;
    return l.length >= min ? l : def;
  };
  const out = { base: lista(q.base, d.base, 1, 4), colores: lista(q.colores, d.colores, 1, 6) };
  if (d.n) out.n = Math.max(10, Math.min(120, Number(q.n) || d.n));
  return out;
}
// Color de muestra (para saber si el fondo es oscuro y para la vista sin animación)
export const colorBase = (f) => parametros(f).base[0];

// ---------- Motor ----------
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const vivos = new Set();
let rafId = 0;
const io = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(es => es.forEach(e => { if (e.target._fondo) e.target._fondo.visible = e.isIntersecting; }), { rootMargin: '80px' })
  : null;

function dibujar(s, t) {
  const { width: w, height: h } = s.cv;
  if (w > 1 && h > 1) { try { s.F.draw(s.ctx, w, h, t, s.st, s.p); } catch (e) { console.warn('Fondo animado', e); vivos.delete(s); } }
}
function bucle(ms) {
  rafId = 0;
  for (const s of vivos) {
    if (!s.cv.isConnected) { vivos.delete(s); io?.unobserve(s.cv); s.ro?.disconnect(); continue; }
    if (s.visible && !document.hidden && !reducido()) dibujar(s, ms / 1000 + s.desfase);
  }
  if (vivos.size) rafId = requestAnimationFrame(bucle);
}
const arrancar = () => { if (!rafId && vivos.size) rafId = requestAnimationFrame(bucle); };
document.addEventListener('visibilitychange', arrancar);

// Pone un fondo animado dentro de `capa` (que ya está vacía). calidad: 'baja' en miniaturas.
export function montarFondoAnimado(capa, f, { calidad = 'alta' } = {}) {
  const F = FONDOS[f?.valor] || FONDOS.aurora;
  const p = parametros(f);
  const cv = document.createElement('canvas');
  cv.className = 'fondo-animado';
  cv.setAttribute('aria-hidden', 'true');
  capa.style.backgroundColor = p.base[0];
  capa.appendChild(cv);
  const semilla = [...String(f?.valor || 'aurora')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const s = { cv, ctx: cv.getContext('2d'), F, p, st: F.init(p, crearAzar(semilla)), visible: !io, desfase: (semilla % 97) / 7,
    escala: calidad === 'baja' ? Math.min(devicePixelRatio || 1, 1) * 0.6 : Math.min(devicePixelRatio || 1, 2) };
  cv._fondo = s;
  const medir = () => {
    const w = Math.max(1, Math.round(cv.clientWidth * s.escala)), h = Math.max(1, Math.round(cv.clientHeight * s.escala));
    if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; }
    dibujar(s, reducido() ? 12 : performance.now() / 1000 + s.desfase);
  };
  if (typeof ResizeObserver === 'function') { s.ro = new ResizeObserver(medir); s.ro.observe(cv); }
  requestAnimationFrame(medir);
  io?.observe(cv);
  vivos.add(s);
  arrancar();
  return cv;
}
