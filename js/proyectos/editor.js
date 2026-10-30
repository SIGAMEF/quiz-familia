// ============================================================
// Proyectos en grupo: editor de hojas (pantalla completa)
// proyectos.html?id=<proyecto>[&volver=admin][&presentar=1]
// Plantillas de culto (una sola hoja, con vista Portada / Con letra):
// proyectos.html?plantilla=<id> (una mía) o ?plantilla=nueva&base=<prediseñada|blanco>[&volver=admin]
// Canciones (cada pantalla de la canción es una hoja; la letra, la plantilla y los resaltados se editan aquí):
// proyectos.html?cancion=<id> o ?cancion=nueva[&volver=admin]
// ============================================================
import { supabase, $, $$, esc, toast, confirmar, abrirModal, mensajeError, exigirRol, copiar, TIPOS } from '../comun.js';
import {
  pintarHoja, pintarHojaMovil, pintarCelular, pintarFondo, repintarElemento, colocar, posMovil, leerVideo, miniaturaVideo, MODOS_FONDO, EFECTOS_TEXTO
} from './lienzo.js';
import {
  FUENTES, COLORES, DEGRADADOS, cssDegradado, PATRONES, estiloFondo, FORMAS, EMOJIS, PLANTILLAS,
  cargarIconos, nodosIcono, ICONOS_ES, ICONOS_POPULARES, colorValido, urlSegura
} from './recursos.js';
import { TIPOS_PREGUNTA, esPregunta, configInicial, huecos, LETRAS, COLORES_OPCION, textoEnunciado, normalizar } from './preguntas.js';
import { presentar } from './presentar.js';
import { crearVivo, borrarFotos, enlaceParticipante } from './vivo-profe.js';
import { configAgruparInicial, resumenReparto } from './agrupar.js';
import { configRuletaInicial, candidatosLocal, PALETAS, ORIGENES } from './ruleta.js';
import { guardarArchivo, medidas, pintarMisArchivos } from './archivos.js';
import { configJuego, infoJuego, UNIDAD, TIEMPOS_JUEGO } from './juego-hoja.js';
import { elegirActividad, TIPOS_JUEGO_CATALOGO, ACTIVIDADES } from '../catalogo.js';
import { abrirEditor } from '../editor-juegos.js';
import { problemas, revisar, necesitaUnirse, esRegistro, agruparAntes, registroAntes, registroDeRuleta } from './revision.js';
import { plantillaIncluida, PLANTILLA_BLANCO, CATEGORIAS } from '../cultos/plantillas.js';
import { datosPlantillas } from '../cultos/datos.js';
import { colorBase, FONDOS, parametros, montarFondoAnimado } from '../cultos/fondos.js';
import { datosCanciones } from '../cultos/datos.js';
import { OPCIONES_DEFECTO, ordenNormal, ubicarResaltados, lineasDeContenido, palabras, etiquetas } from '../cultos/letra.js';
import { hojasDeCancion, plantillaDeCancion, plantillaDe, registrarMisPlantillas, misPlantillas, prepararFuente, pintarPantalla, existePlantilla } from '../cultos/diapositivas.js';
import { PLANTILLAS as PLANTILLAS_CULTO, PLANTILLA_DEFECTO } from '../cultos/plantillas.js';
import { montarPanelLetra } from '../cultos/panel-letra.js';
import { abrirBarraResaltar, cerrarBarraResaltar } from '../cultos/resaltar.js';
import { buscarObjetos, SVG as SVG_OBJ, ANIMACIONES, ANIMACIONES_TEXTO, EMOJIS_LLUVIA, VELOCIDADES } from '../cultos/objetos.js';

const raiz = $('#raiz');
const params = new URLSearchParams(location.search);
const ID = params.get('id');
const MODO_PL = params.has('plantilla');   // editor de una plantilla de culto
const MODO_CAN = params.has('cancion');    // editor de una canción
const VOLVER = (params.get('volver') === 'admin' ? 'admin.html' : 'profesor.html') + (MODO_PL ? '#cultos/plantillas' : MODO_CAN ? '#cultos/canciones' : '#proyectos');
const MAX_VIDEO_MB = 20;

const TIPOS_HOJA = [
  { k: 'contenido', ico: '🖼', txt: 'Contenido' }, { k: 'unirse', ico: '📲', txt: 'Unirse' },
  { k: 'pregunta', ico: '💬', txt: 'Pregunta abierta' }, { k: 'vf', ico: '✔️', txt: 'V / F' },
  { k: 'opcion', ico: '🔘', txt: 'Opción múltiple' }, { k: 'completar', ico: '✏️', txt: 'Completar' },
  { k: 'lluvia', ico: '💭', txt: 'Lluvia de ideas' }, { k: 'agrupar', ico: '👥', txt: 'Agrupar' }, { k: 'ruleta', ico: '🎡', txt: 'Ruleta' }
];
const ICO_HOJA = { ...Object.fromEntries(TIPOS_HOJA.map(t => [t.k, t.ico])), juego: '🎮' };   // las hojas de juego se agregan con "+ Más"
const DISPONIBLES = TIPOS_HOJA.map(t => t.k);
const RECURSOS = [
  ['archivos', '📁', 'Mis archivos'], ['texto', '🔤', 'Texto'], ['fondo', '🎨', 'Fondo'], ['imagen', '🖼', 'Imagen'], ['objetos', '✨', 'Objetos'], ['iconos', '⭐', 'Iconos'],
  ['emojis', '😀', 'Emojis'], ['formas', '🔷', 'Formas'], ['video', '🎬', 'Video'], ['plantillas', '🧩', 'Plantillas']
];
const NOMBRE_EL = { texto: 'Texto', imagen: 'Imagen', icono: 'Icono', emoji: 'Emoji', forma: 'Forma', video: 'Video', zona: 'Área de respuestas', objeto: 'Ilustración', lluvia: 'Lluvia de emojis' };
const ICO_EL = { texto: '🔤', imagen: '🖼', icono: '⭐', forma: '🔷', video: '🎬', zona: '📊', objeto: '✝️', lluvia: '🌧' };
// Plantilla de culto: id guardado (null si todavía es una prediseñada sin guardar), base y categoría
let plantilla = { id: null, base: null, categoria: 'Mis plantillas' };
let verPl = 'portada';       // vista de la plantilla: 'portada' o 'letra'
let animarEd = false;        // ver las animaciones en el editor
const NOMBRE_EN = { portada: 'Solo portada', letra: 'Solo con letra' };
// Canción: los datos, el panel de la letra, la pestaña izquierda y la estrofa elegida
let cancion = null, panelLetra = null, tabIzq = 'letra', bloqueSel = -1, verPlantillas = false;

let perfil, proyecto, hojas = [], actual = 0, selId = null, vista = 'web', recurso = null, editandoTexto = null;
let lienzo = null;          // .lienzo que se edita: el 16:9 en Web o el del celular ajustado a mano
const uid = () => crypto.randomUUID();
const clonar = (o) => JSON.parse(JSON.stringify(o));
const r1 = (n) => Math.round(n * 10) / 10;
const esMovil = () => matchMedia('(max-width: 860px)').matches;
// Hojas con área de respuestas / participantes / ruleta (en el celular se ve un formulario o la ruleta, no la hoja)
const interactiva = (tipo) => esPregunta(tipo) || ['agrupar', 'unirse', 'ruleta', 'juego'].includes(tipo);

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
const ctxHoja = () => ({ hoja: hoja(), ver: MODO_PL ? verPl : null, animar: animarEd });

