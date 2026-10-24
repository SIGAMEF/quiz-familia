// ============================================================
// Proyectos en grupo: editor de hojas (pantalla completa)
// proyectos.html?id=<proyecto>[&volver=admin][&presentar=1]
// ============================================================
import { supabase, $, $$, esc, toast, confirmar, abrirModal, mensajeError, exigirRol } from '../comun.js';
import {
  pintarHoja, pintarHojaMovil, pintarCelular, pintarFondo, repintarElemento, colocar, posMovil, leerVideo, miniaturaVideo, MODOS_FONDO
} from './lienzo.js';
import {
  FUENTES, COLORES, DEGRADADOS, cssDegradado, PATRONES, estiloFondo, FORMAS, EMOJIS, PLANTILLAS,
  cargarIconos, nodosIcono, ICONOS_ES, ICONOS_POPULARES, colorValido, urlSegura
} from './recursos.js';
import { TIPOS_PREGUNTA, esPregunta, configInicial, huecos, LETRAS, COLORES_OPCION, textoEnunciado } from './preguntas.js';
import { presentar } from './presentar.js';
import { crearVivo, borrarFotos, enlaceParticipante } from './vivo-profe.js';
import { configAgruparInicial, resumenReparto } from './agrupar.js';
import { configRuletaInicial, candidatosLocal, PALETAS, ORIGENES } from './ruleta.js';

const raiz = $('#raiz');
const params = new URLSearchParams(location.search);
const ID = params.get('id');
const VOLVER = params.get('volver') === 'admin' ? 'admin.html#proyectos' : 'profesor.html#proyectos';
const MAX_VIDEO_MB = 20;

const TIPOS_HOJA = [
  { k: 'contenido', ico: '🖼', txt: 'Contenido' },
  { k: 'pregunta', ico: '💬', txt: 'Pregunta abierta' }, { k: 'vf', ico: '✔️', txt: 'V / F' },
  { k: 'opcion', ico: '🔘', txt: 'Opción múltiple' }, { k: 'completar', ico: '✏️', txt: 'Completar' },
  { k: 'lluvia', ico: '💭', txt: 'Lluvia de ideas' }, { k: 'agrupar', ico: '👥', txt: 'Agrupar' }, { k: 'ruleta', ico: '🎡', txt: 'Ruleta' }
];
const ICO_HOJA = Object.fromEntries(TIPOS_HOJA.map(t => [t.k, t.ico]));
const DISPONIBLES = TIPOS_HOJA.map(t => t.k);
const RECURSOS = [
  ['texto', '🔤', 'Texto'], ['fondo', '🎨', 'Fondo'], ['imagen', '🖼', 'Imagen'], ['iconos', '⭐', 'Iconos'],
  ['emojis', '😀', 'Emojis'], ['formas', '🔷', 'Formas'], ['video', '🎬', 'Video'], ['plantillas', '🧩', 'Plantillas']
];
const NOMBRE_EL = { texto: 'Texto', imagen: 'Imagen', icono: 'Icono', emoji: 'Emoji', forma: 'Forma', video: 'Video', zona: 'Área de respuestas' };
const ICO_EL = { texto: '🔤', imagen: '🖼', icono: '⭐', forma: '🔷', video: '🎬', zona: '📊' };

let perfil, proyecto, hojas = [], actual = 0, selId = null, vista = 'web', recurso = null, editandoTexto = null;
let lienzo = null;          // .lienzo que se edita: el 16:9 en Web o el del celular ajustado a mano
const uid = () => crypto.randomUUID();
const clonar = (o) => JSON.parse(JSON.stringify(o));
const r1 = (n) => Math.round(n * 10) / 10;
const esMovil = () => matchMedia('(max-width: 860px)').matches;
// Hojas con área de respuestas / participantes / ruleta (en el celular se ve un formulario o la ruleta, no la hoja)
const interactiva = (tipo) => esPregunta(tipo) || tipo === 'agrupar' || tipo === 'ruleta';

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

// ======================= ESTADO, HISTORIAL Y GUARDADO =======================
const hoja = () => hojas[actual];
const elSel = () => hoja()?.diseno.elementos.find(e => e.id === selId) || null;

// En la vista Celular solo se edita si la hoja (de contenido) está "ajustada a mano"
const enCelular = () => vista === 'celular';
const celularManual = () => enCelular() && !interactiva(hoja().tipo) && !!hoja().diseno.movil?.manual;
const editableAqui = () => vista === 'web' || celularManual();
const fmt = () => enCelular() ? 'manual' : 'web';
// Geometría del elemento en la vista actual: en Web el propio elemento; en Celular su posición aparte (diseno.movil.pos)
const geoVer = (el) => enCelular() ? posMovil(hoja(), el) : el;
function geo(el) {
  if (!enCelular()) return el;
  const m = hoja().diseno.movil;
  m.pos = m.pos || {};
  return (m.pos[el.id] = m.pos[el.id] || { ...posMovil(hoja(), el) });
}
const ctxHoja = () => ({ hoja: hoja() });

const hist = { pila: [], pos: -1 };
function foto() { return JSON.stringify({ nombre: proyecto.nombre, hojas }); }
function registrar() {
  const f = foto();
  if (hist.pila[hist.pos]?.f === f) return false;
  hist.pila = hist.pila.slice(0, hist.pos + 1);
  hist.pila.push({ f, actual, selId });
  if (hist.pila.length > 120) hist.pila.shift();
  hist.pos = hist.pila.length - 1;
  pintarBotonesHist();
  return true;
}
function moverHist(d) {
  const p = hist.pos + d;
  if (p < 0 || p >= hist.pila.length) return;
  hist.pos = p;
  const { f, actual: a, selId: s } = hist.pila[p];
  const o = JSON.parse(f);
  proyecto.nombre = o.nombre; hojas = o.hojas;
  actual = Math.min(a, hojas.length - 1);
  selId = hoja().diseno.elementos.some(e => e.id === s) ? s : null;
  $('[data-nombre]').value = proyecto.nombre;
  pintarTodo();
  pintarBotonesHist();
  programarGuardado();
}
function pintarBotonesHist() {
  const d = $('[data-deshacer]'), r = $('[data-rehacer]');
  if (d) d.disabled = hist.pos <= 0;
  if (r) r.disabled = hist.pos >= hist.pila.length - 1;
}

// Confirma un cambio: historial + autoguardado + repintado
function confirmarCambio({ repintar = 'hoja' } = {}) {
  if (!registrar()) return;
  programarGuardado();
  if (repintar === 'hoja') { pintarLienzo(); pintarMini(actual); pintarPropiedades(); }
  else if (repintar === 'todo') pintarTodo();
  else if (repintar === 'mini') pintarMini(actual);
}

let base = null, tGuardar = null, guardando = false, sucio = false, conflicto = false;
function estado(tipo, txt) {
  const e = $('[data-estado]');
  if (!e) return;
  e.className = 'ed-estado ' + tipo;
  e.textContent = txt;
  e.title = tipo === 'error' ? 'Clic para reintentar' : '';
}
function programarGuardado() {
  if (conflicto) return;
  sucio = true;
  estado('pendiente', 'Sin guardar…');
  clearTimeout(tGuardar);
  tGuardar = setTimeout(guardar, 1000);
}
async function guardar() {
  clearTimeout(tGuardar);
  tGuardar = null;
  if (conflicto || !sucio) return;
  if (guardando) { tGuardar = setTimeout(guardar, 400); return; }
  guardando = true; sucio = false;
  estado('guardando', 'Guardando…');
  try {
    const r = await rpc('proyecto_guardar', {
      p_proyecto: ID, p_nombre: proyecto.nombre, p_tema: proyecto.tema || {}, p_base: base,
      p_hojas: hojas.map(h => ({ id: h.id, tipo: h.tipo, diseno: h.diseno, config: h.config || {} }))
    });
    base = r.updated_at;
    if (!sucio) estado('ok', 'Guardado ✓');
  } catch (e) {
    sucio = true;
    const m = mensajeError(e);
    if (/otra pestaña/.test(m)) {
      conflicto = true;
      estado('error', '⚠️ Cambió en otra pestaña');
      abrirModal(`<h3>⚠️ El proyecto cambió en otro lugar</h3><p style="font-weight:600;">${esc(m)}</p>
        <p class="hint">Para no borrar el trabajo de la otra pestaña, aquí ya no se guarda más. Recarga para continuar con la versión más reciente.</p>
        <div class="modal-pie"><button class="btn btn-primary" data-recargar>Recargar</button></div>`).el.querySelector('[data-recargar]').onclick = () => location.reload();
    } else {
      estado('error', '⚠️ No se guardó · reintentar');
      clearTimeout(tGuardar);
      tGuardar = setTimeout(guardar, 6000);
    }
  } finally {
    guardando = false;
    if (sucio && !conflicto && !tGuardar) tGuardar = setTimeout(guardar, 1000);
  }
}
window.addEventListener('beforeunload', (e) => { if ((sucio || guardando) && !conflicto) { guardar(); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && sucio) guardar(); });

// ======================= HOJAS Y ELEMENTOS NUEVOS =======================
function hojaNueva(tipo = 'contenido') {
  const ref = hojas[hojas.length - 1];
  const tit = ref?.diseno.elementos.find(e => e.tipo === 'texto');
  const fondo = ref ? clonar(ref.diseno.fondo) : { tipo: 'color', valor: '#FFFFFF' };
  // conserva el color del título anterior solo si se sigue leyendo sobre el fondo (uno claro y el otro oscuro)
  const color = tit && oscuro({ tipo: 'color', valor: tit.color }) !== oscuro(fondo) ? tit.color : oscuro(fondo) ? '#FFFFFF' : '#2D2A45';
  const titulo = { id: uid(), tipo: 'texto', texto: 'Escribe un título', x: 8, y: 8, w: 84, h: 16, rot: 0,
    fuente: tit?.fuente || 'Baloo 2', tam: 5, color, alinear: 'center', negrita: true };
  if (tipo === 'ruleta') {
    // si ya hay grupos antes, la ruleta sortea entre ellos
    const config = configRuletaInicial();
    if (hojas.some(x => x.tipo === 'agrupar')) config.origen = 'grupos';
    return { id: uid(), tipo, config, diseno: { fondo, elementos: [
      { ...titulo, texto: '¡Gira la ruleta!', y: 4, h: 14 },
      { id: uid(), tipo: 'zona', x: 6, y: 20, w: 88, h: 76, rot: 0 }
    ] } };
  }
  if (tipo === 'agrupar') {
    return { id: uid(), tipo, config: configAgruparInicial(), diseno: { fondo, elementos: [
      { ...titulo, texto: '¡Formemos grupos!', y: 4, h: 14 },
      { id: uid(), tipo: 'zona', x: 4, y: 21, w: 92, h: 75, rot: 0 }
    ] } };
  }
  if (!esPregunta(tipo)) return { id: uid(), tipo, config: { celular: 'mirar' }, diseno: { fondo, elementos: [titulo] } };
  // hoja de pregunta: el enunciado (vinculado a la configuración) y el área de respuestas
  return {
    id: uid(), tipo, config: configInicial(tipo),
    diseno: { fondo, elementos: [
      { ...titulo, texto: '', vinculo: 'enunciado', y: 5, h: 20, tam: 4.2 },
      { id: uid(), tipo: 'zona', x: 8, y: 28, w: 84, h: 66, rot: 0 }
    ] }
  };
}
function agregarHoja(tipo) {
  terminarEdicionTexto();
  hojas.push(hojaNueva(tipo));
  actual = hojas.length - 1; selId = null;
  confirmarCambio({ repintar: 'todo' });
  $('[data-tira]').lastElementChild?.previousElementSibling?.scrollIntoView({ inline: 'end', behavior: 'smooth' });
}
function duplicarHoja(i) {
  const c = clonar(hojas[i]);
  c.id = uid();
  const ids = {};
  c.diseno.elementos.forEach(e => { ids[e.id] = uid(); e.id = ids[e.id]; });
  if (c.diseno.movil?.pos) c.diseno.movil.pos = Object.fromEntries(Object.entries(c.diseno.movil.pos).filter(([k]) => ids[k]).map(([k, v]) => [ids[k], v]));
  hojas.splice(i + 1, 0, c);
  actual = i + 1; selId = null;
  confirmarCambio({ repintar: 'todo' });
}
function eliminarHoja(i) {
  if (hojas.length === 1) return toast('El proyecto necesita al menos una hoja', 'error');
  hojas.splice(i, 1);
  actual = Math.min(actual >= i ? Math.max(0, actual - 1) : actual, hojas.length - 1);
  selId = null;
  confirmarCambio({ repintar: 'todo' });
  toast('Hoja eliminada (Ctrl+Z para deshacer)');
}
function moverHoja(de, a) {
  if (a < 0 || a >= hojas.length || de === a) return;
  const [h] = hojas.splice(de, 1);
  hojas.splice(a, 0, h);
  actual = a;
  confirmarCambio({ repintar: 'todo' });
}
function irAHoja(i) {
  terminarEdicionTexto();
  actual = i; selId = null;
  pintarLienzo(); pintarTira(); pintarPropiedades();
}

