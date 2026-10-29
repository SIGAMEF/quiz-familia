// ============================================================
// Cultos: resaltar palabras de la letra
// - Cada resaltado está anclado al texto (estrofa, línea y palabra; ver letra.js → ubicarResaltados).
// - pintarLetraRica(): dibuja la letra de una pantalla con sus palabras resaltadas (lienzo, proyección).
// - htmlLetraCoristas(): la letra limpia para el celular de los coristas (resaltados en negrita, sin animación).
// - abrirBarraResaltar(): la barra flotante "✨ Resaltar" del editor.
// ============================================================
import { $, $$, esc } from '../comun.js';
import { FUENTES, FUENTES_EXTRA, fuenteValida, cargarFuente, colorValido } from '../proyectos/recursos.js';
import { palabras, resaltadosDeLinea, segmentosDeBloque, etiquetas } from './letra.js';

// ---------- Paletas ----------
export const PALETAS = {
  buscador: { nombre: 'Estilo buscador', colores: ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853'] },
  arcoiris: { nombre: 'Arcoíris', colores: ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6', '#A855F7'] },
  calida: { nombre: 'Cálida', colores: ['#F59E0B', '#F97316', '#EF4444', '#EC4899'] },
  pastel: { nombre: 'Pastel', colores: ['#F9A8D4', '#C4B5FD', '#93C5FD', '#86EFAC', '#FDE68A'] },
  neon: { nombre: 'Neón', colores: ['#22D3EE', '#F0ABFC', '#A3E635', '#FDE047'] }
};
const CLAVE_PALETAS = 'cultos.paletas';
export function misPaletas() {
  try { const o = JSON.parse(localStorage.getItem(CLAVE_PALETAS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function guardarPaleta(nombre, colores) {
  const o = misPaletas();
  o[nombre.slice(0, 30)] = colores.slice(0, 8);
  try { localStorage.setItem(CLAVE_PALETAS, JSON.stringify(o)); } catch { /* sin almacenamiento */ }
}
const todasPaletas = () => ({ ...PALETAS, ...Object.fromEntries(Object.entries(misPaletas()).map(([k, c]) => ['mi:' + k, { nombre: k, colores: c, mia: true }])) });

// ---------- Efectos ----------
export const EFECTOS = {
  latido: 'Latido de corazón', retumbar: 'Retumbar', neon: 'Brillo neón', rebote: 'Rebote', onda: 'Onda',
  palabra: 'Aparecer palabra por palabra', escribir: 'Máquina de escribir', marcador: 'Marcador fluorescente', subrayado: 'Subrayado que se dibuja', contorno: 'Contorno'
};
const DUR = { latido: 1.5, retumbar: 0.35, neon: 2.2, rebote: 1.8, onda: 1.6, palabra: 0.35, escribir: 0.07, marcador: 0.9, subrayado: 0.9 };
export const VEL = { lenta: 1.7, normal: 1, rapida: 0.55 };
const POR_LETRA = ['onda', 'escribir'];

// Presets de la barra
export const PRESETS = [
  ['grande', '🔠 Más grande', { escala: 1.4 }],
  ['multicolor', '🌈 Multicolor', { modo: 'multicolor', paleta: 'arcoiris' }],
  ['buscador', '🔎 Estilo buscador', { modo: 'multicolor', paleta: 'buscador', fuente: 'Poppins', peso: 500 }],
  ['neon', '💡 Neón', { modo: 'color', color: '#F0ABFC', efecto: 'neon' }],
  ['latido', '❤️ Latido', { modo: 'color', color: '#FB7185', efecto: 'latido' }],
  ['marcador', '🖍 Marcador', { efecto: 'marcador', marca: '#FDE047' }],
  ['subrayado', '〰 Subrayado', { efecto: 'subrayado' }],
  ['degradado', '🎨 Degradado', { modo: 'degradado', color: '#22D3EE', color2: '#F472B6' }]
];

const num = (v, d, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
function coloresDe(estilo) {
  if (Array.isArray(estilo.colores) && estilo.colores.length) return estilo.colores.slice(0, 8).map(c => colorValido(c, '#FFFFFF'));
  return (todasPaletas()[estilo.paleta] || PALETAS.arcoiris).colores;
}

// Aplica el estilo a la caja del resaltado (span.rs). Devuelve si hay que partir en letras.
function estilar(span, e, animar) {
  const es = num(e.escala, 1, 0.6, 2.5);
  if (es !== 1) span.style.fontSize = es + 'em';
  if (e.fuente) { cargarFuente(e.fuente); span.style.fontFamily = `'${fuenteValida(e.fuente)}', sans-serif`; }
  if (e.peso) span.style.fontWeight = String(Math.round(num(e.peso, 400, 100, 900) / 100) * 100);
  if (e.modo === 'color') span.style.color = colorValido(e.color, '#FFFFFF');
  if (e.modo === 'degradado') {
    Object.assign(span.style, { backgroundImage: `linear-gradient(90deg, ${colorValido(e.color, '#22D3EE')}, ${colorValido(e.color2, '#F472B6')})`, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  }
  const ef = EFECTOS[e.efecto] ? e.efecto : '';
  if (ef) {
    span.classList.add('rs-' + ef);
    if (animar) span.classList.add('rs-anim');
    span.style.setProperty('--t', (DUR[ef] || 1) * (VEL[e.vel] || 1) + 's');
    if (ef === 'marcador') span.style.setProperty('--m', colorValido(e.marca, '#FDE047') + '99');
    if (ef === 'subrayado' || ef === 'contorno') span.style.setProperty('--m', colorValido(e.marca || e.color, '#FDE047'));
  }
  return e.modo === 'multicolor' || POR_LETRA.includes(ef);
}

// Dibuja en `txt` (el .pe-txt de la zona de la letra) las líneas { t, b, l } con sus resaltados.
// En el editor cada palabra lleva data-b/l/w para poder elegirla con el mouse.
export function pintarLetraRica(cajaTxt, fuente, resaltados, { animar = true, marcar = false } = {}) {
  // todo va en un solo bloque: el .pe-txt es una grilla y cada <span> suelto sería una fila
  cajaTxt.textContent = '';
  const txt = document.createElement('div');
  txt.className = 'pe-letra';
  cajaTxt.appendChild(txt);
  (fuente || []).forEach((f, i) => {
    if (i) txt.append('\n');
    const w = palabras(f.t);
    const nOrigen = f.l == null ? 0 : w.length - (/×\d$/.test(f.t) ? 1 : 0);   // "×2" no es una palabra de la letra
    const rangos = resaltadosDeLinea(f, resaltados);
    let k = 0, indice = 0;
    const palabra = (j) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w[j];
      if (marcar && j < nOrigen) { s.dataset.b = f.b; s.dataset.l = f.l; s.dataset.w = j; }
      return s;
    };
    while (k < w.length) {
      if (k) txt.append(' ');
      const g = k < nOrigen ? rangos.find(x => k >= x.desde && k < x.hasta) : null;
      if (!g) { txt.append(palabra(k)); k++; continue; }
      const e = g.r.estilo || {};
      const caja = document.createElement('span');
      caja.className = 'rs';
      caja.dataset.rs = g.r.id;
      const porLetra = estilar(caja, e, animar);
      const colores = e.modo === 'multicolor' ? coloresDe(e) : null;
      const hasta = Math.min(g.hasta, nOrigen);
      for (let j = k; j < hasta; j++) {
        if (j > k) caja.append(' ');
        const s = palabra(j);
        if (e.efecto === 'palabra') s.style.setProperty('--i', j - k);
        if (porLetra) {
          const letras = [...s.textContent];
          s.textContent = '';
          for (const ch of letras) {
            const l = document.createElement('span');
            l.className = 'l';
            l.textContent = ch;
            if (colores) l.style.color = colores[indice % colores.length];
            l.style.setProperty('--i', indice++);
            s.appendChild(l);
          }
        }
        caja.appendChild(s);
      }
      if (e.efecto === 'escribir' && animar) { const c = document.createElement('span'); c.className = 'rs-cursor'; c.style.setProperty('--i', indice); caja.appendChild(c); }
      txt.appendChild(caja);
      k = hasta;
    }
  });
}

// La letra para los coristas: bloques con su nombre y los resaltados en negrita (sin animación)
export function htmlLetraCoristas(cancion) {
  const bloques = cancion?.bloques || [], et = etiquetas(bloques);
  return bloques.map((b, i) => {
    const lineas = segmentosDeBloque(b.texto, 'marcar', { conFuente: true }).flat().map(x => {
      const f = { t: x.t, b: i, l: x.l }, w = palabras(x.t), r = resaltadosDeLinea(f, cancion.resaltados);
      return `<div>${w.map((p, j) => r.some(g => j >= g.desde && j < g.hasta) ? `<b>${esc(p)}</b>` : esc(p)).join(' ')}</div>`;
    }).join('');
    return `<div class="cu-letra-bloque ${b.tipo === 'coro' ? 'coro' : ''}"><b>${esc(et[i].nombre)}</b>${lineas}</div>`;
  }).join('');
}

// ---------- Barra flotante "✨ Resaltar" ----------
// cont: el escenario del editor; rect: dónde está la selección; texto: las palabras elegidas;
// actual: el resaltado que se edita (o null); alCambiar(estilo, todas) / alQuitar() / alCerrar()
let barraAbierta = null;
export function cerrarBarraResaltar() { barraAbierta?.cerrar(); }
export function abrirBarraResaltar({ cont, rect, texto, actual = null, fuentePlantilla = 'Nunito', alCambiar, alQuitar, alCerrar }) {
  cerrarBarraResaltar();
  let estilo = { ...(actual?.estilo || {}) }, todas = !!actual?.todas, abierta = !!actual;
  const b = document.createElement('div');
  b.className = 'rs-barra';
  b.setAttribute('role', 'dialog');
  b.setAttribute('aria-label', 'Resaltar palabras');
  cont.appendChild(b);
  const fuentes = [...new Set([fuentePlantilla, ...FUENTES, ...FUENTES_EXTRA])];
  const cambiar = (cambios) => { estilo = { ...estilo, ...cambios }; for (const k of Object.keys(estilo)) if (estilo[k] === '' || estilo[k] == null) delete estilo[k]; alCambiar({ ...estilo }, todas); pintar(); };
  const pintar = () => {
    const pal = todasPaletas(), colores = coloresDe(estilo);
    b.innerHTML = `<div class="rs-cab"><b>✨ Resaltar</b><span class="rs-que" title="${esc(texto)}">«${esc(texto)}»</span>
        <button type="button" class="btn btn-sm btn-ghost btn-icon" data-cerrar aria-label="Cerrar">✕</button></div>
      <div class="rs-presets">${PRESETS.map(([k, t]) => `<button type="button" class="chip" data-pre="${k}">${t}</button>`).join('')}</div>
      <button type="button" class="btn btn-sm btn-ghost rs-mas" data-mas aria-expanded="${abierta}">${abierta ? '▾ Menos opciones' : '▸ Más opciones'}</button>
      <div class="rs-opciones" ${abierta ? '' : 'hidden'}>
        <div class="prop-fila"><label>Tamaño</label><input type="range" min="1" max="2" step="0.1" data-escala value="${num(estilo.escala, 1, 1, 2)}"><b data-ver-escala>×${num(estilo.escala, 1, 1, 2).toFixed(1)}</b></div>
        <div class="prop-fila"><label>Fuente</label><select class="input" data-fuente><option value="">La de la plantilla</option>${fuentes.map(f => `<option ${f === estilo.fuente ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
        <div class="grupo-btn rs-modos">${[['', 'Normal'], ['color', 'Color'], ['degradado', 'Degradado'], ['multicolor', 'Multicolor']].map(([k, t]) => `<button type="button" class="btn btn-sm btn-outline ${(estilo.modo || '') === k ? 'activo' : ''}" data-modo="${k}">${t}</button>`).join('')}</div>
        ${estilo.modo === 'color' ? `<div class="prop-fila"><label>Color</label><input type="color" data-c="color" value="${colorValido(estilo.color, '#FFFFFF').slice(0, 7)}"></div>` : ''}
        ${estilo.modo === 'degradado' ? `<div class="prop-fila"><label>Colores</label><input type="color" data-c="color" value="${colorValido(estilo.color, '#22D3EE').slice(0, 7)}"><input type="color" data-c="color2" value="${colorValido(estilo.color2, '#F472B6').slice(0, 7)}"></div>` : ''}
        ${estilo.modo === 'multicolor' ? `<div class="rs-paletas">${Object.entries(pal).map(([k, p]) => `<button type="button" class="rs-paleta ${!estilo.colores && estilo.paleta === k ? 'sel' : ''}" data-paleta="${esc(k)}" title="${esc(p.nombre)}">
            ${p.colores.map(c => `<i style="background:${colorValido(c)}"></i>`).join('')}<span>${esc(p.nombre)}</span></button>`).join('')}</div>
          <div class="rs-editar-paleta"><span class="small muted">Esta paleta:</span>${colores.map((c, i) => `<input type="color" data-pc="${i}" value="${colorValido(c).slice(0, 7)}" aria-label="Color ${i + 1}">`).join('')}
            <button type="button" class="btn btn-sm btn-ghost btn-icon" data-pc-mas title="Agregar color" ${colores.length >= 8 ? 'disabled' : ''}>＋</button>
            <button type="button" class="btn btn-sm btn-ghost btn-icon" data-pc-menos title="Quitar el último" ${colores.length <= 2 ? 'disabled' : ''}>－</button>
            <button type="button" class="btn btn-sm" data-guardar-paleta>💾 Guardar paleta</button></div>` : ''}
        <div class="prop-fila"><label>Efecto</label><select class="input" data-efecto><option value="">Sin efecto</option>${Object.entries(EFECTOS).map(([k, t]) => `<option value="${k}" ${estilo.efecto === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        ${['marcador'].includes(estilo.efecto) ? `<div class="prop-fila"><label>Marcador</label><input type="color" data-c="marca" value="${colorValido(estilo.marca, '#FDE047').slice(0, 7)}"></div>` : ''}
        ${['subrayado', 'contorno'].includes(estilo.efecto) ? `<div class="prop-fila"><label>Color del ${estilo.efecto === 'contorno' ? 'contorno' : 'trazo'}</label><input type="color" data-c="marca" value="${colorValido(estilo.marca, '#FDE047').slice(0, 7)}"></div>` : ''}
        ${estilo.efecto ? `<div class="prop-fila"><label>Velocidad</label><div class="grupo-btn">${[['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']].map(([k, t]) => `<button type="button" class="btn btn-sm btn-outline ${(estilo.vel || 'normal') === k ? 'activo' : ''}" data-vel="${k}">${t}</button>`).join('')}</div></div>` : ''}
        <label class="check small" style="margin-top:6px;"><input type="checkbox" data-todas ${todas ? 'checked' : ''}> Aplicar en todas las veces que se repite</label>
        ${actual || Object.keys(estilo).length ? '<button type="button" class="btn btn-sm btn-red btn-block" data-quitar style="margin-top:8px;">Quitar resaltado</button>' : ''}
      </div>`;
    $('[data-cerrar]', b).onclick = () => cerrar();
    $$('[data-pre]', b).forEach(x => x.onclick = () => {
      const p = PRESETS.find(y => y[0] === x.dataset.pre)[2];
      cambiar({ ...p, ...(p.paleta ? { colores: undefined } : {}) });
    });
    $('[data-mas]', b).onclick = () => { abierta = !abierta; pintar(); };
    const esc_ = $('[data-escala]', b);
    esc_.oninput = () => { $('[data-ver-escala]', b).textContent = '×' + Number(esc_.value).toFixed(1); };
    esc_.onchange = () => cambiar({ escala: Number(esc_.value) === 1 ? '' : Number(esc_.value) });
    $('[data-fuente]', b).onchange = (e) => { cargarFuente(e.target.value); cambiar({ fuente: e.target.value, peso: e.target.value ? estilo.peso : '' }); };
    $$('[data-modo]', b).forEach(x => x.onclick = () => cambiar({ modo: x.dataset.modo, ...(x.dataset.modo === 'multicolor' && !estilo.paleta ? { paleta: 'arcoiris' } : {}) }));
    $$('[data-c]', b).forEach(x => { x.onchange = () => cambiar({ [x.dataset.c]: x.value }); });
    $$('[data-paleta]', b).forEach(x => x.onclick = () => cambiar({ paleta: x.dataset.paleta, colores: '' }));
    $$('[data-pc]', b).forEach(x => x.onchange = () => { const c = [...colores]; c[Number(x.dataset.pc)] = x.value; cambiar({ colores: c }); });
    const mas = $('[data-pc-mas]', b); if (mas) mas.onclick = () => cambiar({ colores: [...colores, colores[0]] });
    const menos = $('[data-pc-menos]', b); if (menos) menos.onclick = () => cambiar({ colores: colores.slice(0, -1) });
    const gp = $('[data-guardar-paleta]', b);
    if (gp) gp.onclick = () => {
      const n = prompt('Nombre de la paleta (por ejemplo: Cálida de mi iglesia)', '');
      if (!n?.trim()) return;
      guardarPaleta(n.trim(), colores);
      cambiar({ paleta: 'mi:' + n.trim().slice(0, 30), colores: '' });
    };
    $('[data-efecto]', b).onchange = (e) => cambiar({ efecto: e.target.value });
    $$('[data-vel]', b).forEach(x => x.onclick = () => cambiar({ vel: x.dataset.vel === 'normal' ? '' : x.dataset.vel }));
    $('[data-todas]', b).onchange = (e) => { todas = e.target.checked; if (Object.keys(estilo).length) alCambiar({ ...estilo }, todas); };
    const q = $('[data-quitar]', b);
    if (q) q.onclick = () => { alQuitar?.(); cerrar(); };
    colocar();
  };
  // junto a la selección (en el celular, abajo como hoja)
  const colocar = () => {
    if (matchMedia('(max-width: 860px)').matches) { b.classList.add('abajo'); return; }
    const c = cont.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;
    let x = rect.left - c.left + rect.width / 2 - w / 2, y = rect.bottom - c.top + 10;
    if (y + h > c.height - 8) y = Math.max(8, rect.top - c.top - h - 10);
    b.style.left = Math.max(8, Math.min(x, c.width - w - 8)) + 'px';
    b.style.top = Math.max(8, Math.min(y, c.height - h - 8)) + 'px';
  };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  const cerrar = () => { if (!b.isConnected) return; b.remove(); document.removeEventListener('keydown', tecla); barraAbierta = null; alCerrar?.(); };
  document.addEventListener('keydown', tecla);
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  pintar();
  barraAbierta = { cerrar, el: b };
  return barraAbierta;
}