const hist = { pila: [], pos: -1 };
function foto() { return MODO_CAN ? JSON.stringify(filaCancion()) : JSON.stringify({ nombre: proyecto.nombre, hojas }); }
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
  if (MODO_CAN) {
    Object.assign(cancion, o);
    reconstruir();
    $('[data-nombre]').value = cancion.titulo;
    panelLetra?.refrescar();
    pintarTodo(); pintarBotonesHist(); programarGuardado();
    return;
  }
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
  if (MODO_CAN) sincronizarDetalles();
  if (!registrar()) return;
  programarGuardado();
  if (repintar === 'hoja') { pintarLienzo(); pintarMini(actual); pintarPropiedades(); }
  else if (repintar === 'todo') pintarTodo();
  else if (repintar === 'mini') pintarMini(actual);
  pintarAvisos();   // un cambio en una hoja puede arreglar (o causar) un ⚠ en otra
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
  if (MODO_PL && !plantilla.id) { estado('pendiente', 'Sin guardar'); return; }
  if (MODO_CAN && !cancion.titulo.trim()) { estado('pendiente', '✏️ Escribe el título'); return; }
  estado('pendiente', 'Sin guardar…');
  clearTimeout(tGuardar);
  tGuardar = setTimeout(guardar, 1000);
}
async function guardar() {
  clearTimeout(tGuardar);
  tGuardar = null;
  if (conflicto || !sucio) return;
  if (guardando) { tGuardar = setTimeout(guardar, 400); return; }
  if (MODO_PL && !plantilla.id) return;
  guardando = true; sucio = false;
  estado('guardando', 'Guardando…');
  try {
    if (MODO_CAN) {
      if (!cancion.titulo.trim()) { sucio = true; estado('pendiente', '✏️ Escribe el título'); return; }
      if (cancion.id) await datosCanciones.guardar(cancion.id, filaCancion());
      else {
        const nueva = await datosCanciones.crear({ ...filaCancion(), profesor_id: perfil.id });
        cancion.id = nueva.id;
        const u = new URLSearchParams(location.search);
        u.set('cancion', nueva.id);
        history.replaceState(null, '', '?' + u.toString());
      }
      if (!sucio) estado('ok', 'Guardado ✓');
      return;
    }
    if (MODO_PL) {
      const r = await datosPlantillas.guardar(plantilla.id, filaPlantilla());
      base = r.updated_at;
      avisarPlantilla('cambio', r.id);
      if (!sucio) estado('ok', 'Guardado ✓');
      return;
    }
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
function hojaNueva(tipo = 'contenido', cfgJuego = null) {
  const ref = hojas[actual] || hojas[hojas.length - 1];   // toma el estilo de la hoja actual
  const tit = ref?.diseno.elementos.find(e => e.tipo === 'texto');
  const fondo = ref ? clonar(ref.diseno.fondo) : { tipo: 'color', valor: '#FFFFFF' };
  // conserva el color del título anterior solo si se sigue leyendo sobre el fondo (uno claro y el otro oscuro)
  const color = tit && oscuro({ tipo: 'color', valor: tit.color }) !== oscuro(fondo) ? tit.color : oscuro(fondo) ? '#FFFFFF' : '#2D2A45';
  const titulo = { id: uid(), tipo: 'texto', texto: 'Escribe un título', x: 8, y: 8, w: 84, h: 16, rot: 0,
    fuente: tit?.fuente || 'Baloo 2', tam: 5, color, alinear: 'center', negrita: true };
  if (tipo === 'unirse') {
    return { id: uid(), tipo, config: {}, diseno: { fondo, elementos: [
      { ...titulo, texto: '¡Únete desde tu celular!', y: 4, h: 14 },
      { id: uid(), tipo: 'zona', x: 4, y: 21, w: 92, h: 75, rot: 0 }
    ] } };
  }
  if (tipo === 'juego') {
    return { id: uid(), tipo, config: cfgJuego, diseno: { fondo, elementos: [
      { ...titulo, texto: cfgJuego.juego.titulo, y: 3, h: 13 },
      { id: uid(), tipo: 'zona', x: 6, y: 18, w: 88, h: 78, rot: 0 }
    ] } };
  }
  if (tipo === 'ruleta') {
    // si ya hay grupos antes, la ruleta sortea entre ellos
    const config = configRuletaInicial();
    if (agruparAntes(hojas, actual + 1).length) config.origen = 'grupos';   // la nueva va después de la actual
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
// Inserta hojas justo después de la hoja actual y deja seleccionada la primera nueva
function insertarHojas(nuevas, pos = actual + 1) {
  hojas.splice(pos, 0, ...nuevas);
  actual = pos; selId = null; pestanaDer = 'tipo';
  confirmarCambio({ repintar: 'todo' });
  $(`.mini-hoja[data-i="${actual}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}
function agregarHoja(tipo) {
  terminarEdicionTexto();
  insertarHojas([hojaNueva(tipo)]);
  if (esPregunta(tipo)) enfocarEnunciado();
  ofrecerUnirse();
}

// La primera hoja interactiva sin una hoja Unirse o Agrupar antes: se ofrece agregarla
let noOfrecerUnirse = false;
async function ofrecerUnirse() {
  const h = hojas[actual];
  if (noOfrecerUnirse || !necesitaUnirse(h) || hojas.slice(0, actual).some(esRegistro)) return;
  const si = await new Promise(ok => {
    let r = false;
    const m = abrirModal(`<h3>📲 ¿Agrego una hoja Unirse?</h3>
      <p style="font-weight:600;">Para que los participantes respondan, primero deben unirse. ¿Agrego una hoja <b>📲 Unirse</b> antes de esta?</p>
      <p class="hint">Muestra el QR grande, el enlace y el PIN, y los participantes aparecen en vivo. Una hoja Agrupar también sirve.</p>
      <div class="modal-pie"><button class="btn btn-outline" data-no>Lo haré después</button><button class="btn btn-primary" data-si>Sí, agregar</button></div>`,
      { alCerrar: () => ok(r) });
    m.el.querySelector('[data-no]').onclick = () => m.cerrar();
    m.el.querySelector('[data-si]').onclick = () => { r = true; m.cerrar(); };
  });
  if (!si) { noOfrecerUnirse = true; return; }   // ya no se vuelve a preguntar; queda el ⚠ en la miniatura
  ponerRegistroAntes('unirse', actual);
  toast('Hoja 📲 Unirse agregada antes');
}
// Agrega una hoja Unirse o Agrupar en la posición "en" y sigue en la misma hoja que se estaba editando
function ponerRegistroAntes(tipo, en) {
  const h = hojaNueva(tipo);
  hojas.splice(en, 0, h);
  if (actual >= en) actual++;
  selId = null;
  confirmarCambio({ repintar: 'todo' });
  return h;
}
// Cursor en el enunciado (o la frase de "Completar"), con el texto de ejemplo elegido para escribir encima
function enfocarEnunciado() {
  const t = $('[data-der] [data-cfg="enunciado"], [data-der] [data-cfg="frase"]');
  if (!t) return;
  t.focus({ preventScroll: false });
  t.select();
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
  const [quitada] = hojas.splice(i, 1);
  const eraActual = actual;
  actual = Math.min(actual >= i ? Math.max(0, actual - 1) : actual, hojas.length - 1);
  selId = null;
  confirmarCambio({ repintar: 'todo' });
  avisoDeshacer(`Hoja ${i + 1} eliminada`, () => {
    hojas.splice(Math.min(i, hojas.length), 0, quitada);
    actual = hojas.indexOf(quitada); selId = null;
    confirmarCambio({ repintar: 'todo' });
  });
  if (eraActual === i) $('.mini-hoja.activa')?.focus();
}
// Aviso abajo con "Deshacer" durante 6 segundos
function avisoDeshacer(texto, alDeshacer) {
  let cont = document.querySelector('.toasts');
  if (!cont) { cont = document.createElement('div'); cont.className = 'toasts'; document.body.appendChild(cont); }
  cont.querySelector('.toast-deshacer')?.remove();
  const t = document.createElement('div');
  t.className = 'toast toast-deshacer';
  t.innerHTML = `<span>🗑 ${esc(texto)}</span><button>Deshacer</button>`;
  const quitar = () => { clearTimeout(t._t); t.style.opacity = '0'; setTimeout(() => t.remove(), 300); };
  t.querySelector('button').onclick = () => { quitar(); alDeshacer(); };
  cont.appendChild(t);
  t._t = setTimeout(quitar, 6000);
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
  if (MODO_CAN && !hoja()?.info) return toast('Primero pega la letra: los detalles se agregan a una pantalla de la canción', 'error');
  if (!editableAqui()) cambiarVista('web');
  el.id = uid();
  el.rot = el.rot || 0;
  if (MODO_PL && el.tipo === 'texto' && !el.en) el.en = verPl;   // un texto nuevo es de la vista que se está editando
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
  if (f?.tipo === 'animado') f = { tipo: 'color', valor: colorBase(f) };
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
// Sube a "Mis archivos" (o reutiliza el mismo archivo si ya estaba). Devuelve el archivo registrado.
async function subirArchivo(original, blob, ext, tipo, extra = {}) {
  const r = await guardarArchivo({ profesorId: perfil.id, original, blob, tipo, ext, nombre: original.name || (tipo === 'video' ? 'Video' : 'Imagen pegada'), ...extra });
  if (r.reutilizado) toast(`Ya tenías ${tipo === 'video' ? 'este video' : 'esta imagen'} en Mis archivos: se reutilizó`);
  return r.archivo;
}
const FONDO_IMAGEN = { tipo: 'imagen', modo: 'cubrir', zoom: 100, px: 50, py: 50, opacidad: 1, oscurecer: 0, desenfoque: 0, color: '#2D2A45' };
// La imagen se agrega como elemento nuevo, como fondo de la hoja o reemplaza la de un elemento
// Reduce y sube una imagen a Mis archivos (o reutiliza la que ya estaba). Devuelve el archivo registrado.
async function imagenAArchivo(archivo, maxLado = 1600) {
  if (!archivo?.type?.startsWith('image/') || archivo.type === 'image/svg+xml') throw new Error('Elige una imagen JPG, PNG, WebP o GIF');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 15 MB');
  const f = await comprimir(archivo, maxLado);
  const tipo = f.type || 'image/jpeg';
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }[tipo] || 'jpg';
  const bmp = await createImageBitmap(f).catch(() => null);
  return subirArchivo(archivo, f, ext, 'imagen', { ancho: bmp?.width ?? null, alto: bmp?.height ?? null });
}
async function subirImagen(archivo, { comoFondo = false, reemplazar = null } = {}) {
  estado('guardando', 'Subiendo imagen…');
  try { ponerImagen(await imagenAArchivo(archivo), { comoFondo, reemplazar }); }
  catch (e) { toast('No se pudo subir la imagen: ' + mensajeError(e), 'error'); }
  finally { if (!sucio && !guardando) estado('ok', 'Guardado ✓'); }
}
async function subirVideo(archivo) {
  if (!/^video\/(mp4|webm)$/.test(archivo?.type || '')) return toast('El video debe ser MP4 o WebM', 'error');
  if (archivo.size > MAX_VIDEO_MB * 1024 * 1024) return toast(`El video debe pesar menos de ${MAX_VIDEO_MB} MB. Para videos más grandes usa un enlace de YouTube.`, 'error');
  estado('guardando', 'Subiendo video…');
  try {
    const a = await subirArchivo(archivo, archivo, archivo.type === 'video/webm' ? 'webm' : 'mp4', 'video');
    ponerArchivo(a);
  } catch (e) { toast('No se pudo subir el video: ' + mensajeError(e), 'error'); }
  finally { if (!sucio && !guardando) estado('ok', 'Guardado ✓'); }
}

// Una imagen de Mis archivos (o recién subida) como elemento nuevo, como fondo o en lugar de la de un elemento
async function ponerImagen(a, { comoFondo = false, reemplazar = null } = {}) {
  const m = await medidas(a);
  if (comoFondo) {
    const previo = hoja().diseno.fondo?.tipo === 'imagen' ? hoja().diseno.fondo : {};
    hoja().diseno.fondo = { ...FONDO_IMAGEN, ...previo, valor: a.url, nat: m.ancho ? [m.ancho, m.alto] : null };
    confirmarCambio();
    if (recurso === 'fondo') pintarIzquierda();
  } else if (reemplazar) {
    reemplazar.url = a.url;
    confirmarCambio();
  } else {
    agregarElemento({ tipo: 'imagen', url: a.url, ajuste: 'cover', radio: 0, ...tamProporcional(m.ancho ? m.ancho / m.alto : 4 / 3, 40) });
  }
}
// Insertar un archivo de Mis archivos en la hoja
async function ponerArchivo(a) {
  if (a.tipo !== 'video') return ponerImagen(a);
  const m = await medidas(a);
  agregarElemento({ tipo: 'video', fuente: 'mp4', url: a.url, ...tamProporcional(m.ancho ? m.ancho / m.alto : 16 / 9, 60) });
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
  if (MODO_PL) return montarPlantilla();
  if (MODO_CAN) return montarCancion();
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

// ---------- Plantilla de culto ----------
function montarPlantilla() {
  document.title = `${proyecto.nombre} · Plantilla de culto`;
  document.body.className = 'editor-proyectos';
  raiz.innerHTML = `<div class="ed ed-plantilla">
    <header class="ed-top">
      <a class="btn btn-sm btn-outline" href="${VOLVER}" title="Volver a las plantillas">←<span class="ocultar-movil"> Plantillas</span></a>
      <input class="ed-nombre" data-nombre maxlength="80" aria-label="Nombre de la plantilla">
      <span class="ed-estado ok" data-estado></span>
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-deshacer title="Deshacer (Ctrl+Z)" aria-label="Deshacer">↶</button>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-rehacer title="Rehacer (Ctrl+Y)" aria-label="Rehacer">↷</button>
      <div class="pestanas ed-vistas"><button data-ver-pl="portada" title="Títulos y avisos">🏷<span class="ocultar-movil"> Portada</span></button><button data-ver-pl="letra" title="Así se verán las canciones">🎵<span class="ocultar-movil"> Con letra</span></button></div>
      <button class="btn btn-sm btn-outline" data-animar title="Ver las animaciones (al editar están quietas)">▶<span class="ocultar-movil"> Animar</span></button>
      <button class="btn btn-primary btn-sm" data-guardar-como title="Guarda una copia en tus plantillas">💾<span class="ocultar-movil"> Guardar como mi plantilla</span></button>
    </header>
    <aside class="ed-izq" data-izq></aside>
    <main class="ed-centro"><div class="escenario" data-escenario></div></main>
    <aside class="ed-der" data-der></aside>
    <nav class="ed-tabs">
      <button data-tab="izq"><span>➕</span>Agregar</button>
      <button data-tab="der"><span>🎛</span>Propiedades</button>
      <button data-deshacer2><span>↶</span>Deshacer</button>
    </nav>
  </div>`;
  const nom = $('[data-nombre]');
  nom.value = proyecto.nombre;
  nom.oninput = () => { proyecto.nombre = nom.value.trim() || proyecto.nombre; document.title = `${proyecto.nombre} · Plantilla de culto`; programarGuardado(); };
  nom.onchange = () => { nom.value = proyecto.nombre; registrar(); };
  nom.onkeydown = (e) => { if (e.key === 'Enter') nom.blur(); };
  $('[data-deshacer]').onclick = () => moverHist(-1);
  $('[data-rehacer]').onclick = () => moverHist(1);
  $('[data-deshacer2]').onclick = () => moverHist(-1);
  $$('[data-ver-pl]').forEach(b => b.onclick = () => cambiarVerPl(b.dataset.verPl));
  $('[data-animar]').onclick = () => { animarEd = !animarEd; $('[data-animar]').classList.toggle('activo', animarEd); if (animarEd) { selId = null; } pintarLienzo(); pintarPropiedades(); };
  $('[data-guardar-como]').onclick = guardarComo;
  $('[data-estado]').onclick = () => { if (!conflicto && sucio) guardar(); };
  $$('[data-tab]').forEach(b => b.onclick = () => alternarPanelMovil(b.dataset.tab));
  estado(plantilla.id ? 'ok' : 'pendiente', plantilla.id ? 'Guardado ✓' : 'Prediseñada');
  if (!plantilla.id) $('[data-estado]').title = 'Tus cambios se guardan con “Guardar como mi plantilla”';
  conectarLienzo();
  conectarTeclado();
  conectarSoltarArchivos();
  cambiarVerPl(verPl);
  pintarIzquierda();
  registrar();
}
function cambiarVerPl(v) {
  terminarEdicionTexto();
  verPl = v;
  const el = elSel();
  if (el && el.en && el.en !== v) selId = null;   // lo elegido no se ve en esta vista
  $$('[data-ver-pl]').forEach(b => b.classList.toggle('activo', b.dataset.verPl === v));
  pintarLienzo(); pintarPropiedades();
}
const filaPlantilla = () => ({ nombre: proyecto.nombre.slice(0, 80), categoria: plantilla.categoria, base: plantilla.base,
  diseno: { fondo: hoja().diseno.fondo, elementos: hoja().diseno.elementos } });
// Avisa a las otras pestañas (el editor de un culto abierto) que una plantilla se guardó: { t: 'nueva' | 'cambio', id }
function avisarPlantilla(t, id) {
  try { const bc = new BroadcastChannel('cultos-plantillas'); bc.postMessage({ t, id }); bc.close(); } catch { /* navegador sin BroadcastChannel */ }
}
// Guarda la plantilla como una nueva en "Mis plantillas" (la primera vez, o una copia si ya era mía)
async function guardarComo() {
  terminarEdicionTexto();
  const yaMia = !!plantilla.id;
  const r = await new Promise(ok => {
    let respondido = false;
    const cats = [...new Set(['Mis plantillas', ...CATEGORIAS, plantilla.categoria])];
    const m = abrirModal(`<h3>💾 Guardar como mi plantilla</h3>
      <p class="hint">${yaMia ? 'Se guarda una copia nueva; esta plantilla queda como estaba.' : 'Queda en tus plantillas con todos tus cambios. La prediseñada no cambia.'}</p>
      <form><label class="lbl">Nombre</label><input class="input" name="nombre" maxlength="80" required value="${esc(proyecto.nombre + (yaMia ? ' (copia)' : ''))}">
      <label class="lbl">Categoría</label><select class="input" name="cat">${cats.map(c => `<option ${c === plantilla.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <div class="modal-pie"><button type="button" class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary">Guardar</button></div></form>`,
      { alCerrar: () => { if (!respondido) ok(null); } });
    $('[data-no]', m.el).onclick = () => m.cerrar();
    $('form', m.el).onsubmit = (e) => {
      e.preventDefault();
      const nombre = $('[name=nombre]', m.el).value.trim();
      if (!nombre) return;
      respondido = true; ok({ nombre, categoria: $('[name=cat]', m.el).value }); m.cerrar();
    };
  });
  if (!r) return;
  estado('guardando', 'Guardando…');
  try {
    const nueva = await datosPlantillas.crear({ ...filaPlantilla(), nombre: r.nombre, categoria: r.categoria, profesor_id: perfil.id });
    plantilla = { id: nueva.id, base: nueva.base, categoria: nueva.categoria };
    proyecto.nombre = nueva.nombre;
    $('[data-nombre]').value = nueva.nombre;
    base = nueva.updated_at; sucio = false;
    const u = new URLSearchParams(location.search);
    u.set('plantilla', nueva.id); u.delete('base');
    history.replaceState(null, '', '?' + u.toString());
    estado('ok', 'Guardado ✓');
    toast(yaMia ? 'Copia guardada en tus plantillas' : 'Guardada en tus plantillas');
    avisarPlantilla('nueva', nueva.id);
    pintarPropiedades();
  } catch (e) { estado('error', '⚠️ No se guardó'); toast(mensajeError(e), 'error'); }
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
    <span class="row" style="gap:6px;"><button class="btn btn-sm btn-primary" data-continuar>Continuar</button>
    <button class="btn btn-sm btn-outline" data-copiar-enlace title="Copiar el enlace para entrar desde una computadora o compartirlo por chat">🔗 Copiar enlace</button><button class="btn btn-sm btn-outline" data-reiniciar>Reiniciar</button>
    <button class="btn btn-sm btn-ghost" data-finalizar title="Cerrar la sesión: el PIN deja de funcionar">Finalizar</button></span>`;
  $('[data-continuar]', b).onclick = iniciarVivo;
  $('[data-copiar-enlace]', b).onclick = () => copiar(enlaceParticipante(s.pin));
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
    try { const r = await rpc('proyecto_finalizar', { p_sesion: s.id }); await borrarFotos(r.fotos); toast('Sesión finalizada'); } catch (e) { toast(mensajeError(e), 'error'); }
    revisarSesion();
  };
}
// Arregla un problema de la revisión. Devuelve false si hay que hacerlo a mano (se abre la hoja).
function arreglar(i, x) {
  const a = x.arreglo, h = hojas[i];
  if (!a) { irAHoja(i); pestanaDer = 'tipo'; pintarPropiedades(); return false; }
  if (a.tipo === 'unirse' || a.tipo === 'agrupar') ponerRegistroAntes(a.tipo, a.en);
  else if (a.tipo === 'grupos') { h.config.hoja_grupos = a.id; confirmarCambio({ repintar: 'todo' }); }
  else if (a.tipo === 'zona') {
    const z = hojaNueva(h.tipo === 'juego' ? 'juego' : h.tipo, h.tipo === 'juego' ? h.config : null).diseno.elementos.find(e => e.tipo === 'zona');
    h.diseno.elementos.push(z); confirmarCambio({ repintar: 'todo' });
  }
  return true;
}
const ETIQUETA_ARREGLO = { unirse: '➕ Agregar hoja 📲 Unirse', agrupar: '➕ Agregar hoja 👥 Agrupar antes', grupos: '✔ Usar esos grupos', zona: '➕ Volver a poner el área' };

// Antes de iniciar en vivo: si hay ⚠, la lista con botones para corregir. Devuelve true para iniciar.
function revisarAntesDeVivo() {
  if (!revisar(hojas).length) return Promise.resolve(true);
  return new Promise(ok => {
    let iniciar = false;
    const m = abrirModal('<div data-c></div>', { ancho: true, alCerrar: () => ok(iniciar) });
    const c = $('[data-c]', m.el);
    const pintarLista = () => {
      const lista = revisar(hojas);
      if (!lista.length) {
        c.innerHTML = `<h3>✅ ¡Todo listo!</h3><p style="font-weight:600;">Ya no hay avisos en el proyecto.</p>
          <div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-iniciar>📡 Iniciar en vivo</button></div>`;
      } else {
        const auto = lista.some(x => x.lista.some(p => p.arreglo));
        c.innerHTML = `<h3>⚠ Antes de iniciar en vivo</h3><p class="sub">Estas hojas necesitan algo. Corrígelas con un clic o ve a la hoja.</p>
          <div class="stack rev-lista">${lista.map(x => x.lista.map((p, k) => `<div class="rev-item"><span class="rev-hoja">Hoja ${x.i + 1}</span><span class="grow">${esc(p.txt)}</span>
            <button class="btn btn-sm ${p.arreglo ? 'btn-primary' : ''}" data-arr="${x.i}:${k}">${p.arreglo ? ETIQUETA_ARREGLO[p.arreglo.tipo] : '✏️ Ir a la hoja'}</button></div>`).join('')).join('')}</div>
          <div class="modal-pie" style="flex-wrap:wrap;">${auto ? '<button class="btn btn-green" data-todo>🪄 Corregir todo lo automático</button>' : ''}<span class="grow"></span>
            <button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-amber" data-iniciar>Iniciar de todos modos</button></div>`;
      }
      $$('[data-arr]', c).forEach(b => b.onclick = () => {
        const [i, k] = b.dataset.arr.split(':').map(Number);
        if (arreglar(i, problemas(hojas, i)[k])) pintarLista(); else m.cerrar();
      });
      const todo = $('[data-todo]', c);
      if (todo) todo.onclick = () => {
        // de a uno, porque cada arreglo puede resolver otros (una hoja Unirse sirve para todas las que siguen)
        for (let n = 0; n < 50; n++) {
          const x = revisar(hojas).flatMap(r => problemas(hojas, r.i).map(p => ({ i: r.i, p }))).find(y => y.p.arreglo);
          if (!x) break;
          arreglar(x.i, x.p);
        }
        pintarLista();
      };
      $('[data-iniciar]', c).onclick = () => { iniciar = true; m.cerrar(); };
      $$('[data-cerrar]', c).forEach(b => b.onclick = () => m.cerrar());
    };
    pintarLista();
  });
}