function agregarElemento(el) {
  terminarEdicionTexto();
  if (!editableAqui()) cambiarVista('web');
  el.id = uid();
  el.rot = el.rot || 0;
  hoja().diseno.elementos.push(el);
  selId = el.id;
  confirmarCambio();
  cerrarPanelMovil();
}
function agregarTexto(nivel, fuente) {
  const p = { titulo: ['Título', 6, true, 18], subtitulo: ['Subtítulo', 3.6, true, 12], parrafo: ['Escribe aquí tu texto', 2.4, false, 18] }[nivel];
  agregarElemento({ tipo: 'texto', texto: p[0], x: 15, y: 50 - p[3] / 2, w: 70, h: p[3], tam: p[1], negrita: p[2],
    fuente: fuente || 'Nunito', color: oscuro(hoja().diseno.fondo) ? '#FFFFFF' : '#2D2A45', alinear: 'center' });
}
// ¿El fondo es oscuro? (para elegir el color de un texto nuevo)
function oscuro(f) {
  let c = f?.valor;
  if (f?.tipo === 'degradado') c = DEGRADADOS[f.valor]?.[1];
  else if (f?.tipo === 'patron') c = colorValido(f.color, PATRONES[f.valor]?.base);
  else if (f?.tipo === 'imagen') return true;
  const m = /^#([0-9a-f]{6})/i.exec(colorValido(c, '#FFFFFF').replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3'));
  if (!m) return false;
  const n = parseInt(m[1], 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
// Tamaño de un elemento con proporción ancho/alto en px (ancho en % del lienzo)
function tamProporcional(prop, ancho = 30) {
  let w = ancho, h = w * (16 / 9) / prop;
  if (h > 80) { h = 80; w = h * prop * (9 / 16); }
  return { w: r1(w), h: r1(h), x: r1(50 - w / 2), y: r1(50 - h / 2) };
}

// ======================= SUBIDA DE IMÁGENES Y VIDEOS =======================
async function comprimir(archivo, maxLado = 1600) {
  if (archivo.type === 'image/gif') return archivo;   // conserva la animación
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const aBlob = (tipo, q) => new Promise(r => c.toBlob(r, tipo, q));
  let b = await aBlob('image/webp', 0.85);
  if (!b || b.type !== 'image/webp') b = await aBlob('image/jpeg', 0.85);
  return b && b.size < archivo.size ? b : archivo;
}
async function subirArchivo(blob, ext, tipo) {
  const nombre = `proyectos/${perfil.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('preguntas-imagenes').upload(nombre, blob, { contentType: tipo, upsert: false });
  if (error) throw error;
  return supabase.storage.from('preguntas-imagenes').getPublicUrl(nombre).data.publicUrl;
}
const FONDO_IMAGEN = { tipo: 'imagen', modo: 'cubrir', zoom: 100, px: 50, py: 50, opacidad: 1, oscurecer: 0, desenfoque: 0, color: '#2D2A45' };
// La imagen se agrega como elemento nuevo, como fondo de la hoja o reemplaza la de un elemento
async function subirImagen(archivo, { comoFondo = false, reemplazar = null } = {}) {
  if (!archivo?.type?.startsWith('image/') || archivo.type === 'image/svg+xml') return toast('Elige una imagen JPG, PNG, WebP o GIF', 'error');
  if (archivo.size > 15 * 1024 * 1024) return toast('La imagen debe pesar menos de 15 MB', 'error');
  estado('guardando', 'Subiendo imagen…');
  try {
    const f = await comprimir(archivo);
    const tipo = f.type || 'image/jpeg';
    const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }[tipo] || 'jpg';
    const bmp = await createImageBitmap(f).catch(() => null);
    const url = await subirArchivo(f, ext, tipo);
    if (comoFondo) {
      const previo = hoja().diseno.fondo?.tipo === 'imagen' ? hoja().diseno.fondo : {};
      hoja().diseno.fondo = { ...FONDO_IMAGEN, ...previo, valor: url, nat: bmp ? [bmp.width, bmp.height] : null };
      confirmarCambio();
      if (recurso === 'fondo') pintarIzquierda();
    } else if (reemplazar) {
      reemplazar.url = url;
      confirmarCambio();
    } else {
      agregarElemento({ tipo: 'imagen', url, ajuste: 'cover', radio: 0, ...tamProporcional(bmp ? bmp.width / bmp.height : 4 / 3, 40) });
    }
  } catch (e) { toast('No se pudo subir la imagen: ' + mensajeError(e), 'error'); }
  finally { if (!sucio && !guardando) estado('ok', 'Guardado ✓'); }
}
async function subirVideo(archivo) {
  if (!/^video\/(mp4|webm)$/.test(archivo?.type || '')) return toast('El video debe ser MP4 o WebM', 'error');
  if (archivo.size > MAX_VIDEO_MB * 1024 * 1024) return toast(`El video debe pesar menos de ${MAX_VIDEO_MB} MB. Para videos más grandes usa un enlace de YouTube.`, 'error');
  estado('guardando', 'Subiendo video…');
  try {
    const url = await subirArchivo(archivo, archivo.type === 'video/webm' ? 'webm' : 'mp4', archivo.type);
    agregarElemento({ tipo: 'video', fuente: 'mp4', url, ...tamProporcional(16 / 9, 60) });
  } catch (e) { toast('No se pudo subir el video: ' + mensajeError(e), 'error'); }
  finally { if (!sucio && !guardando) estado('ok', 'Guardado ✓'); }
}

// ---------- Fondo de imagen ↔ imagen normal ----------
function fondoAImagen() {
  const f = hoja().diseno.fondo;
  if (f?.tipo !== 'imagen') return;
  const el = { id: uid(), tipo: 'imagen', url: f.valor, ajuste: f.modo === 'ajustar' ? 'contain' : f.modo === 'estirar' ? 'fill' : 'cover',
    zoom: Math.max(100, f.zoom || 100), px: f.px ?? 50, py: f.py ?? 50, opacidad: f.opacidad ?? 1, x: 0, y: 0, w: 100, h: 100, rot: 0, radio: 0 };
  hoja().diseno.elementos.unshift(el);   // al fondo de las capas
  hoja().diseno.fondo = { tipo: 'color', valor: colorValido(f.color, '#FFFFFF') };
  selId = el.id;
  confirmarCambio();
  if (recurso === 'fondo') pintarIzquierda();
  toast('Ahora es una imagen normal: puedes moverla, girarla y recortarla');
}
function imagenAFondo(el) {
  hoja().diseno.fondo = { ...FONDO_IMAGEN, valor: el.url, zoom: Math.max(100, el.zoom || 100), px: el.px ?? 50, py: el.py ?? 50, opacidad: el.opacidad ?? 1,
    modo: el.ajuste === 'contain' ? 'ajustar' : el.ajuste === 'fill' ? 'estirar' : 'cubrir' };
  quitarElemento(el.id);
  selId = null;
  confirmarCambio();
  toast('La imagen ahora es el fondo de la hoja');
}
function quitarFondo() {
  const f = hoja().diseno.fondo;
  hoja().diseno.fondo = { tipo: 'color', valor: f?.tipo === 'imagen' ? colorValido(f.color, '#FFFFFF') : '#FFFFFF' };
  confirmarCambio();
  if (recurso === 'fondo') pintarIzquierda();
}
// Repinta solo el fondo (mientras se arrastra un control)
function refrescarFondo() {
  $$('[data-escenario] .lienzo-fondo').forEach(c => pintarFondo(c, hoja().diseno.fondo));
}

// ======================= ESTRUCTURA =======================
function montar() {
  document.title = `${proyecto.nombre} · Proyecto`;
  document.body.className = 'editor-proyectos';
  raiz.innerHTML = `<div class="ed">
    <header class="ed-top">
      <a class="btn btn-sm btn-outline" href="${VOLVER}" title="Volver a la lista de proyectos">←<span class="ocultar-movil"> Proyectos</span></a>
      <input class="ed-nombre" data-nombre maxlength="120" aria-label="Nombre del proyecto">
      <span class="ed-estado ok" data-estado>Guardado ✓</span>
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-deshacer title="Deshacer (Ctrl+Z)" aria-label="Deshacer">↶</button>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-rehacer title="Rehacer (Ctrl+Y)" aria-label="Rehacer">↷</button>
      <div class="pestanas ed-vistas"><button data-vista="web" class="activo" title="Vista web (proyector)">🖥<span class="ocultar-movil"> Web</span></button><button data-vista="celular" title="Vista del celular">📱<span class="ocultar-movil"> Celular</span></button></div>
      <button class="btn btn-sm btn-outline" data-presentar title="Presentar sin participantes (puedes simularlos)">▶<span class="ocultar-movil"> Presentar</span></button>
      <button class="btn btn-primary btn-sm" data-envivo title="Presentar en vivo: los participantes entran con PIN o QR">📡<span class="ocultar-movil"> En vivo</span></button>
    </header>
    <div class="ed-banner" data-banner hidden></div>
    <aside class="ed-izq" data-izq></aside>
    <main class="ed-centro">
      <div class="escenario" data-escenario></div>
      <div class="tira" data-tira></div>
    </main>
    <aside class="ed-der" data-der></aside>
    <nav class="ed-tabs">
      <button data-tab="izq"><span>➕</span>Agregar</button>
      <button data-tab="der"><span>🎛</span>Propiedades</button>
      <button data-deshacer2><span>↶</span>Deshacer</button>
    </nav>
  </div>`;
  const nom = $('[data-nombre]');
  nom.value = proyecto.nombre;
  nom.oninput = () => { proyecto.nombre = nom.value.trim() || proyecto.nombre; document.title = `${proyecto.nombre} · Proyecto`; programarGuardado(); };
  nom.onchange = () => { nom.value = proyecto.nombre; registrar(); };
  nom.onkeydown = (e) => { if (e.key === 'Enter') nom.blur(); };
  $('[data-deshacer]').onclick = () => moverHist(-1);
  $('[data-rehacer]').onclick = () => moverHist(1);
  $('[data-deshacer2]').onclick = () => moverHist(-1);
  $$('[data-vista]').forEach(b => b.onclick = () => cambiarVista(b.dataset.vista));
  $('[data-presentar]').onclick = () => abrirPresentacion(actual);
  $('[data-envivo]').onclick = iniciarVivo;
  $('[data-estado]').onclick = () => { if (!conflicto && sucio) guardar(); };
  $$('[data-tab]').forEach(b => b.onclick = () => alternarPanelMovil(b.dataset.tab));
  conectarLienzo();
  conectarTeclado();
  conectarSoltarArchivos();
  pintarTodo();
  registrar();
}

// ---------- Sesión en vivo ----------
let sesionActiva = null;
async function revisarSesion() {
  try { sesionActiva = await rpc('proyecto_sesion_activa', { p_proyecto: ID }); } catch { sesionActiva = null; }
  pintarBanner();
}
function pintarBanner() {
  const b = $('[data-banner]');
  if (!b) return;
  b.hidden = !sesionActiva;
  if (!sesionActiva) return;
  const s = sesionActiva;
  b.innerHTML = `<span>📡 <b>Tienes una sesión en curso</b> (hoja ${s.hoja_indice} de ${s.total_hojas}, ${s.participantes} ${s.participantes === 1 ? 'participante' : 'participantes'} · PIN ${esc(s.pin)}${s.estado === 'pausada' ? ' · en pausa' : ''})</span>
    <span class="row" style="gap:6px;"><button class="btn btn-sm btn-primary" data-continuar>Continuar</button><button class="btn btn-sm btn-outline" data-reiniciar>Reiniciar</button>
    <button class="btn btn-sm btn-ghost" data-finalizar title="Cerrar la sesión: el PIN deja de funcionar">Finalizar</button></span>`;
  $('[data-continuar]', b).onclick = iniciarVivo;
  $('[data-reiniciar]', b).onclick = async () => {
    if (!await confirmar('Se borrarán los participantes, sus respuestas y los grupos de esta sesión, y habrá un PIN nuevo. El diseño del proyecto no cambia.', { titulo: '¿Reiniciar la sesión?', boton: 'Reiniciar' })) return;
    try {
      const r = await rpc('proyecto_reiniciar_sesion', { p_sesion: s.id });
      await borrarFotos(r.fotos);
      toast('Sesión reiniciada · PIN nuevo: ' + r.sesion.pin);
    } catch (e) { toast(mensajeError(e), 'error'); }
    revisarSesion();
  };
  $('[data-finalizar]', b).onclick = async () => {
    if (!await confirmar('El PIN dejará de funcionar. Los resultados quedan guardados en “Resultados” del proyecto.', { titulo: '¿Finalizar la sesión?', boton: 'Finalizar', peligro: false })) return;
    try { await rpc('proyecto_finalizar', { p_sesion: s.id }); toast('Sesión finalizada'); } catch (e) { toast(mensajeError(e), 'error'); }
    revisarSesion();
  };
}
// Inicia la sesión en vivo (o continúa la que está abierta) y abre la presentación con el control del profesor
async function iniciarVivo() {
  terminarEdicionTexto();
  if (sucio || guardando) {
    await guardar();
    for (let k = 0; k < 40 && (sucio || guardando); k++) await new Promise(r => setTimeout(r, 150));
    if (sucio) return toast('Primero hay que guardar el proyecto. Revisa tu conexión.', 'error');
  }
  let s;
  try { s = await rpc('proyecto_iniciar_sesion', { p_proyecto: ID }); }
  catch (e) { return toast(mensajeError(e), 'error'); }
  const vivo = crearVivo(s, { alError: (m) => toast('Se perdió la conexión con la sesión: ' + m, 'error') });
  await vivo.iniciar();
  const inicio = Math.max(0, hojas.findIndex(h => h.id === vivo.sesion.hoja_id));
  if (!sesionActiva) toast('Sesión iniciada · PIN ' + s.pin);
  presentar(hojas, { inicio, vivo, alSalir: (i) => { irAHoja(i); revisarSesion(); } });
}

function abrirPresentacion(desde) {
  terminarEdicionTexto();
  guardar();
  presentar(hojas, { inicio: desde, alSalir: (i) => { if (params.get('presentar')) { location.href = VOLVER; return; } irAHoja(i); } });
}

function alternarPanelMovil(p) {
  const ed = $('.ed');
  ed.dataset.movil = ed.dataset.movil === p ? '' : p;
  $$('[data-tab]').forEach(b => b.classList.toggle('activo', b.dataset.tab === ed.dataset.movil));
}
function cerrarPanelMovil() {
  const ed = $('.ed');
  if (ed && ed.dataset.movil && esMovil()) { ed.dataset.movil = ''; $$('[data-tab]').forEach(b => b.classList.remove('activo')); }
}

function cambiarVista(v) {
  terminarEdicionTexto();
  vista = v;
  $$('[data-vista]').forEach(b => b.classList.toggle('activo', b.dataset.vista === v));
  pintarLienzo(); pintarPropiedades();
}

function pintarTodo() { pintarLienzo(); pintarTira(); pintarIzquierda(); pintarPropiedades(); }

// ======================= LIENZO (Web y Celular) =======================
function pintarLienzo() {
  const escn = $('[data-escenario]');
  if (!enCelular()) {
    escn.innerHTML = '<div class="marco" data-marco></div>';
    const marco = $('[data-marco]');
    lienzo = pintarHoja(marco, hoja(), { modo: 'editor' });
    const capa = document.createElement('div');
    capa.className = 'capa-sel';
    marco.appendChild(capa);
    pintarSeleccion();
    return;
  }
  // Celular: el teléfono y, al lado, un aviso grande que explica qué se puede hacer aquí
  const h = hoja(), preg = interactiva(h.tipo), manual = celularManual();
  escn.innerHTML = `<div class="cel-vista"><div class="cel-marco" data-cel></div><div class="cel-aviso card" data-aviso></div></div>`;
  const cel = $('[data-cel]');
  lienzo = null;
  if (preg) {
    pintarCelular(cel, h, proyecto.nombre, { alEnviar: () => toast('Vista previa: la respuesta no se guarda'),
      alUnirse: () => { toast('Vista previa: en vivo, aquí se registra el participante'); } });
  } else {
    const r = pintarHojaMovil(cel, h, { modo: 'editor' });
    if (manual) {
      lienzo = r.lienzo;   // las asas, el imán y el teclado funcionan igual que en Web
      const capa = document.createElement('div');
      capa.className = 'capa-sel';
      lienzo.appendChild(capa);
      pintarSeleccion();
    }
  }
  const aviso = $('[data-aviso]');
  if (preg) {
    const ruletaCel = (h.config?.celular || 'ruleta') === 'ruleta';
    aviso.innerHTML = h.tipo === 'ruleta' ? `<div class="cel-aviso-ico">🎡</div><h3>${ruletaCel ? 'El participante ve la ruleta' : 'El participante mira la pantalla'}</h3>
      <p>${ruletaCel ? 'Cuando giras, la ruleta gira también en cada celular y se detiene en el mismo elegido. Si le toca a él (o a su grupo), lo verá en grande.' : 'En el celular solo verá “Mira la pantalla 👀”. Puedes cambiarlo en Propiedades.'}</p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>` : h.tipo === 'agrupar' ? `<div class="cel-aviso-ico">👥</div><h3>Así se registra el participante</h3>
      <p>Escribe su nombre, un alias opcional y elige un avatar o sube una foto. Cuando formes los grupos, verá “Estás en el Grupo…” con sus compañeros.</p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>` : `<div class="cel-aviso-ico">🙋</div><h3>Así responde el participante</h3>
      <p>Es una vista previa: puedes probar el formulario, pero no se guarda nada. Los textos, colores y opciones se cambian en la vista Web y en el panel de la derecha.</p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>`;
  } else if (manual) {
    aviso.innerHTML = `<div class="cel-aviso-ico">🖐</div><h3>Ajuste a mano para celular</h3>
      <p>Mueve y cambia el tamaño de los elementos aquí, en el teléfono. <b>La vista Web no cambia.</b></p>
      <button class="btn btn-block" data-auto>↺ Volver al acomodo automático</button>
      <button class="btn btn-primary btn-block" data-editar-web style="margin-top:8px;">✏️ Editar en Web</button>`;
  } else {
    aviso.innerHTML = `<div class="cel-aviso-ico">📱</div><h3>Acomodo automático para celular</h3>
      <p>El fondo ocupa toda la pantalla y los elementos se ordenan solos de arriba hacia abajo, a todo el ancho y con letra legible. <b>Aquí no se puede mover nada.</b></p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>
      <button class="btn btn-block" data-manual style="margin-top:8px;">🖐 Ajustar a mano para celular</button>`;
  }
  if (!preg) aviso.insertAdjacentHTML('beforeend', `<p class="hint" style="margin-top:12px;">En vivo, el participante verá ${(h.config?.celular || 'mirar') === 'hoja' ? '<b>esta hoja</b>' : '<b>“Mira la pantalla 👀”</b>'} en su celular (se cambia en Propiedades). La presentación en un celular usa este acomodo.</p>`);
  $('[data-editar-web]', aviso).onclick = () => cambiarVista('web');
  const bm = $('[data-manual]', aviso);
  if (bm) bm.onclick = ajustarAMano;
  const ba = $('[data-auto]', aviso);
  if (ba) ba.onclick = () => { delete hoja().diseno.movil; selId = null; confirmarCambio(); toast('Volvió el acomodo automático'); };
}

// Pasa a "ajuste a mano": toma como punto de partida el acomodo automático que se ve ahora
function ajustarAMano() {
  const l = $('[data-cel] .lienzo.movil');
  if (!l) return;
  const r = l.getBoundingClientRect(), u = r.width / 100;
  const pos = {};
  for (const n of l.querySelectorAll(':scope > .pe')) {
    const el = hoja().diseno.elementos.find(e => e.id === n.dataset.id);
    if (!el) continue;
    const b = { left: n.offsetLeft, top: n.offsetTop, width: n.offsetWidth, height: n.offsetHeight };   // sin el giro
    pos[el.id] = { x: r1(b.left / u), y: r1(b.top / u), w: r1(b.width / u), h: r1(b.height / u), rot: ['emoji', 'icono', 'forma'].includes(el.tipo) ? el.rot || 0 : 0 };
  }
  hoja().diseno.movil = { manual: true, pos };
  confirmarCambio();
  toast('Ahora puedes mover los elementos en el celular');
}

function pintarSeleccion() {
  const capa = lienzo?.parentElement?.querySelector(':scope > .capa-sel') || lienzo?.querySelector(':scope > .capa-sel');
  if (!capa) return;
  const el = elSel();
  capa.innerHTML = '';
  if (!el || !editableAqui()) return;
  const c = document.createElement('div');
  c.className = 'sel-caja';
  c.innerHTML = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<span class="h h-${h}" data-h="${h}"></span>`).join('') +
    '<span class="h h-rot" data-h="rot" title="Girar">⟳</span>';
  colocar(c, geoVer(el), fmt());
  capa.appendChild(c);
}
const colocarNodo = (el) => {
  const n = lienzo?.querySelector(`.pe[data-id="${CSS.escape(el.id)}"]`);
  if (n) colocar(n, geoVer(el), fmt());
  const caja = lienzo?.parentElement?.querySelector('.sel-caja') || lienzo?.querySelector('.sel-caja');
  if (caja) colocar(caja, geoVer(el), fmt());
};

function conectarLienzo() {
  const escn = $('[data-escenario]');
  let op = null;   // operación en curso: mover, redimensionar o girar
  escn.addEventListener('pointerdown', (e) => {
    if (!lienzo || !editableAqui() || e.button > 0) return;
    // fuera de la hoja (zona gris): solo quita la selección
    if (!lienzo.contains(e.target) && !e.target.closest('.capa-sel')) {
      if (selId && !e.target.closest('.cel-aviso')) { terminarEdicionTexto(); selId = null; pintarSeleccion(); pintarPropiedades(); }
      return;
    }
    if (editandoTexto && e.target.closest('[contenteditable]')) return;
    // un campo del panel que pierde el foco confirma su cambio (change)
    const activo = document.activeElement;
    if (activo && activo !== document.body && !lienzo.contains(activo)) activo.blur();
    const asa = e.target.closest('[data-h]');
    let nodo = e.target.closest('.pe');
    terminarEdicionTexto();
    // Alt+clic: elige el elemento que está debajo del elegido
    if (nodo && !asa && e.altKey) {
      const pila = [...new Set(document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest('.pe')).filter(n => n && lienzo.contains(n)))];
      const i = pila.findIndex(n => n.dataset.id === selId);
      nodo = pila[(i + 1) % pila.length] || nodo;
    }
    if (!asa && !nodo) {
      if (selId) { selId = null; pintarSeleccion(); pintarPropiedades(); }
      return;
    }
    if (nodo && !asa && nodo.dataset.id !== selId) { selId = nodo.dataset.id; pintarSeleccion(); pintarPropiedades(); }
    const el = elSel();
    if (!el) return;
    e.preventDefault();
    const r = lienzo.getBoundingClientRect();
    const g = geoVer(el);
    op = { tipo: asa ? (asa.dataset.h === 'rot' ? 'girar' : 'tam') : 'mover', h: asa?.dataset.h, x0: e.clientX, y0: e.clientY,
      r, ux: r.width / 100, uy: (enCelular() ? r.width : r.height) / 100, el, ini: { x: g.x, y: g.y, w: g.w, h: g.h, rot: g.rot || 0 }, movido: false };
  });
  escn.addEventListener('pointermove', (e) => {
    if (!op) return;
    const { r, el, ini, ux, uy } = op;
    const dx = e.clientX - op.x0, dy = e.clientY - op.y0;
    if (!op.movido && Math.hypot(dx, dy) < 3) return;
    // la captura empieza recién al arrastrar, para no romper el doble clic sobre un texto
    if (!op.movido) { try { escn.setPointerCapture(e.pointerId); } catch { /* el puntero ya se soltó */ } }
    op.movido = true;
    const g = geo(el);
    if (op.tipo === 'mover') {
      let x = ini.x + dx / ux, y = ini.y + dy / uy;
      // imán al centro (en el celular solo el vertical)
      const iv = Math.abs(x + g.w / 2 - 50) < 1.2 && !e.altKey, ih = !enCelular() && Math.abs(y + g.h / 2 - 50) < 1.6 && !e.altKey;
      if (iv) x = 50 - g.w / 2;
      if (ih) y = 50 - g.h / 2;
      g.x = r1(x); g.y = r1(y);
      guias(iv, ih);
    } else if (op.tipo === 'girar') {
      const cx = r.left + (g.x + g.w / 2) * ux, cy = r.top + (g.y + g.h / 2) * uy;
      let a = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
      if (a > 180) a -= 360;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(a - s) < 4) a = s;
      g.rot = Math.round(a);
    } else {
      redimensionar(op, g, dx, dy, e.shiftKey);
    }
    if (el.tipo === 'emoji' && op.tipo === 'tam') repintarElemento(lienzo, el, 'editor', ctxHoja());
    colocarNodo(el);
  });
  const fin = () => {
    if (!op) return;
    const movido = op.movido;
    op = null;
    guias(false, false);
    if (movido) { confirmarCambio({ repintar: 'mini' }); pintarPropiedades(); }
  };
  escn.addEventListener('pointerup', fin);
  escn.addEventListener('pointercancel', fin);
  escn.addEventListener('dblclick', (e) => {
    const nodo = e.target.closest('.pe-texto');
    if (nodo && lienzo?.contains(nodo) && editableAqui()) editarTexto(nodo.dataset.id);
  });
}

