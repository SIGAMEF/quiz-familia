// ============================================================
// Sopa de letras: arrastra (o toca la primera y la última letra) para marcar una palabra.
// En una sala por turnos: cada palabra encontrada vale 10 y sigues; si fallas, pasa el turno.
// ============================================================
import { $, $$, esc, barajar, sinTildes, sonar, fmtTiempo, pantallaFinal, figura, hudJugadores, turnos } from './util.js?v=202610242304';

const NIVELES = {
  facil:   { lado: 10, n: 6,  dirs: ['horizontal', 'vertical'] },
  medio:   { lado: 12, n: 8,  dirs: ['horizontal', 'vertical', 'diagonal'] },
  dificil: { lado: 13, n: 10, dirs: ['horizontal', 'vertical', 'diagonal', 'reves'] }
};
export const DIRECCIONES = {
  horizontal: [[0, 1]], vertical: [[1, 0]], diagonal: [[1, 1], [-1, 1]],
  reves: [[0, -1], [-1, 0], [-1, -1], [1, -1]]
};
const RELLENO = 'AAABCDEEEFGHIIIJLLMNNÑOOOPQRRSSTTUUVYZ';
export const claveSopa = (t) => sinTildes(t).replace(/[^A-ZÑ]/g, '');

function intentar(lista, filas, columnas, dirs) {
  const g = Array.from({ length: filas }, () => Array(columnas).fill(''));
  const puestas = [], faltaron = [];
  for (const p of lista) {
    let ok = false;
    for (let intento = 0; intento < 400 && !ok; intento++) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const L = p.clave.length;
      const r0 = Math.floor(Math.random() * filas), c0 = Math.floor(Math.random() * columnas);
      const r1 = r0 + dr * (L - 1), c1 = c0 + dc * (L - 1);
      if (r1 < 0 || r1 >= filas || c1 < 0 || c1 >= columnas) continue;
      let cabe = true;
      for (let k = 0; k < L; k++) { const x = g[r0 + dr * k][c0 + dc * k]; if (x && x !== p.clave[k]) { cabe = false; break; } }
      if (!cabe) continue;
      for (let k = 0; k < L; k++) g[r0 + dr * k][c0 + dc * k] = p.clave[k];
      puestas.push({ palabra: p.palabra, pista: p.pista || '', imagen: p.imagen || '', clave: p.clave, celdas: Array.from({ length: L }, (_, k) => `${r0 + dr * k},${c0 + dc * k}`) });
      ok = true;
    }
    if (!ok) faltaron.push(p.palabra);
  }
  return { g, puestas, faltaron };
}

// Genera una sopa de filas × columnas con las palabras dadas.
// Devuelve { grilla, ubicaciones, faltaron } (faltaron = palabras que no cupieron)
export function generarSopa({ palabras, filas = 12, columnas = 12, direcciones = ['horizontal', 'vertical'], max = 99 }) {
  const dirs = direcciones.flatMap(d => DIRECCIONES[d] || []);
  if (!dirs.length) dirs.push([0, 1]);
  const lista = barajar(palabras).map(p => ({ ...p, clave: claveSopa(p.palabra) }))
    .filter(p => p.clave.length >= 2).slice(0, max)
    .sort((a, b) => b.clave.length - a.clave.length);   // las largas primero: caben mejor
  let mejor = null;
  for (let vez = 0; vez < 25; vez++) {
    const r = intentar(lista, filas, columnas, dirs);
    if (!mejor || r.puestas.length > mejor.puestas.length) mejor = r;
    if (!r.faltaron.length) break;
  }
  for (const fila of mejor.g) for (let c = 0; c < columnas; c++) if (!fila[c]) fila[c] = RELLENO[Math.floor(Math.random() * RELLENO.length)];
  return { grilla: mejor.g, ubicaciones: mejor.puestas, faltaron: mejor.faltaron };
}

// Sopa lista para jugar: la ya generada por el profesor o una nueva según el nivel
export function sopaDe(set, nivel = 'facil', pistas = 'palabras') {
  if (set.grilla && set.ubicaciones) return { grilla: set.grilla, ubicaciones: set.ubicaciones };
  const nv = NIVELES[nivel] || NIVELES.facil;
  const palabras = set.palabras.filter(p => claveSopa(p.palabra).length >= 3 && claveSopa(p.palabra).length <= nv.lado
    && (pistas === 'palabras' || p.imagen));
  return generarSopa({ palabras, filas: nv.lado, columnas: nv.lado, direcciones: nv.dirs, max: nv.n });
}

