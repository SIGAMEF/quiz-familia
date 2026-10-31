// ============================================================
// Cultos · pestaña Cultos: lista (el próximo arriba, en grande) y editor de un culto
// Rutas: #cultos · #cultos/culto-<id> (editar) · #cultos/proyectar-<id> (consola, js/cultos/consola.js)
// El culto es una lista de elementos (js/cultos/elementos.js) con "+ Agregar" entre ellos; se arrastran
// para reordenar, se duplican y se eliminan con "Deshacer". Se guarda solo, como en Proyectos.
// ============================================================
import { $, $$, esc, toast, confirmar, abrirModal, mensajeError, coincide, debounce, htmlMenuMas, pedirDatos, reducirImagen, dibujarQR, copiar, fmtFecha } from '../comun.js';
import { pintarHoja, leerVideo } from '../proyectos/lienzo.js';
import { guardarArchivo, pintarMisArchivos } from '../proyectos/archivos.js';
import { prepararFuente, misPlantillas, plantillaDe, registrarMisPlantillas, existePlantilla } from './diapositivas.js';
import { PLANTILLAS } from './plantillas.js';
import { textoBuscable } from './letra.js';
import { plantillaVista, urlEditorCancion } from './canciones.js';
import { letraCoristas } from './resaltar.js';
import { urlLetras, enlaceWhatsApp } from './remoto.js';
import { TIPOS_ELEMENTO, MAX_ELEMENTOS, nuevoIdElemento, hojasDeElemento, tituloDeElemento, plantillaDeElemento, plantillasDeCulto, montarReloj, hojaDePortada } from './elementos.js';
import { abrirPantalla } from './consola.js';
import { descargarCulto } from './sin-red.js';
import { formVersiculo } from './panel-biblia.js';
import { datosCanciones, datosCultos, datosPlantillas } from './datos.js';

