// ============================================================
// Letras: piezas de interfaz para elegir fuentes, modelos de letras coloreadas y la letra de cartel
// Las usan el editor de Proyectos / plantillas / canciones (js/proyectos/editor.js) y la barra
// "✨ Resaltar" de las canciones (js/cultos/resaltar.js). Los datos están en recursos.js
// (GRUPOS_FUENTES, MODELOS_LETRA y aplicarCartel).
// ============================================================
import { $, $$, esc } from '../comun.js';
import { GRUPOS_FUENTES, MODELOS_LETRA, cargarFuentes, aplicarCartel, colorValido, modeloLetra } from './recursos.js';

// <optgroup> con todas las fuentes, para un <select>
export const opcionesFuentes = (actual) => GRUPOS_FUENTES.map(([g, lista]) => `<optgroup label="${esc(g)}">${lista.map(f =>
  `<option value="${esc(f)}" ${f === actual ? 'selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>`).join('');
// Al abrir el select se piden todas las fuentes, para que se vean en la lista (si el navegador lo permite)
export function selectConFuentes(sel) {
  if (!sel) return;
  const cargar = () => cargarFuentes(GRUPOS_FUENTES.flatMap(g => g[1]));
  sel.addEventListener('pointerdown', cargar, { once: true });
  sel.addEventListener('focus', cargar, { once: true });
  $$('option', sel).forEach(o => { o.style.fontFamily = `'${o.value}', sans-serif`; });
}

// ---------- Modelos de letras coloreadas ----------
// Un mosaico de botones "Abc" con el aspecto de cada modelo. alElegir(id, modelo)
export function pintarModelos(cont, alElegir, { muestra = 'Abc', actual = '' } = {}) {
  cargarFuentes(MODELOS_LETRA.map(m => m[2].fuente));
  cont.classList.add('ml-grid');
  cont.innerHTML = MODELOS_LETRA.map(([id, nombre]) => `<button type="button" class="ml-mod ${id === actual ? 'sel' : ''}" data-modelo="${id}" title="${esc(nombre)}">
    <span class="ml-abc"></span><small>${esc(nombre)}</small></button>`).join('');
  for (const [id, , m] of MODELOS_LETRA) {
    const b = $(`[data-modelo="${id}"]`, cont), s = $('.ml-abc', b);
    if (m.fondo) b.style.background = m.fondo;
    s.textContent = muestra;
    Object.assign(s.style, { fontFamily: `'${m.fuente}', sans-serif`, fontWeight: String(m.peso || 400) });
    const colores = aplicarCartel(s, m.cartel);
    if (colores) {
      s.textContent = '';
      [...muestra].forEach((ch, i) => { const l = document.createElement('span'); l.textContent = ch; l.style.color = colores[i % colores.length]; s.appendChild(l); });
    }
    b.onclick = () => alElegir(id, modeloLetra(id));
  }
}
// Un modelo como efecto de un texto del lienzo y como estilo de un resaltado
export const efectoDeModelo = (m) => ({ tipo: 'cartel', ...structuredClone(m.cartel) });
export const resaltadoDeModelo = (m) => ({ modo: 'cartel', fuente: m.fuente, ...(m.peso ? { peso: m.peso } : {}), cartel: structuredClone(m.cartel) });

// ---------- Botones de fuentes, por grupos (el primero abierto; los demás se cargan al abrirlos) ----------
export function pintarFuentes(cont, alElegir) {
  cont.innerHTML = GRUPOS_FUENTES.map(([g, lista], i) => `<details class="ml-grupo" ${i ? '' : 'open'}><summary>${esc(g)} <small>(${lista.length})</small></summary>
    ${lista.map(f => `<button type="button" class="fuente-op" data-f="${esc(f)}" style="font-family:'${esc(f)}', sans-serif;">${esc(f)}</button>`).join('')}</details>`).join('');
  $$('.ml-grupo', cont).forEach((d, i) => {
    const cargar = () => cargarFuentes(GRUPOS_FUENTES[i][1]);
    if (d.open) cargar();
    d.addEventListener('toggle', () => { if (d.open) cargar(); });
  });
  $$('[data-f]', cont).forEach(b => b.onclick = () => alElegir(b.dataset.f));
}

// ---------- Controles de la letra de cartel ----------
// c: { relleno, porLetra, borde, grosor, sombra, prof, brillo }. alCambiar(nuevo, final) — final: al soltar
export function htmlCartel(c = {}) {
  const rel = (Array.isArray(c.relleno) && c.relleno.length ? c.relleno : ['#FFFFFF']).slice(0, 6);
  const col = (k, v, d) => `<input type="color" data-k="${k}" value="${colorValido(v, d).slice(0, 7)}">`;
  return `<div class="ml-cartel">
    <div class="prop-fila"><label>Relleno</label><span class="ml-colores">${rel.map((x, i) => `<input type="color" data-rel="${i}" value="${colorValido(x).slice(0, 7)}" aria-label="Color ${i + 1}">`).join('')}
      <button type="button" class="btn btn-sm btn-ghost btn-icon" data-rel-mas title="Agregar color" ${rel.length >= 6 ? 'disabled' : ''}>＋</button>
      <button type="button" class="btn btn-sm btn-ghost btn-icon" data-rel-menos title="Quitar el último" ${rel.length <= 1 ? 'disabled' : ''}>－</button></span></div>
    ${rel.length > 1 ? `<label class="check small"><input type="checkbox" data-porletra ${c.porLetra ? 'checked' : ''}> Un color por letra (si no, degradado)</label>` : ''}
    <div class="prop-fila"><label><input type="checkbox" data-usa="borde" ${c.borde ? 'checked' : ''}> Contorno</label>${c.borde ? col('borde', c.borde, '#000000') + `<input type="range" min="0.01" max="0.15" step="0.01" data-n="grosor" value="${c.grosor ?? 0.05}">` : ''}</div>
    <div class="prop-fila"><label><input type="checkbox" data-usa="sombra" ${c.sombra ? 'checked' : ''}> Sombra 3D</label>${c.sombra ? col('sombra', c.sombra, '#000000') + `<input type="range" min="0.02" max="0.2" step="0.01" data-n="prof" value="${c.prof ?? 0.06}">` : ''}</div>
    <div class="prop-fila"><label><input type="checkbox" data-usa="brillo" ${c.brillo ? 'checked' : ''}> Brillo</label>${c.brillo ? col('brillo', c.brillo, '#FFFFFF') : ''}</div></div>`;
}
export function enlazarCartel(cont, c, alCambiar) {
  const actual = () => structuredClone(c || {});
  const rel = () => (Array.isArray(c?.relleno) && c.relleno.length ? [...c.relleno] : ['#FFFFFF']);
  $$('[data-rel]', cont).forEach(inp => {
    const poner = (final) => { const r = rel(); r[Number(inp.dataset.rel)] = inp.value; alCambiar({ ...actual(), relleno: r }, final); };
    inp.oninput = () => poner(false); inp.onchange = () => poner(true);
  });
  const mas = $('[data-rel-mas]', cont); if (mas) mas.onclick = () => { const r = rel(); alCambiar({ ...actual(), relleno: [...r, r[r.length - 1]] }, true); };
  const menos = $('[data-rel-menos]', cont); if (menos) menos.onclick = () => alCambiar({ ...actual(), relleno: rel().slice(0, -1) }, true);
  const pl = $('[data-porletra]', cont); if (pl) pl.onchange = () => alCambiar({ ...actual(), porLetra: pl.checked }, true);
  const defecto = { borde: '#111827', sombra: '#111827', brillo: '#FFFFFF' };
  $$('[data-usa]', cont).forEach(x => x.onchange = () => { const n = actual(); if (x.checked) n[x.dataset.usa] = defecto[x.dataset.usa]; else delete n[x.dataset.usa]; alCambiar(n, true); });
  $$('[data-k]', cont).forEach(inp => {
    inp.oninput = () => alCambiar({ ...actual(), [inp.dataset.k]: inp.value }, false);
    inp.onchange = () => alCambiar({ ...actual(), [inp.dataset.k]: inp.value }, true);
  });
  $$('[data-n]', cont).forEach(inp => {
    inp.oninput = () => alCambiar({ ...actual(), [inp.dataset.n]: Number(inp.value) }, false);
    inp.onchange = () => alCambiar({ ...actual(), [inp.dataset.n]: Number(inp.value) }, true);
  });
}