// Elemento de la lista de lo que hay que buscar
function itemLista(p, modo) {
  if (modo === 'palabras' || !p.imagen) return `<li data-p="${p.clave}"><b>${esc(p.palabra)}</b><span>${esc(p.pista)}</span></li>`;
  return `<li data-p="${p.clave}" class="li-fig">${figura(p.imagen)}<span class="li-fig-txt"><b class="oculta">${'_ '.repeat(p.clave.length).trim()}</b>${modo === 'imagenes_desc' && p.pista ? `<span>${esc(p.pista)}</span>` : ''}</span></li>`;
}

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  let turno = 0;
  jugadores.forEach(j => { j.puntos = 0; });
  const modo = opciones.pistas || set.pistas || 'palabras';      // palabras | imagenes | imagenes_desc
  const { grilla: g, ubicaciones: puestas } = opciones.sopa || sopaDe(set, opciones.nivel || 'facil', modo);
  const lado = g[0].length;
  const halladas = new Map();     // clave -> nº de color
  const t0 = Date.now();
  let reloj = null, inicio = null, fin = null, arrastrando = false;
  const jug = jugadores[0];

  cont.innerHTML = `${red ? '<div data-hud></div>' : ''}
    <div class="sopa-top"><span class="pill">🔎 ${esc(set.titulo)}</span><span class="pill" data-reloj>⏱ 0:00</span><span class="pill" data-cuenta>0 / ${puestas.length}</span></div>
    <div class="sopa-wrap">
      <div class="sopa" data-grid style="--lado:${lado}" role="grid" aria-label="Sopa de letras">
        ${g.map((fila, r) => fila.map((l, c) => `<div class="celda" data-rc="${r},${c}" role="gridcell">${l}</div>`).join('')).join('')}
      </div>
      <ul class="sopa-lista ${modo !== 'palabras' ? 'con-fig' : ''}" data-lista>${puestas.map(p => itemLista(p, modo)).join('')}</ul>
    </div>
    <p class="ayuda-juego">Arrastra el dedo desde la primera hasta la última letra. También puedes tocar la primera y luego la última.</p>`;
  const grid = $('[data-grid]', cont);
  const hud = () => { const h = $('[data-hud]', cont); if (h) h.innerHTML = hudJugadores(jugadores, turno, (j) => `⭐ ${j.puntos}`); };
  hud();
  reloj = setInterval(() => { const el = $('[data-reloj]', cont); if (!el || !grid.isConnected) return clearInterval(reloj); el.textContent = `⏱ ${fmtTiempo((Date.now() - t0) / 1000)}`; }, 500);

  const celda = (rc) => grid.querySelector(`[data-rc="${rc}"]`);
  const linea = (a, b) => {
    const [r0, c0] = a.split(',').map(Number), [r1, c1] = b.split(',').map(Number);
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
    const L = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
    if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
    return Array.from({ length: L }, (_, k) => `${r0 + dr * k},${c0 + dc * k}`);
  };
  const marcar = (celdas) => { $$('.celda.sel', grid).forEach(x => x.classList.remove('sel')); (celdas || []).forEach(rc => celda(rc)?.classList.add('sel')); };
  const deEvento = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest('[data-rc]') && grid.contains(el) ? el.closest('[data-rc]').dataset.rc : null; };

  function comprobar(celdas) {
    if (!celdas || celdas.length < 2) return false;
    const txt = celdas.map(rc => celda(rc).textContent).join('');
    const p = puestas.find(x => !halladas.has(x.clave) && (x.clave === txt || x.clave === [...txt].reverse().join('')) && x.celdas.length === celdas.length);
    if (!p) return false;
    const color = halladas.size % 6;
    if (red) jugadores[turno].puntos += 10;
    halladas.set(p.clave, color);
    celdas.forEach(rc => { const el = celda(rc); el.classList.add('hallada', `c${color}`); });
    const li = $(`[data-p="${p.clave}"]`, cont); li.classList.add('hecha', `c${color}`);
    const oculta = $('.oculta', li); if (oculta) { oculta.textContent = p.palabra; oculta.classList.remove('oculta'); }
    $('[data-cuenta]', cont).textContent = `${halladas.size} / ${puestas.length}`;
    sonar.bien(); hud(); if (halladas.size < puestas.length)
    if (halladas.size === puestas.length) {
      clearInterval(reloj);
      const seg = (Date.now() - t0) / 1000;
      if (!red) jug.puntos = Math.max(10, Math.round(puestas.length * 100 - seg * 2));
      T.despues(700, () => pantallaFinal(cont, { jugadores, titulo: '¡Sopa resuelta!', detalle: `${red ? 'Encontraron' : 'Encontraste'} ${puestas.length} palabras en ${fmtTiempo(seg)}.`, alRepetir, alMenu }));
    }
    return true;
  }
  // Jugadas: una línea marcada (encontrada o no) y "pasar"
  function aplicar(a) {
    if (a.t === 'linea') {
      if (comprobar(a.celdas)) return;
      sonar.mal();
      if (N > 1) { turno = (turno + 1) % N; hud(); }
    } else if (a.t === 'pasar' || a.t === 'tiempo') { turno = (turno + 1) % N; hud(); }
  }
  const intentar = (celdas) => {
    if (!celdas || celdas.length < 2) return;
    T.hacer(() => turno, { t: 'linea', celdas }, aplicar);
  };

  grid.addEventListener('pointerdown', (e) => {
    const rc = deEvento(e); if (!rc) return;
    e.preventDefault();
    if (inicio && !arrastrando && rc !== inicio) {          // segundo toque del modo tocar-tocar
      const l = linea(inicio, rc);
      inicio = null; marcar(null); intentar(l); return;
    }
    inicio = rc; fin = rc; arrastrando = true; marcar([rc]);
  });
  grid.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const rc = deEvento(e); if (!rc || rc === fin) return;
    fin = rc; marcar(linea(inicio, fin) || [inicio]);
  });
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    if (fin === inicio) return;                              // fue un toque: espera la última letra
    const l = linea(inicio, fin);
    inicio = null; marcar(null);
    if (l) intentar(l); else sonar.mal();
  };
  grid.addEventListener('pointerup', soltar);
  grid.addEventListener('pointercancel', () => { arrastrando = false; inicio = null; marcar(null); });
  T.reloj(opciones.seg_turno, () => turno, () => { inicio = null; marcar(null); T.hacer(() => turno, { t: 'tiempo' }, aplicar); });
  return { aplicar: (a) => T.recibir(a, aplicar), turno: () => turno };
}

