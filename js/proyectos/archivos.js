// ============================================================
// Proyectos en grupo: "Mis archivos" (imágenes y videos del profesor, como en Canva)
// - cada archivo que se sube queda registrado (tabla archivos, sql/08_archivos.sql)
// - sin duplicados: si el archivo ya está (mismo hash SHA-256 del original), se reutiliza
// - panel con miniaturas, buscador y filtro; insertar, arrastrar a la hoja o usar de fondo
// - eliminar (avisa dónde se usa) y "Limpiar no usados"; barra de espacio usado
// Cambiar el fondo, quitar una imagen o borrar/duplicar un proyecto NO borra archivos.
// ============================================================
import { supabase, $, $$, esc, toast, confirmar, abrirModal, mensajeError, coincide, fmtFecha } from '../comun.js';

const BUCKET = 'preguntas-imagenes';

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

export const fmtMB = (b) => {
  const mb = (Number(b) || 0) / 1048576;
  return mb >= 100 ? `${Math.round(mb)} MB` : mb >= 1 ? `${mb.toFixed(1).replace(/\.0$/, '')} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`;
};

// SHA-256 en hexadecimal (null si el navegador no lo permite, p. ej. sin https)
export async function hashDe(blob) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

let lista = null;          // caché de mis archivos (se recarga al cambiar)
let sincronizado = false;  // los archivos subidos antes de "Mis archivos" se registran una vez por visita
const avisos = new Set();  // funciones a llamar cuando cambia la lista (el panel abierto)
const cambio = () => { lista = null; avisos.forEach(f => f()); };

async function cargar() {
  if (!sincronizado) { sincronizado = true; await rpc('archivos_sincronizar').catch(() => {}); }
  if (!lista) lista = await rpc('mis_archivos');
  return lista;
}