// Redimensiona desde una de las 8 asas, respetando el giro del elemento
function redimensionar(op, g, dx, dy, shift) {
  const { el, ini, h, ux, uy } = op;
  const sx = h.includes('e') ? 1 : h.includes('w') ? -1 : 0, sy = h.includes('s') ? 1 : h.includes('n') ? -1 : 0;
  const rad = (ini.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const ldx = dx * cos + dy * sin, ldy = -dx * sin + dy * cos;   // movimiento en los ejes del elemento
  const w0 = ini.w * ux, h0 = ini.h * uy;
  let w = Math.max(12, w0 + sx * ldx), hh = Math.max(12, h0 + sy * ldy);
  const fija = ['emoji', 'icono', 'imagen'].includes(el.tipo) !== shift;   // Shift invierte la proporción fija
  if (fija && sx && sy) { const k = Math.max(w / w0, hh / h0); w = w0 * k; hh = h0 * k; }
  const lx = sx * (w - w0) / 2, ly = sy * (hh - h0) / 2;
  const cx = (ini.x + ini.w / 2) * ux + lx * cos - ly * sin;
  const cy = (ini.y + ini.h / 2) * uy + lx * sin + ly * cos;
  g.w = r1(w / ux); g.h = r1(hh / uy);
  g.x = r1((cx - w / 2) / ux); g.y = r1((cy - hh / 2) / uy);
}

function guias(v, h) {
  const cont = enCelular() ? lienzo : lienzo?.parentElement;   // en Web, el marco del lienzo
  if (!cont) return;
  cont.querySelectorAll(':scope > .guia').forEach(g => g.remove());
  if (v) cont.insertAdjacentHTML('beforeend', '<div class="guia v"></div>');
  if (h) cont.insertAdjacentHTML('beforeend', '<div class="guia h"></div>');
}

// ---------- Texto: el enunciado de las preguntas vive en la configuración de la hoja ----------
const textoDe = (el) => el.vinculo === 'enunciado' ? (hoja().tipo === 'completar' ? hoja().config.frase || '' : hoja().config.enunciado || '') : el.texto || '';
function ponerTexto(el, t) {
  if (el.vinculo !== 'enunciado') { el.texto = t; return; }
  if (hoja().tipo === 'completar') hoja().config.frase = t; else hoja().config.enunciado = t;
}

function editarTexto(id) {
  const el = hoja().diseno.elementos.find(e => e.id === id);
  const nodo = lienzo?.querySelector(`.pe[data-id="${CSS.escape(id)}"] .pe-txt`);
  if (!el || !nodo) return;
  selId = id; pintarSeleccion();
  editandoTexto = { el, nodo };
  nodo.textContent = textoDe(el);   // la frase de "completar" se edita con sus ___
  try { nodo.contentEditable = 'plaintext-only'; } catch { nodo.contentEditable = 'true'; }
  if (nodo.contentEditable !== 'plaintext-only') nodo.contentEditable = 'true';
  nodo.focus();
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  const s = getSelection(); s.removeAllRanges(); s.addRange(rango);
  nodo.oninput = () => { ponerTexto(el, nodo.innerText.replace(/\n$/, '')); const t = $('[data-prop-texto]'); if (t) t.value = textoDe(el); };
  nodo.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); terminarEdicionTexto(); } e.stopPropagation(); };
  nodo.onblur = () => terminarEdicionTexto();
}
function terminarEdicionTexto() {
  if (!editandoTexto) return;
  const { el, nodo } = editandoTexto;
  editandoTexto = null;
  ponerTexto(el, nodo.innerText.replace(/\n$/, ''));
  nodo.removeAttribute('contenteditable');
  nodo.oninput = nodo.onkeydown = nodo.onblur = null;
  if (el.vinculo) { confirmarCambio(); return; }   // la zona y el panel dependen del enunciado
  confirmarCambio({ repintar: 'mini' });
}

