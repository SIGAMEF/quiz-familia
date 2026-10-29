// ============================================================
// Proyectos en grupo: hoja "Ruleta"
// - zona de la pantalla: la ruleta (SVG), el elegido y el historial de sorteos
// - en vivo el servidor elige (ruleta_girar); aquí la animación solo "aterriza" en el gajo ya elegido,
//   así la pantalla y todos los celulares ven lo mismo
// - en la presentación sin sesión (o simulada) los sorteos se hacen aquí y no se guardan
// ============================================================
import { COLORES_GRUPO } from './agrupar.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]+$/.test(u);

export const PALETAS = {
  arcoiris: { nombre: 'Arcoíris', colores: COLORES_GRUPO },
  pastel: { nombre: 'Pastel', colores: ['#A5B4FC', '#FDBA74', '#86EFAC', '#F9A8D4', '#7DD3FC', '#D8B4FE', '#FDE68A', '#5EEAD4'] },
  fuego: { nombre: 'Fuego', colores: ['#EF4444', '#F97316', '#F59E0B', '#DC2626', '#FB923C', '#EAB308'] },
  mar: { nombre: 'Mar', colores: ['#0EA5E9', '#14B8A6', '#6366F1', '#06B6D4', '#3B82F6', '#10B981'] }
};
export const ORIGENES = {
  nombres: { ico: '✍️', nombre: 'Nombres escritos' },
  grupos: { ico: '👥', nombre: 'Grupos creados' },
  participantes: { ico: '🙋', nombre: 'Participantes' }
};

export const configRuletaInicial = () => ({
  origen: 'nombres', lista: ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe'],
  repetir: false, duracion: 5, sonido: true, paleta: 'arcoiris', celular: 'ruleta'
});
const duracion = (hoja) => Math.max(2, Math.min(12, Number(hoja?.config?.duracion) || 5));

// Gajos calculados aquí (vista previa, presentación sin sesión y simulación); en vivo vienen del servidor.
// datos: { participantes, grupos } de la simulación
export function candidatosLocal(hoja, { participantes = null, grupos = null } = {}) {
  const c = hoja?.config || {};
  if (c.origen === 'grupos') {
    if (!grupos) return [1, 2, 3, 4].map(i => ({ clave: 'g' + i, texto: `Grupo ${i}`, color: COLORES_GRUPO[i - 1] }));
    return grupos.map(g => ({ clave: g.id, texto: g.nombre, color: g.color, emoji: g.emoji }));
  }
  if (c.origen === 'participantes') {
    if (!participantes) return ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gabi', 'Hugo'].map(t => ({ clave: t, texto: t }));
    return participantes.map(p => ({ clave: p.id, texto: p.alias, avatar: p.avatar, foto_url: p.foto_url }));
  }
  // los mismos que deja el servidor: sin vacíos ni repetidos, máximo 200
  const vistos = new Set();
  return (Array.isArray(c.lista) ? c.lista : []).map(t => String(t ?? '').trim().slice(0, 60))
    .filter(t => t && !vistos.has(t.toLowerCase()) && vistos.add(t.toLowerCase())).slice(0, 200)
    .map(t => ({ clave: t, texto: t }));
}

// Los que todavía pueden salir (si no se repite, sin los que ya salieron)
export function restantes(hoja, candidatos, sorteos) {
  if (hoja?.config?.repetir) return candidatos;
  const salieron = new Set((sorteos || []).map(s => s.clave));
  return candidatos.filter(c => !salieron.has(c.clave));
}

// Número al azar entre 0 y n-1 con el generador criptográfico del navegador (sin sesgo: se descartan los valores
// del final que harían más probables a los primeros)
export function azar(n) {
  if (n <= 1) return 0;
  const limite = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limite);
  return buf[0] % n;
}
// Sorteo sin servidor (presentación o simulación); devuelve null si no queda nadie
export function sortearLocal(hoja, candidatos, sorteos) {
  const quedan = restantes(hoja, candidatos, sorteos);
  if (!quedan.length) return null;
  const x = quedan[azar(quedan.length)];
  return { ronda: (sorteos.at(-1)?.ronda || 0) + 1, clave: x.clave, texto: x.texto, created_at: new Date().toISOString() };
}

// Reloj del servidor: para saber si un sorteo es "de recién" y animarlo sincronizado en todos los equipos
let desfase = 0;
export function ajustarReloj(ahoraServidor) {
  const t = Date.parse(ahoraServidor);
  if (!isNaN(t)) desfase = t - Date.now();
}
// hora del servidor en ms (también la usa el tiempo por pregunta)
export const ahoraServidor = () => Date.now() + desfase;