// Sube un archivo (o reutiliza el que ya estaba). original: el archivo tal como lo eligió el profesor (para el hash);
// blob: lo que se sube (la imagen ya reducida). Devuelve { archivo, reutilizado }.
export async function guardarArchivo({ profesorId, original, blob, tipo, ext, nombre = '', ancho = null, alto = null }) {
  const hash = await hashDe(original || blob);
  const antes = await rpc('archivo_antes_de_subir', { p_hash: hash, p_tamano: blob.size });
  if (antes?.existente) return { archivo: antes.existente, reutilizado: true };
  const ruta = `proyectos/${profesorId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type, upsert: false });
  if (error) {
    if (/row-level security|policy|403|Unauthorized/i.test(error.message || '')) {
      throw new Error('No se pudo subir: llegaste al límite de espacio o tu sesión expiró. Revisa “Mis archivos” → Limpiar no usados.');
    }
    throw error;
  }
  let archivo;
  try {
    archivo = await rpc('archivo_registrar', { p_ruta: ruta, p_tipo: tipo, p_nombre: nombre, p_tamano: blob.size,
      p_ancho: ancho, p_alto: alto, p_hash: hash, p_mime: blob.type || null });
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});   // no dejar archivos sin registrar
    throw e;
  }
  if (archivo.duplicado) await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
  cambio();
  return { archivo, reutilizado: !!archivo.duplicado };
}

// Ancho y alto de un archivo (los subidos antes no los tienen): se miden y se guardan
export async function medidas(a) {
  if (a.ancho && a.alto) return { ancho: a.ancho, alto: a.alto };
  const m = await new Promise((ok) => {
    if (a.tipo === 'video') {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = () => ok({ ancho: v.videoWidth, alto: v.videoHeight });
      v.onerror = () => ok(null);
      v.src = a.url;
    } else {
      const i = new Image();
      i.onload = () => ok({ ancho: i.naturalWidth, alto: i.naturalHeight });
      i.onerror = () => ok(null);
      i.src = a.url;
    }
    setTimeout(() => ok(null), 8000);
  });
  if (m?.ancho) {
    Object.assign(a, m);
    rpc('archivo_medidas', { p_id: a.id, p_ancho: m.ancho, p_alto: m.alto }).catch(() => {});
  }
  return m || { ancho: null, alto: null };
}

// "Proyecto X (hojas 1, 3) · Juego “Y” · Quiz “Z”"
export function textoUsos(usos) {
  const proy = new Map();
  const otros = [];
  for (const u of usos || []) {
    if (u.donde === 'proyecto') {
      const k = u.id + '|' + u.nombre;
      if (!proy.has(k)) proy.set(k, { nombre: u.nombre, hojas: [] });
      proy.get(k).hojas.push(u.hoja);
    } else otros.push(`${{ juego: 'Juego', plantilla: 'Plantilla de culto', cancion: 'Canción' }[u.donde] || 'Quiz'} “${u.nombre}”`);
  }
  return [...[...proy.values()].map(p => `${p.nombre} (${p.hojas.length === 1 ? 'hoja' : 'hojas'} ${p.hojas.join(', ')})`), ...otros];
}

async function borrar(archivos) {
  const r = await rpc('archivos_eliminar', { p_ids: archivos.map(a => a.id) });
  const rutas = r?.rutas || [];
  for (let i = 0; i < rutas.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(rutas.slice(i, i + 100));
    if (error) console.warn('No se pudo borrar de Storage', error);   // si quedó, se vuelve a registrar al sincronizar
  }
  cambio();
  return rutas.length;
}

// Eliminar un archivo: avisa si se usa en algún lado
export async function eliminarArchivo(a, { antesDeUsos } = {}) {
  let usos = [];
  try { await antesDeUsos?.(); usos = await rpc('archivo_usos', { p_id: a.id }); }
  catch (e) { return toast(mensajeError(e), 'error'); }
  const lugares = textoUsos(usos);
  const msg = lugares.length
    ? `Se usa en: ${lugares.join(' · ')}. Si lo borras, dejará de verse allí.`
    : `“${a.nombre}” no se usa en ningún proyecto, juego, plantilla ni pregunta. Se borrará para siempre.`;
  if (!await confirmar(msg, { titulo: lugares.length ? '⚠️ Este archivo está en uso' : '¿Eliminar el archivo?', boton: 'Eliminar' })) return;
  try { await borrar([a]); toast('Archivo eliminado'); }
  catch (e) { toast(mensajeError(e), 'error'); }
}

// "Limpiar no usados": lista con casillas para borrar todos o elegir cuáles
export async function limpiarNoUsados({ antesDeUsos } = {}) {
  const m = abrirModal('<h3>🧹 Limpiar archivos no usados</h3><div data-c><div class="center" style="padding:20px;"><div class="spinner"></div></div></div>', { ancho: true });
  let libres;
  try { await antesDeUsos?.(); libres = await rpc('archivos_no_usados'); }
  catch (e) { $('[data-c]', m.el).innerHTML = `<p class="err">${esc(mensajeError(e))}</p>`; return; }
  const c = $('[data-c]', m.el);
  if (!libres.length) {
    c.innerHTML = '<div class="empty"><span class="big">✨</span>¡Todo en orden! Todos tus archivos se usan en algún proyecto, juego, plantilla o pregunta.</div><div class="modal-pie"><button class="btn btn-primary" data-ok>Cerrar</button></div>';
    $('[data-ok]', c).onclick = () => m.cerrar();
    return;
  }
  c.innerHTML = `<p class="hint" style="margin-bottom:10px;">Estos archivos no se usan en ningún proyecto, juego, plantilla ni pregunta. Marca los que quieras borrar.</p>
    <label class="check" style="display:flex; margin-bottom:8px;"><input type="checkbox" data-todos checked> <b>Elegir todos (${libres.length})</b></label>
    <div class="arch-limpiar">${libres.map(a => `<label class="arch-lim" title="${esc(a.nombre)}"><input type="checkbox" data-id="${a.id}" checked>
      ${miniatura(a)}<span>${esc(a.nombre)}<small>${fmtMB(a.tamano)} · ${fmtFecha(a.created_at)}</small></span></label>`).join('')}</div>
    <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-red" data-borrar></button></div>`;
  const marcados = () => libres.filter(a => $(`[data-id="${a.id}"]`, c).checked);
  const contar = () => {
    const s = marcados();
    const b = $('[data-borrar]', c);
    b.textContent = s.length ? `🗑 Borrar ${s.length} (${fmtMB(s.reduce((t, a) => t + Number(a.tamano || 0), 0))})` : 'Nada elegido';
    b.disabled = !s.length;
    $('[data-todos]', c).checked = s.length === libres.length;
  };
  $$('[data-id]', c).forEach(x => x.onchange = contar);
  $('[data-todos]', c).onchange = (e) => { $$('[data-id]', c).forEach(x => { x.checked = e.target.checked; }); contar(); };
  $('[data-no]', c).onclick = () => m.cerrar();
  $('[data-borrar]', c).onclick = async () => {
    const s = marcados();
    if (!await confirmar(`Se borrarán ${s.length} ${s.length === 1 ? 'archivo' : 'archivos'} para siempre.`, { titulo: '¿Borrar los archivos no usados?', boton: 'Borrar' })) return;
    try { const n = await borrar(s); toast(`${n} ${n === 1 ? 'archivo borrado' : 'archivos borrados'}`); m.cerrar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  };
  contar();
}

const miniatura = (a) => a.tipo === 'video'
  ? `<span class="arch-mini"><video src="${esc(a.url)}#t=0.5" preload="metadata" muted playsinline></video><i>▶</i></span>`
  : `<span class="arch-mini"><img src="${esc(a.url)}" alt="" loading="lazy" draggable="false"></span>`;

// Barra "Usas 45 MB de 200 MB"
export async function pintarEspacio(cont) {
  let e;
  try { e = await rpc('archivos_espacio'); } catch { cont.innerHTML = ''; return; }
  const pct = e.limite ? Math.min(100, Math.round(e.usado * 100 / e.limite)) : 0;
  cont.innerHTML = `<div class="arch-espacio ${pct >= 90 ? 'lleno' : ''}">
    <div class="arch-espacio-txt">Usas <b>${fmtMB(e.usado)}</b>${e.limite ? ` de ${fmtMB(e.limite)}` : ' (sin límite)'}</div>
    ${e.limite ? `<div class="arch-barra"><i style="width:${pct}%"></i></div>${pct >= 100 ? '<small>Llegaste al límite: borra archivos o usa “Limpiar no usados”.</small>' : pct >= 90 ? '<small>Te queda poco espacio.</small>' : ''}` : ''}</div>`;
}

// ======================= PANEL "MIS ARCHIVOS" =======================
// alInsertar(a): insertar en la hoja · alFondo(a): usar de fondo · antesDeUsos(): guardar lo pendiente antes de revisar usos
export function pintarMisArchivos(c, { alInsertar, alFondo, antesDeUsos }) {
  let filtro = 'todos';
  c.innerHTML = `<div data-espacio></div>
    <input class="input" data-buscar placeholder="🔍 Buscar por nombre" style="margin-top:8px;">
    <div class="pestanas arch-filtro" style="margin:8px 0;"><button data-f="todos" class="activo">Todos</button><button data-f="imagen">🖼 Imágenes</button><button data-f="video">🎬 Videos</button></div>
    <div class="arch-grid" data-grid><div class="center" style="grid-column:1/-1; padding:20px;"><div class="spinner"></div></div></div>
    <button class="btn btn-sm btn-block btn-outline" data-limpiar style="margin-top:10px;">🧹 Limpiar no usados</button>
    <p class="hint" style="margin-top:8px;">Clic: agregar a la hoja · arrastra a la hoja · 🖼 usar de fondo. Quitar una imagen de una hoja no la borra de aquí.</p>`;
  const grid = $('[data-grid]', c);
  const pintar = async () => {
    if (!c.isConnected) { avisos.delete(pintar); return; }
    pintarEspacio($('[data-espacio]', c));
    let todos;
    try { todos = await cargar(); }
    catch (e) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">⚠️ ${esc(mensajeError(e))}</div>`; return; }
    const q = $('[data-buscar]', c).value;
    const vis = todos.filter(a => (filtro === 'todos' || a.tipo === filtro) && (!q || coincide(a.nombre, q)));
    grid.innerHTML = vis.map(a => `<div class="arch" data-arch="${a.id}" draggable="true" title="${esc(a.nombre)} · ${fmtMB(a.tamano)}">
        ${miniatura(a)}
        <span class="arch-acc">${a.tipo === 'imagen' && alFondo ? '<button data-fondo title="Usar de fondo de la hoja" aria-label="Usar de fondo">🖼</button>' : ''}
          <button data-borrar title="Eliminar" aria-label="Eliminar ${esc(a.nombre)}">🗑</button></span></div>`).join('')
      || `<div class="empty" style="grid-column:1/-1; padding:16px 6px;"><span class="big">📁</span>${todos.length ? 'Nada coincide con la búsqueda.' : 'Aún no tienes archivos. Las imágenes y videos que subas aparecerán aquí.'}</div>`;
    $$('[data-arch]', grid).forEach(el => {
      const a = todos.find(x => x.id === el.dataset.arch);
      el.onclick = (e) => {
        if (e.target.closest('[data-borrar]')) return eliminarArchivo(a, { antesDeUsos });
        if (e.target.closest('[data-fondo]')) return alFondo(a);
        alInsertar(a);
      };
      el.ondragstart = (e) => { e.dataTransfer.setData('text/x-archivo', JSON.stringify(a)); e.dataTransfer.effectAllowed = 'copy'; };
    });
  };
  $('[data-buscar]', c).oninput = pintar;
  $$('[data-f]', c).forEach(b => b.onclick = () => { filtro = b.dataset.f; $$('[data-f]', c).forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
  $('[data-limpiar]', c).onclick = () => limpiarNoUsados({ antesDeUsos });
  avisos.add(pintar);
  pintar();
}