// ---------- Teclado ----------
function conectarTeclado() {
  let tFlechas;
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.pres, .modal-fondo')) return;
    const enCampo = e.target.closest?.('input, textarea, select, [contenteditable]');
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !enCampo && e.key.toLowerCase() === 'z') { e.preventDefault(); moverHist(e.shiftKey ? 1 : -1); return; }
    if (ctrl && !enCampo && e.key.toLowerCase() === 'y') { e.preventDefault(); moverHist(1); return; }
    if (enCampo) return;
    const el = editableAqui() ? elSel() : null;
    if (ctrl && e.key.toLowerCase() === 'd' && el) { e.preventDefault(); duplicarElemento(); return; }
    if (!el) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (actual < hojas.length - 1) irAHoja(actual + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (actual > 0) irAHoja(actual - 1); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); eliminarElemento(); }
    else if (e.key === 'Escape') { selId = null; pintarSeleccion(); pintarPropiedades(); }
    else if (e.key === 'Enter' && el.tipo === 'texto') { e.preventDefault(); editarTexto(el.id); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const p = e.shiftKey ? 5 : 0.5, g = geo(el);
      if (e.key === 'ArrowLeft') g.x = r1(g.x - p);
      if (e.key === 'ArrowRight') g.x = r1(g.x + p);
      if (e.key === 'ArrowUp') g.y = r1(g.y - p);
      if (e.key === 'ArrowDown') g.y = r1(g.y + p);
      colocarNodo(el);
      clearTimeout(tFlechas);
      tFlechas = setTimeout(() => confirmarCambio({ repintar: 'mini' }), 400);
    }
  });
  // Pegar: una imagen se sube; un texto se agrega como texto nuevo
  document.addEventListener('paste', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]') || document.querySelector('.pres, .modal-fondo')) return;
    const it = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); subirImagen(it.getAsFile()); return; }
    const txt = e.clipboardData?.getData('text/plain')?.trim();
    if (!txt) return;
    e.preventDefault();
    const v = leerVideo(txt);
    if (v) return agregarElemento({ tipo: 'video', ...v, ...tamProporcional(16 / 9, 60) });
    agregarElemento({ tipo: 'texto', texto: txt.slice(0, 2000), x: 15, y: 40, w: 70, h: 20, tam: 2.6, fuente: 'Nunito',
      color: oscuro(hoja().diseno.fondo) ? '#FFFFFF' : '#2D2A45', alinear: 'center' });
  });
}

// Arrastrar y soltar archivos sobre el lienzo
function conectarSoltarArchivos() {
  const escn = $('[data-escenario]');
  let n = 0;
  const marca = (on) => $('[data-escenario] .marco, [data-escenario] .cel-marco')?.classList.toggle('soltar', on);
  escn.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { n++; marca(true); e.preventDefault(); } });
  escn.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  escn.addEventListener('dragleave', () => { if (--n <= 0) { n = 0; marca(false); } });
  escn.addEventListener('drop', (e) => {
    n = 0; marca(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    e.preventDefault();
    if (f.type.startsWith('video/')) subirVideo(f); else subirImagen(f);
  });
}

// ---------- Operaciones sobre el elemento elegido ----------
function duplicarElemento() {
  const el = elSel();
  if (!el) return;
  const c = clonar(el);
  c.id = uid(); c.x = r1(c.x + 3); c.y = r1(c.y + 4);
  const lista = hoja().diseno.elementos;
  lista.splice(lista.indexOf(el) + 1, 0, c);
  const pos = hoja().diseno.movil?.pos;
  if (pos?.[el.id]) pos[c.id] = { ...pos[el.id], y: r1(pos[el.id].y + 6) };
  selId = c.id;
  confirmarCambio();
}
function quitarElemento(id) {
  const lista = hoja().diseno.elementos;
  const i = lista.findIndex(e => e.id === id);
  if (i >= 0) lista.splice(i, 1);
  if (hoja().diseno.movil?.pos) delete hoja().diseno.movil.pos[id];
}
function eliminarElemento() {
  if (!elSel()) return;
  quitarElemento(selId);
  selId = null;
  confirmarCambio();
}
function moverCapa(hacia) {
  const lista = hoja().diseno.elementos;
  const i = lista.findIndex(e => e.id === selId);
  if (i < 0) return;
  const [el] = lista.splice(i, 1);
  const j = { frente: lista.length, fondo: 0, adelante: Math.min(lista.length, i + 1), atras: Math.max(0, i - 1) }[hacia];
  lista.splice(j, 0, el);
  confirmarCambio();
}