// ---------- Fechas (la fecha del culto es un día, sin hora) ----------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => iso(new Date());
export function proximoDomingo() { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7); return iso(d); }
export function fechaBonita(f) {
  if (!f) return 'Sin fecha';
  const d = new Date(f + 'T12:00:00');
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  return t.charAt(0).toUpperCase() + t.slice(1) + (f === hoy() ? ' · hoy' : '');
}
const textoN = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ---------- Plantillas para elegir ----------
function opcionesPlantilla(actual, extra = []) {
  return [...extra, ...misPlantillas().map(p => [p.id, `Mía · ${p.nombre}`]), ...PLANTILLAS.map(p => [p.id, `${p.nombre} · ${p.categoria}`])]
    .map(([v, t]) => `<option value="${esc(v)}" ${v === actual ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

// Canciones del profesor (las mías y las compartidas de mi iglesia), por id
async function mapaCanciones(datos) {
  return new Map((await datos.listar()).map(c => [c.id, c]));
}

// Abre la consola y, en el mismo clic, la ventana de la pantalla (así el navegador no la bloquea)
export function proyectar(id) {
  abrirPantalla(id);
  location.hash = 'cultos/proyectar-' + id;
}

// ======================= LISTA =======================
export async function pintarCultos(cuerpo, { perfil, datos = datosCultos, canciones: datosCanc = datosCanciones }) {
  cuerpo.innerHTML = '<div class="center" style="padding:40px;"><div class="spinner"></div></div>';
  let cultos, canciones;
  try { [cultos, canciones] = await Promise.all([datos.listar(), mapaCanciones(datosCanc)]); }
  catch (e) { cuerpo.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }

  if (!cultos.length) return pintarGuia(cuerpo, { perfil, datos, canciones });
  // el próximo: el de fecha más cercana desde hoy; si no hay, el último
  const futuros = cultos.filter(c => c.fecha && c.fecha >= hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const proximo = futuros[0] || cultos[0];
  const otros = cultos.filter(c => c !== proximo);
  const menu = htmlMenuMas([['data-descargar', '💾', 'Descargar (proyectar sin internet)'], ['data-duplicar', '📄', 'Duplicar (para otro día)'], 'sep', ['data-borrar', '🗑', 'Eliminar', true]]);
  cuerpo.innerHTML = `
    <div class="card cu-proximo" data-culto="${proximo.id}">
      <button class="cu-mini" data-editar title="Editar"><div data-mini></div></button>
      <div class="cu-proximo-info">
        <span class="badge ${proximo.fecha && proximo.fecha >= hoy() ? 'green' : 'gray'}">${proximo.fecha && proximo.fecha >= hoy() ? '📅 Próximo culto' : '🕘 Último culto'}</span>
        <h2>${esc(proximo.nombre)}</h2>
        <p class="sub" style="margin:0;">${esc(fechaBonita(proximo.fecha))} · ${esc(textoN((proximo.items || []).length, 'elemento', 'elementos'))}</p>
        <div class="row cu-acciones" style="margin-top:12px;">
          <button class="btn btn-primary" data-proyectar>▶ Proyectar</button>
          <button class="btn" data-editar>✏️ Editar</button>
          ${proximo.codigo_coristas && proximo.publicado_en ? '<button class="btn" data-coristas>🔗 Enlace coristas</button>' : ''}
          ${menu}</div></div></div>
    <div class="row between" style="margin-top:20px; gap:10px;">
      <h3 style="margin:0;">${otros.length ? 'Otros cultos' : ''}</h3>
      <button class="btn btn-primary" data-nuevo>➕ Nuevo culto</button></div>
    <div class="cu-lista" data-lista>${otros.map(c => `<div class="card cu-card" data-culto="${c.id}">
      <button class="cu-mini" data-editar title="Editar"><div data-mini></div></button>
      <div><h3 title="${esc(c.nombre)}">${esc(c.nombre)}</h3><p class="act-meta">${esc(fechaBonita(c.fecha))} · ${esc(textoN((c.items || []).length, 'elemento', 'elementos'))}</p></div>
      <div class="row cu-acciones"><button class="btn btn-sm btn-primary" data-editar>✏️ Editar</button><button class="btn btn-sm" data-proyectar>▶ Proyectar</button>${menu}</div></div>`).join('')}</div>`;

  $('[data-nuevo]', cuerpo).onclick = () => nuevoCulto({ datos });
  for (const c of cultos) {
    const t = $(`[data-culto="${c.id}"]`, cuerpo);
    $$('[data-editar]', t).forEach(b => b.onclick = () => { location.hash = 'cultos/culto-' + c.id; });
    $('[data-proyectar]', t).onclick = () => proyectar(c.id);
    $('[data-duplicar]', t).onclick = () => duplicarCulto(c, { datos });
    $('[data-descargar]', t).onclick = () => descargarCulto(c.id, { datos, canciones: datosCanc });
    $('[data-coristas]', t)?.addEventListener('click', () => mostrarEnlaceCoristas(c));
    $('[data-borrar]', t).onclick = async () => {
      if (!await confirmar(`“${c.nombre}” se borrará. Las canciones y las imágenes que usa no se borran.`, { titulo: '¿Eliminar el culto?', boton: 'Eliminar' })) return;
      try { await datos.eliminar(c.id); toast('Culto eliminado'); pintarCultos(cuerpo, { perfil, datos, canciones: datosCanc }); }
      catch (e) { toast(mensajeError(e), 'error'); }
    };
  }
  // miniaturas: la primera pantalla del primer elemento
  for (const c of cultos) {
    const mini = $(`[data-culto="${c.id}"] [data-mini]`, cuerpo);
    const primero = (c.items || [])[0];
    const id = primero ? plantillaDeElemento(primero, c, canciones.get(primero.cancion)) : plantillaDe(c.plantilla_base).id;
    await prepararFuente(id);
    if (!mini.isConnected) return;
    const h = primero ? hojasDeElemento(primero, c, canciones)[0] : null;
    pintarHoja(mini, h || hojaDePortada(id), { modo: 'miniatura' });
  }
}

// La primera vez: la guía de 3 pasos
function pintarGuia(cuerpo, { datos, canciones }) {
  const n = [...canciones.values()].filter(c => c.mia).length;
  const pasos = [
    { ok: n > 0, txt: 'Agrega canciones', det: n ? `Ya tienes ${textoN(n, 'canción', 'canciones')}.` : 'Pega la letra y se divide sola en pantallas.', boton: n ? 'Ver canciones' : '➕ Agregar', accion: () => { location.hash = 'cultos/canciones'; } },
    { ok: false, txt: 'Crea un culto', det: 'Bienvenida, canciones, versículos, avisos y videos en orden.', boton: '➕ Nuevo culto', accion: () => nuevoCulto({ datos }), principal: true },
    { ok: false, txt: 'Proyecta o comparte', det: 'Proyéctalo en el TV y contrólalo desde la PC o el celular, o publica las letras para los coristas.' }
  ];
  cuerpo.innerHTML = `<div class="card"><h2>🚀 Así se prepara un culto</h2><p class="sub">Tres pasos. Empieza por tus canciones y luego arma el culto.</p>
    ${pasos.map((p, i) => `<div class="row cu-paso-guia"><span class="badge ${p.ok ? 'green' : p.accion ? '' : 'gray'}">${p.ok ? '✔' : i + 1}</span>
      <span class="grow"><b>${esc(p.txt)}</b><br><span class="small muted">${esc(p.det)}</span></span>
      ${p.accion ? `<button class="btn btn-sm ${p.principal || !n ? 'btn-primary' : ''}" data-paso="${i}">${esc(p.boton)}</button>` : ''}</div>`).join('')}</div>`;
  $$('[data-paso]', cuerpo).forEach(b => b.onclick = pasos[b.dataset.paso].accion);
}

async function nuevoCulto({ datos }) {
  const r = await pedirDatos('⛪ Nuevo culto', [
    { nombre: 'nombre', etiqueta: 'Nombre', valor: 'Culto dominical', requerido: true },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: proximoDomingo() },
    { nombre: 'plantilla', etiqueta: 'Plantilla base (el estilo de todo el culto)', tipo: 'select', valor: plantillaVista(),
      opciones: [...misPlantillas().map(p => ({ valor: p.id, texto: `Mía · ${p.nombre}` })), ...PLANTILLAS.map(p => ({ valor: p.id, texto: `${p.nombre} · ${p.categoria}` }))] }
  ], { boton: 'Crear y agregar elementos', nota: 'Cada elemento puede cambiar su plantilla después.' });
  if (!r) return;
  try {
    const c = await datos.crear({ nombre: r.nombre.slice(0, 120), fecha: r.fecha || null, plantilla_base: r.plantilla, items: [] });
    location.hash = 'cultos/culto-' + c.id;
  } catch (e) { toast(mensajeError(e), 'error'); }
}

async function duplicarCulto(c, { datos }) {
  const r = await pedirDatos('📄 Duplicar culto', [
    { nombre: 'nombre', etiqueta: 'Nombre', valor: c.nombre, requerido: true },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: proximoDomingo() }
  ], { boton: 'Duplicar', nota: 'Se copian todos los elementos, en el mismo orden.' });
  if (!r) return;
  try {
    const n = await datos.crear({ nombre: r.nombre.slice(0, 120), fecha: r.fecha || null, plantilla_base: c.plantilla_base,
      items: (c.items || []).map(it => ({ ...it, id: nuevoIdElemento() })) });
    toast('Culto duplicado');
    location.hash = 'cultos/culto-' + n.id;
  } catch (e) { toast(mensajeError(e), 'error'); }
}

// ======================= EDITOR =======================
export async function pintarEditorCulto(cuerpo, id, { perfil, datos = datosCultos, canciones: datosCanc = datosCanciones }) {
  cuerpo.innerHTML = '<div class="center" style="padding:40px;"><div class="spinner"></div></div>';
  let culto, canciones;
  try { [culto, canciones] = await Promise.all([datos.obtener(id), mapaCanciones(datosCanc)]); }
  catch (e) { cuerpo.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  if (!culto) { cuerpo.innerHTML = '<div class="card empty"><span class="big">🔎</span>Este culto ya no existe.<br><a href="#cultos">← Volver a los cultos</a></div>'; return; }
  culto.items = Array.isArray(culto.items) ? culto.items : [];
  await Promise.all(plantillasDeCulto(culto, canciones).map(prepararFuente));

  // ---------- guardado automático ----------
  let sucio = false, guardando = false;
  const estado = (clase, txt) => { const e = $('[data-estado]', cuerpo); if (e) { e.className = 'cu-guardado ' + clase; e.textContent = txt; } };
  async function guardar() {
    if (guardando || !sucio) return;
    guardando = true; sucio = false;
    estado('', 'Guardando…');
    try {
      const r = await datos.guardar(culto.id, { nombre: (culto.nombre || '').trim().slice(0, 120) || 'Culto', fecha: culto.fecha || null,
        plantilla_base: culto.plantilla_base, items: culto.items });
      estado('', 'Guardado ✓');
      if (culto.publicado_en) { pendiente = true; pintarPublicar(); }
      culto.updated_at = r?.updated_at || culto.updated_at;
    } catch (e) { sucio = true; estado('error', '⚠️ No se guardó: ' + mensajeError(e)); }
    finally { guardando = false; if (sucio) programar(); }
  }
  const programar = debounce(guardar, 700);
  const cambio = () => { sucio = true; estado('', 'Cambios sin guardar…'); programar(); };
  const avisoSalir = (e) => { if (sucio || guardando) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', avisoSalir);
  addEventListener('hashchange', () => { removeEventListener('beforeunload', avisoSalir); guardar(); }, { once: true });

  cuerpo.innerHTML = `
    <div class="row cu-ed-cab" style="gap:10px;">
      <a class="btn btn-sm btn-ghost" href="#cultos">← Cultos</a>
      <span class="cu-guardado" data-estado>Guardado ✓</span>
      <span class="grow"></span>
      <span class="row" style="gap:6px;" data-publicar></span>
      <button class="btn" data-descargar title="Un archivo para proyectar sin internet">💾 Descargar</button>
      <button class="btn btn-primary" data-proyectar>▶ Proyectar</button></div>
    <div class="card cu-culto-datos">
      <div><label class="lbl">Nombre del culto</label><input class="input" data-nombre maxlength="120" value="${esc(culto.nombre)}"></div>
      <div><label class="lbl">Fecha</label><input class="input" type="date" data-fecha value="${esc(culto.fecha || '')}"></div>
      <div><label class="lbl">Plantilla base</label><select class="input" data-base>${opcionesPlantilla(plantillaDe(culto.plantilla_base).id)}</select></div>
    </div>
    <div class="row between" style="margin:18px 0 8px; gap:8px;"><h3 style="margin:0;">Orden del culto</h3><span class="small muted" data-total></span></div>
    <div class="cu-items" data-items></div>
    <div class="cu-deshacer" data-deshacer hidden></div>`;

  $('[data-nombre]', cuerpo).oninput = (e) => { culto.nombre = e.target.value; cambio(); };
  $('[data-fecha]', cuerpo).onchange = (e) => { culto.fecha = e.target.value || null; cambio(); };
  $('[data-base]', cuerpo).onchange = async (e) => { culto.plantilla_base = e.target.value; await prepararFuente(e.target.value); cambio(); pintarItems(); };
  $('[data-proyectar]', cuerpo).onclick = async () => { await guardar(); proyectar(culto.id); };
  $('[data-descargar]', cuerpo).onclick = async () => { await guardar(); descargarCulto(culto.id, { datos, canciones: datosCanc }); };

  // ---------- 📤 Publicar para coristas (una copia fija; el enlace no cambia al publicar cambios) ----------
  let pendiente = !!culto.publicado_en && new Date(culto.updated_at) - new Date(culto.publicado_en) > 2000;
  function pintarPublicar() {
    const c = $('[data-publicar]', cuerpo);
    if (!c) return;
    if (!culto.publicado_en) {
      c.innerHTML = '<button class="btn" data-pub title="Las letras para el celular de los coristas">📤 Publicar para coristas</button>';
    } else {
      c.innerHTML = `${pendiente ? '<button class="btn btn-amber" data-pub title="Los coristas ven la versión anterior hasta que publiques">📤 Publicar cambios</button>'
        : `<span class="badge green" title="Publicado ${esc(fmtFecha(culto.publicado_en, true))}">✔ Publicado</span>`}
        <button class="btn" data-enlace>🔗 Coristas</button>
        ${htmlMenuMas([['data-despub', '🚫', 'Despublicar (el enlace deja de funcionar)', true]])}`;
    }
    $('[data-pub]', c)?.addEventListener('click', publicar);
    $('[data-enlace]', c)?.addEventListener('click', () => mostrarEnlaceCoristas(culto));
    $('[data-despub]', c)?.addEventListener('click', async () => {
      if (!await confirmar('El enlace de los coristas dejará de funcionar. Si vuelves a publicar, tendrás un enlace nuevo.', { titulo: '¿Despublicar?', boton: 'Despublicar' })) return;
      try { await datos.despublicar(culto.id); culto.publicado_en = null; culto.codigo_coristas = null; pendiente = false; pintarPublicar(); toast('Despublicado'); }
      catch (e) { toast(mensajeError(e), 'error'); }
    });
  }
  async function publicar() {
    await guardar();
    const items = datosCoristas(culto, canciones);
    if (!items.length && !await confirmar('Este culto no tiene canciones ni versículos: los coristas verán la lista vacía.', { titulo: '¿Publicar igual?', boton: 'Publicar', peligro: false })) return;
    try {
      const r = await datos.publicar(culto.id, items);
      const primera = !culto.publicado_en;
      culto.codigo_coristas = r.codigo; culto.publicado_en = r.publicado_en; pendiente = false;
      pintarPublicar();
      if (primera) mostrarEnlaceCoristas(culto); else toast('Cambios publicados: los coristas los verán al abrir el enlace');
    } catch (e) { toast(mensajeError(e), 'error'); }
  }
  pintarPublicar();

  const recargarPlantillas = async () => { registrarMisPlantillas(await datosPlantillas.listar()); await Promise.all(plantillasDeCulto(culto, canciones).map(prepararFuente)); };
  const ctx = { culto, canciones, perfil, recargarPlantillas, recargar: async () => { const m = await mapaCanciones(datosCanc); canciones.clear(); m.forEach((v, k) => canciones.set(k, v)); } };
  // si se guarda una plantilla en otra pestaña (el editor de plantillas), las miniaturas se actualizan
  if ('BroadcastChannel' in window) {
    const bcPl = new BroadcastChannel('cultos-plantillas');
    bcPl.onmessage = async () => { if (!cuerpo.isConnected) return bcPl.close(); try { await recargarPlantillas(); pintarItems(); } catch { /* se verá al recargar */ } };
    addEventListener('hashchange', () => bcPl.close(), { once: true });
  }

  // ---------- la lista ----------
  let arrastrando = null;
  function pintarItems() {
    const el = $('[data-items]', cuerpo);
    if (!el) return;
    const items = culto.items;
    const hojas = items.map(it => hojasDeElemento(it, culto, canciones));
    const total = hojas.reduce((t, h) => t + h.length, 0);
    $('[data-total]', cuerpo).textContent = items.length ? `${textoN(items.length, 'elemento', 'elementos')} · ${textoN(total, 'pantalla', 'pantallas')}` : '';
    const agregar = (i, grande = false) => grande
      ? `<button class="btn btn-block cu-agregar-fin" data-agregar="${i}">➕ Agregar ${items.length ? 'otro elemento' : 'el primer elemento'}</button>`
      : `<button class="cu-agregar" data-agregar="${i}" title="Agregar un elemento aquí"><span>＋ Agregar aquí</span></button>`;
    el.innerHTML = (items.length ? agregar(0) : '') + items.map((it, i) => {
      const t = TIPOS_ELEMENTO[it.tipo] || { ico: '❔', nombre: 'Elemento' };
      const n = hojas[i].length;
      const p = plantillaDe(plantillaDeElemento(it, culto, canciones.get(it.cancion)));
      const falta = it.tipo === 'cancion' && !canciones.has(it.cancion);
      return `<div class="cu-item ${falta ? 'malo' : ''}" data-i="${i}" draggable="true">
          <span class="cu-asa" title="Arrastra para mover" aria-hidden="true">⠿</span>
          <b class="cu-item-n">${i + 1}</b>
          <button class="cu-item-mini" data-editar title="Editar"><div data-mini></div></button>
          <div class="cu-item-info"><span class="cu-item-tipo">${t.ico} ${esc(t.nombre)}</span>
            <h4 title="${esc(tituloDeElemento(it, canciones))}">${esc(tituloDeElemento(it, canciones))}</h4>
            <span class="small muted">${esc(textoN(n, 'pantalla', 'pantallas'))}${it.tipo === 'video' ? '' : ' · ' + esc(p.nombre)}</span></div>
          <div class="row cu-item-acc"><button class="btn btn-sm" data-editar>✏️<span class="cu-solo-ancho"> Editar</span></button>
            ${htmlMenuMas([['data-subir', '⬆️', 'Subir'], ['data-bajar', '⬇️', 'Bajar'], ['data-duplicar', '📄', 'Duplicar'], 'sep', ['data-borrar', '🗑', 'Eliminar', true]])}</div>
        </div>${i < items.length - 1 ? agregar(i + 1) : ''}`;
    }).join('') + (items.length < MAX_ELEMENTOS ? agregar(items.length, true) : '<p class="hint">Llegaste al máximo de elementos de un culto.</p>');

    items.forEach((it, i) => {
      const fila = $(`.cu-item[data-i="${i}"]`, el);
      if (hojas[i][0]) pintarHoja($('[data-mini]', fila), hojas[i][0], { modo: 'miniatura' });
      $$('[data-editar]', fila).forEach(b => b.onclick = () => editar(i));
      $('[data-subir]', fila).onclick = () => mover(i, i - 1);
      $('[data-bajar]', fila).onclick = () => mover(i, i + 1);
      $('[data-duplicar]', fila).onclick = () => { if (items.length >= MAX_ELEMENTOS) return; items.splice(i + 1, 0, { ...structuredClone(it), id: nuevoIdElemento() }); cambio(); pintarItems(); };
      $('[data-borrar]', fila).onclick = () => borrar(i);
      // si había texto seleccionado, el navegador arrastraría la selección en vez del elemento
      fila.onmousedown = () => getSelection()?.removeAllRanges();
      fila.ondragstart = (e) => { arrastrando = i; fila.classList.add('arrastra'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); };
      fila.ondragend = () => { arrastrando = null; $$('.cu-item', el).forEach(x => x.classList.remove('arrastra', 'sobre')); };
      fila.ondragover = (e) => { if (arrastrando == null) return; e.preventDefault(); $$('.cu-item', el).forEach(x => x.classList.toggle('sobre', x === fila && arrastrando !== i)); };
      fila.ondrop = (e) => { e.preventDefault(); if (arrastrando != null && arrastrando !== i) mover(arrastrando, i); };
    });
    $$('[data-agregar]', el).forEach(b => b.onclick = () => agregarEn(Number(b.dataset.agregar)));
  }
  function mover(de, a) {
    const items = culto.items;
    if (a < 0 || a >= items.length || de === a) return;
    const [x] = items.splice(de, 1);
    items.splice(a, 0, x);
    cambio(); pintarItems();
  }
  let tDeshacer;
  function borrar(i) {
    const [x] = culto.items.splice(i, 1);
    cambio(); pintarItems();
    const bar = $('[data-deshacer]', cuerpo);
    bar.innerHTML = `<span>🗑 Se eliminó “${esc(tituloDeElemento(x, canciones))}”</span><button class="btn btn-sm" data-volver>↩ Deshacer</button>`;
    bar.hidden = false;
    clearTimeout(tDeshacer);
    tDeshacer = setTimeout(() => { bar.hidden = true; }, 7000);
    $('[data-volver]', bar).onclick = () => { culto.items.splice(Math.min(i, culto.items.length), 0, x); bar.hidden = true; cambio(); pintarItems(); };
  }
  async function agregarEn(pos) {
    const tipo = await elegirTipo();
    if (!tipo) return;
    const base = { id: nuevoIdElemento(), tipo, plantilla: '' };
    const extra = { texto: { titulo: '', texto: '', portada: false }, versiculo: { cita: '', texto: '', numeros: true }, diseno: { plantilla: culto.plantilla_base }, regresiva: { minutos: 5, texto: 'El culto empieza en', plantilla: 'regresiva' } }[tipo] || {};
    const it = await editarElemento({ ...base, ...extra }, { ...ctx, nuevo: true });
    if (!it) return;
    culto.items.splice(pos, 0, it);
    cambio(); pintarItems();
  }
  async function editar(i) {
    const it = await editarElemento(culto.items[i], ctx);
    if (!it) return;
    culto.items[i] = it;
    cambio(); pintarItems();
  }
  pintarItems();
}

function elegirTipo() {
  return new Promise(resolve => {
    let elegido = null;
    const m = abrirModal(`<h3>➕ ¿Qué quieres agregar?</h3>
      <div class="cu-tipos-el">${Object.entries(TIPOS_ELEMENTO).map(([k, t]) => `<button class="cu-tipo-el" data-tipo="${k}"><span>${t.ico}</span>${esc(t.nombre)}</button>`).join('')}</div>`,
    { alCerrar: () => resolve(elegido) });
    $$('[data-tipo]', m.el).forEach(b => b.onclick = () => { elegido = b.dataset.tipo; m.cerrar(); });
  });
}

// ---------- Editar un elemento ----------
// Devuelve el elemento cambiado (o null si se cancela). La vista previa se actualiza mientras se escribe.
function editarElemento(original, { culto, canciones, perfil, recargar, recargarPlantillas, nuevo = false }) {
  return new Promise(resolve => {
    const it = structuredClone(original);
    const t = TIPOS_ELEMENTO[it.tipo];
    let listo = false, cerrarDiseno = null;
    const m = abrirModal(`<h3>${t.ico} ${nuevo ? 'Agregar' : 'Editar'}: ${esc(t.nombre)}</h3>
      <div class="cu-el">
        <div class="cu-el-form" data-form></div>
        <div class="cu-el-prev"><div data-prev></div><p class="hint" data-nprev style="margin-top:6px;"></p></div>
      </div>
      <div class="err" data-err></div>
      <div class="modal-pie"><button class="btn btn-outline" data-cancelar>Cancelar</button><button class="btn btn-primary" data-ok>${nuevo ? '➕ Agregar' : 'Guardar'}</button></div>`,
    { ancho: true, alCerrar: () => { cerrarDiseno?.(); if (!listo) resolve(null); } });
    const form = $('[data-form]', m.el);
    $('[data-cancelar]', m.el).onclick = () => m.cerrar();

    const previa = debounce(async () => {
      const pid = plantillaDeElemento(it, culto, canciones.get(it.cancion));
      await prepararFuente(pid);
      if (!m.el.isConnected) return;
      const hojas = hojasDeElemento(it, culto, canciones);
      const l = hojas[0] ? pintarHoja($('[data-prev]', m.el), hojas[0], { modo: 'miniatura' }) : null;
      if (l) montarReloj(l, hojas[0]);
      $('[data-nprev]', m.el).textContent = `Saldrá en ${textoN(hojas.length, 'pantalla', 'pantallas')}.` + (hojas.length > 1 ? ' Aquí ves la primera.' : '');
    }, 250);

    const selPlantilla = (extra = []) => `<label class="lbl">Plantilla</label><select class="input" data-pl>${opcionesPlantilla(it.plantilla || '', [['', `La del culto (${plantillaDe(culto.plantilla_base).nombre})`], ...extra])}</select>`;
    const enlazar = () => {
      $$('[data-campo]', form).forEach(x => {
        const k = x.dataset.campo;
        x.oninput = x.onchange = () => { it[k] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Number(x.value) : x.value; previa(); };
      });
      const pl = $('[data-pl]', form);
      if (pl) pl.onchange = () => { it.plantilla = pl.value; previa(); };
    };

    if (it.tipo === 'cancion') {
      form.innerHTML = `<label class="lbl">Canción</label><input class="input" data-q placeholder="🔍 Buscar por título, autor o letra">
        <div class="cu-el-canciones" data-lista></div>
        <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm" data-nueva>➕ Crear canción nueva</button><button class="btn btn-sm btn-ghost" data-recargar>🔄 Actualizar la lista</button></div>
        ${selPlantilla([['cancion', '🎵 La de la canción']])}`;
      const pintarLista = () => {
        const q = $('[data-q]', form).value;
        const vis = [...canciones.values()].filter(c => !q || coincide(textoBuscable(c), q)).slice(0, 60);
        $('[data-lista]', form).innerHTML = vis.map(c => `<button class="cu-el-cancion ${c.id === it.cancion ? 'sel' : ''}" data-c="${c.id}">
            <b>${esc(c.titulo)}</b><small>${esc([c.autor, c.mia ? '' : '⛪ ' + (c.profesor || 'de mi iglesia')].filter(Boolean).join(' · '))}</small></button>`).join('')
          || `<p class="hint" style="padding:10px;">${canciones.size ? 'Ninguna canción coincide.' : 'Aún no tienes canciones. Crea una nueva.'}</p>`;
        $$('[data-c]', form).forEach(b => b.onclick = () => { it.cancion = b.dataset.c; $$('[data-c]', form).forEach(x => x.classList.toggle('sel', x === b)); previa(); });
      };
      $('[data-q]', form).oninput = debounce(pintarLista, 150);
      $('[data-nueva]', form).onclick = () => { window.open(urlEditorCancion('nueva'), '_blank'); toast('Cuando termines la canción, vuelve aquí y toca 🔄 Actualizar la lista'); };
      $('[data-recargar]', form).onclick = async () => { try { await recargar(); pintarLista(); toast('Lista actualizada'); } catch (e) { toast(mensajeError(e), 'error'); } };
      pintarLista();
    } else if (it.tipo === 'versiculo') {
      formVersiculo(form, it, { previa, selPlantilla }).then(() => { enlazar(); previa(); }).catch(e => toast(mensajeError(e), 'error'));
    } else if (it.tipo === 'diseno') {
      formDiseno(form, it, { previa, recargarPlantillas, alCerrar: (f) => { cerrarDiseno = f; } });
    } else if (it.tipo === 'texto') {
      form.innerHTML = `<label class="lbl">Título (sale abajo, como el nombre de una canción)</label><input class="input" data-campo="titulo" maxlength="80" placeholder="Bienvenidos" value="${esc(it.titulo || '')}">
        <label class="lbl">Texto</label><textarea class="input cu-el-area" data-campo="texto" placeholder="Qué bueno que estás aquí.&#10;&#10;Deja una línea en blanco para pasar a otra pantalla.">${esc(it.texto || '')}</textarea>
        <label class="check" style="margin-top:10px;"><input type="checkbox" data-campo="portada" ${it.portada ? 'checked' : ''}> Mostrar primero la portada de la plantilla</label>
        ${selPlantilla()}`;
    } else if (it.tipo === 'anuncio') {
      form.innerHTML = `<label class="lbl">Nombre (para la lista)</label><input class="input" data-campo="nombre" maxlength="80" placeholder="Retiro de jóvenes" value="${esc(it.nombre || '')}">
        <label class="lbl">Imagen</label><div data-img></div>
        <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm" data-mis>📁 Mis archivos</button>
          <label class="btn btn-sm">⬆️ Subir imagen<input type="file" accept="image/*" data-subir hidden></label>
          <button class="btn btn-sm btn-ghost" data-quitar>Quitar imagen</button></div>
        <p class="hint">También puedes pegar una imagen con Ctrl+V. Sin imagen se muestra la portada de la plantilla.</p>
        <div data-solo-pl>${selPlantilla()}</div>`;
      const pintarImg = () => {
        $('[data-img]', form).innerHTML = it.url ? `<img class="cu-el-img" src="${esc(it.url)}" alt="">` : '<p class="small muted">Sin imagen: se usa la portada de la plantilla.</p>';
        $('[data-quitar]', form).hidden = !it.url;
        $('[data-solo-pl]', form).hidden = !!it.url;
      };
      const usar = (a) => { it.url = a.url; if (!it.nombre) { it.nombre = a.nombre || ''; $('[data-campo="nombre"]', form).value = it.nombre; } pintarImg(); previa(); };
      const subir = async (archivo) => {
        try { toast('Subiendo imagen…'); usar(await subirImagenCulto(archivo, perfil)); }
        catch (e) { toast('No se pudo subir la imagen: ' + mensajeError(e), 'error'); }
      };
      $('[data-mis]', form).onclick = () => elegirArchivo('imagen', usar);
      $('[data-subir]', form).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) subir(f); };
      $('[data-quitar]', form).onclick = () => { it.url = ''; pintarImg(); previa(); };
      m.el.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); subir(f); } });
      pintarImg();
    } else if (it.tipo === 'video') {
      form.innerHTML = `<label class="lbl">Nombre (para la lista)</label><input class="input" data-campo="nombre" maxlength="80" placeholder="Video de misiones" value="${esc(it.nombre || '')}">
        <label class="lbl">Enlace de YouTube o Vimeo</label><input class="input" data-campo="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(it.url || '')}">
        <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm" data-mis>📁 Un video de Mis archivos</button></div>
        <p class="hint">En la proyección el video empieza solo (si el navegador no lo permite, haz clic en la pantalla). Necesita internet.</p>`;
      $('[data-mis]', form).onclick = () => elegirArchivo('video', (a) => {
        it.url = a.url; $('[data-campo="url"]', form).value = a.url;
        if (!it.nombre) { it.nombre = a.nombre || ''; $('[data-campo="nombre"]', form).value = it.nombre; }
        previa();
      });
    } else if (it.tipo === 'regresiva') {
      form.innerHTML = `<label class="lbl">Minutos</label><input class="input" type="number" min="0.5" max="120" step="0.5" data-campo="minutos" value="${esc(it.minutos ?? 5)}">
        <label class="lbl">Texto</label><input class="input" data-campo="texto" maxlength="120" placeholder="El culto empieza en" value="${esc(it.texto || '')}">
        <p class="hint">El reloj empieza a contar cuando la pantalla aparece en la proyección.</p>
        ${selPlantilla()}`;
    }
    enlazar();
    previa();

    $('[data-ok]', m.el).onclick = () => {
      const err = $('[data-err]', m.el);
      if (it.tipo === 'cancion' && !it.cancion) { err.textContent = 'Elige una canción de la lista.'; return; }
      if (it.tipo === 'video' && !leerVideo(it.url)) { err.textContent = 'Pega un enlace de YouTube o Vimeo, o elige un video de Mis archivos.'; return; }
      if (it.tipo === 'versiculo' && !String(it.cita || '').trim() && !String(it.texto || '').trim()) { err.textContent = 'Escribe la cita o el texto del versículo.'; return; }
      if (it.tipo === 'diseno' && !existePlantilla(it.plantilla)) { err.textContent = 'Elige una plantilla.'; return; }
      if (it.tipo === 'regresiva') it.minutos = Math.max(0.5, Math.min(120, Number(it.minutos) || 5));
      for (const k of ['cita', 'titulo', 'nombre', 'texto']) if (typeof it[k] === 'string') it[k] = it[k].slice(0, k !== 'texto' ? 120 : it.tipo === 'versiculo' ? 12000 : 4000);
      delete it.vcorto;
      listo = true;
      resolve(it);
      m.cerrar();
    };
  });
}

// ---------- Coristas ----------
// Lo que se publica: las canciones (letra por bloques, con los resaltados), los versículos, los textos,
// los anuncios con imagen y los videos (como enlace), en orden. Cuentas regresivas y diseños no salen.
export function datosCoristas(culto, canciones) {
  return (culto.items || []).flatMap(it => {
    if (it.tipo === 'cancion') {
      const c = canciones.get(it.cancion);
      return c ? [{ id: it.id, tipo: 'cancion', titulo: c.titulo, autor: c.autor || '', tono: c.tono || '', bloques: letraCoristas(c) }] : [];
    }
    if (it.tipo === 'versiculo') return [{ id: it.id, tipo: 'versiculo', titulo: it.cita || 'Versículo', texto: String(it.texto || '') }];
    if (it.tipo === 'texto') {
      const titulo = String(it.titulo || '').trim(), texto = String(it.texto || '').trim();
      return titulo || texto ? [{ id: it.id, tipo: 'texto', titulo: titulo || 'Aviso', texto }] : [];
    }
    if (it.tipo === 'anuncio') return it.url ? [{ id: it.id, tipo: 'anuncio', titulo: it.nombre || 'Anuncio', url: it.url }] : [];
    if (it.tipo === 'video') return it.url ? [{ id: it.id, tipo: 'video', titulo: it.nombre || 'Video', url: it.url }] : [];
    return [];
  });
}
export function mostrarEnlaceCoristas(culto) {
  if (!culto.codigo_coristas) return toast('Primero publica el culto (📤 Publicar para coristas).', 'error');
  const url = urlLetras(culto.codigo_coristas);
  const m = abrirModal(`<h3>🔗 Letras para los coristas</h3>
    <p class="hint">Cada corista ve las letras en su celular, a su ritmo. Funciona aunque nadie esté proyectando y sin señal después de abrirlo una vez.</p>
    <div class="center"><div class="cu-qr" data-qr></div></div>
    <p class="small" style="word-break:break-all; text-align:center;">${esc(url)}</p>
    <div class="modal-pie" style="flex-wrap:wrap;"><button class="btn btn-outline" data-copiar>📋 Copiar</button>
      <button class="btn btn-outline" data-abrir>👁 Ver como corista</button><button class="btn btn-primary" data-wa>🟢 Enviar por WhatsApp</button></div>`);
  dibujarQR($('[data-qr]', m.el), url, 200);
  $('[data-copiar]', m.el).onclick = async () => { await copiar(url); toast('Enlace copiado'); };
  $('[data-abrir]', m.el).onclick = () => window.open(url, '_blank');
  $('[data-wa]', m.el).onclick = () => window.open(enlaceWhatsApp(`🎵 Letras para “${culto.nombre}”${culto.fecha ? ' (' + fechaBonita(culto.fecha) + ')' : ''}: ${url}`), '_blank');
}

// ---------- Plantilla / Diseño: elegir una plantilla (mía o prediseñada) y editarla ----------
const enAdmin = () => /admin\.html$/.test(location.pathname);
const urlEditorPlantilla = (q) => `proyectos.html?${q}${enAdmin() ? '&volver=admin' : ''}`;
function formDiseno(form, it, { previa, recargarPlantillas, alCerrar }) {
  form.innerHTML = `<p class="hint" style="margin-top:0;">La portada de la plantilla será una pantalla del culto. Toca una para elegirla.</p>
    <div class="cu-el-pls" data-pls></div>
    <div class="row" style="gap:6px; margin-top:8px;"><button class="btn btn-sm btn-primary" data-editar-pl>✏️ Editar esta plantilla</button>
      <button class="btn btn-sm" data-blanco>➕ Nueva en blanco</button><button class="btn btn-sm btn-ghost" data-recargar-pl>🔄 Actualizar</button></div>
    <p class="hint" data-nota-pl></p>`;
  const pintar = async () => {
    const lista = [...misPlantillas(), ...PLANTILLAS];
    const cont = $('[data-pls]', form);
    cont.innerHTML = lista.map(p => `<button class="cu-el-pl ${p.id === it.plantilla ? 'sel' : ''}" data-pl="${esc(p.id)}" title="${esc(p.nombre)}"><div data-m></div><span>${p.mia ? '⭐ ' : ''}${esc(p.nombre)}</span></button>`).join('');
    for (const p of lista) {
      const b = $(`[data-pl="${CSS.escape(p.id)}"]`, cont);
      pintarHoja($('[data-m]', b), hojaDePortada(p.id), { modo: 'miniatura' });
      b.onclick = () => { it.plantilla = p.id; $$('[data-pl]', cont).forEach(x => x.classList.toggle('sel', x === b)); nota(); previa(); };
    }
    nota();
  };
  const nota = () => {
    const p = existePlantilla(it.plantilla) ? plantillaDe(it.plantilla) : null;
    $('[data-editar-pl]', form).disabled = !p;
    $('[data-nota-pl]', form).textContent = !p ? '' : p.mia
      ? 'Es tuya: los cambios que hagas se verán en este culto (y donde más la uses).'
      : 'Es prediseñada: al editarla, pulsa “💾 Guardar como mi plantilla” y aquí se elegirá tu copia sola.';
  };
  $('[data-editar-pl]', form).onclick = () => {
    const p = plantillaDe(it.plantilla);
    window.open(urlEditorPlantilla(p.mia ? `plantilla=${encodeURIComponent(p.idBase)}` : `plantilla=nueva&base=${encodeURIComponent(p.id)}`), '_blank');
  };
  $('[data-blanco]', form).onclick = () => window.open(urlEditorPlantilla('plantilla=nueva&base=blanco'), '_blank');
  const recargar = async (elegir) => {
    try { await recargarPlantillas(); if (elegir) it.plantilla = 'mi:' + elegir; await prepararFuente(it.plantilla); await pintar(); previa(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  };
  $('[data-recargar-pl]', form).onclick = () => recargar();
  // la pestaña del editor avisa cuando guarda: una copia nueva se elige sola
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel('cultos-plantillas');
    bc.onmessage = (e) => recargar(e.data?.t === 'nueva' ? e.data.id : null);
    alCerrar(() => bc.close());
  }
  pintar();
}

// Mis archivos en una ventana: al tocar uno, se usa
function elegirArchivo(tipo, alElegir) {
  const m = abrirModal(`<h3>📁 Mis archivos</h3><p class="hint">Toca ${tipo === 'video' ? 'un video' : 'una imagen'} para usarl${tipo === 'video' ? 'o' : 'a'}.</p><div data-arch></div>`, { ancho: true });
  pintarMisArchivos($('[data-arch]', m.el), {
    alInsertar: (a) => {
      if (a.tipo !== tipo) return toast(tipo === 'video' ? 'Elige un video' : 'Elige una imagen', 'error');
      m.cerrar(); alElegir(a);
    }
  });
}

// Reduce y sube una imagen a Mis archivos (o reutiliza la que ya estaba)
async function subirImagenCulto(archivo, perfil) {
  if (!archivo?.type?.startsWith('image/') || archivo.type === 'image/svg+xml') throw new Error('Elige una imagen JPG, PNG, WebP o GIF');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 15 MB');
  const f = await reducirImagen(archivo, 1920, 0.88);
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }[f.type] || 'jpg';
  const bmp = await createImageBitmap(f).catch(() => null);
  const r = await guardarArchivo({ profesorId: perfil.id, original: archivo, blob: f, tipo: 'imagen', ext, nombre: archivo.name || 'Imagen pegada',
    ancho: bmp?.width ?? null, alto: bmp?.height ?? null });
  if (r.reutilizado) toast('Ya tenías esta imagen en Mis archivos: se reutilizó');
  return r.archivo;
}
