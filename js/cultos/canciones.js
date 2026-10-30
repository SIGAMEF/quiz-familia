// ============================================================
// Cultos · Canciones: biblioteca (buscador, etiquetas, compartidas de mi iglesia)
// Cada canción se edita en el editor de Proyectos (proyectos.html?cancion=<id>): pantallas en la tira,
// 🎵 Letra y ➕ Recursos a la izquierda, plantilla y propiedades a la derecha.
// ============================================================
import { $, $$, esc, toast, confirmar, abrirModal, mensajeError, coincide, debounce, htmlMenuMas } from '../comun.js';
import { OPCIONES_DEFECTO, diapositivas, textoBuscable } from './letra.js';
import { prepararFuente, existePlantilla, hojasDeCancion, plantillaDeCancion } from './diapositivas.js';
import { PLANTILLA_DEFECTO } from './plantillas.js';
import { pintarHoja } from '../proyectos/lienzo.js';
import { htmlLetraCoristas } from './resaltar.js';
import { datosCanciones } from './datos.js';
import { proyectarSuelto } from './consola.js';

// ▶ Proyectar una canción sola (sin culto): primero su título y luego la letra, con su plantilla
export function proyectarCancion(c) {
  const pl = plantillaDeCancion(c);
  proyectarSuelto({ nombre: c.titulo, plantilla_base: pl, volver: 'cultos/canciones', items: [
    { id: 'titulo', tipo: 'texto', nombre: c.titulo, titulo: [c.autor, c.tono ? 'Tono ' + c.tono : ''].filter(Boolean).join(' · '), texto: c.titulo, plantilla: pl },
    { id: 'letra', tipo: 'cancion', cancion: c.id, plantilla: 'cancion' }
  ] });
}

// Preferencias de esta computadora (no importan si se pierden)
const pref = {
  leer(k, d) { try { return localStorage.getItem('cultos.' + k) ?? d; } catch { return d; } },
  poner(k, v) { try { localStorage.setItem('cultos.' + k, v); } catch { /* sin almacenamiento */ } }
};
// Plantilla para las canciones nuevas (y para las que todavía no eligieron una)
export const plantillaVista = () => { const p = pref.leer('plantilla', PLANTILLA_DEFECTO); return existePlantilla(p) ? p : PLANTILLA_DEFECTO; };
export const ponerPlantillaVista = (id) => pref.poner('plantilla', id);

const enAdmin = () => /admin\.html$/.test(location.pathname);
export const urlEditorCancion = (id) => `proyectos.html?cancion=${encodeURIComponent(id)}${enAdmin() ? '&volver=admin' : ''}`;
const abrirEditor = (id) => { location.href = urlEditorCancion(id); };
const nPantallas = (c) => diapositivas(c).length;
const textoPantallas = (n) => `${n} ${n === 1 ? 'pantalla' : 'pantallas'}`;
const conPlantilla = (c) => ({ ...c, opciones: { ...(c.opciones || {}), plantilla: c.opciones?.plantilla && existePlantilla(c.opciones.plantilla) ? c.opciones.plantilla : plantillaVista() } });