// ======================= TIRA DE HOJAS =======================
function pintarTira() {
  const tira = $('[data-tira]');
  tira.innerHTML = hojas.map((h, i) => `<div class="mini-hoja ${i === actual ? 'activa' : ''}" draggable="true" data-i="${i}" role="button" tabindex="0"
      aria-label="Hoja ${i + 1}"><span class="num">${i + 1}${h.tipo !== 'contenido' ? ' ' + (ICO_HOJA[h.tipo] || '') : ''}</span><button class="mas-op" data-op="${i}" title="Opciones de la hoja" aria-label="Opciones de la hoja ${i + 1}">⋯</button><div data-mini></div></div>`).join('') +
    '<button class="mini-agregar" data-agregar title="Agregar hoja de contenido" aria-label="Agregar hoja">+</button>';
  hojas.forEach((_, i) => pintarMini(i));
  $$('.mini-hoja', tira).forEach(m => {
    const i = +m.dataset.i;
    m.onclick = (e) => { if (!e.target.closest('[data-op]')) irAHoja(i); };
    m.onkeydown = (e) => { if (e.key === 'Enter') irAHoja(i); };
    m.oncontextmenu = (e) => { e.preventDefault(); menuHoja(i, e.clientX, e.clientY); };
    m.ondragstart = (e) => { e.dataTransfer.setData('text/x-hoja', String(i)); e.dataTransfer.effectAllowed = 'move'; m.classList.add('arrastrando'); };
    m.ondragend = () => { m.classList.remove('arrastrando'); $$('.mini-hoja', tira).forEach(x => x.classList.remove('antes', 'despues')); };
    m.ondragover = (e) => {
      if (!e.dataTransfer.types.includes('text/x-hoja')) return;
      e.preventDefault();
      const r = m.getBoundingClientRect(), antes = e.clientX < r.left + r.width / 2;
      $$('.mini-hoja', tira).forEach(x => x.classList.remove('antes', 'despues'));
      m.classList.add(antes ? 'antes' : 'despues');
    };
    m.ondrop = (e) => {
      const de = +e.dataTransfer.getData('text/x-hoja');
      if (!Number.isInteger(de)) return;
      e.preventDefault();
      const r = m.getBoundingClientRect(), antes = e.clientX < r.left + r.width / 2;
      let a = i + (antes ? 0 : 1);
      if (de < a) a--;
      moverHoja(de, a);
    };
  });
  $$('[data-op]', tira).forEach(b => b.onclick = (e) => { e.stopPropagation(); const r = b.getBoundingClientRect(); menuHoja(+b.dataset.op, r.left, r.bottom + 4); });
  $('[data-agregar]', tira).onclick = () => agregarHoja('contenido');
}
function pintarMini(i) {
  const cont = $(`.mini-hoja[data-i="${i}"] [data-mini]`);
  if (cont) pintarHoja(cont, hojas[i], { modo: 'miniatura' });
}
function menuHoja(i, x, y) {
  document.querySelector('.menu-flotante')?.remove();
  const m = document.createElement('div');
  m.className = 'menu-usuario menu-flotante';
  m.setAttribute('role', 'menu');
  const ops = [['⧉', 'Duplicar', () => duplicarHoja(i)], ['◀', 'Mover a la izquierda', () => moverHoja(i, i - 1), i === 0],
    ['▶', 'Mover a la derecha', () => moverHoja(i, i + 1), i === hojas.length - 1], ['▶', 'Presentar desde aquí', () => abrirPresentacion(i)],
    'sep', ['🗑', 'Eliminar hoja', () => eliminarHoja(i), hojas.length === 1, true]];
  for (const o of ops) {
    if (o === 'sep') { m.appendChild(document.createElement('hr')); continue; }
    const [ico, txt, fn, desact, peligro] = o;
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.disabled = !!desact;
    if (peligro) b.className = 'peligro';
    if (desact) b.style.opacity = '.45';
    b.innerHTML = `<span class="ico">${ico}</span><span>${esc(txt)}</span>`;
    b.onclick = () => { m.remove(); fn(); };
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.querySelector('button:not(:disabled)')?.focus();
  const cerrar = (e) => { if (!m.contains(e.target) || e.key === 'Escape') { m.remove(); document.removeEventListener('pointerdown', cerrar, true); document.removeEventListener('keydown', cerrar); } };
  setTimeout(() => { document.addEventListener('pointerdown', cerrar, true); document.addEventListener('keydown', cerrar); });
}

// ======================= PANEL IZQUIERDO: HOJAS Y RECURSOS =======================
function pintarIzquierda() {
  const p = $('[data-izq]');
  if (!recurso) {
    p.innerHTML = `<h4>Agregar hoja</h4>
      <div class="tipos-hoja">${TIPOS_HOJA.map(t => {
        const ok = DISPONIBLES.includes(t.k);
        return `<button class="tipo-hoja" data-tipo="${t.k}" ${ok ? '' : 'disabled title="Disponible en una próxima fase"'}><span>${t.ico}</span><span>${t.txt}${ok ? '' : '<small>Próximamente</small>'}</span></button>`;
      }).join('')}</div>
      <h4>Recursos</h4>
      <div class="recursos">${RECURSOS.map(([k, ico, txt]) => `<button class="recurso" data-rec="${k}"><span>${ico}</span>${txt}</button>`).join('')}</div>
      <p class="hint" style="margin-top:14px;">También puedes <b>pegar</b> (Ctrl+V) o <b>arrastrar</b> una imagen sobre la hoja.</p>`;
    $$('[data-tipo]', p).forEach(b => b.onclick = () => { agregarHoja(b.dataset.tipo); cerrarPanelMovil(); });
    $$('[data-rec]', p).forEach(b => b.onclick = () => { recurso = b.dataset.rec; pintarIzquierda(); });
    return;
  }
  const [, ico, txt] = RECURSOS.find(r => r[0] === recurso);
  p.innerHTML = `<div class="panel-cab"><button class="btn btn-sm btn-ghost btn-icon" data-atras aria-label="Volver a recursos">←</button><b>${ico} ${txt}</b></div><div data-cuerpo></div>`;
  $('[data-atras]', p).onclick = () => { recurso = null; pintarIzquierda(); };
  PANELES[recurso]($('[data-cuerpo]', p));
}

const PANELES = {
  texto(c) {
    c.innerHTML = `<div class="stack">
      <button class="btn btn-block" data-n="titulo" style="font-size:20px;">Agregar título</button>
      <button class="btn btn-block" data-n="subtitulo" style="font-size:16px;">Agregar subtítulo</button>
      <button class="btn btn-block btn-outline" data-n="parrafo" style="font-family:Nunito; font-weight:600;">Agregar párrafo</button></div>
      <h4 style="margin-top:16px;">Fuentes</h4><p class="hint" style="margin-bottom:8px;">Con un texto elegido, cambia su fuente; si no, agrega un título con ella.</p>
      ${FUENTES.map(f => `<button class="fuente-op" data-f="${esc(f)}" style="font-family:'${esc(f)}';">${esc(f)}</button>`).join('')}`;
    $$('[data-n]', c).forEach(b => b.onclick = () => agregarTexto(b.dataset.n));
    $$('[data-f]', c).forEach(b => b.onclick = () => {
      const el = elSel();
      if (el?.tipo === 'texto') { el.fuente = b.dataset.f; confirmarCambio(); } else agregarTexto('titulo', b.dataset.f);
    });
  },

  fondo(c) {
    const f = hoja().diseno.fondo || {};
    c.innerHTML = `<h4>Color</h4><div class="muestras">${COLORES.map(k => `<button class="muestra ${f.tipo === 'color' && f.valor === k ? 'sel' : ''}" data-color="${k}" style="background:${k}" aria-label="Color ${k}"></button>`).join('')}</div>
      <div class="prop-fila" style="margin-top:8px;"><label>Otro color</label><input type="color" data-color-libre value="${f.tipo === 'color' ? colorValido(f.valor) : '#FFFFFF'}"></div>
      <h4>Degradados</h4><div class="muestras">${Object.keys(DEGRADADOS).map(k => `<button class="muestra ${f.tipo === 'degradado' && f.valor === k ? 'sel' : ''}" data-deg="${k}" style="background:${cssDegradado(k)}" aria-label="Degradado ${k}"></button>`).join('')}</div>
      <h4>Patrones</h4><div class="muestras anchas">${Object.entries(PATRONES).map(([k, p]) => `<button class="muestra ${f.tipo === 'patron' && f.valor === k ? 'sel' : ''}" data-pat="${k}"><span class="etq">${esc(p.nombre)}</span></button>`).join('')}</div>
      ${f.tipo === 'patron' ? `<div class="prop-fila" style="margin-top:8px;"><label>Base</label><input type="color" data-pat-base value="${colorValido(f.color, PATRONES[f.valor]?.base)}">
        <label style="min-width:0;">Dibujo</label><input type="color" data-pat-tinta value="${colorValido(f.tinta, PATRONES[f.valor]?.tinta)}"></div>` : ''}
      <h4>Imagen propia</h4>
      <label class="btn btn-block btn-outline" style="cursor:pointer;">📁 ${f.tipo === 'imagen' ? 'Cambiar' : 'Subir'} imagen de fondo<input type="file" accept="image/*" hidden data-fondo-img></label>
      ${f.tipo === 'imagen' ? '<p class="hint">Ajusta el modo, el zoom, la posición y el oscurecido en el panel de la derecha.</p>' : ''}
      <button class="btn btn-block btn-sm" style="margin-top:14px;" data-todas>Aplicar este fondo a todas las hojas</button>`;
    $$('[data-pat]', c).forEach(b => Object.assign(b.style, estiloFondo({ tipo: 'patron', valor: b.dataset.pat })));
    const poner = (nuevo) => { hoja().diseno.fondo = nuevo; confirmarCambio(); PANELES.fondo(c); };
    $$('[data-color]', c).forEach(b => b.onclick = () => poner({ tipo: 'color', valor: b.dataset.color }));
    const libre = $('[data-color-libre]', c);
    libre.oninput = () => { hoja().diseno.fondo = { tipo: 'color', valor: libre.value }; refrescarFondo(); };
    libre.onchange = () => poner({ tipo: 'color', valor: libre.value });
    $$('[data-deg]', c).forEach(b => b.onclick = () => poner({ tipo: 'degradado', valor: b.dataset.deg }));
    $$('[data-pat]', c).forEach(b => b.onclick = () => poner({ tipo: 'patron', valor: b.dataset.pat }));
    for (const [sel, campo] of [['[data-pat-base]', 'color'], ['[data-pat-tinta]', 'tinta']]) {
      const inp = $(sel, c);
      if (!inp) continue;
      inp.oninput = () => { hoja().diseno.fondo[campo] = inp.value; refrescarFondo(); };
      inp.onchange = () => { hoja().diseno.fondo[campo] = inp.value; confirmarCambio(); };
    }
    $('[data-fondo-img]', c).onchange = (e) => { if (e.target.files[0]) subirImagen(e.target.files[0], { comoFondo: true }); e.target.value = ''; };
    $('[data-todas]', c).onclick = async () => {
      if (!await confirmar('Todas las hojas del proyecto tendrán este mismo fondo.', { titulo: '¿Aplicar a todas?', boton: 'Aplicar', peligro: false })) return;
      const fondo = hoja().diseno.fondo;
      hojas.forEach(h => { h.diseno.fondo = clonar(fondo); });
      confirmarCambio({ repintar: 'todo' });
    };
  },

  imagen(c) {
    c.innerHTML = `<label class="btn btn-primary btn-block" style="cursor:pointer;">📁 Subir desde el equipo<input type="file" accept="image/*" hidden data-arch></label>
      <div class="zona-pegar" tabindex="0" data-pegar style="margin-top:10px; padding:22px 12px;">📋 Haz clic aquí y pega una imagen (Ctrl+V)<br><small>o arrástrala sobre la hoja</small></div>
      <h4>Desde un enlace</h4>
      <div class="row"><input class="input grow" data-url placeholder="https://…/imagen.jpg"><button class="btn btn-sm" data-usar>Usar</button></div>
      <p class="hint">Las imágenes se reducen a 1600 px antes de subirlas para que carguen rápido en los celulares.</p>`;
    $('[data-arch]', c).onchange = (e) => { if (e.target.files[0]) subirImagen(e.target.files[0]); e.target.value = ''; };
    $('[data-pegar]', c).onpaste = (e) => {
      const it = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
      e.preventDefault(); e.stopPropagation();
      if (!it) return toast('No hay ninguna imagen en el portapapeles', 'error');
      subirImagen(it.getAsFile());
    };
    $('[data-usar]', c).onclick = () => {
      const u = $('[data-url]', c).value.trim();
      if (!urlSegura(u)) return toast('Escribe un enlace que empiece con https://', 'error');
      const img = new Image();
      img.onload = () => agregarElemento({ tipo: 'imagen', url: u, ajuste: 'cover', radio: 0, ...tamProporcional(img.naturalWidth / img.naturalHeight, 40) });
      img.onerror = () => toast('No se pudo abrir esa imagen', 'error');
      img.src = u;
    };
  },

  async iconos(c) {
    let color = '#6C5CE7';
    c.innerHTML = `<input class="input" data-buscar placeholder="🔍 Buscar (estrella, libro, idea…)">
      <div class="prop-fila" style="margin-top:8px;"><label>Color</label><input type="color" data-color value="${color}"></div>
      <div class="iconos-ed" data-lista><div class="center" style="grid-column:1/-1; padding:20px;"><div class="spinner"></div></div></div>
      <p class="hint" style="margin-top:8px;">Iconos de Lucide (licencia libre). Busca en español o en inglés.</p>`;
    let iconos;
    try { iconos = await cargarIconos(); }
    catch (e) { $('[data-lista]', c).innerHTML = `<div class="empty" style="grid-column:1/-1;">⚠️ ${esc(e.message)}</div>`; return; }
    const lista = $('[data-lista]', c);
    const svgDe = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
      nodosIcono(iconos[n]).map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('')}</svg>`;
    const pintar = () => {
      const q = $('[data-buscar]', c).value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let nombres;
      if (!q) nombres = ICONOS_POPULARES.filter(n => iconos[n]);
      else {
        const es = Object.entries(ICONOS_ES).filter(([k]) => k.startsWith(q)).map(([, v]) => v);
        const en = Object.keys(iconos).filter(n => n.toLowerCase().includes(q.replace(/\s+/g, '')));
        nombres = [...new Set([...es, ...en])].filter(n => iconos[n]).slice(0, 120);
      }
      lista.innerHTML = nombres.map(n => `<button data-ic="${esc(n)}" title="${esc(n)}">${svgDe(n)}</button>`).join('') ||
        '<div class="empty" style="grid-column:1/-1;">No hay iconos con ese nombre.</div>';
      $$('[data-ic]', lista).forEach(b => b.onclick = () => agregarElemento({ tipo: 'icono', nombre: b.dataset.ic, nodos: nodosIcono(iconos[b.dataset.ic]),
        color, grosor: 2, ...tamProporcional(1, 14) }));
    };
    $('[data-buscar]', c).oninput = pintar;
    $('[data-color]', c).oninput = (e) => { color = e.target.value; lista.style.color = color; };
    pintar();
  },

  emojis(c) {
    let cat = Object.keys(EMOJIS)[0];
    const pintar = () => {
      c.innerHTML = `<div class="chips" style="margin-bottom:10px;">${Object.keys(EMOJIS).map(k => `<button class="chip ${k === cat ? 'activo' : ''}" data-cat="${esc(k)}" style="padding:5px 9px; font-size:12px;">${esc(k)}</button>`).join('')}</div>
        <div class="emojis-ed">${EMOJIS[cat].map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`;
      $$('[data-cat]', c).forEach(b => b.onclick = () => { cat = b.dataset.cat; pintar(); });
      $$('[data-e]', c).forEach(b => b.onclick = () => {
        const el = elSel();
        if (el?.tipo === 'emoji') { el.emoji = b.dataset.e; confirmarCambio(); return; }
        agregarElemento({ tipo: 'emoji', emoji: b.dataset.e, ...tamProporcional(1, 14) });
      });
    };
    pintar();
  },

  formas(c) {
    c.innerHTML = `<div class="formas-ed">${Object.entries(FORMAS).map(([k, f]) => `<button data-forma="${k}" title="${esc(f.nombre)}" aria-label="${esc(f.nombre)}"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${f.svg}</svg></button>`).join('')}</div>`;
    $$('[data-forma]', c).forEach(b => b.onclick = () => {
      const k = b.dataset.forma;
      const prop = ['circulo', 'estrella', 'corazon'].includes(k) ? 1 : k === 'flecha' ? 2 : 1.5;
      agregarElemento({ tipo: 'forma', forma: k, relleno: '#7C6FF0', borde: '#2D2A45', grosorBorde: 0, ...tamProporcional(prop, prop === 1 ? 20 : 30) });
    });
  },

  video(c) {
    c.innerHTML = `<label class="lbl" style="margin-top:0;">Enlace de YouTube o Vimeo</label>
      <input class="input" data-url placeholder="https://www.youtube.com/watch?v=…">
      <button class="btn btn-primary btn-block" data-usar style="margin-top:8px;">Agregar video</button>
      <p class="hint">Recomendado: no ocupa espacio y se ve en buena calidad.</p>
      <h4>O sube un archivo</h4>
      <label class="btn btn-block btn-outline" style="cursor:pointer;">🎞 Subir MP4 (máx. ${MAX_VIDEO_MB} MB)<input type="file" accept="video/mp4,video/webm" hidden data-arch></label>
      <p class="hint">En el editor verás una vista previa; el video se reproduce al presentar.</p>`;
    $('[data-usar]', c).onclick = () => {
      const v = leerVideo($('[data-url]', c).value);
      if (!v) return toast('Ese enlace no es de YouTube, Vimeo ni un archivo MP4', 'error');
      agregarElemento({ tipo: 'video', ...v, ...tamProporcional(16 / 9, 60) });
    };
    $('[data-arch]', c).onchange = (e) => { if (e.target.files[0]) subirVideo(e.target.files[0]); e.target.value = ''; };
  },

  plantillas(c) {
    c.innerHTML = `<p class="hint" style="margin:0 0 10px;">Aplica el fondo, los colores y las fuentes a esta hoja. Si la hoja de contenido está vacía, también agrega sus textos.</p>
      <div class="muestras anchas" data-lista></div>`;
    const lista = $('[data-lista]', c);
    for (const [k, p] of Object.entries(PLANTILLAS)) {
      const b = document.createElement('button');
      b.className = 'muestra'; b.dataset.pl = k; b.title = p.nombre;
      const cont = document.createElement('div');
      cont.style.cssText = 'position:absolute; inset:0;';
      pintarHoja(cont, hojaDePlantilla(p), { modo: 'miniatura' });
      b.append(cont);
      b.insertAdjacentHTML('beforeend', `<span class="etq">${esc(p.nombre)}</span>`);
      b.onclick = () => aplicarPlantilla(p);
      lista.appendChild(b);
    }
  }
};

function hojaDePlantilla(p) {
  return { diseno: { fondo: clonar(p.fondo), elementos: p.elementos.map(e => ({ id: uid(), fuente: p.fuente, color: p.color, ...clonar(e) })) } };
}
function aplicarPlantilla(p) {
  const h = hoja();
  h.diseno.fondo = clonar(p.fondo);
  const textos = h.diseno.elementos.filter(e => e.tipo === 'texto');
  const vacia = !h.diseno.elementos.length || (textos.length === h.diseno.elementos.length && textos.every(t => /^(Escribe un título|Título|Subtítulo)$/.test(t.texto)));
  if (!interactiva(h.tipo) && vacia) {
    h.diseno.elementos = hojaDePlantilla(p).diseno.elementos;
    delete h.diseno.movil;
  } else {
    // conserva el contenido y solo cambia el estilo: el primer texto toma el estilo del título de la plantilla
    const est = p.elementos.filter(e => e.tipo === 'texto');
    textos.forEach((t, i) => { const e = est[Math.min(i, est.length - 1)] || {}; t.fuente = e.fuente || p.fuente; t.color = e.color || p.color; });
  }
  selId = null;
  confirmarCambio();
  cerrarPanelMovil();
}

// ======================= PANEL DERECHO: PROPIEDADES =======================
const fila = (etq, html) => `<div class="prop-fila"><label>${etq}</label>${html}</div>`;

// Control del punto de enfoque: arrastrar el punto sobre la imagen o elegir una de 9 posiciones
function controlEnfoque(cont, url, px, py, alCambiar) {
  cont.innerHTML = `<div class="enfoque"><div class="enfoque-caja" data-caja><img src="${esc(url)}" alt="" draggable="false"><span class="enfoque-punto" data-punto></span></div></div>
    <div class="enfoque-9">${[0, 50, 100].flatMap(y => [0, 50, 100].map(x => `<button type="button" data-xy="${x},${y}" class="${x === px && y === py ? 'sel' : ''}" aria-label="Posición ${x}% ${y}%"></button>`)).join('')}</div>`;
  const caja = $('[data-caja]', cont), punto = $('[data-punto]', cont);
  const poner = (x, y, final) => {
    x = Math.round(Math.max(0, Math.min(100, x))); y = Math.round(Math.max(0, Math.min(100, y)));
    punto.style.left = x + '%'; punto.style.top = y + '%';
    $$('[data-xy]', cont).forEach(b => b.classList.toggle('sel', b.dataset.xy === `${x},${y}`));
    alCambiar(x, y, final);
  };
  punto.style.left = px + '%'; punto.style.top = py + '%';
  let arrastrando = false;
  const leer = (e, final) => { const r = caja.getBoundingClientRect(); poner((e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100, final); };
  caja.onpointerdown = (e) => { arrastrando = true; caja.setPointerCapture(e.pointerId); leer(e, false); };
  caja.onpointermove = (e) => { if (arrastrando) leer(e, false); };
  caja.onpointerup = (e) => { if (arrastrando) { arrastrando = false; leer(e, true); } };
  $$('[data-xy]', cont).forEach(b => b.onclick = () => { const [x, y] = b.dataset.xy.split(',').map(Number); poner(x, y, true); });
}

// Sliders conectados a un objeto: en vivo con "input" y confirmados con "change"
function conectarSliders(p, obj, alMover, alConfirmar) {
  $$('[data-f]', p).forEach(inp => {
    const k = inp.dataset.f, esc100 = inp.hasAttribute('data-pct');
    const leer = () => esc100 ? Number(inp.value) / 100 : Number(inp.value);
    const ver = () => { const v = $(`[data-ver-f="${k}"]`, p); if (v) v.textContent = inp.value + (inp.dataset.unidad || ''); };
    inp.oninput = () => { obj[k] = leer(); ver(); alMover(); };
    inp.onchange = () => { obj[k] = leer(); ver(); alConfirmar(); };
  });
}

function seccionFondoImagen(p) {
  const f = hoja().diseno.fondo;
  const modo = MODOS_FONDO[f.modo] ? f.modo : 'cubrir';
  const s = document.createElement('div');
  s.innerHTML = `<h4>🖼 Imagen de fondo</h4>
    <div class="grupo-btn" style="margin-bottom:10px;">${Object.entries(MODOS_FONDO).map(([k, t]) => `<button class="btn btn-sm btn-outline ${k === modo ? 'activo' : ''}" data-modo="${k}">${t}</button>`).join('')}</div>
    ${fila('Zoom', `<input type="range" min="50" max="300" step="5" data-f="zoom" data-unidad="%" value="${f.zoom ?? 100}"><b data-ver-f="zoom">${f.zoom ?? 100}%</b>`)}
    <label class="lbl" style="margin-top:4px;">Posición (arrastra el punto)</label><div data-enfoque></div>
    ${fila('Opacidad', `<input type="range" min="10" max="100" step="5" data-f="opacidad" data-pct data-unidad="%" value="${Math.round((f.opacidad ?? 1) * 100)}"><b data-ver-f="opacidad">${Math.round((f.opacidad ?? 1) * 100)}%</b>`)}
    ${fila('Oscurecer', `<input type="range" min="0" max="70" step="5" data-f="oscurecer" data-pct data-unidad="%" value="${Math.round((f.oscurecer || 0) * 100)}"><b data-ver-f="oscurecer">${Math.round((f.oscurecer || 0) * 100)}%</b>`)}
    ${fila('Desenfoque', `<input type="range" min="0" max="20" step="1" data-f="desenfoque" value="${f.desenfoque || 0}"><b data-ver-f="desenfoque">${f.desenfoque || 0}</b>`)}
    ${fila('Color base', `<input type="color" data-color-base value="${colorValido(f.color, '#2D2A45')}"><span class="hint" style="margin:0;">se ve donde la imagen no llega</span>`)}
    <div class="stack" style="margin-top:10px;">
      <label class="btn btn-sm btn-outline btn-block" style="cursor:pointer;">🔁 Cambiar imagen<input type="file" accept="image/*" hidden data-cambiar-fondo></label>
      <button class="btn btn-sm btn-block" data-a-imagen>🖼 Usar como imagen normal</button>
      <button class="btn btn-sm btn-red btn-block" data-quitar-fondo>🗑 Quitar fondo</button></div>`;
  p.appendChild(s);
  $$('[data-modo]', s).forEach(b => b.onclick = () => { f.modo = b.dataset.modo; confirmarCambio(); });
  conectarSliders(s, f, refrescarFondo, () => confirmarCambio({ repintar: 'mini' }));
  controlEnfoque($('[data-enfoque]', s), f.valor, f.px ?? 50, f.py ?? 50, (x, y, final) => {
    f.px = x; f.py = y; refrescarFondo();
    if (final) confirmarCambio({ repintar: 'mini' });
  });
  const cb = $('[data-color-base]', s);
  cb.oninput = () => { f.color = cb.value; refrescarFondo(); };
  cb.onchange = () => confirmarCambio({ repintar: 'mini' });
  $('[data-cambiar-fondo]', s).onchange = (e) => { const a = e.target.files[0]; e.target.value = ''; if (a) subirImagen(a, { comoFondo: true }); };
  $('[data-a-imagen]', s).onclick = fondoAImagen;
  $('[data-quitar-fondo]', s).onclick = quitarFondo;
}

function pintarPropiedades() {
  const p = $('[data-der]');
  if (!p) return;
  const el = editableAqui() ? elSel() : null;
  if (!el) return pintarPropsHoja(p);
  const g = geoVer(el);
  let esp = '';
  if (el.tipo === 'texto') {
    const vinc = el.vinculo === 'enunciado';
    esp = `<label class="lbl" style="margin-top:0;">${vinc ? (hoja().tipo === 'completar' ? 'Frase (usa ___ para cada espacio)' : 'Enunciado de la pregunta') : 'Texto'}</label>
      <textarea class="input" data-prop-texto style="min-height:70px;">${esc(textoDe(el))}</textarea>
      <label class="lbl">Fuente</label><select class="input" data-p="fuente">${FUENTES.map(f => `<option ${f === el.fuente ? 'selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select>
      <div style="margin-top:10px;">${fila('Tamaño', `<input type="range" min="1" max="16" step="0.1" data-p="tam" data-num value="${el.tam ?? 4}"><b data-ver="tam">${r1(el.tam ?? 4)}</b>`)}
      ${fila('Color', `<input type="color" data-p="color" value="${colorValido(el.color, '#2D2A45')}">
        <label class="check small" style="margin-left:6px;"><input type="checkbox" data-fondo-caja ${el.fondoCaja ? 'checked' : ''}> Caja</label>
        ${el.fondoCaja ? `<input type="color" data-p="fondoCaja" value="${colorValido(el.fondoCaja, '#FFFFFF')}">` : ''}`)}</div>
      <div class="grupo-btn" style="margin-bottom:8px;">
        ${[['left', '⯇'], ['center', '≡'], ['right', '⯈']].map(([k, t]) => `<button class="btn btn-sm btn-outline ${(el.alinear || 'center') === k ? 'activo' : ''}" data-alinear="${k}" title="Alinear ${k === 'left' ? 'a la izquierda' : k === 'right' ? 'a la derecha' : 'al centro'}">${t}</button>`).join('')}
        <button class="btn btn-sm btn-outline ${el.negrita ? 'activo' : ''}" data-alt="negrita" title="Negrita"><b>N</b></button>
        <button class="btn btn-sm btn-outline ${el.cursiva ? 'activo' : ''}" data-alt="cursiva" title="Cursiva"><i>K</i></button>
        <button class="btn btn-sm btn-outline ${el.sombra ? 'activo' : ''}" data-alt="sombra" title="Sombra">S</button>
      </div>`;
  } else if (el.tipo === 'imagen') {
    const aj = el.ajuste === 'contain' ? 'contain' : el.ajuste === 'fill' ? 'fill' : 'cover';
    esp = `<div class="grupo-btn" style="margin-bottom:8px;">${[['cover', 'Rellenar'], ['contain', 'Ver completa'], ['fill', 'Estirar']].map(([k, t]) => `<button class="btn btn-sm btn-outline ${aj === k ? 'activo' : ''}" data-ajuste="${k}">${t}</button>`).join('')}</div>
      ${aj === 'cover' ? `<label class="lbl" style="margin-top:0;">Recorte</label>
        ${fila('Zoom', `<input type="range" min="100" max="300" step="5" data-p="zoom" data-num value="${el.zoom ?? 100}"><b data-ver="zoom">${el.zoom ?? 100}</b>`)}
        <div data-enfoque-img></div>` : ''}
      ${fila('Esquinas', `<input type="range" min="0" max="50" step="1" data-p="radio" data-num value="${el.radio || 0}">`)}
      <div class="stack"><label class="btn btn-sm btn-outline btn-block" style="cursor:pointer;">🔁 Cambiar imagen<input type="file" accept="image/*" hidden data-cambiar-img></label>
        <button class="btn btn-sm btn-block" data-a-fondo>🌄 Usar como fondo de la hoja</button></div>`;
  } else if (el.tipo === 'icono') {
    esp = fila('Color', `<input type="color" data-p="color" value="${colorValido(el.color, '#6C5CE7')}">`) +
      fila('Grosor', `<input type="range" min="0.5" max="4" step="0.25" data-p="grosor" data-num value="${el.grosor ?? 2}">`);
  } else if (el.tipo === 'emoji') {
    esp = `<div class="row" style="margin-bottom:8px;"><span style="font-size:34px;">${esc(el.emoji)}</span><button class="btn btn-sm" data-cambiar-emoji>Cambiar emoji</button></div>`;
  } else if (el.tipo === 'forma') {
    esp = `<label class="lbl" style="margin-top:0;">Forma</label><select class="input" data-p="forma">${Object.entries(FORMAS).map(([k, f]) => `<option value="${k}" ${k === el.forma ? 'selected' : ''}>${esc(f.nombre)}</option>`).join('')}</select>
      <div style="margin-top:10px;">${fila('Relleno', `<input type="color" data-p="relleno" value="${colorValido(el.relleno, '#7C6FF0')}">`)}
      ${fila('Borde', `<input type="color" data-p="borde" value="${colorValido(el.borde, '#2D2A45')}"><input type="range" min="0" max="12" step="1" data-p="grosorBorde" data-num value="${el.grosorBorde || 0}">`)}</div>`;
  } else if (el.tipo === 'video') {
    const mini = miniaturaVideo(el);
    esp = `<p class="small" style="font-weight:700; margin-bottom:8px;">${el.fuente === 'youtube' ? '▶ YouTube' : el.fuente === 'vimeo' ? '▶ Vimeo' : '🎞 Archivo de video'}</p>
      ${mini ? `<img src="${esc(mini)}" alt="" style="border-radius:10px; margin-bottom:8px;">` : ''}
      <p class="hint" style="margin-bottom:8px;">Se reproduce al presentar. Pulsa ▶ Presentar para probarlo.</p>`;
  } else if (el.tipo === 'zona') {
    esp = hoja().tipo === 'ruleta'
      ? `<p class="hint" style="margin:0 0 8px;">Aquí gira la ruleta, con el elegido y el historial. Muévela o cambia su tamaño; los nombres y opciones están en el panel de la hoja.</p>`
      : `<p class="hint" style="margin:0 0 8px;">Aquí aparecen las respuestas en vivo (y las simuladas al presentar). Muévela o cambia su tamaño; las opciones de la pregunta están en el panel de la hoja.</p>`;
  }
  const enCel = enCelular();
  p.innerHTML = `<div class="panel-cab"><b>${esc(NOMBRE_EL[el.tipo] || 'Elemento')}</b>${enCel ? '<span class="badge">📱 celular</span>' : ''}<span class="grow"></span>
      <button class="btn btn-sm btn-ghost btn-icon" data-cerrar-sel title="Quitar selección (Esc)" aria-label="Quitar selección">✕</button></div>
    ${esp}
    <h4>Posición${enCel ? ' en el celular' : ''}</h4>
    <div class="prop-num">${[['x', 'X'], ['y', 'Y'], ['w', 'Ancho'], ['h', 'Alto']].map(([k, t]) => `<div><label>${t} %</label><input type="number" step="0.5" data-p="${k}" data-geo data-num value="${r1(g[k])}"></div>`).join('')}</div>
    <div style="margin-top:10px;">${fila('Giro', `<input type="range" min="-180" max="180" step="1" data-p="rot" data-geo data-num value="${g.rot || 0}"><b data-ver="rot">${g.rot || 0}°</b>`)}
    ${fila('Opacidad', `<input type="range" min="0.1" max="1" step="0.05" data-p="opacidad" data-num value="${el.opacidad ?? 1}">`)}</div>
    <h4>Capa</h4>
    <div class="grupo-btn"><button class="btn btn-sm btn-outline" data-capa="frente" title="Al frente">⏫</button><button class="btn btn-sm btn-outline" data-capa="adelante" title="Adelante">⬆</button>
      <button class="btn btn-sm btn-outline" data-capa="atras" title="Atrás">⬇</button><button class="btn btn-sm btn-outline" data-capa="fondo" title="Al fondo">⏬</button></div>
    <p class="hint">Alt+clic sobre la hoja elige lo que está debajo.</p>
    <div class="row" style="margin-top:14px;"><button class="btn btn-sm" data-dup>⧉ Duplicar</button><button class="btn btn-sm btn-red" data-del>🗑 Eliminar</button></div>`;

  // cambios en vivo (input) y confirmados (change); x, y, w, h y giro van a la vista actual (Web o celular)
  $$('[data-p]', p).forEach(inp => {
    const k = inp.dataset.p;
    const destino = () => inp.hasAttribute('data-geo') ? geo(el) : el;
    const leer = () => inp.hasAttribute('data-num') ? Number(inp.value) : inp.value;
    const aplicar = () => {
      destino()[k] = leer();
      const ver = $(`[data-ver="${k}"]`, p);
      if (ver) ver.textContent = k === 'rot' ? `${destino().rot}°` : r1(destino()[k]);
      if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja());
      pintarSeleccion();
    };
    inp.oninput = aplicar;
    inp.onchange = () => { aplicar(); confirmarCambio({ repintar: 'mini' }); };
  });
  const txt = $('[data-prop-texto]', p);
  if (txt) {
    txt.oninput = () => { ponerTexto(el, txt.value); if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja()); };
    txt.onchange = () => confirmarCambio({ repintar: el.vinculo ? 'hoja' : 'mini' });
  }
  $$('[data-alinear]', p).forEach(b => b.onclick = () => { el.alinear = b.dataset.alinear; confirmarCambio(); });
  $$('[data-alt]', p).forEach(b => b.onclick = () => { el[b.dataset.alt] = !el[b.dataset.alt]; confirmarCambio(); });
  $$('[data-ajuste]', p).forEach(b => b.onclick = () => { el.ajuste = b.dataset.ajuste; confirmarCambio(); });
  const caja = $('[data-fondo-caja]', p);
  if (caja) caja.onchange = () => { if (caja.checked) el.fondoCaja = '#FFFFFF'; else delete el.fondoCaja; confirmarCambio(); };
  const enf = $('[data-enfoque-img]', p);
  if (enf) controlEnfoque(enf, el.url, el.px ?? 50, el.py ?? 50, (x, y, final) => {
    el.px = x; el.py = y;
    if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja());
    if (final) confirmarCambio({ repintar: 'mini' });
  });
  const cimg = $('[data-cambiar-img]', p);
  if (cimg) cimg.onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) subirImagen(f, { reemplazar: el }); };
  const afondo = $('[data-a-fondo]', p);
  if (afondo) afondo.onclick = () => imagenAFondo(el);
  const cem = $('[data-cambiar-emoji]', p);
  if (cem) cem.onclick = () => { recurso = 'emojis'; pintarIzquierda(); if (esMovil()) alternarPanelMovil('izq'); };
  $('[data-cerrar-sel]', p).onclick = () => { selId = null; pintarSeleccion(); pintarPropiedades(); cerrarPanelMovil(); };
  $$('[data-capa]', p).forEach(b => b.onclick = () => moverCapa(b.dataset.capa));
  $('[data-dup]', p).onclick = duplicarElemento;
  $('[data-del]', p).onclick = eliminarElemento;
}

