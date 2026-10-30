// ============================================================
// Cultos: sección del panel del profesor y del admin (#cultos)
// 3 pestañas: Cultos · Canciones · Plantillas.
// Rutas: #cultos · #cultos/canciones · #cultos/plantillas (los enlaces viejos #cultos/cancion-<id> abren el editor nuevo)
// #cultos/culto-<id> edita un culto y #cultos/proyectar-<id> abre la consola (js/cultos/cultos.js y consola.js).
// Las plantillas se editan en el editor de Proyectos (proyectos.html?plantilla=…).
// ============================================================
import { $, $$, esc, toast, confirmar, abrirModal, mensajeError } from '../comun.js';
import { pintarBiblioteca, plantillaVista, ponerPlantillaVista, urlEditorCancion } from './canciones.js';
import { pintarPantalla, pintarPortada, prepararFuente, registrarMisPlantillas, misPlantillas } from './diapositivas.js';
import { PLANTILLAS, CATEGORIAS } from './plantillas.js';
import { FONDOS } from './fondos.js';
import { pintarCultos, pintarEditorCulto } from './cultos.js';
import { pintarConsola } from './consola.js';
import { datosCanciones, datosPlantillas } from './datos.js';

const PESTANAS = { cultos: '⛪ Cultos', canciones: '🎵 Canciones', plantillas: '🎨 Plantillas' };

export async function vistaCultos(contenido, { perfil, param = '', datos = datosCanciones, plantillas = datosPlantillas }) {
  // las plantillas propias se necesitan en todas las pestañas (vista previa de las canciones)
  try { registrarMisPlantillas(await plantillas.listar()); } catch (e) { console.warn('No se pudieron cargar tus plantillas', e); }
  if (param.startsWith('cancion-')) { location.replace(urlEditorCancion(param.slice(8))); return; }
  const pestana = PESTANAS[param] ? param : 'cultos';
  const culto = /^(culto|proyectar)-(.+)$/.exec(param);
  contenido.innerHTML = `<div class="pestanas cu-pestanas" role="tablist">${Object.entries(PESTANAS).map(([k, t]) =>
    `<button role="tab" data-pest="${k}" class="${k === pestana ? 'activo' : ''}" aria-selected="${k === pestana}">${t}</button>`).join('')}</div><div data-cuerpo></div>`;
  $$('[data-pest]', contenido).forEach(b => b.onclick = () => { location.hash = 'cultos/' + b.dataset.pest; });
  const cuerpo = $('[data-cuerpo]', contenido);
  if (pestana === 'canciones') return pintarBiblioteca(cuerpo, { perfil, datos });
  if (pestana === 'plantillas') return pintarPlantillas(cuerpo, { plantillas });
  if (culto?.[1] === 'culto') return pintarEditorCulto(cuerpo, culto[2], { perfil, canciones: datos });
  if (culto?.[1] === 'proyectar') return pintarConsola(cuerpo, culto[2], { canciones: datos });
  return pintarCultos(cuerpo, { perfil, canciones: datos });
}

// ---------- Plantillas ----------
const enAdmin = () => /admin\.html$/.test(location.pathname);
export const urlEditorPlantilla = (q) => `proyectos.html?${q}${enAdmin() ? '&volver=admin' : ''}`;
const editarCopia = (id) => { location.href = urlEditorPlantilla(`plantilla=nueva&base=${encodeURIComponent(id)}`); };
const editarMia = (id) => { location.href = urlEditorPlantilla(`plantilla=${encodeURIComponent(id)}`); };