// ======================= BIBLIOTECA =======================
export async function pintarBiblioteca(cont, { perfil, datos = datosCanciones }) {
  cont.innerHTML = '<div class="center" style="padding:40px;"><div class="spinner"></div></div>';
  let lista;
  try { lista = (await datos.listar()).map(conPlantilla); }
  catch (e) { cont.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  await Promise.all([...new Set(lista.map(plantillaDeCancion))].map(prepararFuente));
  const estado = { q: '', etiqueta: '', de: 'todas' };
  const hayCompartidas = lista.some(c => !c.mia);
  const todasEtiquetas = [...new Set(lista.flatMap(c => c.etiquetas || []))].sort((a, b) => a.localeCompare(b, 'es'));

  cont.innerHTML = `
    <div class="row cu-barra">
      <input class="input grow" data-buscar placeholder="🔍 Buscar por título, autor o letra" aria-label="Buscar canciones">
      <button class="btn btn-primary" data-nueva>➕ Nueva canción</button>
    </div>
    ${hayCompartidas ? `<div class="pestanas cu-de" style="max-width:420px; margin-top:12px;"><button data-de="todas" class="activo">Todas</button><button data-de="mias">Mías</button><button data-de="iglesia">⛪ De mi iglesia</button></div>` : ''}
    ${todasEtiquetas.length ? `<div class="cu-chips" data-filtro-et style="margin-top:10px;"><button class="chip activo" data-et="">Todas</button>${todasEtiquetas.map(t => `<button class="chip" data-et="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="cu-lista" data-lista></div>`;
  const pintar = () => {
    const vis = lista.filter(c => (!estado.q || coincide(textoBuscable(c), estado.q))
      && (!estado.etiqueta || (c.etiquetas || []).includes(estado.etiqueta))
      && (estado.de === 'todas' || (estado.de === 'mias') === !!c.mia));
    const el = $('[data-lista]', cont);
    if (!lista.length) {
      el.innerHTML = `<div class="card empty" style="grid-column:1/-1;"><span class="big">🎵</span>Aún no tienes canciones.<br>
        <span class="small">Crea una, pega la letra y la app la divide sola en pantallas.</span><br>
        <button class="btn btn-primary" style="margin-top:12px;" data-nueva2>➕ Nueva canción</button></div>`;
      $('[data-nueva2]', el).onclick = () => abrirEditor('nueva');
      return;
    }
    el.innerHTML = vis.map(c => htmlTarjeta(c)).join('') || '<div class="card empty" style="grid-column:1/-1;"><span class="big">🔎</span>Ninguna canción coincide.</div>';
    for (const c of vis) {
      const t = $(`[data-cancion="${c.id}"]`, el);
      // la primera pantalla, con su plantilla, sus resaltados y sus detalles
      const h = hojasDeCancion(c)[0] || hojasDeCancion({ ...c, bloques: [{ tipo: 'estrofa', texto: c.titulo }], orden_canto: null })[0];
      pintarHoja($('[data-mini]', t), h, { modo: 'miniatura' });
      const abrir = () => c.mia ? abrirEditor(c.id) : verCancion(c, { perfil, datos, alCopiar: () => pintarBiblioteca(cont, { perfil, datos }) });
      $('[data-abrir]', t).onclick = abrir;
      $('[data-editar]', t).onclick = abrir;
      $('[data-proyectar]', t).onclick = () => proyectarCancion(c);
      $('[data-copiar]', t)?.addEventListener('click', () => copiarCancion(c, { perfil, datos }).then(ok => ok && pintarBiblioteca(cont, { perfil, datos })));
      $('[data-duplicar]', t)?.addEventListener('click', () => copiarCancion(c, { perfil, datos, sufijo: ' (copia)' }).then(ok => ok && pintarBiblioteca(cont, { perfil, datos })));
      $('[data-ver]', t)?.addEventListener('click', () => verCancion(c, { perfil, datos }));
      $('[data-borrar]', t)?.addEventListener('click', async () => {
        if (!await confirmar(`“${c.titulo}” se borrará para siempre.`, { titulo: '¿Eliminar la canción?', boton: 'Eliminar' })) return;
        try { await datos.eliminar(c.id); toast('Canción eliminada'); lista = lista.filter(x => x.id !== c.id); pintar(); }
        catch (e) { toast(mensajeError(e), 'error'); }
      });
    }
  };
  $('[data-buscar]', cont).oninput = debounce((e) => { estado.q = e.target.value; pintar(); }, 200);
  $('[data-nueva]', cont).onclick = () => abrirEditor('nueva');
  $$('[data-de]', cont).forEach(b => b.onclick = () => { estado.de = b.dataset.de; $$('[data-de]', cont).forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
  $$('[data-et]', cont).forEach(b => b.onclick = () => { estado.etiqueta = b.dataset.et; $$('[data-et]', cont).forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
  pintar();
}

function htmlTarjeta(c) {
  const n = nPantallas(c);
  const meta = [c.autor, c.tono ? `Tono ${c.tono}` : '', textoPantallas(n)].filter(Boolean).join(' · ');
  const mas = c.mia
    ? htmlMenuMas([['data-ver', '👁', 'Ver la letra (coristas)'], ['data-duplicar', '📄', 'Duplicar'], 'sep', ['data-borrar', '🗑', 'Eliminar', true]])
    : '';
  return `<div class="card cu-card" data-cancion="${c.id}">
    <button class="cu-mini" data-abrir title="${c.mia ? 'Editar' : 'Ver'}"><div data-mini></div></button>
    <div><h3 title="${esc(c.titulo)}">${esc(c.titulo)}</h3><p class="act-meta">${esc(meta)}</p></div>
    <div class="cu-chips">${c.mia ? (c.compartida ? '<span class="badge blue">⛪ Compartida</span>' : '') : `<span class="badge amber">⛪ De ${esc(c.profesor || 'otro profesor')}</span>`}
      ${(c.resaltados || []).length ? '<span class="badge">✨ Resaltados</span>' : ''}
      ${(c.etiquetas || []).map(t => `<span class="badge gray">${esc(t)}</span>`).join('')}</div>
    <div class="row cu-acciones">
      <button class="btn btn-sm ${c.mia ? 'btn-primary' : ''}" data-editar>${c.mia ? '✏️ Editar' : '👁 Ver'}</button>
      <button class="btn btn-sm" data-proyectar title="Proyectar esta canción">▶</button>
      ${c.mia ? '' : '<button class="btn btn-sm btn-primary" data-copiar>📋 Copiar a mis canciones</button>'}
      ${mas}</div></div>`;
}

const filaDe = (c) => ({ titulo: c.titulo, autor: c.autor || '', tono: c.tono || '', etiquetas: c.etiquetas || [], bloques: c.bloques || [],
  orden_canto: c.orden_canto?.length ? c.orden_canto : null, opciones: { ...OPCIONES_DEFECTO, ...(c.opciones || {}) }, compartida: !!c.compartida,
  resaltados: c.resaltados || [], detalles: c.detalles || {} });

async function copiarCancion(c, { perfil, datos, sufijo = '' }) {
  try {
    await datos.crear({ ...filaDe(c), titulo: (c.titulo + sufijo).slice(0, 150), compartida: false, profesor_id: perfil.id });
    toast(sufijo ? 'Canción duplicada' : 'Copiada a tus canciones');
    return true;
  } catch (e) { toast(mensajeError(e), 'error'); return false; }
}

// Letra completa, como la verán los coristas (resaltados en negrita, sin animación)
function verCancion(c, { perfil, datos, alCopiar }) {
  const m = abrirModal(`<h3>🎵 ${esc(c.titulo)}</h3>
    <p class="hint">${esc([c.autor, c.tono ? 'Tono ' + c.tono : '', c.mia ? '' : 'Compartida por ' + (c.profesor || 'otro profesor')].filter(Boolean).join(' · '))}</p>
    <div class="cu-letra">${htmlLetraCoristas(c) || '<p class="muted">Sin letra.</p>'}</div>
    <p class="hint" style="margin-top:10px;">Así la verán los coristas. En la proyección sale en ${textoPantallas(nPantallas(c))}, con sus efectos.</p>
    <div class="modal-pie">${!c.mia ? '<button class="btn btn-primary" data-copiar>📋 Copiar a mis canciones</button>' : '<button class="btn btn-primary" data-editar>✏️ Editar</button>'}
      <button class="btn btn-outline" data-cerrar>Cerrar</button></div>`, { ancho: true });
  const b = $('[data-copiar]', m.el);
  if (b) b.onclick = async () => { if (await copiarCancion(c, { perfil, datos })) { m.cerrar(); alCopiar?.(); } };
  const e = $('[data-editar]', m.el);
  if (e) e.onclick = () => { m.cerrar(); abrirEditor(c.id); };
}