// Inicia la sesión en vivo (o continúa la que está abierta) y abre la presentación con el control del profesor
async function iniciarVivo() {
  terminarEdicionTexto();
  if (!await revisarAntesDeVivo()) return;
  if (sucio || guardando) {
    await guardar();
    for (let k = 0; k < 40 && (sucio || guardando); k++) await new Promise(r => setTimeout(r, 150));
    if (sucio) return toast('Primero hay que guardar el proyecto. Revisa tu conexión.', 'error');
  }
  let s;
  try { s = await rpc('proyecto_iniciar_sesion', { p_proyecto: ID }); if (s.fotos_viejas?.length) borrarFotos(s.fotos_viejas); }
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
    lienzo = pintarHoja(marco, hoja(), { modo: 'editor', ...(MODO_PL ? { ver: verPl } : {}), animar: animarEd, marcar: MODO_CAN });
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
    aviso.innerHTML = h.tipo === 'unirse' ? `<div class="cel-aviso-ico">📲</div><h3>Así se une el participante</h3>
      <p>Escanea el QR o entra con el PIN, escribe su nombre, un alias opcional y elige un avatar o sube una foto. Después ve “¡Ya estás registrado!” hasta que empiece la actividad.</p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>` : h.tipo === 'juego' ? `<div class="cel-aviso-ico">${infoJuego(h.config.juego?.tipo).ico}</div><h3>Cada participante juega en su celular</h3>
      <p>Mientras esperan ven esta pantalla. Cuando pulsas <b>▶ Empezar juego</b>, todos empiezan a la vez con el mismo cronómetro y la pantalla muestra el ranking en vivo.</p>
      <button class="btn btn-primary btn-block" data-editar-web>✏️ Editar en Web</button>` : h.tipo === 'ruleta' ? `<div class="cel-aviso-ico">🎡</div><h3>${ruletaCel ? 'El participante ve la ruleta' : 'El participante mira la pantalla'}</h3>
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
    // canción: en la letra se eligen palabras (para resaltarlas), no se mueve nada
    if (MODO_CAN && e.target.closest('.pe[data-vinculo="letra"]') && lienzo.contains(e.target)) {
      if (selId) { selId = null; pintarSeleccion(); pintarPropiedades(); }
      return;
    }
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
    let nodo = e.target.closest('.pe:not(.bloq)');
    terminarEdicionTexto();
    // Alt+clic: elige el elemento que está debajo del elegido
    if (nodo && !asa && e.altKey) {
      const pila = [...new Set(document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest('.pe:not(.bloq)')).filter(n => n && lienzo.contains(n)))];
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
    const nodo = e.target.closest('.pe-texto:not(.bloq)');
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
  const fija = ['emoji', 'icono', 'imagen', 'objeto'].includes(el.tipo) !== shift;   // Shift invierte la proporción fija
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
const textoDe = (el) => el.vinculo === 'enunciado' ? (hoja().tipo === 'completar' ? hoja().config.frase || '' : hoja().config.enunciado || '')
  : el.vinculo === 'letra' ? 'Aquí va la letra (o el versículo)' : el.vinculo === 'pie' ? 'Título · Estrofa' : el.texto || '';
function ponerTexto(el, t) {
  if (el.vinculo === 'letra' || el.vinculo === 'pie') return;   // lo pone la canción
  if (el.vinculo !== 'enunciado') { el.texto = t; return; }
  if (hoja().tipo === 'completar') hoja().config.frase = t; else hoja().config.enunciado = t;
}

function editarTexto(id) {
  const el = hoja().diseno.elementos.find(e => e.id === id);
  if (el?.vinculo === 'letra' || el?.vinculo === 'pie') return toast('Aquí va la letra de cada canción: cambia su fuente, color y tamaño en el panel de la derecha');
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
  const sirve = (e) => e.dataTransfer?.types?.includes('Files') || e.dataTransfer?.types?.includes('text/x-archivo');
  escn.addEventListener('dragenter', (e) => { if (sirve(e)) { n++; marca(true); e.preventDefault(); } });
  escn.addEventListener('dragover', (e) => { if (sirve(e)) e.preventDefault(); });
  escn.addEventListener('dragleave', () => { if (--n <= 0) { n = 0; marca(false); } });
  escn.addEventListener('drop', (e) => {
    n = 0; marca(false);
    const deMisArchivos = e.dataTransfer?.getData('text/x-archivo');
    if (deMisArchivos) {
      e.preventDefault();
      try { ponerArchivo(JSON.parse(deMisArchivos)); } catch { /* no era un archivo */ }
      return;
    }
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
  if (!tira) return;   // la plantilla de culto tiene una sola hoja
  if (MODO_CAN) return pintarTiraCancion(tira);
  tira.innerHTML = hojas.map((h, i) => `<div class="mini-hoja ${i === actual ? 'activa' : ''}" draggable="true" data-i="${i}" role="button" tabindex="0"
      aria-label="Hoja ${i + 1}"><span class="num">${i + 1}${h.tipo !== 'contenido' ? ' ' + (ICO_HOJA[h.tipo] || '') : ''}</span><span class="mini-aviso" data-aviso hidden>⚠</span>
      <span class="mini-acc"><button data-dup-h title="Duplicar hoja" aria-label="Duplicar la hoja ${i + 1}">⧉</button><button data-del-h title="Eliminar hoja (Supr)" aria-label="Eliminar la hoja ${i + 1}">🗑</button></span>
      <button class="mas-op" data-op="${i}" title="Opciones de la hoja" aria-label="Opciones de la hoja ${i + 1}">⋯</button><div data-mini></div></div>`).join('') +
    '<button class="mini-agregar" data-agregar title="Agregar hoja de contenido" aria-label="Agregar hoja">+</button>';
  hojas.forEach((_, i) => pintarMini(i));
  $$('.mini-hoja', tira).forEach(m => {
    const i = +m.dataset.i;
    m.onclick = (e) => {
      if (e.target.closest('[data-del-h]')) return eliminarHoja(i);
      if (e.target.closest('[data-dup-h]')) return duplicarHoja(i);
      if (!e.target.closest('[data-op]')) { irAHoja(i); $(`.mini-hoja[data-i="${i}"]`)?.focus(); }
    };
    m.onkeydown = (e) => {
      if (e.target !== m) return;
      if (e.key === 'Enter') irAHoja(i);
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); eliminarHoja(i); }
    };
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
  pintarAvisos();
}
// ⚠ en las miniaturas de las hojas a las que les falta algo (el detalle, al pasar el mouse)
function pintarAvisos() {
  if (MODO_CAN) return;   // las pantallas de una canción tienen su propio aviso (texto muy largo)
  $$('.mini-hoja').forEach(m => {
    const av = problemas(hojas, +m.dataset.i), b = $('[data-aviso]', m);
    if (!b) return;
    b.hidden = !av.length;
    b.title = av.map(x => '⚠ ' + x.txt).join('\n');
    m.classList.toggle('con-aviso', av.length > 0);
  });
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
  if (MODO_CAN) return pintarIzquierdaCancion(p);
  if (!recurso && MODO_PL) {
    p.innerHTML = `<h4>Recursos</h4>
      <div class="recursos">${RECURSOS.filter(r => r[0] !== 'plantillas').map(([k, ico, txt]) => `<button class="recurso" data-rec="${k}"><span>${ico}</span>${txt}</button>`).join('')}</div>
      <p class="hint" style="margin-top:14px;">Todo se puede mover, cambiar y borrar. En <b>🏷 Portada</b> van los títulos y avisos; en <b>🎵 Con letra</b>, cómo se verán las canciones (la zona punteada es la letra).</p>
      <p class="hint">También puedes <b>pegar</b> (Ctrl+V) o <b>arrastrar</b> una imagen sobre la plantilla.</p>`;
    $$('[data-rec]', p).forEach(b => b.onclick = () => { recurso = b.dataset.rec; pintarIzquierda(); });
    return;
  }
  if (!recurso) {
    p.innerHTML = `<h4>Agregar hoja</h4>
      <div class="tipos-hoja">${TIPOS_HOJA.map(t => {
        const ok = DISPONIBLES.includes(t.k);
        return `<button class="tipo-hoja" data-tipo="${t.k}" ${ok ? '' : 'disabled title="Disponible en una próxima fase"'}><span>${t.ico}</span><span>${t.txt}${ok ? '' : '<small>Próximamente</small>'}</span></button>`;
      }).join('')}</div>
      <button class="tipo-hoja tipo-mas" data-mas title="Sopa de letras, ahorcado, memorama, rompecabezas, trivia… de Mis actividades"><span>➕</span><span>Más: juegos<small>Sopa, ahorcado, memorama…</small></span></button>
      <button class="btn btn-sm btn-block btn-outline" data-importar style="margin-top:8px;">📥 Traer preguntas de mis quizzes</button>
      <h4>Recursos</h4>
      <div class="recursos">${RECURSOS.map(([k, ico, txt]) => `<button class="recurso" data-rec="${k}"><span>${ico}</span>${txt}</button>`).join('')}</div>
      <p class="hint" style="margin-top:14px;">También puedes <b>pegar</b> (Ctrl+V) o <b>arrastrar</b> una imagen sobre la hoja.</p>`;
    $$('[data-tipo]', p).forEach(b => b.onclick = () => {
      cerrarPanelMovil();
      agregarHoja(b.dataset.tipo);
      if (esPregunta(b.dataset.tipo) && esMovil()) { alternarPanelMovil('der'); enfocarEnunciado(); }   // en el celular se abre el panel de la pregunta
    });
    $('[data-importar]', p).onclick = () => { cerrarPanelMovil(); importarDeQuizzes(); };
    $('[data-mas]', p).onclick = () => { cerrarPanelMovil(); agregarHojaJuego(); };
    $$('[data-rec]', p).forEach(b => b.onclick = () => { recurso = b.dataset.rec; pintarIzquierda(); });
    return;
  }
  const [, ico, txt] = RECURSOS.find(r => r[0] === recurso);
  p.innerHTML = `<div class="panel-cab"><button class="btn btn-sm btn-ghost btn-icon" data-atras aria-label="Volver a recursos">←</button><b>${ico} ${txt}</b></div><div data-cuerpo></div>`;
  $('[data-atras]', p).onclick = () => { recurso = null; pintarIzquierda(); };
  PANELES[recurso]($('[data-cuerpo]', p));
}

const PANELES = {
  archivos(c) {
    pintarMisArchivos(c, {
      alInsertar: (a) => { ponerArchivo(a); cerrarPanelMovil(); },
      alFondo: (a) => { ponerImagen(a, { comoFondo: true }); cerrarPanelMovil(); },
      // para saber dónde se usa un archivo, primero se guarda lo que esté pendiente
      antesDeUsos: async () => {
        if (sucio || guardando) await guardar();
        for (let k = 0; k < 40 && (sucio || guardando); k++) await new Promise(r => setTimeout(r, 150));
      }
    });
  },

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
    const pa = f.tipo === 'animado' ? parametros(f) : null;
    c.innerHTML = `<h4>✨ Animados</h4><div class="fondos-anim" data-anim></div>
      ${pa ? `<p class="hint" style="margin:8px 0 4px;">Colores de “${esc(FONDOS[f.valor]?.nombre || '')}”</p>
        <div class="colores-fondo"><span class="small muted">Fondo</span>${pa.base.map((k, i) => `<input type="color" data-fa="base:${i}" value="${k}" aria-label="Fondo ${i + 1}">`).join('')}</div>
        <div class="colores-fondo" style="margin-top:4px;"><span class="small muted">Luces</span>${pa.colores.map((k, i) => `<input type="color" data-fa="colores:${i}" value="${k}" aria-label="Luz ${i + 1}">`).join('')}</div>
        <button class="btn btn-sm btn-ghost" data-fa-reset>↺ Colores originales</button>
        <p class="hint">Se mueven solos; se detienen cuando no se ven y si el equipo pide menos movimiento.</p>` : ''}
      <h4>Color</h4><div class="muestras">${COLORES.map(k => `<button class="muestra ${f.tipo === 'color' && f.valor === k ? 'sel' : ''}" data-color="${k}" style="background:${k}" aria-label="Color ${k}"></button>`).join('')}</div>
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
    const anim = $('[data-anim]', c);
    for (const [k, F] of Object.entries(FONDOS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.title = F.nombre; b.className = f.tipo === 'animado' && f.valor === k ? 'sel' : '';
      b.innerHTML = `<div class="fondo-capa"></div><span>${esc(F.nombre)}</span>`;
      montarFondoAnimado($('.fondo-capa', b), { tipo: 'animado', valor: k }, { calidad: 'baja' });
      b.onclick = () => poner({ tipo: 'animado', valor: k });
      anim.appendChild(b);
    }
    $$('[data-fa]', c).forEach(inp => {
      const [lista, i] = inp.dataset.fa.split(':');
      const aplicar = () => { const fa = hoja().diseno.fondo; const q = parametros(fa); fa.p = { ...(fa.p || {}), base: q.base, colores: q.colores }; fa.p[lista][Number(i)] = inp.value; };
      inp.oninput = () => { aplicar(); refrescarFondo(); };
      inp.onchange = () => { aplicar(); confirmarCambio({ repintar: 'mini' }); };
    });
    const fr = $('[data-fa-reset]', c);
    if (fr) fr.onclick = () => { delete hoja().diseno.fondo.p; confirmarCambio(); PANELES.fondo(c); };
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

  objetos(c) {
    let cat = 'ilustracion', q = '';
    const lluvia = new Set(['🔥', '🙌', '✨']);
    c.innerHTML = `<div class="pestanas" style="margin-bottom:8px;"><button data-oc="ilustracion" class="activo">Ilustraciones</button><button data-oc="emoji">Emojis</button><button data-oc="frase">Frases</button></div>
      <input class="input" data-buscar placeholder="🔍 Buscar (cruz, fuego, búsqueda…)">
      <div class="obj-grid" data-lista></div>
      <p class="hint" style="margin-top:8px;">Al insertarlo se puede mover y cambiar de tamaño; su animación y velocidad se eligen a la derecha.</p>
      <h4>🌧 Lluvia de emojis</h4><p class="hint" style="margin:0 0 6px;">Elige de 3 a 5: suben desde abajo por toda la pantalla.</p>
      <div class="lluvia-chips" data-lluvia></div>
      <button class="btn btn-sm btn-block" data-lluvia-agregar style="margin-top:6px;">➕ Agregar lluvia</button>
      <h4>✍️ Texto animado</h4>
      <div class="stack"><button class="btn btn-sm btn-block btn-outline" data-ta="aparecer">Aparecer</button><button class="btn btn-sm btn-block btn-outline" data-ta="escribir">Máquina de escribir</button>
        <button class="btn btn-sm btn-block btn-outline" data-ta="marquesina">Marquesina</button><button class="btn btn-sm btn-block btn-outline" data-ta="chat">💬 Burbujas de chat (una por una)</button></div>`;
    const lista = $('[data-lista]', c);
    const pintar = () => {
      const items = buscarObjetos(cat, q);
      lista.innerHTML = items.map((o, i) => {
        const a = o.el?.anim && o.el.anim !== 'ninguna' ? `class="pe-anim a-${o.el.anim}" style="--t:${o.el.dur || 3}s"` : '';
        if (o.cat === 'frase') return `<button type="button" class="frase" data-o="${i}" title="${esc(o.nombre)}" style="font-family:'${esc(o.el.fuente || 'Nunito')}'">${esc(o.el.texto)}</button>`;
        if (o.cat === 'emoji') return `<button type="button" data-o="${i}" title="${esc(o.nombre)}"><span ${a}>${esc(o.el.emoji)}</span></button>`;
        if (o.grupo || o.el?.tipo === 'busqueda') return `<button type="button" data-o="${i}" title="${esc(o.nombre)}" style="font-size:11px; font-weight:800;">🔍 ${esc(o.nombre)}</button>`;
        return `<button type="button" data-o="${i}" title="${esc(o.nombre)}"><span ${a}>${SVG_OBJ[o.el.obj].svg}</span></button>`;   // dibujos fijos de objetos.js
      }).join('') || '<div class="empty small" style="grid-column:1/-1;">Nada coincide.</div>';
      $$('[data-o]', lista).forEach(b => b.onclick = () => {
        const o = items[Number(b.dataset.o)];
        if (o.grupo) { o.grupo.forEach(e => agregarElemento(clonar(e))); return; }
        const el = clonar(o.el);
        if (o.cat === 'frase') agregarElemento({ ...el, x: r1(50 - el.w / 2), y: r1(50 - el.h / 2) });
        else agregarElemento({ ...el, ...tamProporcional(o.prop || 1, el.tipo === 'busqueda' ? 56 : 16) });
        cerrarPanelMovil();
      });
    };
    $$('[data-oc]', c).forEach(b => b.onclick = () => { cat = b.dataset.oc; $$('[data-oc]', c).forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
    $('[data-buscar]', c).oninput = (e) => { q = e.target.value; pintar(); };
    const pintarLluvia = () => {
      $('[data-lluvia]', c).innerHTML = EMOJIS_LLUVIA.map(e => `<button type="button" class="${lluvia.has(e) ? 'sel' : ''}" data-ll="${e}" aria-pressed="${lluvia.has(e)}">${e}</button>`).join('');
      $$('[data-ll]', c).forEach(b => b.onclick = () => {
        const e = b.dataset.ll;
        if (lluvia.has(e)) { if (lluvia.size > 1) lluvia.delete(e); } else if (lluvia.size < 5) lluvia.add(e); else toast('Hasta 5 emojis', 'error');
        pintarLluvia();
      });
    };
    pintarLluvia();
    $('[data-lluvia-agregar]', c).onclick = () => {
      if (lluvia.size < 3) return toast('Elige al menos 3 emojis', 'error');
      agregarElemento({ tipo: 'lluvia', emojis: [...lluvia], cantidad: 10, tam: 5, x: 0, y: 0, w: 100, h: 100 });
      cerrarPanelMovil();
    };
    const color = () => oscuro(hoja().diseno.fondo) ? '#FFFFFF' : '#2D2A45';
    $$('[data-ta]', c).forEach(b => b.onclick = () => {
      const t = b.dataset.ta;
      if (t === 'chat') {
        [['¿Vienes el domingo? 👀', '#FFFFFF', '#1E1B4B', 14], ['¡Claro! 🙌', '#22C55E', '#FFFFFF', 52], ['Trae a un amigo 😎', '#FFFFFF', '#1E1B4B', 14]].forEach(([texto, caja, col, x], i) =>
          agregarElemento({ tipo: 'texto', texto, x, y: 14 + i * 24, w: 34, h: 16, tam: 3, fuente: 'Montserrat', peso: 700, color: col, fondoCaja: caja, alinear: 'center', anim: 'chat', dur: 9, retraso: i * 1.2 }));
        return;
      }
      const base = { tipo: 'texto', x: 10, y: 40, w: 80, h: 18, tam: 5, fuente: 'Montserrat', peso: 800, color: color(), alinear: 'center', anim: t };
      if (t === 'marquesina') agregarElemento({ ...base, texto: 'BIENVENIDOS ✦ DIOS TE BENDIGA ✦', x: -5, y: 80, w: 110, h: 10, tam: 3.4, fondoCaja: '#FACC15', color: '#111111', fuente: 'Anton', peso: 0 });
      else agregarElemento({ ...base, texto: t === 'escribir' ? 'Hoy Dios tiene algo para ti' : '¡Bienvenidos!' });
    });
    pintar();
  },

  imagen(c) {
    c.innerHTML = `<label class="btn btn-primary btn-block" style="cursor:pointer;">📁 Subir desde el equipo<input type="file" accept="image/*" hidden data-arch></label>
      <div class="zona-pegar" tabindex="0" data-pegar style="margin-top:10px; padding:22px 12px;">📋 Haz clic aquí y pega una imagen (Ctrl+V)<br><small>o arrástrala sobre la hoja</small></div>
      <h4>Desde un enlace</h4>
      <div class="row"><input class="input grow" data-url placeholder="https://…/imagen.jpg"><button class="btn btn-sm" data-usar>Usar</button></div>
      <p class="hint">Las imágenes se reducen a 1600 px antes de subirlas para que carguen rápido en los celulares.
        Todo lo que subes queda en <a href="#" data-ir-archivos>📁 Mis archivos</a> para volver a usarlo.</p>`;
    $('[data-ir-archivos]', c).onclick = (e) => { e.preventDefault(); recurso = 'archivos'; pintarIzquierda(); };
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

// En las hojas de pregunta, Agrupar y Ruleta el panel derecho tiene dos pestañas fijas:
// "Pregunta" (o Agrupar/Ruleta) y "Diseño/Elemento". Elegir un elemento en la hoja pasa a "Elemento";
// cambiar de pestaña no quita la selección.
let pestanaDer = 'tipo', selAntes = null, hojaAntes = null;
function pintarPropiedades() {
  const p = $('[data-der]');
  if (!p) return;
  const h = hoja();
  const el = editableAqui() ? elSel() : null;
  if (h.id !== hojaAntes) { pestanaDer = 'tipo'; hojaAntes = h.id; selAntes = null; }
  if (selId && selId !== selAntes) pestanaDer = 'diseno';
  selAntes = selId;
  if (MODO_CAN) return el ? pintarPropsElemento(p, el) : pintarPropsCancion(p);
  if (!interactiva(h.tipo)) return el ? pintarPropsElemento(p, el) : pintarPropsHoja(p);
  const nombre = esPregunta(h.tipo) ? '❓ Pregunta' : { agrupar: '👥 Agrupar', unirse: '📲 Unirse', ruleta: '🎡 Ruleta', juego: '🎮 Juego' }[h.tipo];
  p.innerHTML = `<div class="der-tabs" role="tablist">
      <button role="tab" data-tab-der="tipo" aria-selected="${pestanaDer === 'tipo'}" class="${pestanaDer === 'tipo' ? 'activo' : ''}">${nombre}</button>
      <button role="tab" data-tab-der="diseno" aria-selected="${pestanaDer === 'diseno'}" class="${pestanaDer === 'diseno' ? 'activo' : ''}">🎨 ${el ? 'Elemento' : 'Diseño'}</button></div>
    <div data-der-cuerpo></div>`;
  $$('[data-tab-der]', p).forEach(b => b.onclick = () => { pestanaDer = b.dataset.tabDer; pintarPropiedades(); });
  const cuerpo = $('[data-der-cuerpo]', p);
  if (pestanaDer === 'diseno') return el ? pintarPropsElemento(cuerpo, el) : pintarPropsHoja(cuerpo, { conTipo: false });
  const tipo = TIPOS_HOJA.find(t => t.k === h.tipo) || (h.tipo === 'juego' && { ico: '🎮', txt: 'Juego' });
  cuerpo.innerHTML = `<div class="panel-cab"><b>Hoja ${actual + 1} de ${hojas.length}</b><span class="grow"></span><span class="badge">${tipo?.ico || ''} ${esc(tipo?.txt || h.tipo)}</span></div>`;
  if (esPregunta(h.tipo)) seccionPregunta(cuerpo);
  if (h.tipo === 'agrupar') seccionAgrupar(cuerpo);
  if (h.tipo === 'ruleta') seccionRuleta(cuerpo);
  if (h.tipo === 'juego') seccionJuego(cuerpo);
  if (h.tipo === 'unirse') seccionUnirse(cuerpo);
  const av = problemas(hojas, actual);
  if (av.length) cuerpo.insertAdjacentHTML('afterbegin', `<div class="rev-panel">${av.map(x => `<div>⚠ ${esc(x.txt)}</div>`).join('')}</div>`);
}

function seccionUnirse(p) {
  const s = document.createElement('div');
  s.innerHTML = `<h4>📲 Unirse</h4>
    <p class="hint" style="margin:0 0 8px;">En vivo se ve el QR grande, el enlace y el PIN, y los participantes aparecen a medida que se unen. Es el registro de <b>Agrupar</b>, pero sin formar grupos.</p>
    <p class="hint">Ponla antes de las preguntas, la ruleta de participantes o los juegos. Desde la barra de la presentación puedes cerrar el registro o dejar entrar a los que llegan tarde.</p>
    ${hojas.slice(0, actual).some(esRegistro) ? '<p class="hint">ℹ️ Ya hay una hoja de registro antes: los participantes que se unieron allí siguen en la sesión.</p>' : ''}`;
  p.appendChild(s);
}

// "Por grupo": se elige la hoja Agrupar (antes de esta) cuyos grupos se usan; si no hay ninguna, el botón para agregarla
function bloqueGrupos(c, activo) {
  const ag = agruparAntes(hojas, actual);
  if (!ag.length) return `<p class="hint">Para usar grupos, primero tiene que haber una hoja 👥 Agrupar antes.</p>
    <button class="btn btn-sm" data-agrupar-antes>➕ Agregar hoja Agrupar antes</button>`;
  if (!activo) return '';
  const elegida = c.hoja_grupos && ag.some(a => a.id === c.hoja_grupos) ? c.hoja_grupos : ag.at(-1).id;
  return `${fila('Grupos de', `<select class="input" data-hoja-grupos>${ag.map(a => `<option value="${a.id}" ${a.id === elegida ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select>`)}
    ${elegida !== ag.at(-1).id ? `<p class="hint">⚠ Esos grupos se vuelven a formar en la ${esc(ag.at(-1).nombre.split(':')[0].toLowerCase())}: en vivo se usarán los de esa hoja.</p>` : ''}`;
}
function conectarGrupos(s, c) {
  const b = $('[data-agrupar-antes]', s);
  if (b) b.onclick = () => { ponerRegistroAntes('agrupar', actual); toast('Hoja 👥 Agrupar agregada antes'); };
  const sel = $('[data-hoja-grupos]', s);
  if (sel) sel.onchange = () => { c.hoja_grupos = sel.value; confirmarCambio(); };
}
function pintarPropsElemento(p, el) {
  const g = geoVer(el);
  let esp = '';
  if (el.tipo === 'texto') {
    const vinc = el.vinculo === 'enunciado', deCancion = el.vinculo === 'letra' || el.vinculo === 'pie';
    const ef = el.efecto || {};
    esp = (deCancion ? `<p class="hint" style="margin-top:0;">${el.vinculo === 'letra'
        ? '🎵 <b>Zona de la letra.</b> Aquí se acomoda la letra de cada canción (o el versículo) con el tamaño más grande que quepa: el tamaño de aquí es el máximo.'
        : '🎵 <b>Pie.</b> Aquí sale el título de la canción y la estrofa.'}</p>`
      : `<label class="lbl" style="margin-top:0;">${vinc ? (hoja().tipo === 'completar' ? 'Frase (usa ___ para cada espacio)' : 'Enunciado de la pregunta') : 'Texto'}</label>
      <textarea class="input" data-prop-texto style="min-height:70px;">${esc(textoDe(el))}</textarea>`) + `
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
        <button class="btn btn-sm btn-outline ${el.mayus ? 'activo' : ''}" data-alt="mayus" title="Todo en mayúsculas">AA</button>
      </div>
      ${fila('Grosor', `<select class="input" data-p="peso" data-num>${[[0, el.negrita ? 'Negrita' : 'Normal'], [300, 'Fina'], [400, 'Normal'], [500, 'Media'], [700, 'Negrita'], [800, 'Extra'], [900, 'Gruesa']]
        .map(([v, t]) => `<option value="${v}" ${Number(el.peso || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${fila('Espaciado', `<input type="range" min="-0.05" max="0.6" step="0.01" data-p="espaciado" data-num value="${el.espaciado || 0}">`)}
      ${fila('Interlínea', `<input type="range" min="0.8" max="2" step="0.05" data-p="interlineado" data-num value="${el.interlineado || 1.15}">`)}
      ${fila('Efecto', `<select class="input" data-efecto><option value="">Ninguno</option>${Object.entries(EFECTOS_TEXTO).map(([k, t]) => `<option value="${k}" ${ef.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${ef.tipo ? fila('Color', `<input type="color" data-ef="color" value="${colorValido(ef.color, '#FFFFFF').slice(0, 7)}">${ef.tipo === 'degradado' ? `<input type="color" data-ef="color2" value="${colorValido(ef.color2, '#F0ABFC').slice(0, 7)}">` : ''}`) : ''}`;
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
  } else if (el.tipo === 'lluvia') {
    esp = `<label class="lbl" style="margin-top:0;">Emojis (de 3 a 5)</label><input class="input" data-lluvia-emojis value="${esc((el.emojis || []).join(' '))}" placeholder="🔥 🙌 ✨">
      <div style="margin-top:8px;">${fila('Cantidad', `<input type="range" min="3" max="24" step="1" data-p="cantidad" data-num value="${el.cantidad || 10}">`)}
      ${fila('Tamaño', `<input type="range" min="2" max="12" step="0.5" data-p="tam" data-num value="${el.tam || 5}">`)}
      ${fila('Velocidad', `<select class="input" data-p="vel"><option value="">Normal</option><option value="lenta" ${el.vel === 'lenta' ? 'selected' : ''}>Lenta</option><option value="rapida" ${el.vel === 'rapida' ? 'selected' : ''}>Rápida</option></select>`)}</div>
      <p class="hint">Pulsa ✨ Animar (o ▶ Presentar) para verla subir.</p>`;
  } else if (el.tipo === 'busqueda') {
    esp = `<label class="lbl" style="margin-top:0;">Texto que se escribe solo</label><input class="input" data-busq maxlength="120" value="${esc(el.texto || '')}">
      <div style="margin-top:8px;">${fila('Escribe en', `<input type="range" min="1" max="10" step="0.5" data-p="dur" data-num value="${el.dur || 3}"><b data-ver="dur">${el.dur || 3}</b> s`)}
      ${fila('Empieza a los', `<input type="range" min="0" max="10" step="0.5" data-p="retraso" data-num value="${el.retraso || 0}"><b data-ver="retraso">${el.retraso || 0}</b> s`)}</div>`;
  } else if (el.tipo === 'objeto') {
    esp = `<p class="small" style="font-weight:700; margin-bottom:8px;">✨ ${esc(SVG_OBJ[el.obj]?.nombre || 'Ilustración')}</p>`;
  } else if (el.tipo === 'zona') {
    esp = hoja().tipo === 'ruleta'
      ? `<p class="hint" style="margin:0 0 8px;">Aquí gira la ruleta, con el elegido y el historial. Muévela o cambia su tamaño; los nombres y opciones están en el panel de la hoja.</p>`
      : `<p class="hint" style="margin:0 0 8px;">Aquí aparecen las respuestas en vivo (y las simuladas al presentar). Muévela o cambia su tamaño; las opciones de la pregunta están en el panel de la hoja.</p>`;
  }
  const enCel = enCelular();
  p.innerHTML = `<div class="panel-cab"><b>${esc(NOMBRE_EL[el.tipo] || 'Elemento')}</b>${enCel ? '<span class="badge">📱 celular</span>' : ''}<span class="grow"></span>
      <button class="btn btn-sm btn-ghost btn-icon" data-cerrar-sel title="Quitar selección (Esc)" aria-label="Quitar selección">✕</button></div>
    ${esp}
    ${['lluvia', 'busqueda', 'zona'].includes(el.tipo) || el.vinculo ? '' : `<h4>Animación</h4>
      ${fila('Efecto', `<select class="input" data-anim>${Object.entries(ANIMACIONES).map(([k, t]) => `<option value="${k === 'ninguna' ? '' : k}" ${(el.anim || '') === (k === 'ninguna' ? '' : k) ? 'selected' : ''}>${t}</option>`).join('')}
        ${el.tipo === 'texto' ? `<optgroup label="Texto">${Object.entries(ANIMACIONES_TEXTO).map(([k, t]) => `<option value="${k}" ${el.anim === k ? 'selected' : ''}>${t}</option>`).join('')}</optgroup>` : ''}</select>`)}
      ${el.anim ? `${fila('Velocidad', `<div class="grupo-btn">${[['lenta', 'Lenta'], ['', 'Normal'], ['rapida', 'Rápida']].map(([k, t]) => `<button type="button" class="btn btn-sm btn-outline ${(el.vel || '') === k ? 'activo' : ''}" data-vel="${k}">${t}</button>`).join('')}</div>`)}
        ${fila('Empieza a los', `<input type="range" min="0" max="10" step="0.2" data-p="retraso" data-num value="${el.retraso || 0}"><b data-ver="retraso">${el.retraso || 0}</b> s`)}
        <p class="hint">Al editar está quieto: pulsa ✨ Animar para verlo.</p>` : ''}`}
    ${MODO_PL && !el.vinculo ? fila('Se ve en', `<select class="input" data-en><option value="">Portada y letra</option>${Object.entries(NOMBRE_EN).map(([k, t]) => `<option value="${k}" ${el.en === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`) : ''}
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
  const selEf = $('[data-efecto]', p);
  if (selEf) selEf.onchange = () => {
    if (!selEf.value) delete el.efecto;
    else el.efecto = { color: selEf.value === 'contorno' ? '#1F1147' : selEf.value === 'solida' ? '#7C2D92' : '#FFFFFF', color2: '#F0ABFC', ...(el.efecto || {}), tipo: selEf.value };
    confirmarCambio();
  };
  $$('[data-ef]', p).forEach(inp => {
    inp.oninput = () => { el.efecto[inp.dataset.ef] = inp.value; if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja()); };
    inp.onchange = () => confirmarCambio({ repintar: 'mini' });
  });
  const selAnim = $('[data-anim]', p);
  if (selAnim) selAnim.onchange = () => { if (selAnim.value) { el.anim = selAnim.value; delete el.dur; } else { delete el.anim; delete el.dur; delete el.vel; delete el.retraso; } confirmarCambio(); };
  $$('[data-vel]', p).forEach(b => b.onclick = () => { if (b.dataset.vel) el.vel = b.dataset.vel; else delete el.vel; confirmarCambio(); });
  const ll = $('[data-lluvia-emojis]', p);
  if (ll) ll.onchange = () => {
    const lista = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(ll.value)].map(x => x.segment).filter(x => x.trim()).slice(0, 5);
    if (lista.length) { el.emojis = lista; confirmarCambio(); } else toast('Escribe al menos un emoji', 'error');
  };
  const bq = $('[data-busq]', p);
  if (bq) { bq.oninput = () => { el.texto = bq.value; if (lienzo) repintarElemento(lienzo, el, 'editor', ctxHoja()); }; bq.onchange = () => confirmarCambio({ repintar: 'mini' }); }
  const selEn = $('[data-en]', p);
  if (selEn) selEn.onchange = () => {
    if (selEn.value) el.en = selEn.value; else delete el.en;
    if (el.en && el.en !== verPl) { selId = null; cambiarVerPl(el.en); selId = el.id; }
    confirmarCambio();
  };
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
  cuerpo += fila('⏱ Tiempo', `<select class="input" data-tiempo style="width:auto;">${[0, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300].map(t =>
    `<option value="${t}" ${Number(c.tiempo || 0) === t ? 'selected' : ''}>${t ? (t < 60 ? t + ' segundos' : t / 60 + (t === 60 ? ' minuto' : ' minutos')) : 'Sin límite'}</option>`).join('')}</select>`);
  if (h.tipo === 'pregunta') cuerpo += fila('Máx. letras', `<input class="input" type="number" min="10" max="500" data-cfg-num="limite" value="${c.limite ?? 140}" style="width:90px;">`);
  if (h.tipo === 'lluvia') cuerpo += fila('Ideas por persona', `<input class="input" type="number" min="1" max="10" data-cfg-num="max" value="${c.max ?? 3}" style="width:80px;">`);
  if (h.tipo === 'vf') {
    cuerpo += `<label class="lbl">Respuesta correcta</label>
      ${[['true', '✔ Verdadero'], ['false', '✘ Falso'], ['', 'Sin respuesta correcta (opinión)']].map(([v, t]) => `<label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="vfok" value="${v}" ${String(c.correcta ?? '') === v ? 'checked' : ''}> ${t}</label>`).join('')}`;
  }
  if (h.tipo === 'opcion') {
    const ops = c.opciones || (c.opciones = []);
    cuerpo += `<label class="lbl">Opciones (2 a 6) <span style="text-transform:none;">· pulsa ✓ en la correcta (o en ninguna, si es de opinión)</span></label>
      <div class="ops-ed">${ops.map((o, i) => { const ok = (c.correctas || []).includes(o.id); return `<div class="op-fila ${ok ? 'correcta' : ''}"><span class="zb-letra mini" style="background:${COLORES_OPCION[i % 6]}">${LETRAS[i]}</span>
        <input type="text" data-op-txt="${i}" value="${esc(o.texto)}" maxlength="80" aria-label="Opción ${LETRAS[i]}">
        ${o.imagen ? `<span class="op-img"><img src="${esc(o.imagen)}" alt=""><button data-op-img-del="${i}" title="Quitar la imagen" aria-label="Quitar la imagen de la opción ${LETRAS[i]}">✕</button></span>`
          : `<label class="btn btn-sm btn-ghost btn-icon" title="Agregar imagen (opcional)" style="cursor:pointer;">🖼<input type="file" accept="image/*" hidden data-op-img="${i}"></label>`}
        <button class="op-ok ${ok ? 'si' : ''}" data-op-ok="${i}" aria-pressed="${ok}" title="${ok ? 'Es la correcta (pulsa para quitar)' : 'Marcar como correcta'}">✓</button>
        <button class="btn btn-sm btn-ghost btn-icon" data-op-del="${i}" ${ops.length <= 2 ? 'disabled' : ''} title="Quitar opción" aria-label="Quitar opción">🗑</button></div>`; }).join('')}</div>
      ${ops.length < 6 ? '<button class="btn btn-sm" data-op-mas>➕ Agregar opción</button>' : ''}`;
  }
  const hayGrupos = agruparAntes(hojas, actual).length > 0;
  cuerpo += `<label class="lbl">Responde</label>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="modo" value="persona" ${c.modo !== 'grupo' ? 'checked' : ''}> 🙋 Cada participante</label>
    <label class="check" style="display:flex; ${hayGrupos ? '' : 'opacity:.55;'}" ${hayGrupos ? '' : 'title="Agrega antes una hoja Agrupar"'}><input type="radio" name="modo" value="grupo" ${c.modo === 'grupo' ? 'checked' : ''} ${hayGrupos ? '' : 'disabled'}> 👥 Una respuesta por grupo</label>
    ${bloqueGrupos(c, c.modo === 'grupo')}`;
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
  conectarGrupos(s, c);
  $$('input[name=vfok]', s).forEach(r => r.onchange = () => { c.correcta = r.value === '' ? null : r.value === 'true'; confirmarCambio(); });
  $$('[data-op-txt]', s).forEach(inp => {
    inp.oninput = () => { c.opciones[+inp.dataset.opTxt].texto = inp.value; repintarZona(); };
    inp.onchange = () => confirmarCambio();
  });
  $$('[data-op-ok]', s).forEach(b => b.onclick = () => {
    const id = c.opciones[+b.dataset.opOk].id;
    const era = (c.correctas || []).includes(id);
    c.correctas = (c.correctas || []).filter(x => x !== id);
    if (!era) c.correctas.push(id);
    confirmarCambio();
  });
  $$('[data-op-img]', s).forEach(inp => inp.onchange = async () => {
    const f = inp.files[0], o = c.opciones[+inp.dataset.opImg];
    inp.value = '';
    if (!f || !o) return;
    estado('guardando', 'Subiendo imagen…');
    try { o.imagen = (await imagenAArchivo(f, 800)).url; confirmarCambio(); }
    catch (e) { toast('No se pudo subir la imagen: ' + mensajeError(e), 'error'); }
    finally { if (!sucio && !guardando) estado('ok', 'Guardado ✓'); }
  });
  $$('[data-op-img-del]', s).forEach(b => b.onclick = () => { delete c.opciones[+b.dataset.opImgDel].imagen; confirmarCambio(); });   // sigue en Mis archivos
  const tiempo = $('[data-tiempo]', s);
  if (tiempo) tiempo.onchange = () => { c.tiempo = Number(tiempo.value) || 0; confirmarCambio({ repintar: 'nada' }); };
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

// Ruleta de participantes: de qué hoja Unirse/Agrupar salen (la más cercana antes; si hay varias, se elige)
function bloqueRegistro(c) {
  const r = registroAntes(hojas, actual), usada = registroDeRuleta(hojas, actual);
  if (!r.length) return `<p class="hint">⚠ Para sortear entre participantes, primero tiene que haber una hoja 📲 Unirse o 👥 Agrupar antes.</p>
    <button class="btn btn-sm" data-unirse-antes>➕ Agregar hoja Unirse antes</button>`;
  const etq = (x) => `${x.nombre.split(':')[0]} · ${x.tipo === 'agrupar' ? 'Agrupar' : 'Unirse'}`;
  return `<p class="hint" data-usa-registro>🙋 Usará los participantes de la <b>${esc(etq(usada).replace(/^Hoja/, 'hoja'))}</b>. En vivo se llena sola con sus nombres o alias;
      los expulsados no entran y los que se unen tarde se agregan.</p>
    ${r.length > 1 ? fila('Participantes de', `<select class="input" data-hoja-registro>${r.map(x => `<option value="${x.id}" ${x.id === usada.id ? 'selected' : ''}>${esc(etq(x))}</option>`).join('')}</select>`) : ''}`;
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
    ${bloqueGrupos(c, origen === 'grupos')}${origen === 'grupos' && agrupar.length ? '<p class="hint">En vivo, la ruleta muestra los grupos con sus nombres y colores.</p>' : ''}
    ${origen === 'participantes' ? bloqueRegistro(c) : ''}
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
  conectarGrupos(s, c);
  const selReg = $('[data-hoja-registro]', s);
  if (selReg) selReg.onchange = () => { c.hoja_registro = selReg.value; confirmarCambio(); };
  const unirAntes = $('[data-unirse-antes]', s);
  if (unirAntes) unirAntes.onclick = () => { ponerRegistroAntes('unirse', actual); toast('Hoja 📲 Unirse agregada antes'); };
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

// conTipo: false en la pestaña "Diseño" (la configuración de la pregunta está en su propia pestaña)
// ======================= HOJAS DE JUEGO ("+ Más") =======================
// Elige el tipo en el catálogo; luego crea un juego nuevo o trae uno de Mis actividades. reemplazar: la hoja a cambiar
async function agregarHojaJuego(reemplazar = null) {
  terminarEdicionTexto();
  const tipo = await elegirActividad({ titulo: '🎲 Agregar una hoja de juego', subtitulo: 'En vivo, cada participante juega en su celular y la pantalla muestra el ranking.', tipos: TIPOS_JUEGO_CATALOGO });
  if (!tipo) return;
  const a = ACTIVIDADES[tipo];
  let mios = [];
  try { mios = (await rpc('mis_juegos_profesor')).filter(j => j.tipo === tipo); } catch (e) { toast(mensajeError(e), 'error'); }
  const m = abrirModal(`<h3>${a.ico} ${esc(a.nombre)}</h3>
    <button class="btn btn-primary btn-block" data-crear>➕ Crear uno nuevo</button>
    <h4 style="margin:14px 0 6px;">O trae uno de Mis actividades</h4>
    ${mios.length ? `<div class="imp-lista">${mios.map(j => `<button class="imp-preg" data-j="${j.id}" style="text-align:left; background:#fff;"><span style="font-size:24px;">${a.ico}</span>
      <span><b>${esc(j.titulo)}</b><small>${j.n} ${UNIDAD[j.tipo] || 'palabras'}${j.tema ? ' · ' + esc(j.tema) : ''} · editado ${new Date(j.updated_at).toLocaleDateString()}</small></span></button>`).join('')}</div>`
      : `<p class="hint">Todavía no tienes juegos de este tipo.</p>`}`, { ancho: true });
  const poner = (j) => {
    m.cerrar();
    if (reemplazar) {
      reemplazar.config = configJuego(j, reemplazar.config);
      const t = reemplazar.diseno.elementos.find(e => e.tipo === 'texto');
      if (t && !t.vinculo) t.texto = j.titulo;
      confirmarCambio({ repintar: 'todo' });
      return toast('Juego cambiado');
    }
    insertarHojas([hojaNueva('juego', configJuego(j))]);
    toast(`Hoja de juego agregada: ${j.titulo}`);
    ofrecerUnirse();
  };
  $('[data-crear]', m.el).onclick = () => { m.cerrar(); abrirEditor(tipo, null, poner); };
  $$('[data-j]', m.el).forEach(b => b.onclick = () => poner(mios.find(j => j.id === b.dataset.j)));
}

function seccionJuego(p) {
  const h = hoja(), c = h.config, g = c.juego || {};
  const info = infoJuego(g.tipo);
  const hayGrupos = agruparAntes(hojas, actual).length > 0;
  const s = document.createElement('div');
  s.innerHTML = `<h4>${info.ico} ${esc(info.nombre)}</h4>
    <div class="juego-ficha" style="--c:${info.color}"><b>${esc(g.titulo)}</b><small>${g.n || 0} ${UNIDAD[g.tipo] || 'palabras'}${g.tema ? ' · ' + esc(g.tema) : ''}</small></div>
    ${fila('⏱ Tiempo', `<select class="input" data-seg style="width:auto;">${TIEMPOS_JUEGO.map(([v, t]) => `<option value="${v}" ${Number(g.segundos || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
    <p class="hint" style="margin-top:-2px;">El mismo cronómetro para todos. Quien termina antes gana un bono por el tiempo que le sobró.</p>
    <label class="lbl">Ranking</label>
    <label class="check" style="display:flex; margin-bottom:4px;"><input type="radio" name="modoj" value="persona" ${c.modo !== 'grupo' ? 'checked' : ''}> 🙋 Por participante</label>
    <label class="check" style="display:flex; ${hayGrupos ? '' : 'opacity:.55;'}" ${hayGrupos ? '' : 'title="Agrega antes una hoja Agrupar"'}><input type="radio" name="modoj" value="grupo" ${c.modo === 'grupo' ? 'checked' : ''} ${hayGrupos ? '' : 'disabled'}> 👥 Por grupos (promedio de sus integrantes)</label>
    ${bloqueGrupos(c, c.modo === 'grupo')}
    <div class="stack" style="margin-top:10px;">
      <button class="btn btn-sm" data-editar-juego>✏️ Editar el juego</button>
      <button class="btn btn-sm" data-cambiar-juego>🔁 Cambiar por otro juego</button>
      ${h.diseno.elementos.some(e => e.tipo === 'zona') ? '' : '<button class="btn btn-sm" data-poner-zona>➕ Volver a poner el ranking</button>'}</div>
    <p class="hint" style="margin-top:10px;">La hoja guarda una copia del juego: si lo cambias en Mis actividades, toca “Editar el juego” aquí para traer los cambios. Pruébala con <b>▶ Presentar → 🎭 Simular → ▶ Empezar juego</b>.</p>`;
  p.appendChild(s);
  $('[data-seg]', s).onchange = (e) => { g.segundos = Number(e.target.value) || 0; confirmarCambio({ repintar: 'hoja' }); };
  $$('input[name=modoj]', s).forEach(r => r.onchange = () => { c.modo = r.value; confirmarCambio(); });
  conectarGrupos(s, c);
  $('[data-cambiar-juego]', s).onclick = () => agregarHojaJuego(h);
  $('[data-editar-juego]', s).onclick = async () => {
    const { data: j, error } = await supabase.from('juegos').select('*').eq('id', g.id).maybeSingle();
    if (error) return toast(mensajeError(error), 'error');
    if (!j) return toast('Ese juego ya no está en Mis actividades. Usa “Cambiar por otro juego”.', 'error');
    abrirEditor(j.tipo, j, (nuevo) => { h.config = configJuego(nuevo, h.config); confirmarCambio({ repintar: 'todo' }); toast('La hoja se actualizó con los cambios del juego'); });
  };
  const pz = $('[data-poner-zona]', s);
  if (pz) pz.onclick = () => { const z = hojaNueva('juego', c).diseno.elementos.find(e => e.tipo === 'zona'); h.diseno.elementos.push(z); selId = z.id; confirmarCambio(); };
}

// ======================= TRAER PREGUNTAS DE MIS QUIZZES =======================
const TIPO_DESDE_QUIZ = { verdadero_falso: 'vf', opcion_unica: 'opcion', opcion_multiple: 'opcion', completar: 'completar', lluvia_ideas: 'lluvia' };
// Una pregunta de un quiz convertida en hoja del tipo correcto, con su enunciado, opciones y respuesta
function hojaDesdePregunta(p) {
  const tipo = TIPO_DESDE_QUIZ[p.tipo] || 'pregunta';
  const h = hojaNueva(tipo), c = h.config;
  const enun = String(p.enunciado || '').trim().slice(0, 500);
  if (tipo === 'completar') {
    c.frase = /_{3,}/.test(enun) ? enun : `${enun} ___`;
    c.aceptadas = Array.from({ length: Math.max(1, huecos(c.frase)) }, (_, i) =>
      String(p.respuestas_texto?.[i] || '').split('|').map(x => x.trim()).filter(Boolean));
  } else c.enunciado = enun;
  if (tipo === 'vf') {
    const ok = (p.opciones || []).find(o => o.es_correcta);
    c.correcta = ok ? normalizar(ok.texto).startsWith('v') : null;
  }
  if (tipo === 'opcion') {
    const ops = (p.opciones || []).filter(o => o.texto || o.imagen_url).slice(0, 6)
      .map(o => ({ id: uid(), texto: String(o.texto || '').slice(0, 80), imagen: o.imagen_url || undefined, ok: !!o.es_correcta }));
    while (ops.length < 2) ops.push({ id: uid(), texto: `Opción ${LETRAS[ops.length]}`, ok: false });
    c.opciones = ops.map(({ ok, ...o }) => (o.imagen ? o : { id: o.id, texto: o.texto }));
    c.correctas = ops.filter(o => o.ok).map(o => o.id);
  }
  // la imagen de la pregunta va a la izquierda y el área de respuestas se angosta
  if (/^https:\/\//.test(p.imagen_url || '')) {
    const z = h.diseno.elementos.find(e => e.tipo === 'zona');
    if (z) Object.assign(z, { x: 40, w: 54 });
    h.diseno.elementos.push({ id: uid(), tipo: 'imagen', url: p.imagen_url, ajuste: 'contain', radio: 4, x: 6, y: 28, w: 31, h: 66, rot: 0 });
  }
  return h;
}

async function importarDeQuizzes() {
  terminarEdicionTexto();
  const m = abrirModal(`<h3>📥 Traer preguntas de mis quizzes</h3><div data-c><div class="center" style="padding:20px;"><div class="spinner"></div></div></div>`, { ancho: true });
  const c = $('[data-c]', m.el);
  let quizzes;
  try { quizzes = (await rpc('mis_quizzes')).filter(q => q.n_preguntas > 0); }
  catch (e) { c.innerHTML = `<p class="err">${esc(mensajeError(e))}</p>`; return; }
  if (!quizzes.length) {
    c.innerHTML = '<div class="empty"><span class="big">📚</span>Todavía no tienes quizzes con preguntas.</div>';
    return;
  }
  c.innerHTML = `<label class="lbl" style="margin-top:0;">Quiz</label>
    <select class="input" data-quiz><option value="">Elige un quiz…</option>${quizzes.map(q => `<option value="${q.id}">${esc(q.titulo)} (${q.n_preguntas} ${q.n_preguntas === 1 ? 'pregunta' : 'preguntas'})</option>`).join('')}</select>
    <div data-lista style="margin-top:12px;"></div>
    <p class="hint" style="margin-top:8px;">Cada pregunta se convierte en una hoja del mismo tipo, con su enunciado, opciones y respuesta correcta. Se agregan después de la hoja actual.</p>
    <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary" data-si disabled>Agregar</button></div>`;
  let preguntas = [];
  const lista = $('[data-lista]', c), si = $('[data-si]', c);
  const elegidas = () => preguntas.filter(p => $(`[data-p="${p.id}"]`, lista)?.checked);
  const contar = () => {
    const n = elegidas().length;
    si.disabled = !n;
    si.textContent = n ? `Agregar ${n} ${n === 1 ? 'hoja' : 'hojas'}` : 'Agregar';
    const t = $('[data-todas]', lista);
    if (t) t.checked = n === preguntas.length;
  };
  $('[data-quiz]', c).onchange = async (e) => {
    preguntas = [];
    contar();
    if (!e.target.value) { lista.innerHTML = ''; return; }
    lista.innerHTML = '<div class="center" style="padding:14px;"><div class="spinner"></div></div>';
    try { preguntas = await rpc('preguntas_de_quiz', { p_quiz: e.target.value }); }
    catch (x) { lista.innerHTML = `<p class="err">${esc(mensajeError(x))}</p>`; return; }
    lista.innerHTML = `<label class="check" style="display:flex; margin-bottom:8px;"><input type="checkbox" data-todas checked> <b>Elegir todas (${preguntas.length})</b></label>
      <div class="imp-lista">${preguntas.map((p, i) => {
        const t = TIPOS[p.tipo] || { ico: '❓', nombre: p.tipo };
        const destino = TIPOS_PREGUNTA[TIPO_DESDE_QUIZ[p.tipo] || 'pregunta'];
        return `<label class="imp-preg"><input type="checkbox" data-p="${p.id}" checked>
          <span><b>${i + 1}. ${esc(String(p.enunciado || '').slice(0, 140)) || '<i>(sin enunciado)</i>'}</b>
          <small>${t.ico} ${esc(t.nombre)} → hoja ${destino.ico} ${esc(destino.nombre)}${p.imagen_url ? ' · 🖼 con imagen' : ''}</small></span></label>`;
      }).join('')}</div>`;
    $$('[data-p]', lista).forEach(x => x.onchange = contar);
    $('[data-todas]', lista).onchange = (ev) => { $$('[data-p]', lista).forEach(x => { x.checked = ev.target.checked; }); contar(); };
    contar();
  };
  $('[data-no]', c).onclick = () => m.cerrar();
  si.onclick = () => {
    const nuevas = elegidas().map(hojaDesdePregunta);
    if (!nuevas.length) return;
    if (hojas.length + nuevas.length > 100) return toast(`Un proyecto puede tener hasta 100 hojas (quedan ${100 - hojas.length}).`, 'error');
    m.cerrar();
    insertarHojas(nuevas);
    toast(`Se agregaron ${nuevas.length} ${nuevas.length === 1 ? 'hoja' : 'hojas'} de preguntas`);
    ofrecerUnirse();
  };
}

function pintarPropsHoja(p, { conTipo = true } = {}) {
  if (MODO_PL) return pintarPropsPlantilla(p);
  const h = hoja();
  const preg = interactiva(h.tipo);
  const cel = h.config?.celular || 'mirar';
  const els = h.diseno.elementos;
  const tipo = TIPOS_HOJA.find(t => t.k === h.tipo) || (h.tipo === 'juego' && { ico: '🎮', txt: 'Juego' });
  p.innerHTML = `<div class="panel-cab"><b>Hoja ${actual + 1} de ${hojas.length}</b><span class="grow"></span><span class="badge">${tipo?.ico || ''} ${esc(tipo?.txt || h.tipo)}</span></div>`;
  if (conTipo && esPregunta(h.tipo)) seccionPregunta(p);
  if (conTipo && h.tipo === 'agrupar') seccionAgrupar(p);
  if (conTipo && h.tipo === 'ruleta') seccionRuleta(p);
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

// Panel de la plantilla de culto (sin nada elegido)
function pintarPropsPlantilla(p) {
  const h = hoja(), els = h.diseno.elementos;
  const cats = [...new Set(['Mis plantillas', ...CATEGORIAS, plantilla.categoria])];
  const zona = els.find(e => e.vinculo === 'letra'), tienePie = els.some(e => e.vinculo === 'pie');
  p.innerHTML = `<div class="panel-cab"><b>🎵 Plantilla de culto</b></div>
    ${plantilla.id ? `<label class="lbl" style="margin-top:0;">Categoría</label><select class="input" data-cat>${cats.map(c => `<option ${c === plantilla.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`
      : '<p class="hint" style="margin-top:0;">Es una plantilla prediseñada: cámbiala como quieras y pulsa <b>💾 Guardar como mi plantilla</b>.</p>'}
    <h4>Vista</h4>
    <div class="grupo-btn"><button class="btn btn-sm btn-outline ${verPl === 'portada' ? 'activo' : ''}" data-vpl="portada">🏷 Portada</button><button class="btn btn-sm btn-outline ${verPl === 'letra' ? 'activo' : ''}" data-vpl="letra">🎵 Con letra</button></div>
    <p class="hint">${verPl === 'portada' ? 'Títulos, avisos y versículos: lo que se ve antes de la letra.' : 'Así se verá cada pantalla de las canciones. La letra se acomoda sola en la zona punteada, con el tamaño más grande que quepa.'}</p>
    ${zona ? '' : '<button class="btn btn-sm btn-primary btn-block" data-zona>➕ Agregar zona de letra</button>'}
    ${tienePie ? '' : '<button class="btn btn-sm btn-block" data-pie style="margin-top:6px;">➕ Agregar pie (título · estrofa)</button>'}
    <h4>Fondo</h4>
    <div class="muestras">${COLORES.slice(0, 10).map(k => `<button class="muestra" data-color="${k}" style="background:${k}" aria-label="Color ${k}"></button>`).join('')}</div>
    <button class="btn btn-sm btn-block" data-mas-fondos style="margin-top:8px;">🎨 Más fondos e imagen</button>
    <h4>Elementos (${els.length})</h4>
    <div class="capas">${els.slice().reverse().map(e => `<button data-elegir="${e.id}" class="${e.en && e.en !== verPl ? 'otra-vista' : ''}">${e.tipo === 'emoji' ? esc(e.emoji || '😀') : ICO_EL[e.tipo] || '•'}
      <span>${esc(e.tipo === 'texto' ? textoDe(e).slice(0, 40) || '(texto vacío)' : NOMBRE_EL[e.tipo] || e.tipo)}${e.en ? ` · ${e.en === 'portada' ? '🏷' : '🎵'}` : ''}</span></button>`).join('')}</div>
    <div class="atajos"><b>Atajos:</b><br><kbd>Doble clic</kbd> editar texto · <kbd>Supr</kbd> eliminar<br><kbd>Ctrl</kbd>+<kbd>D</kbd> duplicar · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> deshacer/rehacer<br>
      <kbd>Alt</kbd>+clic elige lo que está debajo</div>`;
  const cat = $('[data-cat]', p);
  if (cat) cat.onchange = () => { plantilla.categoria = cat.value; programarGuardado(); };
  $$('[data-vpl]', p).forEach(b => b.onclick = () => cambiarVerPl(b.dataset.vpl));
  const bz = $('[data-zona]', p);
  if (bz) bz.onclick = () => { verPl = 'letra'; agregarElemento({ tipo: 'texto', vinculo: 'letra', en: 'letra', texto: '', x: 7, y: 11, w: 86, h: 72, tam: 5.4, fuente: 'Montserrat', peso: 800,
    color: oscuro(h.diseno.fondo) ? '#FFFFFF' : '#1E293B', alinear: 'center', interlineado: 1.28 }); cambiarVerPl('letra'); };
  const bp = $('[data-pie]', p);
  if (bp) bp.onclick = () => { agregarElemento({ tipo: 'texto', vinculo: 'pie', en: 'letra', texto: '', x: 10, y: 89, w: 80, h: 5, tam: 1.2, fuente: 'Montserrat', peso: 500,
    espaciado: 0.35, mayus: true, opacidad: 0.55, color: oscuro(h.diseno.fondo) ? '#FFFFFF' : '#1E293B', alinear: 'center' }); cambiarVerPl('letra'); };
  $$('[data-color]', p).forEach(b => b.onclick = () => { h.diseno.fondo = { tipo: 'color', valor: b.dataset.color }; confirmarCambio(); if (recurso === 'fondo') pintarIzquierda(); });
  $('[data-mas-fondos]', p).onclick = () => { recurso = 'fondo'; pintarIzquierda(); if (esMovil()) alternarPanelMovil('izq'); };
  $$('[data-elegir]', p).forEach(b => b.onclick = () => {
    const e = els.find(x => x.id === b.dataset.elegir);
    if (e?.en && e.en !== verPl) cambiarVerPl(e.en);
    selId = b.dataset.elegir; pintarSeleccion(); pintarPropiedades();
  });
}

// ======================= CANCIÓN =======================
// Los datos que se guardan (y que guarda el historial para deshacer)
const filaCancion = () => ({
  titulo: cancion.titulo.trim().slice(0, 150), autor: cancion.autor || '', tono: cancion.tono || '', etiquetas: cancion.etiquetas || [],
  bloques: cancion.bloques, orden_canto: cancion.orden_canto?.length ? ordenNormal(cancion.orden_canto) : null, opciones: cancion.opciones,
  compartida: !!cancion.compartida, resaltados: cancion.resaltados || [], detalles: cancion.detalles || {}
});
const fondoPlantilla = () => JSON.stringify(plantillaDe(plantillaDeCancion(cancion)).diseno?.fondo || plantillaDe(plantillaDeCancion(cancion)).fondo);
// Pantalla de muestra cuando todavía no hay letra
function hojaVacia() {
  const h = hojasDeCancion({ ...cancion, bloques: [{ tipo: 'estrofa', texto: 'Pega la letra en 🎵 Letra' }], orden_canto: null, resaltados: [], detalles: {} })[0];
  return { ...h, id: 'vacia', info: null, textos: { ...h.textos, pie: '' } };
}
// Vuelve a armar las pantallas desde la canción (después de cambiar la letra, el orden, la plantilla o un resaltado)
function reconstruir() {
  const clave = hojas[actual]?.id;
  hojas = hojasDeCancion(cancion);
  if (!hojas.length) hojas = [hojaVacia()];
  const i = hojas.findIndex(h => h.id === clave);
  actual = i >= 0 ? i : Math.min(actual, hojas.length - 1);
  if (selId && !hoja().diseno.elementos.some(e => e.id === selId && !e.bloqueado)) selId = null;
}
// Los detalles de cada pantalla (lo que no es de la plantilla) vuelven a la canción
function sincronizarDetalles() {
  const base = fondoPlantilla(), det = {};
  for (const h of hojas) {
    if (!h.info) continue;
    const el = h.diseno.elementos.filter(e => !e.bloqueado);
    const fondo = JSON.stringify(h.diseno.fondo) !== base ? h.diseno.fondo : null;
    if (el.length || fondo) det[h.id] = { el, ...(fondo ? { fondo } : {}) };
  }
  // los de pantallas que ahora no salen (p. ej. se quitó un coro del orden) se guardan por si vuelven
  for (const [k, v] of Object.entries(cancion.detalles || {})) if (!hojas.some(h => h.id === k)) det[k] = v;
  cancion.detalles = det;
}
let tHist = null;
// Un cambio de la canción: rearma las pantallas, repinta y guarda
function cambioCancion({ letra = false, panel = false, demorarHistorial = false } = {}) {
  sincronizarDetalles();
  if (letra) {
    const { validos, perdidos } = ubicarResaltados(cancion.bloques, cancion.resaltados);
    cancion.resaltados = validos;
    if (perdidos.length) toast(`Se quitó el resaltado de ${perdidos.map(r => `«${r.texto}»`).join(', ')}: ya no está en la letra`, 'error');
  }
  reconstruir();
  pintarLienzo(); pintarTira(); pintarPropiedades();
  if (panel) panelLetra?.refrescar();
  clearTimeout(tHist);
  if (demorarHistorial) tHist = setTimeout(registrar, 700); else registrar();
  programarGuardado();
}
async function abrirCancion() {
  try { registrarMisPlantillas(await datosPlantillas.listar()); } catch (e) { console.warn('No se pudieron cargar tus plantillas', e); }
  const id = params.get('cancion');
  if (id && id !== 'nueva') {
    cancion = await datosCanciones.obtener(id);
    if (!cancion) throw new Error('Esa canción ya no existe.');
    if (!cancion.mia) throw new Error('Esta canción es de otro profesor: cópiala a tus canciones para cambiarla.');
  } else cancion = { id: null, titulo: '', autor: '', tono: '', etiquetas: [], bloques: [], orden_canto: null, opciones: {}, compartida: false };
  let pl = cancion.opciones?.plantilla;
  if (!pl || !existePlantilla(pl)) { try { pl = localStorage.getItem('cultos.plantilla'); } catch { pl = null; } }
  cancion.opciones = { ...OPCIONES_DEFECTO, ...(cancion.opciones || {}), plantilla: pl && existePlantilla(pl) ? pl : PLANTILLA_DEFECTO };
  cancion.resaltados = Array.isArray(cancion.resaltados) ? cancion.resaltados : [];
  cancion.detalles = cancion.detalles && typeof cancion.detalles === 'object' ? cancion.detalles : {};
  cancion.etiquetas = cancion.etiquetas || [];
  proyecto = { nombre: cancion.titulo || 'Canción nueva', tema: {} };
  await prepararFuente(plantillaDeCancion(cancion));
  reconstruir();
  if (!cancion.bloques.length) tabIzq = 'letra';
  montar();
}
function montarCancion() {
  document.title = `${cancion.titulo || 'Canción nueva'} · Canción`;
  document.body.className = 'editor-proyectos';
  raiz.innerHTML = `<div class="ed ed-cancion">
    <header class="ed-top">
      <a class="btn btn-sm btn-outline" href="${VOLVER}" title="Volver a las canciones">←<span class="ocultar-movil"> Canciones</span></a>
      <input class="ed-nombre" data-nombre maxlength="150" placeholder="Título de la canción" aria-label="Título de la canción">
      <span class="ed-estado ok" data-estado></span>
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-deshacer title="Deshacer (Ctrl+Z)" aria-label="Deshacer">↶</button>
      <button class="btn btn-sm btn-ghost btn-icon ocultar-movil" data-rehacer title="Rehacer (Ctrl+Y)" aria-label="Rehacer">↷</button>
      <button class="btn btn-sm btn-outline" data-animar title="Ver los efectos (al editar están quietos)">✨<span class="ocultar-movil"> Animar</span></button>
      <button class="btn btn-primary btn-sm" data-presentar title="Ver la canción a pantalla completa, como en la proyección">▶<span class="ocultar-movil"> Ver proyección</span></button>
    </header>
    <aside class="ed-izq" data-izq></aside>
    <main class="ed-centro">
      <div class="escenario" data-escenario></div>
      <div class="tira" data-tira></div>
    </main>
    <aside class="ed-der" data-der></aside>
    <nav class="ed-tabs">
      <button data-tab="izq" data-tab-izq="letra"><span>🎵</span>Letra</button>
      <button data-tab="izq" data-tab-izq="recursos"><span>➕</span>Recursos</button>
      <button data-tab="der"><span>🎛</span>Propiedades</button>
    </nav>
  </div>`;
  const nom = $('[data-nombre]');
  nom.value = cancion.titulo;
  nom.oninput = () => { cancion.titulo = nom.value; proyecto.nombre = nom.value; panelLetra?.ponerTitulo(nom.value); document.title = `${nom.value || 'Canción nueva'} · Canción`; cambioCancion({ demorarHistorial: true }); };
  $('[data-deshacer]').onclick = () => moverHist(-1);
  $('[data-rehacer]').onclick = () => moverHist(1);
  $('[data-animar]').onclick = () => { animarEd = !animarEd; $('[data-animar]').classList.toggle('activo', animarEd); cerrarBarraResaltar(); pintarLienzo(); };
  $('[data-presentar]').onclick = () => { if (!hoja().info) return toast('Primero pega la letra', 'error'); cerrarBarraResaltar(); presentar(hojas, { inicio: actual, alSalir: (i) => irAHoja(i) }); };
  $('[data-estado]').onclick = () => { if (!conflicto && sucio) guardar(); };
  // en el celular: Letra y Recursos son dos pestañas de abajo que abren el mismo panel
  $$('[data-tab]').forEach(b => b.onclick = () => {
    if (b.dataset.tabIzq) {
      const ed = $('.ed');
      if (ed.dataset.movil === 'izq' && tabIzq === b.dataset.tabIzq) { alternarPanelMovil('izq'); }
      else { tabIzq = b.dataset.tabIzq; pintarIzquierda(); if (ed.dataset.movil !== 'izq') alternarPanelMovil('izq'); }
      $$('[data-tab-izq]').forEach(x => x.classList.toggle('activo', ed.dataset.movil === 'izq' && x.dataset.tabIzq === tabIzq));
      return;
    }
    alternarPanelMovil(b.dataset.tab);
  });
  estado(cancion.id ? 'ok' : 'pendiente', cancion.id ? 'Guardado ✓' : cancion.titulo ? '' : '✏️ Escribe el título');
  conectarLienzo();
  conectarTeclado();
  conectarSoltarArchivos();
  conectarResaltar();
  pintarTodo();
  registrar();
  if (!cancion.titulo) nom.focus();
}

// ---------- Izquierda: 🎵 Letra / ➕ Recursos ----------
function pintarIzquierdaCancion(p) {
  if (tabIzq === 'letra' && panelLetra && p.querySelector('[data-panel-letra]')) return;   // no se rearma mientras se escribe
  p.innerHTML = `<div class="izq-tabs" role="tablist"><button role="tab" data-ti="letra" class="${tabIzq === 'letra' ? 'activo' : ''}">🎵 Letra</button>
    <button role="tab" data-ti="recursos" class="${tabIzq === 'recursos' ? 'activo' : ''}">➕ Recursos</button></div><div data-izq-cuerpo></div>`;
  $$('[data-ti]', p).forEach(b => b.onclick = () => { tabIzq = b.dataset.ti; if (tabIzq === 'letra') panelLetra = null; pintarIzquierda(); });
  const c = $('[data-izq-cuerpo]', p);
  if (tabIzq === 'letra') {
    c.dataset.panelLetra = '';
    panelLetra = montarPanelLetra(c, {
      cancion, perfil,
      alCambiar: (tipo, o = {}) => {
        if (tipo === 'datos') {
          if (o.campo === 'titulo') { $('[data-nombre]').value = cancion.titulo; proyecto.nombre = cancion.titulo; }
          cambioCancion({ demorarHistorial: true });
        } else cambioCancion({ letra: tipo === 'letra' });
      },
      alElegirBloque: (i) => {
        bloqueSel = i;
        const k = hojas.findIndex(h => h.info?.bloque === i);
        if (k >= 0) { actual = k; selId = null; pintarLienzo(); pintarPropiedades(); }
        pintarTira();
        $(`.mini-hoja[data-i="${actual}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    });
    return;
  }
  panelLetra = null;
  if (!recurso) {
    c.innerHTML = `<div class="recursos">${RECURSOS.filter(r => r[0] !== 'plantillas').map(([k, ico, txt]) => `<button class="recurso" data-rec="${k}"><span>${ico}</span>${txt}</button>`).join('')}</div>
      <p class="hint" style="margin-top:12px;">Lo que agregues sale <b>solo en la pantalla que estás viendo</b> (por ejemplo 🔥 en el coro final). Luego puedes copiarlo a las demás pantallas de esa estrofa.</p>`;
    $$('[data-rec]', c).forEach(b => b.onclick = () => { recurso = b.dataset.rec; pintarIzquierda(); });
    return;
  }
  const [, ico, txt] = RECURSOS.find(r => r[0] === recurso);
  c.innerHTML = `<div class="panel-cab"><button class="btn btn-sm btn-ghost btn-icon" data-atras aria-label="Volver a recursos">←</button><b>${ico} ${txt}</b></div><div data-cuerpo></div>`;
  $('[data-atras]', c).onclick = () => { recurso = null; pintarIzquierda(); };
  PANELES[recurso]($('[data-cuerpo]', c));
}

// ---------- Tira de pantallas ----------
function pintarTiraCancion(tira) {
  tira.innerHTML = hojas.map((h, i) => `<div class="mini-hoja ${i === actual ? 'activa' : ''} ${bloqueSel >= 0 && h.info?.bloque === bloqueSel ? 'del-bloque' : ''}" data-i="${i}" role="button" tabindex="0"
      aria-label="Pantalla ${i + 1}${h.info ? ' · ' + esc(h.info.nombre) : ''}"><span class="num">${i + 1}${h.info ? ' · ' + esc(h.info.codigo) : ''}</span>
      <span class="mini-aviso" ${h.chico ? '' : 'hidden'} title="Mucho texto: corta la estrofa o usa menos líneas por pantalla">⚠</span><div data-mini></div></div>`).join('');
  hojas.forEach((_, i) => pintarMini(i));
  $$('.mini-hoja', tira).forEach(m => {
    const i = +m.dataset.i;
    m.onclick = () => { cerrarBarraResaltar(); irAHoja(i); };
    m.onkeydown = (e) => { if (e.target === m && e.key === 'Enter') irAHoja(i); };
  });
}

// ---------- Derecha: plantilla de la canción y la pantalla ----------
function pintarPropsCancion(p) {
  const h = hoja(), d = h.info;
  const pl = plantillaDe(plantillaDeCancion(cancion));
  const det = h.diseno.elementos.filter(e => !e.bloqueado);
  const fondoPropio = d && JSON.stringify(h.diseno.fondo) !== fondoPlantilla();
  const hermanas = d ? hojas.filter(x => x.info?.bloque === d.bloque && x !== h).length : 0;
  p.innerHTML = `<details class="pl-plantilla" data-det-pl ${verPlantillas ? 'open' : ''}><summary class="panel-cab" style="cursor:pointer;"><b>🎨 Plantilla: ${esc(pl.nombre)}</b><span class="grow"></span><span class="small muted">Cambiar ▾</span></summary>
      <div class="pl-plantillas" data-pls></div>
      <p class="hint"><a href="${VOLVER.replace('#cultos/canciones', '#cultos/plantillas')}">🎨 Ver y editar plantillas</a></p></details>
    <div class="panel-cab" style="margin-top:8px;"><b>${d ? `Pantalla ${actual + 1} de ${hojas.length}` : 'Sin pantallas'}</b><span class="grow"></span>${d ? `<span class="badge">${esc(d.codigo)} · ${esc(d.nombre)}</span>` : ''}</div>
    ${d ? `<p class="hint" style="margin-top:0;">✨ <b>Para resaltar</b>, selecciona una o varias palabras de la letra en la pantalla.</p>
    <h4>Detalles de esta pantalla (${det.length})</h4>
    <div class="capas">${det.slice().reverse().map(e => `<button data-elegir="${e.id}">${e.tipo === 'emoji' ? esc(e.emoji || '😀') : ICO_EL[e.tipo] || '•'}
      <span>${esc(e.tipo === 'texto' ? (e.texto || '').slice(0, 40) || '(texto vacío)' : NOMBRE_EL[e.tipo] || e.tipo)}</span></button>`).join('') || '<p class="hint">Agrega objetos, emojis, imágenes o un texto desde <b>➕ Recursos</b>: solo saldrán en esta pantalla.</p>'}</div>
    ${det.length || fondoPropio ? `${hermanas ? `<button class="btn btn-sm btn-block" data-copiar-det style="margin-top:8px;">📋 Copiar estos detalles a las demás pantallas de ${esc(d.codigo)} (${hermanas})</button>` : ''}
      <button class="btn btn-sm btn-block btn-ghost" data-quitar-det style="margin-top:4px;">🗑 Quitar los detalles de esta pantalla</button>` : ''}
    ${fondoPropio ? '<button class="btn btn-sm btn-block" data-fondo-pl style="margin-top:4px;">↺ Volver al fondo de la plantilla</button>' : ''}` : '<p class="hint">Pega la letra en <b>🎵 Letra</b> y aquí verás cada pantalla.</p>'}`;
  const detPl = $('[data-det-pl]', p);
  const pintarPls = async () => {
    const cont = $('[data-pls]', p);
    if (!detPl.open || cont.childElementCount) return;
    const lineas = d ? d.fuente : [{ t: 'Te alabaré con todo mi ser' }, { t: 'tu amor me sostiene' }];
    const lista = [...misPlantillas(), ...PLANTILLAS_CULTO];
    cont.innerHTML = '<div class="center" style="grid-column:1/-1; padding:12px;"><div class="spinner"></div></div>';
    await Promise.all(lista.map(x => prepararFuente(x.id)));   // se mide con la fuente real de cada plantilla
    if (!cont.isConnected) return;
    cont.innerHTML = lista.map(x => `<button type="button" data-pl="${esc(x.id)}" class="${x.id === pl.id ? 'sel' : ''}" title="${esc(x.nombre)}"><div data-mini></div><span>${x.mia ? '⭐ ' : ''}${esc(x.nombre)}</span></button>`).join('');
    lista.forEach(x => {
      const b = $(`[data-pl="${CSS.escape(x.id)}"]`, cont);
      pintarPantalla($('[data-mini]', b), x.id, lineas, { resaltados: cancion.resaltados });
      b.onclick = async () => {
        cancion.opciones.plantilla = x.id;
        try { localStorage.setItem('cultos.plantilla', x.id); } catch { /* sin almacenamiento */ }
        await prepararFuente(x.id);
        cambioCancion();
      };
    });
  };
  detPl.ontoggle = () => { verPlantillas = detPl.open; pintarPls(); };
  pintarPls();
  $$('[data-elegir]', p).forEach(b => b.onclick = () => { selId = b.dataset.elegir; pintarSeleccion(); pintarPropiedades(); });
  const cp = $('[data-copiar-det]', p);
  if (cp) cp.onclick = () => {
    for (const x of hojas) {
      if (x === h || x.info?.bloque !== d.bloque) continue;
      x.diseno.elementos = [...x.diseno.elementos.filter(e => e.bloqueado), ...det.map(e => ({ ...clonar(e), id: uid() }))];
      x.diseno.fondo = clonar(h.diseno.fondo);
    }
    confirmarCambio({ repintar: 'todo' });
    toast(`Detalles copiados a ${hermanas} ${hermanas === 1 ? 'pantalla' : 'pantallas'} de ${d.codigo}`);
  };
  const qd = $('[data-quitar-det]', p);
  if (qd) qd.onclick = () => { h.diseno.elementos = h.diseno.elementos.filter(e => e.bloqueado); h.diseno.fondo = JSON.parse(fondoPlantilla()); selId = null; confirmarCambio({ repintar: 'todo' }); };
  const fp = $('[data-fondo-pl]', p);
  if (fp) fp.onclick = () => { h.diseno.fondo = JSON.parse(fondoPlantilla()); confirmarCambio(); };
}

// ---------- ✨ Resaltar: elegir palabras en la letra ----------
function conectarResaltar() {
  const escn = $('[data-escenario]');
  const revisar = () => {
    const sel = getSelection();
    const zona = lienzo?.querySelector('.pe[data-vinculo="letra"]');
    if (!zona || !sel || sel.isCollapsed || !sel.rangeCount || !zona.contains(sel.anchorNode)) return;
    const ws = [...zona.querySelectorAll('.w[data-w]')].filter(w => sel.containsNode(w, true));
    if (!ws.length) return;
    const grupos = [];
    for (const w of ws) {
      const k = w.dataset.b + ':' + w.dataset.l;
      let g = grupos.find(x => x.k === k);
      if (!g) grupos.push(g = { k, b: +w.dataset.b, l: +w.dataset.l, w: [] });
      g.w.push(+w.dataset.w);
    }
    const anclas = grupos.map(g => {
      const p = Math.min(...g.w), n = Math.max(...g.w) - p + 1;
      return { b: g.b, l: g.l, p, n, texto: palabras(lineasDeContenido(cancion.bloques[g.b]?.texto)[g.l]).slice(p, p + n).join(' ') };
    }).filter(a => a.texto);
    if (anclas.length) abrirResaltar(anclas, null, sel.getRangeAt(0).getBoundingClientRect());
  };
  escn.addEventListener('pointerup', () => setTimeout(revisar, 10));
  let tSel;
  document.addEventListener('selectionchange', () => { if (matchMedia('(pointer: coarse)').matches) { clearTimeout(tSel); tSel = setTimeout(revisar, 600); } });
  // tocar una palabra ya resaltada abre sus opciones
  escn.addEventListener('click', (e) => {
    const rs = e.target.closest('.pe[data-vinculo="letra"] .rs');
    if (!rs || !getSelection()?.isCollapsed) return;
    const r = cancion.resaltados.find(x => x.id === rs.dataset.rs);
    if (r) abrirResaltar([r], r, rs.getBoundingClientRect());
  });
}
function abrirResaltar(anclas, actualR, rect) {
  let ids = actualR ? [actualR.id] : [];
  const z = plantillaDe(plantillaDeCancion(cancion)).diseno?.elementos?.find(e => e.vinculo === 'letra') || plantillaDe(plantillaDeCancion(cancion)).elementos?.find(e => e.vinculo === 'letra');
  abrirBarraResaltar({
    cont: $('.ed-centro'), rect, actual: actualR, fuentePlantilla: z?.fuente || 'Nunito',
    texto: anclas.map(a => a.texto).join(' / '),
    alCambiar: (estilo, todas) => {
      if (!ids.length) ids = anclas.map(a => { const r = { id: uid(), b: a.b, l: a.l, p: a.p, n: a.n, texto: a.texto, todas, estilo }; cancion.resaltados.push(r); return r.id; });
      else ids.forEach(id => { const r = cancion.resaltados.find(x => x.id === id); if (r) { r.estilo = estilo; r.todas = todas; } });
      getSelection()?.removeAllRanges();
      cambioCancion();
    },
    alQuitar: () => { cancion.resaltados = cancion.resaltados.filter(r => !ids.includes(r.id)); cambioCancion(); }
  });
}

// ======================= ARRANQUE =======================
function pantallaError(msg) {
  document.body.className = 'centrado';
  raiz.innerHTML = `<div class="hoja center"><div style="font-size:50px;">⚠️</div><h2 style="margin:8px 0;">No se pudo abrir el proyecto</h2>
    <p class="muted" style="font-weight:700; margin-bottom:14px;">${esc(msg)}</p><a class="btn btn-primary btn-block" href="${VOLVER}">Volver a mis proyectos</a></div>`;
}

// Abre una plantilla de culto: una mía (?plantilla=<id>) o una prediseñada / en blanco sin guardar (?plantilla=nueva&base=…)
async function abrirPlantilla() {
  const id = params.get('plantilla');
  let fila;
  if (id && id !== 'nueva') {
    fila = await datosPlantillas.obtener(id);
    if (!fila) throw new Error('Esa plantilla ya no existe.');
    plantilla = { id: fila.id, base: fila.base, categoria: fila.categoria };
    base = fila.updated_at;
  } else {
    const b = params.get('base');
    const pre = b === 'blanco' ? PLANTILLA_BLANCO : plantillaIncluida(b) || PLANTILLA_BLANCO;
    fila = { nombre: pre.nombre, categoria: pre.id === 'blanco' ? 'Mis plantillas' : pre.categoria, diseno: { fondo: pre.fondo, elementos: pre.elementos } };
    plantilla = { id: null, base: pre.id === 'blanco' ? null : pre.id, categoria: fila.categoria };
  }
  const d = clonar(fila.diseno || {});
  proyecto = { nombre: fila.nombre, tema: {} };
  hojas = [{ id: uid(), tipo: 'contenido', config: {}, diseno: { fondo: d.fondo || { tipo: 'color', valor: '#111827' },
    elementos: (d.elementos || []).map(e => ({ ...e, id: plantilla.id ? e.id || uid() : uid() })) } }];
  montar();
}

perfil = await exigirRol(['profesor', 'admin']);
if (perfil && MODO_CAN) {
  try { await abrirCancion(); } catch (e) { console.error(e); pantallaError(mensajeError(e)); }
} else if (perfil && MODO_PL) {
  try { await abrirPlantilla(); } catch (e) { console.error(e); pantallaError(mensajeError(e)); }
} else if (perfil) {
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