// ---------- Configuración de las hojas de preguntas ----------
function seccionPregunta(p) {
  const h = hoja(), c = h.config;
  const s = document.createElement('div');
  const repintarZona = () => {
    for (const el of h.diseno.elementos.filter(e => e.tipo === 'zona' || e.vinculo)) if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja());
    if (enCelular()) pintarLienzo();
  };
  let cuerpo = '';
  if (h.tipo === 'completar') {
    const n = Math.max(1, huecos(c.frase));
    c.aceptadas = Array.from({ length: n }, (_, i) => c.aceptadas?.[i] || []);
    cuerpo = `<label class="lbl" style="margin-top:0;">Frase</label><input class="input" data-cfg="frase" value="${esc(c.frase || '')}">
      <p class="hint">Escribe ___ (tres guiones bajos) donde va cada espacio para completar.</p>
      ${c.aceptadas.map((a, i) => `<label class="lbl">Respuestas aceptadas${n > 1 ? ` · espacio ${i + 1}` : ''}</label>
        <input class="input" data-acept="${i}" value="${esc(a.join(', '))}" placeholder="Separa con comas: 100, cien">`).join('')}
      <p class="hint">No importan mayúsculas ni tildes.</p>`;
  } else {
    cuerpo = `<label class="lbl" style="margin-top:0;">Enunciado</label><textarea class="input" data-cfg="enunciado" style="min-height:64px;">${esc(c.enunciado || '')}</textarea>`;
  }
  if (h.tipo === 'pregunta') cuerpo += fila('Máx. letras', `<input class="input" type="number" min="10" max="500" data-cfg-num="limite" value="${c.limite ?? 140}" style="width:90px;">`);
  if (h.tipo === 'lluvia') cuerpo += fila('Ideas por persona', `<input class="input" type="number" min="1" max="10" data-cfg-num="max" value="${c.max ?? 3}" style="width:80px;">`);
  if (h.tipo === 'vf') {
    cuerpo += `<label class="lbl">Respuesta correcta</label>
      ${[['true', '✔ Verdadero'], ['false', '✘ Falso'], ['', 'Sin respuesta correcta (opinión)']].map(([v, t]) => `<label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="vfok" value="${v}" ${String(c.correcta ?? '') === v ? 'checked' : ''}> ${t}</label>`).join('')}`;
  }
  if (h.tipo === 'opcion') {
    const ops = c.opciones || (c.opciones = []);
    cuerpo += `<label class="lbl">Opciones <span style="text-transform:none;">(marca la correcta o deja todas sin marcar)</span></label>
      <div class="ops-ed">${ops.map((o, i) => `<div class="op-fila ${(c.correctas || []).includes(o.id) ? 'correcta' : ''}"><span class="zb-letra mini" style="background:${COLORES_OPCION[i % 6]}">${LETRAS[i]}</span>
        <input type="text" data-op-txt="${i}" value="${esc(o.texto)}" maxlength="80" aria-label="Opción ${LETRAS[i]}">
        <input type="checkbox" data-op-ok="${i}" ${(c.correctas || []).includes(o.id) ? 'checked' : ''} title="Correcta">
        <button class="btn btn-sm btn-ghost btn-icon" data-op-del="${i}" ${ops.length <= 2 ? 'disabled' : ''} aria-label="Quitar opción">✕</button></div>`).join('')}</div>
      ${ops.length < 6 ? '<button class="btn btn-sm" data-op-mas>➕ Agregar opción</button>' : ''}`;
  }
  const hayGrupos = hojas.slice(0, actual).some(x => x.tipo === 'agrupar');
  cuerpo += `<label class="lbl">Responde</label>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="modo" value="persona" ${c.modo !== 'grupo' ? 'checked' : ''}> 🙋 Cada participante</label>
    <label class="check" style="display:flex; ${hayGrupos ? '' : 'opacity:.55;'}" ${hayGrupos ? '' : 'title="Agrega antes una hoja Agrupar"'}><input type="radio" name="modo" value="grupo" ${c.modo === 'grupo' ? 'checked' : ''} ${hayGrupos ? '' : 'disabled'}> 👥 Una respuesta por grupo</label>
    ${hayGrupos ? '' : `<p class="hint">${c.modo === 'grupo' ? '⚠️ Esta pregunta es “por grupo” pero ya no hay una hoja Agrupar antes. ' : ''}Para responder en grupo, agrega antes una hoja <b>Agrupar</b>.</p>`}`;
  const falta = [];
  if (!h.diseno.elementos.some(e => e.tipo === 'zona')) falta.push('<button class="btn btn-sm" data-poner="zona">➕ Volver a poner el área de respuestas</button>');
  if (!h.diseno.elementos.some(e => e.vinculo === 'enunciado')) falta.push('<button class="btn btn-sm" data-poner="enunciado">➕ Volver a poner el enunciado</button>');
  s.innerHTML = `<h4>${TIPOS_PREGUNTA[h.tipo].ico} ${TIPOS_PREGUNTA[h.tipo].nombre}</h4>${cuerpo}${falta.length ? `<div class="stack" style="margin-top:10px;">${falta.join('')}</div>` : ''}
    <p class="hint" style="margin-top:10px;">Pruébala con <b>▶ Presentar → 🎭 Simular</b>: aparecen respuestas falsas que no se guardan.</p>`;
  p.appendChild(s);

  $$('[data-cfg]', s).forEach(inp => {
    inp.oninput = () => { c[inp.dataset.cfg] = inp.value; repintarZona(); };
    inp.onchange = () => { c[inp.dataset.cfg] = inp.value; confirmarCambio(); };
  });
  $$('[data-cfg-num]', s).forEach(inp => inp.onchange = () => {
    const [mn, mx] = [Number(inp.min), Number(inp.max)];
    c[inp.dataset.cfgNum] = Math.max(mn, Math.min(mx, Math.round(Number(inp.value) || mn)));
    confirmarCambio();
  });
  $$('[data-acept]', s).forEach(inp => inp.onchange = () => {
    c.aceptadas[+inp.dataset.acept] = inp.value.split(',').map(x => x.trim()).filter(Boolean);
    confirmarCambio();
  });
  $$('input[name=modo]', s).forEach(r => r.onchange = () => { c.modo = r.value; confirmarCambio(); });
  $$('input[name=vfok]', s).forEach(r => r.onchange = () => { c.correcta = r.value === '' ? null : r.value === 'true'; confirmarCambio(); });
  $$('[data-op-txt]', s).forEach(inp => {
    inp.oninput = () => { c.opciones[+inp.dataset.opTxt].texto = inp.value; repintarZona(); };
    inp.onchange = () => confirmarCambio();
  });
  $$('[data-op-ok]', s).forEach(ch => ch.onchange = () => {
    const id = c.opciones[+ch.dataset.opOk].id;
    c.correctas = (c.correctas || []).filter(x => x !== id);
    if (ch.checked) c.correctas.push(id);
    confirmarCambio();
  });
  $$('[data-op-del]', s).forEach(b => b.onclick = () => {
    const [o] = c.opciones.splice(+b.dataset.opDel, 1);
    c.correctas = (c.correctas || []).filter(x => x !== o.id);
    confirmarCambio();
  });
  const mas = $('[data-op-mas]', s);
  if (mas) mas.onclick = () => { c.opciones.push({ id: uid(), texto: `Opción ${LETRAS[c.opciones.length]}` }); confirmarCambio(); };
  $$('[data-poner]', s).forEach(b => b.onclick = () => {
    const nueva = hojaNueva(h.tipo).diseno.elementos.find(e => b.dataset.poner === 'zona' ? e.tipo === 'zona' : e.vinculo);
    h.diseno.elementos.push(nueva);
    selId = nueva.id;
    confirmarCambio();
  });
}