// ---------- sonido (clics del puntero y fanfarria al final) ----------
let audio = null;
function tono(f, dur = 0.06, tipo = 'triangle', cuando = 0, vol = 0.08) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = tipo; o.frequency.value = f;
    const t = audio.currentTime + cuando;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* sin audio */ }
}
const fanfarria = () => [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.2, 'triangle', i * 0.11, 0.16));
// en pantalla completa solo se ve ese elemento: el confeti se dibuja en un lienzo dentro de él
function confeti() {
  if (!window.confetti?.create || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; pointer-events:none; z-index:4800;';
  (document.fullscreenElement || document.body).appendChild(c);
  const disparar = window.confetti.create(c, { resize: true });
  [0.25, 0.5, 0.75].forEach((x, i) => setTimeout(() => disparar({ particleCount: 70, spread: 75, origin: { x, y: 0.55 } }), i * 180));
  setTimeout(() => c.remove(), 4500);
}

// ---------- estado de la animación de cada ruleta (por hoja, en este equipo) ----------
// fase: 'quieta' | 'gira' (hasta fin) | 'celebra' (hasta fin, con el ganador resaltado)
const estados = new Map();
const CELEBRA_MS = 2200;
export const ruletaGirando = (hojaId) => { const s = estados.get(hojaId); return !!s && s.fase !== 'quieta' && performance.now() < s.fin; };

// pequeño número "al azar" pero igual en todos los equipos para la misma ronda
const azarFijo = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

function actualizarEstado(hoja, res) {
  const sorteos = res.sorteos || [];
  const ult = sorteos.at(-1) || null;
  let s = estados.get(hoja.id);
  const nuevo = !s;
  if (!s) { s = { ronda: 0, fase: 'quieta', fin: 0, rot: 0 }; estados.set(hoja.id, s); }
  if (s.fase !== 'quieta' && performance.now() >= s.fin) {
    if (s.fase === 'gira') { s.fase = 'celebra'; s.fin = s.inicio + s.dur + CELEBRA_MS; s.festejar = true; }
    if (s.fase === 'celebra' && performance.now() >= s.fin) s.fase = 'quieta';
  }
  if (!ult) { Object.assign(s, { ronda: 0, fase: 'quieta', rot: 0 }); return s; }
  if (ult.ronda === s.ronda && !nuevo) return s;
  if (ult.ronda < s.ronda) { Object.assign(s, { ronda: ult.ronda, fase: 'quieta', rot: 0 }); return s; }   // se reinició
  // sorteo nuevo: ¿es de recién? (si no, se muestra quieta)
  const dur = duracion(hoja) * 1000;
  const ahora = res.local ? Date.now() : Date.now() + desfase;
  const edad = Math.max(0, ahora - Date.parse(ult.created_at));
  s.ronda = ult.ronda;
  if (isNaN(edad) || edad > dur + CELEBRA_MS) { s.fase = 'quieta'; s.rot = res.config?.repetir ? s.rot : 0; return s; }
  // la ruleta "antes" de este sorteo: sin los que salieron en las rondas anteriores
  const antes = restantes(hoja, res.candidatos || [], sorteos.slice(0, -1));
  const k = Math.max(0, antes.findIndex(c => c.clave === ult.clave));
  const a = 360 / Math.max(1, antes.length);
  const vueltas = 3 + Math.round(dur / 1000);
  const destino = ((-(k + 0.5) * a + (azarFijo(ult.ronda) - 0.5) * 0.6 * a) % 360 + 360) % 360;
  Object.assign(s, { fase: 'gira', antes, k, inicio: performance.now() - edad, dur, fin: performance.now() - edad + dur,
    desde: 0, hasta: vueltas * 360 + destino, festejar: false, sonido: !!res.profe && hoja.config?.sonido !== false });
  if (edad > dur) { s.fase = 'celebra'; s.fin = s.inicio + dur + CELEBRA_MS; s.festejar = false; }
  return s;
}

// ---------- dibujo de la rueda ----------
const punto = (r, g) => { const t = g * Math.PI / 180; return [(r * Math.sin(t)).toFixed(2), (-r * Math.cos(t)).toFixed(2)]; };
function svgRueda(gajos, paleta, { ganador = -1, sale = false } = {}) {
  const n = gajos.length, a = 360 / n, R = 96;
  const cols = PALETAS[paleta]?.colores || PALETAS.arcoiris.colores;
  const color = (g, i) => g.color || cols[(i === n - 1 && n % cols.length === 1 && n > 1) ? 1 : i % cols.length];
  const fs = Math.max(3.2, Math.min(11, (R * 0.62 * a * Math.PI / 180) * 0.62));
  const max = n > 60 ? 0 : Math.max(6, Math.round(18 - n / 6));
  const partes = gajos.map((g, i) => {
    const forma = n === 1 ? `<circle r="${R}"/>`
      : `<path d="M0 0 L${punto(R, i * a).join(' ')} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${punto(R, (i + 1) * a).join(' ')} Z"/>`;
    let txt = String(g.texto || '');
    if (txt.length > max) txt = txt.slice(0, Math.max(1, max - 1)) + '…';
    const etiqueta = max ? `<text transform="rotate(${(i + 0.5) * a - 90}) translate(${R - 8} 0)" text-anchor="end" dominant-baseline="central"
      style="font-size:${Math.min(fs, 150 / Math.max(4, txt.length + 2)).toFixed(1)}px">${esc((g.emoji ? g.emoji + ' ' : '') + txt)}</text>` : '';
    return `<g class="zr-gajo${i === ganador ? ' gana' + (sale ? ' sale' : '') : ''}" style="--c:${esc(color(g, i))}">${forma}${etiqueta}</g>`;
  }).join('');
  return `<svg class="zr-svg" viewBox="-100 -100 200 200" aria-hidden="true"><circle class="zr-borde" r="99"/><g class="zr-gira">${partes}</g></svg>`;
}

const cara = (c) => esUrl(c?.foto_url) ? `<img src="${esc(c.foto_url)}" alt="">` : esc(c?.emoji || c?.avatar || '');

// res: { candidatos, sorteos, profe, local, cargando, yo: { id, grupo } } o null (vista previa del editor)
// opciones: { animar } (false en miniaturas y resultados)
export function pintarZonaRuleta(d, hoja, res, { animar = true } = {}) {
  const c = hoja.config || {};
  const preview = !res;
  const candidatos = res ? (res.candidatos || []) : candidatosLocal(hoja);
  const sorteos = res?.sorteos || [];
  const s = res && animar ? actualizarEstado(hoja, { ...res, config: c }) : { fase: 'quieta', rot: 0 };
  const ult = sorteos.at(-1);
  const quedan = restantes(hoja, candidatos, sorteos);
  let rueda, ganador = '', central = '';

  const vacio = (ico, txt) => `<div class="zona-vacia"><span>${ico}</span>${txt}</div>`;
  if (res?.cargando) rueda = vacio('🎡', 'Cargando la ruleta…');
  else if (s.fase !== 'quieta') {
    // girando o celebrando: la ruleta tal como estaba antes del sorteo
    rueda = svgRueda(s.antes, c.paleta, { ganador: s.fase === 'celebra' ? s.k : -1, sale: !c.repetir });
  } else if (!candidatos.length) {
    rueda = vacio(c.origen === 'grupos' ? '👥' : c.origen === 'participantes' ? '🙋' : '✍️',
      c.origen === 'grupos' ? 'Aquí aparecerán los grupos cuando los formes en una hoja Agrupar'
        : c.origen === 'participantes' ? 'Aquí aparecerán los participantes cuando se unan'
          : 'Escribe los nombres de la ruleta en el panel de la hoja');
  } else if (!quedan.length) {
    rueda = `<div class="zona-vacia zr-todos"><span>🎉</span>¡Todos han salido!${res?.profe ? '<button class="zr-btn" data-ruleta-reiniciar>↺ Reiniciar ruleta</button>' : ''}</div>`;
  } else rueda = svgRueda(quedan, c.paleta);

  const mostrarGanador = ult && s.fase !== 'gira' && !res?.cargando;
  if (mostrarGanador) {
    const cand = candidatos.find(x => x.clave === ult.clave);
    const soyYo = res?.yo && (ult.clave === res.yo.id || ult.clave === res.yo.grupo);
    ganador = `<div class="zr-ganador${s.fase === 'celebra' ? ' pop' : ''}"><small>${soyYo ? (c.origen === 'grupos' ? '¡Salió tu grupo!' : '¡Saliste tú!') : '¡Salió!'}</small>
      <b>${cand ? cara(cand) + ' ' : ''}${esc(ult.texto)}</b></div>`;
  } else if (s.fase === 'gira') ganador = '<div class="zr-ganador espera"><small>Girando…</small><b>🤞</b></div>';
  if (res?.profe && s.fase === 'quieta' && quedan.length && !res.cargando) central = '<button class="zr-centro" data-ruleta-girar title="Girar la ruleta">GIRAR</button>';
  else central = '<span class="zr-centro">🎡</span>';

  const vistos = s.fase === 'gira' ? sorteos.slice(0, -1) : sorteos;   // el que está girando todavía no se cuenta
  const hist = vistos.length
    ? `<ol class="zr-hist">${vistos.map(x => `<li><span>${x.ronda}°</span> ${esc(x.texto)}</li>`).reverse().join('')}</ol>`
    : `<p class="zr-nadie">${preview ? `${ORIGENES[c.origen]?.ico || '✍️'} ${esc(ORIGENES[c.origen]?.nombre || '')} · ${c.repetir ? 'pueden repetir' : 'el elegido sale de la ruleta'}` : 'Aún no hay sorteos'}</p>`;
  const conRueda = rueda.startsWith('<svg');
  d.innerHTML = `<div class="zona zona-ruleta">
    <div class="zr-rueda">${conRueda ? `<div class="zr-caja${s.fase === 'quieta' && s.recien ? ' entra' : ''}">${rueda}<span class="zr-puntero"></span>${central}</div>` : rueda}</div>
    <div class="zr-lado">${ganador}<div class="zr-hist-tit">Historial${c.repetir ? '' : ` · quedan ${quedan.length}`}</div>${hist}</div></div>`;
  s.recien = false;

  const giro = d.querySelector('.zr-gira');
  if (!giro) return;
  if (s.fase === 'gira') {
    const anim = giro.animate([{ transform: `rotate(${s.desde}deg)` }, { transform: `rotate(${s.hasta}deg)` }],
      { duration: s.dur, easing: 'cubic-bezier(.12,.67,.1,1)', fill: 'forwards' });
    anim.currentTime = Math.max(0, performance.now() - s.inicio);
    // clic del puntero cada vez que pasa un gajo (solo en la pantalla del profesor)
    if (s.sonido) {
      const a = 360 / Math.max(1, s.antes.length);
      let previo = -1, tPrev = 0;
      const tic = () => {
        if (!giro.isConnected || anim.playState === 'finished') return;
        const g = (anim.effect.getComputedTiming().progress || 0) * s.hasta;
        const gajo = Math.floor(g / a);
        if (gajo !== previo && performance.now() - tPrev > 45) { if (previo >= 0) tono(1200, 0.03, 'square', 0, 0.04); previo = gajo; tPrev = performance.now(); }
        requestAnimationFrame(tic);
      };
      requestAnimationFrame(tic);
    }
    anim.onfinish = () => { if (giro.isConnected) { s.rot = s.hasta % 360; pintarZonaRuleta(d, hoja, res, { animar }); avisar(d); } };
  } else if (s.fase === 'celebra') {
    giro.style.transform = `rotate(${s.hasta}deg)`;
    if (s.festejar) { s.festejar = false; confeti(); if (s.sonido) fanfarria(); }
    clearTimeout(s.tCelebra);
    s.tCelebra = setTimeout(() => {
      if (!giro.isConnected) return;
      s.fase = 'quieta'; s.recien = true; s.rot = c.repetir ? s.hasta % 360 : 0;
      pintarZonaRuleta(d, hoja, res, { animar });
      avisar(d);
    }, Math.max(0, s.fin - performance.now()));
  } else if (s.rot && c.repetir) giro.style.transform = `rotate(${s.rot}deg)`;
}
// avisa a la presentación que cambió la fase (para habilitar el botón GIRAR)
const avisar = (d) => d.dispatchEvent(new CustomEvent('ruleta-cambio', { bubbles: true }));

// Lo que ve el participante en el celular: la ruleta en grande
export function pintarRuletaCelular(cont, hoja, res, nombreProyecto = '') {
  const caja = document.createElement('div');
  caja.className = 'part';
  caja.innerHTML = `<div class="part-card zr-cel-card">${nombreProyecto ? `<div class="part-tipo" style="text-align:center;">${esc(nombreProyecto)}</div>` : ''}
    <div class="pe-zona zr-movil"></div></div>`;
  cont.appendChild(caja);
  pintarZonaRuleta(caja.querySelector('.zr-movil'), hoja, res ? { ...res, profe: false } : null);
}