async function pintarPlantillas(cuerpo, { plantillas }) {
  let cat = 'Todas';
  const mias = misPlantillas();
  const cats = ['Todas', ...(mias.length ? ['Mis plantillas'] : []), ...CATEGORIAS];
  cuerpo.innerHTML = `<div class="row between cu-barra" style="margin-bottom:6px;">
      <p class="sub grow" style="margin:0;">Toca una plantilla para verla en grande. Todas se pueden cambiar como en Canva: textos, objetos, fondos animados e imágenes de Mis archivos.</p>
      <button class="btn btn-primary" data-blanco>➕ Nueva plantilla en blanco</button></div>
    <div class="cu-chips" data-cats style="margin:10px 0 4px;"></div>
    <div class="cu-lista cu-galeria" data-lista></div>`;
  $('[data-blanco]', cuerpo).onclick = () => editarCopia('blanco');
  const pintar = () => {
    $('[data-cats]', cuerpo).innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'activo' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $$('[data-cat]', cuerpo).forEach(b => b.onclick = () => { cat = b.dataset.cat; pintar(); });
    const lista = [...mias.map(p => ({ ...p, cat: 'Mis plantillas' })), ...PLANTILLAS.map(p => ({ ...p, cat: p.categoria }))]
      .filter(p => cat === 'Todas' || p.cat === cat || (cat !== 'Mis plantillas' && p.mia && p.categoria === cat));
    const el = $('[data-lista]', cuerpo);
    const enUso = plantillaVista();
    el.innerHTML = lista.map(p => `<div class="card cu-card ${p.id === enUso ? 'sel' : ''}" data-pl="${esc(p.id)}">
        <button class="cu-mini" data-ver title="Ver en grande"><div data-mini></div></button>
        <div class="row between" style="flex-wrap:nowrap; gap:8px;"><div style="min-width:0;"><h3 title="${esc(p.nombre)}">${esc(p.nombre)}</h3>
          <p class="act-meta">${esc(p.mia ? `Mía · ${p.categoria}` : `${p.categoria} · ${FONDOS[p.fondo?.valor]?.nombre || 'fondo'}`)}</p></div>
          ${p.id === enUso ? '<span class="badge green" title="Es la que se usa para ver las canciones">✔ En uso</span>' : ''}</div>
        <div class="row cu-acciones">
          <button class="btn btn-sm btn-primary" data-editar>✏️ ${p.mia ? 'Editar' : 'Personalizar'}</button>
          <button class="btn btn-sm" data-usar ${p.id === enUso ? 'disabled' : ''}>Usar en canciones</button>
          ${p.mia ? '<button class="btn btn-sm btn-ghost" data-borrar title="Eliminar" aria-label="Eliminar plantilla">🗑</button>' : ''}</div></div>`).join('')
      || '<div class="card empty" style="grid-column:1/-1;"><span class="big">🎨</span>No hay plantillas en esta categoría.</div>';
    for (const p of lista) {
      const t = $(`[data-pl="${CSS.escape(p.id)}"]`, el);
      pintarPortada($('[data-mini]', t), p.id);
      $('[data-ver]', t).onclick = () => verPlantilla(lista, lista.indexOf(p));
      $('[data-editar]', t).onclick = () => p.mia ? editarMia(p.idBase) : editarCopia(p.id);
      $('[data-usar]', t).onclick = () => { ponerPlantillaVista(p.id); toast(`Las canciones se verán con “${p.nombre}”`); pintar(); };
      $('[data-borrar]', t)?.addEventListener('click', async () => {
        if (!await confirmar(`“${p.nombre}” se borrará. Las imágenes que usa quedan en Mis archivos.`, { titulo: '¿Eliminar la plantilla?', boton: 'Eliminar' })) return;
        try {
          await plantillas.eliminar(p.idBase);
          registrarMisPlantillas(mias.filter(x => x.id !== p.id).map(x => ({ ...x, id: x.idBase })));
          mias.splice(mias.findIndex(x => x.id === p.id), 1);
          toast('Plantilla eliminada');
          pintar();
        } catch (e) { toast(mensajeError(e), 'error'); }
      });
    }
  };
  pintar();
}

// Vista grande: Portada / Con letra, ← → para cambiar de plantilla
function verPlantilla(lista, i) {
  let modo = 'portada';
  const m = abrirModal(`<div class="row between" style="margin:-4px 34px 10px 0; gap:8px;"><h3 style="margin:0;" data-titulo></h3>
      <div class="pestanas" style="margin:0; width:auto;"><button data-modo="portada">🏷 Portada</button><button data-modo="letra">🎵 Con letra</button></div></div>
    <div class="cu-grande" data-g></div>
    <div class="row between" style="margin-top:10px;"><button class="btn btn-outline" data-ant>◀</button>
      <span class="small muted">← → cambia de plantilla</span>
      <div class="row" style="gap:6px;"><button class="btn btn-primary" data-editar></button><button class="btn btn-outline" data-sig>▶</button></div></div>`, { ancho: true });
  const pintar = async () => {
    const p = lista[i];
    $('[data-titulo]', m.el).textContent = `${p.nombre} · ${p.categoria}`;
    $$('[data-modo]', m.el).forEach(b => b.classList.toggle('activo', b.dataset.modo === modo));
    $('[data-editar]', m.el).textContent = p.mia ? '✏️ Editar' : '✏️ Personalizar';
    if (modo === 'letra') {
      await prepararFuente(p.id);
      pintarPantalla($('[data-g]', m.el), p.id, ['Te alabaré con todo mi ser', 'tu amor me sostiene', 'en ti está mi fe'], { modo: 'ver', pie: 'Canción de ejemplo · Estrofa 1' });
    } else pintarPortada($('[data-g]', m.el), p.id, { modo: 'ver' });
  };
  const mover = (d) => { i = (i + d + lista.length) % lista.length; pintar(); };
  $$('[data-modo]', m.el).forEach(b => b.onclick = () => { modo = b.dataset.modo; pintar(); });
  $('[data-ant]', m.el).onclick = () => mover(-1);
  $('[data-sig]', m.el).onclick = () => mover(1);
  $('[data-editar]', m.el).onclick = () => { const p = lista[i]; if (p.mia) editarMia(p.idBase); else editarCopia(p.id); };
  const tecla = (e) => { if (!m.el.isConnected) return document.removeEventListener('keydown', tecla); if (e.key === 'ArrowLeft') mover(-1); if (e.key === 'ArrowRight') mover(1); };
  document.addEventListener('keydown', tecla);
  pintar();
}