function seccionAgrupar(p) {
  const c = hoja().config;
  const s = document.createElement('div');
  const pintarEjemplo = () => { $('[data-ejemplo]', s).textContent = 'Con 24 participantes: ' + resumenReparto(24, c.cantidad, c.por).replace('Quedarán', 'quedarían'); };
  s.innerHTML = `<h4>👥 Agrupar</h4>
    <p class="hint" style="margin:0 0 8px;">En vivo, los participantes se registran con el QR o el PIN y aparecen en la pantalla. Después cierras el registro y formas los grupos al azar (equilibrados).</p>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="por" value="grupos" ${c.por !== 'personas' ? 'checked' : ''}> Por número de grupos</label>
    <label class="check" style="display:flex; margin-bottom:8px;"><input type="radio" name="por" value="personas" ${c.por === 'personas' ? 'checked' : ''}> Por personas en cada grupo</label>
    ${fila(c.por === 'personas' ? 'Personas' : 'Grupos', `<input class="input" type="number" min="1" max="60" data-cant value="${c.cantidad ?? 4}" style="width:90px;">`)}
    <p class="hint" data-ejemplo></p>
    <label class="lbl">Nombres de los grupos (opcional, uno por línea)</label>
    <textarea class="input" data-nombres style="min-height:80px;" placeholder="Los Leones&#10;Las Águilas&#10;…">${esc((c.nombres || []).join('\n'))}</textarea>
    <p class="hint">Si faltan nombres, quedan como “Grupo 1”, “Grupo 2”… También se cambian en vivo.</p>
    <p class="hint" style="margin-top:8px;">Pruébala con <b>▶ Presentar → 🎭 Simular</b>.</p>`;
  p.appendChild(s);
  pintarEjemplo();
  $$('input[name=por]', s).forEach(r => r.onchange = () => { c.por = r.value; confirmarCambio(); });
  const cant = $('[data-cant]', s);
  cant.oninput = () => { c.cantidad = Math.max(1, Math.min(60, Math.round(Number(cant.value) || 1))); pintarEjemplo(); };
  cant.onchange = () => confirmarCambio({ repintar: 'nada' });
  $('[data-nombres]', s).onchange = (e) => { c.nombres = e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 60); confirmarCambio({ repintar: 'nada' }); };
}