// ---------- Solución dibujada: cada palabra encerrada en un óvalo de su color ----------
export const COLORES_SOL = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#D81B60', '#6D4C41', '#3949AB', '#7CB342', '#F4511E', '#5E35B1'];
export const colorSol = (i) => COLORES_SOL[i % COLORES_SOL.length];
// SVG para poner encima de la grilla (coordenadas en celdas: 1 unidad = 1 celda)
export function capsulasSVG(ubicaciones, filas, columnas, { grosor = 0.07, relleno = 0.16 } = {}) {
  const r = 0.43;
  const formas = ubicaciones.map((u, i) => {
    const [r0, c0] = u.celdas[0].split(',').map(Number);
    const [r1, c1] = u.celdas[u.celdas.length - 1].split(',').map(Number);
    const x0 = c0 + 0.5, y0 = r0 + 0.5, x1 = c1 + 0.5, y1 = r1 + 0.5;
    const L = Math.hypot(x1 - x0, y1 - y0) || 0.0001;
    const nx = -(y1 - y0) / L * r, ny = (x1 - x0) / L * r;   // normal
    const f = (n) => n.toFixed(3);
    const d = `M${f(x0 + nx)} ${f(y0 + ny)} L${f(x1 + nx)} ${f(y1 + ny)} A${r} ${r} 0 0 0 ${f(x1 - nx)} ${f(y1 - ny)} L${f(x0 - nx)} ${f(y0 - ny)} A${r} ${r} 0 0 0 ${f(x0 + nx)} ${f(y0 + ny)}Z`;
    const c = colorSol(i);
    return `<path d="${d}" fill="${c}" fill-opacity="${relleno}" stroke="${c}" stroke-width="${grosor}" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg class="capsulas" viewBox="0 0 ${columnas} ${filas}" preserveAspectRatio="none" aria-hidden="true">${formas}</svg>`;
}
