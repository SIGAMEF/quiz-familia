// ============================================================
// Fondos animados con escenas (Cristianos, Niños, Jóvenes).
// Mismo formato que FONDOS: { nombre, cat, p, init(p), draw(ctx, w, h, t, st, p) }
//   - t en segundos; todo se dibuja en coordenadas relativas (0..1) * w / h.
//   - Sin imágenes ni descargas: todo es canvas, nítido en cualquier resolución.
// Uso: import { ESCENAS } from './escenas.js'; Object.assign(FONDOS, ESCENAS);
// ============================================================

const TAU = Math.PI * 2;
let semilla = 4242;
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + azar() * (b - a);
const elegir = (arr) => arr[Math.floor(azar() * arr.length)];
const ciclo = (v) => ((v % 1) + 1) % 1;
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

const cacheLuz = new Map();
function luz(hex) { // punto de luz suave reutilizable
  if (cacheLuz.has(hex)) return cacheLuz.get(hex);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(.35, rgba(hex, .45)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); cacheLuz.set(hex, c); return c;
}
function cielo(ctx, w, h, colores, y0 = 0, y1 = h) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  colores.forEach((c, i) => g.addColorStop(i / (colores.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function mancha(ctx, x, y, r, hex, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function colina(ctx, w, h, base, amp, frec, fase, color) {
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 10; x += 10) { const u = x / w; ctx.lineTo(x, h * (base + amp * Math.sin(u * frec * TAU + fase) + amp * .4 * Math.sin(u * frec * 2.3 * TAU + fase * 1.7))); }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
const PUFF = [[-1, .1, .55], [-.45, -.25, .7], [.15, -.35, .8], [.7, -.1, .6], [1.1, .15, .45], [.1, .15, .75]];
function nubeSuave(ctx, x, y, s, a, hex = '#ffffff') {
  const img = luz(hex); ctx.globalAlpha = a;
  for (const [dx, dy, k] of PUFF) ctx.drawImage(img, x + dx * s - s * k * 1.3, y + dy * s - s * k * .8, s * k * 2.6, s * k * 1.6);
  ctx.globalAlpha = 1;
}
function nubeDibujo(ctx, x, y, s, color = '#ffffff') { // nube de caricatura
  ctx.fillStyle = color; ctx.beginPath();
  for (const [dx, dy, k] of PUFF) { ctx.moveTo(x + dx * s + k * s * .55, y + dy * s * .7); ctx.arc(x + dx * s, y + dy * s * .7, k * s * .55, 0, TAU); }
  ctx.fill();
}
function cruz(ctx, cx, base, alto, color, grosor = .11) {
  const g = alto * grosor; ctx.fillStyle = color;
  ctx.fillRect(cx - g / 2, base - alto, g, alto);
  ctx.fillRect(cx - alto * .3, base - alto * .76, alto * .6, g);
}
function ave(ctx, x, y, s, fase) {
  const a = Math.sin(fase) * .55;
  ctx.beginPath(); ctx.moveTo(x - s, y - s * a * .7);
  ctx.quadraticCurveTo(x - s * .45, y - s * (.35 + a * .5), x, y);
  ctx.quadraticCurveTo(x + s * .45, y - s * (.35 + a * .5), x + s, y - s * a * .7);
  ctx.stroke();
}
function brazos(ctx, w, h, st, t, color, alto = 1) { // multitud con manos levantadas
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (const b of st.brazos) {
    const ang = -Math.PI / 2 + b.inc + Math.sin(t * b.v + b.ph) * .13, L = b.l * h * alto;
    const x0 = b.x * w, y0 = h * 1.02, x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
    ctx.lineWidth = w * .022; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x1, y1, w * .014, w * .02, ang + Math.PI / 2, 0, TAU); ctx.fill();
    ctx.lineWidth = w * .005;
    for (let k = -1.5; k <= 1.5; k++) { const a2 = ang + k * .22; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a2) * w * .022, y1 + Math.sin(a2) * w * .022); ctx.stroke(); }
  }
  for (const c of st.cabezas) { ctx.beginPath(); ctx.arc(c.x * w, h * (1.0 + Math.sin(t * 2 + c.ph) * .004), c.r * w, 0, TAU); ctx.fill(); }
}
const nuevosBrazos = (n) => ({
  brazos: Array.from({ length: n }, () => ({ x: R(0, 1), inc: R(-.35, .35), l: R(.22, .42), v: R(1.2, 2.4), ph: R(0, TAU) })),
  cabezas: Array.from({ length: Math.round(n * .8) }, () => ({ x: R(0, 1), r: R(.025, .04), ph: R(0, TAU) })),
});
function nota(ctx, x, y, s, doble, color) { // ♪ o ♫ dibujada
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * .12;
  const cab = (cx, cy) => { ctx.beginPath(); ctx.ellipse(cx, cy, s * .32, s * .23, -.4, 0, TAU); ctx.fill(); };
  if (!doble) {
    cab(x, y); ctx.beginPath(); ctx.moveTo(x + s * .28, y - s * .05); ctx.lineTo(x + s * .28, y - s * 1.3);
    ctx.quadraticCurveTo(x + s * .75, y - s * 1.0, x + s * .6, y - s * .55); ctx.stroke();
  } else {
    cab(x, y); cab(x + s * .9, y - s * .2);
    ctx.beginPath(); ctx.moveTo(x + s * .28, y - s * .05); ctx.lineTo(x + s * .28, y - s * 1.25); ctx.moveTo(x + s * 1.18, y - s * .25); ctx.lineTo(x + s * 1.18, y - s * 1.45); ctx.stroke();
    ctx.lineWidth = s * .25; ctx.beginPath(); ctx.moveTo(x + s * .22, y - s * 1.2); ctx.lineTo(x + s * 1.24, y - s * 1.4); ctx.stroke();
  }
}
function estrella5(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function hierba(ctx, w, h, st, t, color, alto = .06) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w / 500); ctx.beginPath();
  for (const b of st.hierba) { const x = b.x * w, s = Math.sin(t * 1.4 + b.ph) * .012 * w; ctx.moveTo(x, h); ctx.quadraticCurveTo(x + s * .4, h - b.l * h * alto * .5, x + s, h - b.l * h * alto); }
  ctx.stroke();
}
const nuevaHierba = (n) => Array.from({ length: n }, () => ({ x: R(0, 1), l: R(.5, 1.4), ph: R(0, TAU) }));