function seccionRuleta(p) {
  const h = hoja(), c = h.config;
  const agrupar = hojas.slice(0, actual).map((x, i) => ({ x, i })).filter(({ x }) => x.tipo === 'agrupar');
  const origen = c.origen || 'nombres';
  const repintarZona = () => {
    const z = h.diseno.elementos.find(e => e.tipo === 'zona');
    if (z && lienzo) repintarElemento(lienzo, z, 'editor', ctxHoja());
    if (enCelular()) pintarLienzo();
  };
  const s = document.createElement('div');
  s.innerHTML = `<h4>🎡 Ruleta</h4>
    <label class="lbl">¿Entre quiénes sortea?</label>
    ${Object.entries(ORIGENES).map(([k, o]) => {
      const off = k === 'grupos' && !agrupar.length;
      return `<label class="check" style="display:flex; margin-bottom:4px; ${off ? 'opacity:.55;' : ''}" ${off ? 'title="Agrega antes una hoja Agrupar"' : ''}><input type="radio" name="origen" value="${k}" ${origen === k ? 'checked' : ''} ${off ? 'disabled' : ''}> ${o.ico} ${o.nombre}</label>`;
    }).join('')}
    ${origen === 'nombres' ? `<label class="lbl">Nombres (uno por línea, o pega una lista)</label>
      <textarea class="input" data-lista style="min-height:120px;" placeholder="Ana&#10;Bruno&#10;Carla">${esc((c.lista || []).join('\n'))}</textarea>
      <p class="hint" data-cuantos></p>` : ''}
    ${origen === 'grupos' ? (agrupar.length > 1 ? fila('De la hoja', `<select class="input" data-hoja-grupos><option value="">La última hoja Agrupar</option>${agrupar.map(({ x, i }) => `<option value="${x.id}" ${c.hoja_grupos === x.id ? 'selected' : ''}>Hoja ${i + 1} · Agrupar</option>`).join('')}</select>`) : '')
      + `<p class="hint">${agrupar.length ? 'En vivo, la ruleta muestra los grupos con sus nombres y colores.' : '⚠️ Para sortear grupos, agrega antes una hoja <b>Agrupar</b>.'}</p>` : ''}
    ${origen === 'participantes' ? '<p class="hint">En vivo, la ruleta muestra a los participantes que se unieron con el PIN.</p>' : ''}
    <label class="lbl">¿Puede repetir?</label>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="repetir" value="no" ${c.repetir ? '' : 'checked'}> No: el elegido sale de la ruleta</label>
    <label class="check" style="display:flex;"><input type="radio" name="repetir" value="si" ${c.repetir ? 'checked' : ''}> Sí: puede volver a salir</label>
    <label class="lbl">Colores de los gajos${origen === 'grupos' ? ' <span style="text-transform:none;">(los grupos usan su color)</span>' : ''}</label>
    <div class="grupo-btn" style="flex-wrap:wrap;">${Object.entries(PALETAS).map(([k, pal]) => `<button class="btn btn-sm ${(c.paleta || 'arcoiris') === k ? 'btn-primary' : 'btn-outline'}" data-paleta="${k}">
      <span class="zr-muestra">${pal.colores.slice(0, 4).map(x => `<i style="background:${x}"></i>`).join('')}</span> ${pal.nombre}</button>`).join('')}</div>
    <div style="margin-top:10px;">${fila('Duración', `<input type="range" min="2" max="12" step="1" data-dur value="${c.duracion ?? 5}"><b data-ver-dur>${c.duracion ?? 5} s</b>`)}</div>
    <label class="check" style="display:flex; margin-top:6px;"><input type="checkbox" data-sonido ${c.sonido === false ? '' : 'checked'}> 🔊 Sonido al girar (en la pantalla)</label>
    <label class="lbl">En el celular del participante</label>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="celr" value="ruleta" ${(c.celular || 'ruleta') === 'ruleta' ? 'checked' : ''}> 🎡 Ve la ruleta girar</label>
    <label class="check" style="display:flex;"><input type="radio" name="celr" value="mirar" ${c.celular === 'mirar' ? 'checked' : ''}> 👀 “Mira la pantalla”</label>
    ${h.diseno.elementos.some(e => e.tipo === 'zona') ? '' : '<button class="btn btn-sm" data-poner-zona style="margin-top:10px;">➕ Volver a poner la ruleta</button>'}
    <p class="hint" style="margin-top:10px;">Pruébala con <b>▶ Presentar → 🎡 GIRAR</b>${origen === 'nombres' ? '' : ' (pulsa antes 🎭 Simular)'}: los sorteos de prueba no se guardan.</p>`;
  p.appendChild(s);
  const cuantos = () => {
    const q = $('[data-cuantos]', s);
    if (!q) return;
    const n = candidatosLocal(h).length;
    q.textContent = n ? `${n} ${n === 1 ? 'nombre' : 'nombres'} en la ruleta (sin repetidos).` : 'Escribe al menos un nombre.';
  };
  cuantos();
  $$('input[name=origen]', s).forEach(r => r.onchange = () => { c.origen = r.value; confirmarCambio(); });
  const lista = $('[data-lista]', s);
  if (lista) {
    const leer = () => lista.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 200);
    lista.oninput = () => { c.lista = leer(); cuantos(); repintarZona(); };
    lista.onchange = () => { c.lista = leer(); confirmarCambio({ repintar: 'nada' }); };
  }
  const hg = $('[data-hoja-grupos]', s);
  if (hg) hg.onchange = () => { c.hoja_grupos = hg.value || null; confirmarCambio({ repintar: 'nada' }); };
  $$('input[name=repetir]', s).forEach(r => r.onchange = () => { c.repetir = r.value === 'si'; confirmarCambio(); });
  $$('[data-paleta]', s).forEach(b => b.onclick = () => { c.paleta = b.dataset.paleta; confirmarCambio(); });
  const dur = $('[data-dur]', s);
  dur.oninput = () => { $('[data-ver-dur]', s).textContent = dur.value + ' s'; };
  dur.onchange = () => { c.duracion = Number(dur.value); confirmarCambio({ repintar: 'nada' }); };
  $('[data-sonido]', s).onchange = (e) => { c.sonido = e.target.checked; confirmarCambio({ repintar: 'nada' }); };
  $$('input[name=celr]', s).forEach(r => r.onchange = () => { c.celular = r.value; confirmarCambio({ repintar: enCelular() ? 'hoja' : 'nada' }); });
  const pz = $('[data-poner-zona]', s);
  if (pz) pz.onclick = () => {
    const nueva = hojaNueva('ruleta').diseno.elementos.find(e => e.tipo === 'zona');
    h.diseno.elementos.push(nueva);
    selId = nueva.id;
    confirmarCambio();
  };
}

function pintarPropsHoja(p) {
  const h = hoja();
  const preg = interactiva(h.tipo);
  const cel = h.config?.celular || 'mirar';
  const els = h.diseno.elementos;
  const tipo = TIPOS_HOJA.find(t => t.k === h.tipo);
  p.innerHTML = `<div class="panel-cab"><b>Hoja ${actual + 1} de ${hojas.length}</b><span class="grow"></span><span class="badge">${tipo?.ico || ''} ${esc(tipo?.txt || h.tipo)}</span></div>`;
  if (esPregunta(h.tipo)) seccionPregunta(p);
  if (h.tipo === 'agrupar') seccionAgrupar(p);
  if (h.tipo === 'ruleta') seccionRuleta(p);
  if (h.diseno.fondo?.tipo === 'imagen') seccionFondoImagen(p);
  p.insertAdjacentHTML('beforeend', `
    ${h.diseno.fondo?.tipo === 'imagen' ? '' : `<h4>Fondo</h4>
    <div class="muestras">${COLORES.slice(0, 10).map(k => `<button class="muestra" data-color="${k}" style="background:${k}" aria-label="Color ${k}"></button>`).join('')}</div>
    <button class="btn btn-sm btn-block" data-mas-fondos style="margin-top:8px;">🎨 Más fondos, degradados, patrones e imagen</button>`}
    ${preg ? '' : `<h4>En vivo, el participante ve en su celular</h4>
    <label class="check" style="display:flex; margin-bottom:6px;"><input type="radio" name="cel" value="mirar" ${cel === 'mirar' ? 'checked' : ''}> 👀 “Mira la pantalla”</label>
    <label class="check" style="display:flex;"><input type="radio" name="cel" value="hoja" ${cel === 'hoja' ? 'checked' : ''}> 🖼 La hoja acomodada al celular</label>`}
    <button class="btn btn-sm btn-ghost" data-ver-cel style="margin-top:4px;">📱 Ver cómo queda en el celular</button>
    <h4>Elementos de la hoja (${els.length})</h4>
    <div class="capas">${els.slice().reverse().map(e => `<button data-elegir="${e.id}">${e.tipo === 'emoji' ? esc(e.emoji || '😀') : ICO_EL[e.tipo] || '•'}
      <span>${esc(e.tipo === 'texto' ? textoDe(e).slice(0, 40) || '(texto vacío)' : NOMBRE_EL[e.tipo])}${e.vinculo ? ' · enunciado' : ''}</span></button>`).join('') || '<p class="hint">La hoja está vacía. Agrega texto, imágenes o iconos desde Recursos.</p>'}</div>
    <div class="atajos"><b>Atajos:</b><br><kbd>Doble clic</kbd> editar texto · <kbd>Supr</kbd> eliminar<br><kbd>Ctrl</kbd>+<kbd>D</kbd> duplicar · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> deshacer/rehacer<br>
      <kbd>Flechas</kbd> mover (<kbd>Shift</kbd> = más) · <kbd>Shift</kbd> al girar = de 15° en 15°<br><kbd>Alt</kbd>+clic elige lo que está debajo<br><kbd>Ctrl</kbd>+<kbd>V</kbd> pegar imagen, texto o enlace de YouTube</div>`);
  $$('[data-color]', p).forEach(b => b.onclick = () => { h.diseno.fondo = { tipo: 'color', valor: b.dataset.color }; confirmarCambio(); if (recurso === 'fondo') pintarIzquierda(); });
  const mf = $('[data-mas-fondos]', p);
  if (mf) mf.onclick = () => { recurso = 'fondo'; pintarIzquierda(); if (esMovil()) alternarPanelMovil('izq'); };
  $$('input[name=cel]', p).forEach(r => r.onchange = () => { h.config = { ...(h.config || {}), celular: r.value }; confirmarCambio({ repintar: enCelular() ? 'hoja' : 'nada' }); });
  $('[data-ver-cel]', p).onclick = () => cambiarVista('celular');
  $$('[data-elegir]', p).forEach(b => b.onclick = () => { if (!editableAqui()) cambiarVista('web'); selId = b.dataset.elegir; pintarSeleccion(); pintarPropiedades(); });
}

// ======================= ARRANQUE =======================
function pantallaError(msg) {
  document.body.className = 'centrado';
  raiz.innerHTML = `<div class="hoja center"><div style="font-size:50px;">⚠️</div><h2 style="margin:8px 0;">No se pudo abrir el proyecto</h2>
    <p class="muted" style="font-weight:700; margin-bottom:14px;">${esc(msg)}</p><a class="btn btn-primary btn-block" href="${VOLVER}">Volver a mis proyectos</a></div>`;
}

perfil = await exigirRol(['profesor', 'admin']);
if (perfil) {
  if (!ID) location.href = VOLVER;
  else {
    try {
      const d = await rpc('proyecto_editor', { p_proyecto: ID });
      proyecto = d.proyecto;
      hojas = d.hojas.map(h => ({ ...h, config: h.config || {}, diseno: { ...(h.diseno || {}), fondo: h.diseno?.fondo || { tipo: 'color', valor: '#FFFFFF' }, elementos: h.diseno?.elementos || [] } }));
      if (!hojas.length) hojas = [hojaNueva()];
      base = proyecto.updated_at;
      if (!proyecto.editable) throw new Error('Tu cuenta no puede modificar este proyecto.');
      montar();
      await revisarSesion();
      if (params.get('presentar')) abrirPresentacion(0);
      else if (params.get('vivo')) iniciarVivo();
    } catch (e) { console.error(e); pantallaError(mensajeError(e)); }
  }
}