// ============================================================
export const ESCENAS = {
  // ------------------------ CRISTIANOS ------------------------
  cruzAtardecer: { nombre: 'Cruz al atardecer', cat: 'Cristianos',
    p: { cielo: ['#1e1b4b', '#5b21b6', '#be185d', '#f97316', '#fcd34d'], cerros: ['#3b0764', '#1e0b36', '#0a0612'] },
    init: () => ({ nubes: Array.from({ length: 9 }, () => ({ x: R(0, 1), y: R(.08, .5), s: R(.07, .14), v: R(.004, .01) })),
      aves: Array.from({ length: 5 }, () => ({ x: R(0, 1), y: R(.2, .45), s: R(.008, .014), v: R(.015, .025), ph: R(0, TAU) })), hierba: nuevaHierba(140) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo, 0, h * .85);
      mancha(ctx, w * .3, h * .74, w * .3, '#fde68a', .55 + .05 * Math.sin(t * .6));
      ctx.fillStyle = 'rgba(254,240,138,.85)'; ctx.beginPath(); ctx.arc(w * .3, h * .76, h * .07, 0, TAU); ctx.fill();
      for (const n of st.nubes) nubeSuave(ctx, (ciclo(n.x + t * n.v) * 1.4 - .2) * w, n.y * h, n.s * w, .22, '#fbcfe8');
      ctx.strokeStyle = 'rgba(20,10,30,.8)'; ctx.lineWidth = Math.max(1, w / 600);
      for (const a of st.aves) ave(ctx, (ciclo(a.x + t * a.v) * 1.3 - .15) * w, (a.y + Math.sin(t * .5 + a.ph) * .02) * h, a.s * w, t * 6 + a.ph);
      colina(ctx, w, h, .8, .025, 1.2, 0.4, p.cerros[0]); colina(ctx, w, h, .86, .03, .9, 2, p.cerros[1]);
      cruz(ctx, w * .72, h * .83, h * .52, p.cerros[2]);
      colina(ctx, w, h, .92, .015, 2, 1, p.cerros[2]); hierba(ctx, w, h, st, t, p.cerros[2], .09);
    } },

  caminoLuz: { nombre: 'Camino a la cruz', cat: 'Cristianos', p: { luz: '#ffffff', linea: '#e5e7eb' },
    init: () => ({ polvo: Array.from({ length: 70 }, () => ({ x: R(-.15, .15), y: R(0, 1), v: R(.02, .06), ph: R(0, TAU) })),
      montes: [0, 1].map(() => Array.from({ length: 9 }, (_, i) => [i / 8, R(.04, .16)])) }),
    draw(ctx, w, h, t, st, p) {
      ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, w, h);
      const vx = w * .5, vy = h * .5, pul = .8 + .2 * Math.sin(t * 1.5);
      ctx.globalCompositeOperation = 'lighter'; mancha(ctx, vx, vy - h * .1, h * .7, '#ffffff', .22 * pul); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.moveTo(vx - w * .02, vy); ctx.lineTo(vx + w * .02, vy); ctx.lineTo(vx + w * .42, h); ctx.lineTo(vx - w * .42, h); ctx.fill();
      ctx.fillStyle = p.linea;
      for (let i = 0; i < 9; i++) { const k = ciclo(i / 9 + t * .18), y = vy + (h - vy) * k * k, k2 = Math.min(1, k + .04), y2 = vy + (h - vy) * k2 * k2, a = w * .002 + w * .008 * k;
        ctx.globalAlpha = Math.min(1, k * 3); ctx.beginPath(); ctx.moveTo(vx - a, y); ctx.lineTo(vx + a, y); ctx.lineTo(vx + a * 1.1, y2); ctx.lineTo(vx - a * 1.1, y2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1, w / 900);
      st.montes.forEach((m, lado) => { const sg = lado ? 1 : -1, P = m.map(([u, alto], i) => { const bx = vx + sg * (w * .05 + u * w * .5), by = vy + u * h * .16;
          return [bx, by, by - alto * h * (.35 + u) * (.95 + .05 * Math.sin(t * .8 + i))]; });
        ctx.beginPath(); P.forEach(([x, , py], i) => i ? ctx.lineTo(x, py) : ctx.moveTo(x, py));
        P.forEach(([x, by, py], i) => { if (i) { ctx.moveTo(x, py); ctx.lineTo(P[i - 1][0], P[i - 1][1]); } ctx.moveTo(x, py); ctx.lineTo(x + sg * w * .03, by); });
        ctx.moveTo(P[0][0], P[0][1]); P.forEach(([x, by]) => ctx.lineTo(x, by)); ctx.stroke(); });
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 3; k >= 1; k--) { ctx.globalAlpha = .12 * pul; cruz(ctx, vx, vy, h * .26 + k * h * .015, '#ffffff', .14 + k * .02); }
      ctx.globalAlpha = 1; cruz(ctx, vx, vy, h * .26, '#ffffff', .13);
      for (const d of st.polvo) { const y = ciclo(d.y - t * d.v), r = w * .004; ctx.globalAlpha = (1 - y) * .8 * (.6 + .4 * Math.sin(t * 3 + d.ph)); ctx.drawImage(luz('#ffffff'), vx + d.x * w * (1 + (1 - y)) - r * 2, (vy - h * .35) + y * h * .5 - r * 2, r * 4, r * 4); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },

  cruzGloria: { nombre: 'Cruz en la gloria', cat: 'Cristianos', p: { cielo: ['#fef3c7', '#f59e0b', '#92400e'], madera: ['#8b5a2b', '#4a2c14'] },
    init: () => ({ nubes: Array.from({ length: 10 }, () => ({ x: R(0, 1), y: R(.05, .75), s: R(.1, .2), v: R(.004, .009) })),
      rayos: Array.from({ length: 20 }, (_, i) => ({ a: i / 20 * TAU, w: R(.04, .09), v: R(.4, 1), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo); const sx = w * .58, sy = h * .32, L = w;
      ctx.globalCompositeOperation = 'lighter';
      for (const r of st.rayos) { const a = r.a + t * .03, al = .05 + .05 * (.5 + .5 * Math.sin(t * r.v + r.ph)), g = ctx.createRadialGradient(sx, sy, 0, sx, sy, L);
        g.addColorStop(0, `rgba(255,248,220,${al * 2})`); g.addColorStop(1, 'rgba(255,248,220,0)'); ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, L, a - r.w / 2, a + r.w / 2); ctx.fill(); }
      mancha(ctx, sx, sy, w * .28, '#fffbeb', .8); ctx.globalCompositeOperation = 'source-over';
      for (const n of st.nubes) nubeSuave(ctx, (ciclo(n.x + t * n.v) * 1.4 - .2) * w, n.y * h, n.s * w, .3, '#fff7ed');
      ctx.save(); ctx.translate(w * .45, h * 1.02); ctx.rotate(-.18);
      const al = h * .95, g = al * .085, gr = ctx.createLinearGradient(-g, 0, g, 0); gr.addColorStop(0, p.madera[1]); gr.addColorStop(.5, p.madera[0]); gr.addColorStop(1, p.madera[1]);
      ctx.fillStyle = gr; ctx.fillRect(-g / 2, -al, g, al); ctx.fillRect(-al * .3, -al * .76, al * .6, g);
      ctx.strokeStyle = 'rgba(255,230,180,.35)'; ctx.lineWidth = Math.max(1, w / 700); ctx.strokeRect(-g / 2, -al, g, al); ctx.strokeRect(-al * .3, -al * .76, al * .6, g);
      ctx.restore();
    } },

  paloma: { nombre: 'Paloma en el cielo', cat: 'Cristianos', p: { cielo: ['#1e40af', '#3b82f6', '#bfdbfe'] },
    init: () => ({ nubes: Array.from({ length: 8 }, () => ({ x: R(0, 1), y: R(.05, .9), s: R(.08, .16), v: R(.006, .014) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo); const cx = w * .5, cy = h * .4;
      ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .05);
      for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); const g = ctx.createLinearGradient(0, 0, w * .7, 0); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * .7, -w * .04); ctx.lineTo(w * .7, w * .04); ctx.fill(); }
      ctx.restore(); mancha(ctx, cx, cy, w * .22, '#ffffff', .9); ctx.globalCompositeOperation = 'source-over';
      for (const n of st.nubes) nubeSuave(ctx, (ciclo(n.x + t * n.v) * 1.4 - .2) * w, n.y * h, n.s * w, .55);
      const px = cx - w * .1 + Math.sin(t * .4) * w * .06, py = cy + h * .2 + Math.sin(t * .8) * h * .03, s = h * .22, f = .35 + .65 * Math.sin(t * 3.2);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(30,58,138,.45)'; ctx.lineWidth = Math.max(1.5, w / 500);
      for (const lado of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px, py);
        ctx.bezierCurveTo(px + lado * s * .5, py - s * (.2 + f * .5), px + lado * s * 1.1, py - s * (.5 + f * .6), px + lado * s * 1.4, py - s * (.2 + f * .9));
        ctx.bezierCurveTo(px + lado * s * 1.0, py - s * (.05 + f * .3), px + lado * s * .5, py + s * .1, px, py + s * .1); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(px, py + s * .05, s * .14, s * .32, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py - s * .28, s * .1, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(px - s * .03, py - s * .36); ctx.lineTo(px + s * .03, py - s * .36); ctx.lineTo(px, py - s * .45); ctx.fill(); ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(px - s * .12, py + s * .3); ctx.lineTo(px, py + s * .6); ctx.lineTo(px + s * .12, py + s * .3); ctx.fill();
    } },

  adoracionManos: { nombre: 'Manos en adoración', cat: 'Cristianos', p: { fondo: ['#e0f2fe', '#67b7c9', '#134e5e'], sombra: '#0b1f2a' },
    init: () => ({ ...nuevosBrazos(38), bokeh: Array.from({ length: 30 }, () => ({ x: R(0, 1), y: R(0, 1), r: R(.02, .07), v: R(.005, .015), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.fondo); ctx.globalCompositeOperation = 'lighter';
      for (const b of st.bokeh) { const r = b.r * w; ctx.globalAlpha = .35 + .2 * Math.sin(t + b.ph); ctx.drawImage(luz('#ffffff'), b.x * w - r, ciclo(b.y - t * b.v) * h - r, r * 2, r * 2); }
      ctx.globalAlpha = 1; mancha(ctx, w * .5, h * .35, w * .3, '#ffffff', .5); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .45; cruz(ctx, w * .5, h * .78, h * .6, '#5b7f8c', .09); ctx.globalAlpha = 1;
      brazos(ctx, w, h, st, t, p.sombra);
    } },

  oracion: { nombre: 'Oración al atardecer', cat: 'Cristianos', p: { cielo: ['#3b2a4a', '#9a3412', '#f59e0b', '#fde68a'], sombra: '#1a0e08' },
    init: () => ({ hierba: nuevaHierba(220), luciernagas: Array.from({ length: 24 }, () => ({ x: R(0, 1), y: R(.55, .95), ph: R(0, TAU), v: R(.3, .8) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo, 0, h * .8);
      mancha(ctx, w * .64, h * .7, w * .35, '#fde68a', .6 + .06 * Math.sin(t * .7));
      ctx.fillStyle = 'rgba(255,247,200,.9)'; ctx.beginPath(); ctx.arc(w * .64, h * .72, h * .06, 0, TAU); ctx.fill();
      colina(ctx, w, h, .84, .015, 1, .5, '#2a160c');
      cruz(ctx, w * .76, h * .86, h * .55, p.sombra);
      const s = h * .32, x = w * .36, y = h * .9; ctx.fillStyle = p.sombra; // persona arrodillada
      ctx.beginPath(); ctx.moveTo(x - .35 * s, y - .3 * s); ctx.bezierCurveTo(x - .42 * s, y - .62 * s, x - .3 * s, y - .86 * s, x - .02 * s, y - .88 * s);
      ctx.lineTo(x + .12 * s, y - .62 * s); ctx.lineTo(x - .02 * s, y - .3 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - .42 * s, y - .34 * s); ctx.lineTo(x - .18 * s, y - .36 * s); ctx.lineTo(x + .2 * s, y - .06 * s); ctx.lineTo(x + .18 * s, y); ctx.lineTo(x - .55 * s, y); ctx.lineTo(x - .55 * s, y - .1 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x + .13 * s, y - .93 * s + Math.sin(t * .8) * s * .005, .13 * s, 0, TAU); ctx.fill();
      ctx.lineWidth = .1 * s; ctx.lineCap = 'round'; ctx.strokeStyle = p.sombra; ctx.beginPath(); ctx.moveTo(x - .02 * s, y - .8 * s); ctx.lineTo(x + .16 * s, y - .62 * s); ctx.lineTo(x + .22 * s, y - .86 * s); ctx.stroke();
      hierba(ctx, w, h, st, t, p.sombra, .12);
      ctx.globalCompositeOperation = 'lighter';
      for (const f of st.luciernagas) { const r = w * .006; ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * f.v * 2 + f.ph)); ctx.drawImage(luz('#fde047'), (f.x + Math.sin(t * f.v + f.ph) * .02) * w - r * 2, (f.y + Math.cos(t * f.v + f.ph) * .02) * h - r * 2, r * 4, r * 4); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } },

  fogata: { nombre: 'Fogata', cat: 'Cristianos', p: { cielo: ['#0b1020', '#1e293b', '#292524'] },
    init: () => ({ llamas: Array.from({ length: 9 }, (_, i) => ({ dx: (i - 4) * .012 + R(-.006, .006), alto: R(.14, .3), v: R(6, 10), ph: R(0, TAU) })),
      chispas: Array.from({ length: 120 }, () => ({ x: R(-.05, .05), y: R(0, 1), v: R(.05, .14), sw: R(.02, .12), ph: R(0, TAU), c: elegir(['#fb923c', '#fde047', '#f97316']) })),
      arboles: Array.from({ length: 7 }, () => ({ x: R(.6, 1.05), alto: R(.35, .7), ancho: R(.06, .12) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo);
      ctx.fillStyle = 'rgba(10,15,20,.75)';
      for (const a of st.arboles) { ctx.beginPath(); ctx.moveTo(a.x * w, h * (.82 - a.alto)); ctx.lineTo((a.x - a.ancho) * w, h * .82); ctx.lineTo((a.x + a.ancho) * w, h * .82); ctx.fill(); }
      ctx.fillStyle = '#0c0a09'; ctx.fillRect(0, h * .8, w, h * .2);
      const fx = w * .5, fy = h * .86, pul = .85 + .15 * Math.sin(t * 7) * Math.sin(t * 3.1);
      ctx.globalCompositeOperation = 'lighter'; mancha(ctx, fx, fy - h * .08, w * .4, '#ea580c', .45 * pul);
      for (const l of st.llamas) { const alto = l.alto * h * (.8 + .2 * Math.sin(t * l.v + l.ph)), x = fx + l.dx * w, sway = Math.sin(t * 4 + l.ph) * w * .01, base = w * .03;
        const g = ctx.createLinearGradient(0, fy, 0, fy - alto); g.addColorStop(0, 'rgba(254,240,138,.9)'); g.addColorStop(.4, 'rgba(249,115,22,.7)'); g.addColorStop(1, 'rgba(220,38,38,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - base, fy); ctx.quadraticCurveTo(x - base * .8 + sway, fy - alto * .5, x + sway * 2, fy - alto); ctx.quadraticCurveTo(x + base * .8 + sway, fy - alto * .5, x + base, fy); ctx.fill(); }
      for (const c of st.chispas) { const y = ciclo(c.y + t * c.v), r = w * .003 * (1 - y * .5);
        ctx.globalAlpha = (1 - y) * (.5 + .5 * Math.sin(t * 9 + c.ph)); ctx.drawImage(luz(c.c), fx + (c.x + Math.sin(t * 1.5 + c.ph) * c.sw * y) * w - r * 3, fy - h * .05 - y * h * .85 - r * 3, r * 6, r * 6); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#292018'; ctx.save(); ctx.translate(fx, fy + h * .02);
      for (const a of [-.25, .25]) { ctx.save(); ctx.rotate(a); ctx.fillRect(-w * .09, -h * .015, w * .18, h * .03); ctx.restore(); } ctx.restore();
    } },

  // ------------------------ NIÑOS ------------------------
  pradoOvejas: { nombre: 'Prado con ovejas', cat: 'Niños', p: { cielo: ['#38bdf8', '#7dd3fc', '#e0f2fe'], verdes: ['#86efac', '#4ade80', '#22c55e'] },
    init: () => ({ nubes: Array.from({ length: 6 }, () => ({ x: R(0, 1), y: R(.08, .35), s: R(.05, .09), v: R(.006, .012) })),
      ovejas: Array.from({ length: 5 }, (_, i) => ({ x: i / 5 + R(0, .1), y: R(.74, .9), s: R(.04, .06), v: R(.004, .008), ph: R(0, TAU) })),
      flores: Array.from({ length: 50 }, () => ({ x: R(0, 1), y: R(.78, 1), c: elegir(['#f472b6', '#facc15', '#ffffff', '#a78bfa']), ph: R(0, TAU) })),
      mariposas: Array.from({ length: 3 }, () => ({ x: R(.1, .9), y: R(.45, .7), ph: R(0, TAU), c: elegir(['#f472b6', '#fb923c', '#a78bfa']) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo, 0, h * .7);
      const sx = w * .14, sy = h * .17, sr = h * .08; ctx.strokeStyle = '#facc15'; ctx.lineWidth = Math.max(2, w / 250); ctx.lineCap = 'round';
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * .3; ctx.moveTo(sx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3); ctx.lineTo(sx + Math.cos(a) * sr * 1.7, sy + Math.sin(a) * sr * 1.7); } ctx.stroke();
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
      for (const n of st.nubes) nubeDibujo(ctx, (ciclo(n.x + t * n.v) * 1.4 - .2) * w, n.y * h, n.s * w);
      colina(ctx, w, h, .62, .04, .8, .2, p.verdes[0]); colina(ctx, w, h, .72, .035, 1.1, 2.4, p.verdes[1]); colina(ctx, w, h, .82, .025, 1.4, 4, p.verdes[2]);
      for (const f of st.flores) { const x = f.x * w + Math.sin(t * 1.5 + f.ph) * w * .002, y = f.y * h, r = w * .005; ctx.fillStyle = f.c; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .8, 0, TAU); ctx.fill(); } ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y, r * .6, 0, TAU); ctx.fill(); }
      for (const o of st.ovejas) { const x = (ciclo(o.x + t * o.v) * 1.2 - .1) * w, s = o.s * w, y = o.y * h - Math.abs(Math.sin(t * 4 + o.ph)) * s * .08, paso = Math.sin(t * 8 + o.ph) * s * .08;
        ctx.fillStyle = '#1f2937'; for (const [dx, d] of [[-.35, 1], [-.15, -1], [.15, 1], [.35, -1]]) ctx.fillRect(x + dx * s + d * paso - s * .05, y + s * .2, s * .1, s * .35);
        ctx.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[-.35, 0, .3], [-.1, -.15, .33], [.2, -.12, .32], [.35, .05, .28], [0, .1, .35]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(x + .62 * s, y - .05 * s, .18 * s, .14 * s, .3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + .68 * s, y - .09 * s, .035 * s, 0, TAU); ctx.fill(); }
      for (const m of st.mariposas) { const x = (m.x + Math.sin(t * .3 + m.ph) * .1) * w, y = (m.y + Math.sin(t * .9 + m.ph) * .05) * h, a = Math.abs(Math.sin(t * 9 + m.ph)), r = w * .012;
        ctx.fillStyle = m.c; ctx.beginPath(); ctx.ellipse(x - r * a * .8, y, r * a, r * 1.1, 0, 0, TAU); ctx.ellipse(x + r * a * .8, y, r * a, r * 1.1, 0, 0, TAU); ctx.fill(); }
    } },

  arcoiris: { nombre: 'Arcoíris', cat: 'Niños', p: { cielo: ['#c4b5fd', '#fbcfe8', '#fef9c3'] },
    init: () => ({ estrellas: Array.from({ length: 22 }, () => ({ x: R(0, 1), y: R(.05, .6), r: R(.008, .016), ph: R(0, TAU), c: elegir(['#fde047', '#f9a8d4', '#ffffff', '#a5f3fc']) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo);
      const cx = w * .5, cy = h * 1.02, R0 = w * .44, lw = w * .028, colores = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
      ctx.lineWidth = lw; colores.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R0 - i * lw, Math.PI, TAU); ctx.stroke(); });
      const brillo = Math.PI + ciclo(t * .08) * Math.PI; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = lw * 7; ctx.beginPath(); ctx.arc(cx, cy, R0 - lw * 3, brillo - .08, brillo + .08); ctx.stroke();
      const sube = Math.sin(t * 1.2) * h * .01;
      nubeDibujo(ctx, cx - R0 + lw * 3, cy - h * .06 + sube, w * .09); nubeDibujo(ctx, cx + R0 - lw * 3, cy - h * .06 - sube, w * .09);
      for (const e of st.estrellas) { const k = .6 + .4 * Math.sin(t * 2 + e.ph); estrella5(ctx, e.x * w, (e.y + Math.sin(t * .6 + e.ph) * .01) * h, e.r * w * k, e.c); }
    } },

  globos: { nombre: 'Globos', cat: 'Niños', p: { cielo: ['#a5f3fc', '#e0f2fe', '#fef3c7'] },
    init: () => ({ g: Array.from({ length: 16 }, () => ({ x: R(.03, .97), y: R(0, 1), v: R(.03, .06), s: R(.035, .06), ph: R(0, TAU), c: elegir(['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15']) })),
      nubes: Array.from({ length: 4 }, () => ({ x: R(0, 1), y: R(.1, .7), s: R(.05, .08), v: R(.005, .01) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.cielo);
      for (const n of st.nubes) nubeDibujo(ctx, (ciclo(n.x + t * n.v) * 1.4 - .2) * w, n.y * h, n.s * w);
      for (const b of st.g) { const s = b.s * w, x = b.x * w + Math.sin(t * .8 + b.ph) * w * .015, y = (1.15 - ciclo(b.y + t * b.v) * 1.45) * h;
        ctx.strokeStyle = 'rgba(80,80,80,.5)'; ctx.lineWidth = Math.max(1, w / 900); ctx.beginPath(); ctx.moveTo(x, y + s * 1.25);
        ctx.bezierCurveTo(x + Math.sin(t * 2 + b.ph) * s * .4, y + s * 2, x - Math.sin(t * 2 + b.ph) * s * .4, y + s * 2.6, x, y + s * 3.2); ctx.stroke();
        const g = ctx.createRadialGradient(x - s * .3, y - s * .4, s * .1, x, y, s * 1.2); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, b.c); g.addColorStop(1, b.c);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s * .85, s * 1.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(x, y + s * 1.05); ctx.lineTo(x - s * .12, y + s * 1.28); ctx.lineTo(x + s * .12, y + s * 1.28); ctx.fill(); }
    } },

  fondoMar: { nombre: 'Fondo del mar', cat: 'Niños', p: { agua: ['#38bdf8', '#0284c7', '#0c4a6e'] },
    init: () => ({ peces: Array.from({ length: 9 }, () => ({ y: R(.2, .75), v: R(.03, .07) * elegir([1, -1]), s: R(.025, .05), x: R(0, 1), ph: R(0, TAU), c: elegir(['#f97316', '#facc15', '#ec4899', '#a3e635', '#f43f5e', '#c084fc']) })),
      algas: Array.from({ length: 14 }, () => ({ x: R(0, 1), alto: R(.15, .35), ph: R(0, TAU), c: elegir(['#16a34a', '#22c55e', '#15803d']) })),
      burbujas: Array.from({ length: 30 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(.04, .1), r: R(.003, .01), ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.agua); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const x = w * (.1 + i * .17 + Math.sin(t * .2 + i) * .03), g = ctx.createLinearGradient(0, 0, 0, h * .8); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * .02, 0); ctx.lineTo(x + w * .02, 0); ctx.lineTo(x + w * .08, h * .8); ctx.lineTo(x - w * .02, h * .8); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fcd34d'; colina(ctx, w, h, .93, .015, 1.5, 1, '#fde68a');
      for (const a of st.algas) { ctx.strokeStyle = a.c; ctx.lineWidth = w * .008; ctx.lineCap = 'round'; const x = a.x * w; ctx.beginPath(); ctx.moveTo(x, h);
        for (let k = 1; k <= 8; k++) ctx.lineTo(x + Math.sin(t * 1.2 + a.ph + k * .6) * w * .012 * k / 8, h - a.alto * h * k / 8); ctx.stroke(); }
      for (const f of st.peces) { const dir = Math.sign(f.v), x = (ciclo(f.x + t * f.v) * 1.3 - .15) * w, y = (f.y + Math.sin(t * 1.5 + f.ph) * .02) * h, s = f.s * w, cola = Math.sin(t * 10 + f.ph) * s * .15;
        ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * .55, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * .85, 0); ctx.lineTo(-s * 1.5, -s * .45 + cola); ctx.lineTo(-s * 1.5, s * .45 + cola); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * .5, -s * .12, s * .15, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * .55, -s * .12, s * .07, 0, TAU); ctx.fill(); ctx.restore(); }
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(1, w / 900);
      for (const b of st.burbujas) { ctx.beginPath(); ctx.arc((b.x + Math.sin(t * 2 + b.ph) * .006) * w, (1.05 - ciclo(b.y + t * b.v) * 1.1) * h, b.r * w, 0, TAU); ctx.stroke(); }
    } },

  // ------------------------ JÓVENES ------------------------
  notasMusicales: { nombre: 'Notas musicales', cat: 'Jóvenes', p: { fondo: ['#0f0c29', '#302b63', '#24243e'], colores: ['#22d3ee', '#f0abfc', '#facc15', '#a78bfa', '#4ade80'] },
    init: (p) => ({ n: Array.from({ length: 18 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(.02, .05), s: R(.018, .035), d: azar() < .45, ph: R(0, TAU), c: elegir(p.colores) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.fondo); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(1, w / 800);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let x = 0; x <= w + 10; x += 10) { const y = h * (.5 + (i - 2) * .025) + Math.sin(x / w * TAU * 1.2 + t * .6) * h * .06; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      for (const n of st.n) { const x = (n.x + Math.sin(t * .5 + n.ph) * .03) * w, y = (1.1 - ciclo(n.y + t * n.v) * 1.2) * h, s = n.s * w;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(luz(n.c), x - s * 2, y - s * 2.5, s * 4, s * 4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.5 + n.ph) * .25); nota(ctx, 0, 0, s, n.d, n.c); ctx.restore(); }
    } },

  ecualizador: { nombre: 'Ecualizador', cat: 'Jóvenes', p: { fondo: ['#09090b', '#1e1b4b'], c1: '#22d3ee', c2: '#e879f9' },
    init: () => ({ b: Array.from({ length: 36 }, () => ({ f: [R(1, 3), R(3, 7), R(6, 11)], ph: [R(0, TAU), R(0, TAU), R(0, TAU)] })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.fondo); const base = h * .7, n = st.b.length, bw = w * .8 / n;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { const r = ciclo(t * .35 + k / 3); ctx.strokeStyle = rgba(p.c2, (1 - r) * .35); ctx.lineWidth = Math.max(1, w / 500); ctx.beginPath(); ctx.arc(w / 2, base, r * w * .5, Math.PI, TAU); ctx.stroke(); }
      st.b.forEach((b, i) => { const lvl = .15 + .85 * Math.abs(.45 * Math.sin(t * b.f[0] + b.ph[0]) + .35 * Math.sin(t * b.f[1] + b.ph[1]) + .2 * Math.sin(t * b.f[2] + b.ph[2])) * (1 - Math.abs(i / n - .5) * .9);
        const x = w * .1 + i * bw, alto = lvl * h * .5, g = ctx.createLinearGradient(0, base - alto, 0, base); g.addColorStop(0, p.c2); g.addColorStop(1, p.c1);
        ctx.fillStyle = g; ctx.fillRect(x + bw * .15, base - alto, bw * .7, alto); ctx.globalAlpha = .18; ctx.fillRect(x + bw * .15, base + h * .01, bw * .7, alto * .5); ctx.globalAlpha = 1; });
      ctx.globalCompositeOperation = 'source-over';
    } },

  concierto: { nombre: 'Concierto', cat: 'Jóvenes', p: { fondo: ['#05010d', '#1a0533'], luces: ['#e879f9', '#22d3ee', '#facc15', '#a78bfa', '#f43f5e'] },
    init: (p) => ({ ...nuevosBrazos(46), focos: p.luces.map((c, i) => ({ c, x: (i + .5) / p.luces.length, v: R(.4, .9), ph: R(0, TAU) })), humo: Array.from({ length: 10 }, () => ({ x: R(0, 1), y: R(.4, .9), s: R(.15, .3), v: R(.004, .01) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.fondo); ctx.globalCompositeOperation = 'lighter';
      for (const f of st.focos) { const ox = f.x * w, a = Math.PI / 2 + Math.sin(t * f.v + f.ph) * .55, L = h * 1.3, ab = .14, g = ctx.createLinearGradient(ox, 0, ox + Math.cos(a) * L, Math.sin(a) * L);
        g.addColorStop(0, rgba(f.c, .55)); g.addColorStop(1, rgba(f.c, 0)); ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(ox, -h * .02); ctx.lineTo(ox + Math.cos(a - ab) * L, Math.sin(a - ab) * L); ctx.lineTo(ox + Math.cos(a + ab) * L, Math.sin(a + ab) * L); ctx.fill();
        mancha(ctx, ox, 0, w * .05, f.c, .9); }
      for (const m of st.humo) nubeSuave(ctx, (ciclo(m.x + t * m.v) * 1.4 - .2) * w, m.y * h, m.s * w, .06, '#c4b5fd');
      if (Math.sin(t * 2.3) > .97) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, w, h); }
      ctx.globalCompositeOperation = 'source-over'; brazos(ctx, w, h, st, t * 1.4, '#000000', .9);
    } },

  guitarra: { nombre: 'Guitarra', cat: 'Jóvenes', p: { fondo: ['#1c1917', '#431407', '#7c2d12'], cuerpo: '#0c0a09', notas: '#fbbf24' },
    init: () => ({ n: Array.from({ length: 10 }, () => ({ x: R(.1, .6), y: R(0, 1), v: R(.02, .04), s: R(.018, .03), d: azar() < .5, ph: R(0, TAU) })) }),
    draw(ctx, w, h, t, st, p) {
      cielo(ctx, w, h, p.fondo); mancha(ctx, w * .72, h * .6, w * .45, '#f97316', .25);
      ctx.save(); ctx.translate(w * .72, h * .66); ctx.rotate(-.55); const s = h * .22;
      for (let k = 0; k < 3; k++) { const r = ciclo(t * .5 + k / 3); ctx.strokeStyle = `rgba(253,186,116,${(1 - r) * .5})`; ctx.lineWidth = Math.max(1, w / 600); ctx.beginPath(); ctx.arc(0, -s * .1, s * .3 + r * s * 2, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = p.cuerpo; ctx.beginPath(); ctx.arc(0, s * .45, s * .75, 0, TAU); ctx.arc(0, -s * .55, s * .58, 0, TAU); ctx.fill();
      ctx.fillRect(-s * .12, -s * 2.9, s * .24, s * 2.4); ctx.fillRect(-s * .18, -s * 3.4, s * .36, s * .55);
      ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.arc(0, -s * .1, s * .2, 0, TAU); ctx.fill(); ctx.fillRect(-s * .3, s * .6, s * .6, s * .1);
      ctx.strokeStyle = 'rgba(255,237,213,.75)'; ctx.lineWidth = Math.max(1, w / 1200);
      for (let i = 0; i < 6; i++) { const x = (i - 2.5) * s * .04, vib = Math.sin(t * 50 + i * 1.7) * s * .012 * (.5 + .5 * Math.sin(t * 2 + i));
        ctx.beginPath(); ctx.moveTo(x, s * .65); ctx.quadraticCurveTo(x + vib, -s * 1.2, x, -s * 2.95); ctx.stroke(); }
      ctx.restore();
      for (const n of st.n) { const x = (n.x + Math.sin(t * .6 + n.ph) * .03) * w, y = (1.1 - ciclo(n.y + t * n.v) * 1.2) * h, sz = n.s * w;
        ctx.globalAlpha = .9; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t + n.ph) * .3); nota(ctx, 0, 0, sz, n.d, p.notas); ctx.restore(); ctx.globalAlpha = 1; }
    } },
};
