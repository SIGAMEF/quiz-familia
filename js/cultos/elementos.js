// ============================================================
// Cultos: los elementos de un culto y sus pantallas
// Un culto es una lista ordenada de elementos (cultos.items):
//   { id, tipo: 'cancion', cancion: <uuid>, plantilla }      plantilla '' = la del culto, 'cancion' = la de la canción
//   { id, tipo: 'versiculo', cita, texto, ref, version, numeros, plantilla }   el texto ya viene de la Biblia (js/cultos/biblia.js) o pegado
//   { id, tipo: 'texto', titulo, texto, portada, plantilla }  portada: primero la portada de la plantilla
//   { id, tipo: 'anuncio', url, nombre, plantilla }           sin imagen: la portada de la plantilla
//   { id, tipo: 'video', url, nombre }                        YouTube, Vimeo o un video de Mis archivos
//   { id, tipo: 'regresiva', minutos, texto, plantilla }
//   { id, tipo: 'diseno', plantilla }                          la portada de una plantilla (prediseñada o mía) como pantalla
// Cada elemento se convierte en hojas del lienzo de Proyectos (una por pantalla). Las hojas son datos
// simples: la consola se las pasa tal cual a la pantalla de proyección.
// ============================================================
import { leerVideo } from '../proyectos/lienzo.js';
import { plantillaDe, hojaDePantalla, hojasDeCancion, ajustar, existePlantilla } from './diapositivas.js';
import { hojaDePlantilla } from './plantillas.js';
import { repartir } from './letra.js';

export const TIPOS_ELEMENTO = {
  cancion: { ico: '🎵', nombre: 'Canción' },
  versiculo: { ico: '📖', nombre: 'Versículo' },
  texto: { ico: '👋', nombre: 'Texto / Bienvenida' },
  anuncio: { ico: '📢', nombre: 'Anuncio / Imagen' },
  video: { ico: '▶️', nombre: 'Video' },
  regresiva: { ico: '⏱', nombre: 'Cuenta regresiva' },
  diseno: { ico: '🎨', nombre: 'Plantilla / Diseño' }
};
export const MAX_ELEMENTOS = 120;
export const nuevoIdElemento = () => Math.random().toString(36).slice(2, 10);

// La plantilla con la que se ve un elemento
export function plantillaDeElemento(it, culto, cancion = null) {
  if (it.tipo === 'cancion' && it.plantilla === 'cancion') return plantillaDe(cancion?.opciones?.plantilla).id;
  if (it.plantilla && it.plantilla !== 'cancion' && existePlantilla(it.plantilla)) return it.plantilla;
  return plantillaDe(culto?.plantilla_base).id;
}

export function tituloDeElemento(it, canciones = new Map()) {
  if (it.tipo === 'cancion') return canciones.get(it.cancion)?.titulo || 'Canción no encontrada';
  if (it.tipo === 'versiculo') return it.cita || 'Versículo';
  if (it.tipo === 'texto') return it.nombre || it.titulo || primeraLinea(it.texto) || 'Texto';
  if (it.tipo === 'anuncio') return it.nombre || (it.url ? 'Imagen' : 'Anuncio');
  if (it.tipo === 'video') return it.nombre || 'Video';
  if (it.tipo === 'regresiva') return `${fmtReloj(segundosDe(it))} · ${it.texto || 'Cuenta regresiva'}`;
  if (it.tipo === 'diseno') return plantillaDe(it.plantilla).nombre;
  return 'Elemento';
}
const primeraLinea = (t) => String(t || '').split('\n').map(x => x.trim()).find(Boolean) || '';

// ---------- Texto en pantallas ----------
const lineasDe = (t) => String(t || '').replace(/\r/g, '').split('\n').map(x => x.replace(/\s+/g, ' ').trim());
// Parte un texto largo por las frases (y si no hay, por las palabras) en trozos de máximo `max` letras
function partirLargo(linea, max) {
  if (linea.length <= max) return [linea];
  const frases = linea.match(/[^.;:!?]+[.;:!?]*\s*/g) || [linea];
  const out = [];
  let act = '';
  for (const f of frases.flatMap(f => f.length <= max ? [f] : f.split(/(?<=\s)/))) {
    if (act && (act + f).trim().length > max) { out.push(act.trim()); act = ''; }
    act += f;
  }
  if (act.trim()) out.push(act.trim());
  return out;
}
// Versículos: cada línea es un versículo; se juntan hasta ~200 letras o 4 líneas por pantalla
export function trozosDeVersiculo(texto, opciones) { return partesDeVersiculo(texto, opciones).map(t => t.map(x => x.t)); }
// Lo mismo, pero cada parte recuerda su línea (l) y desde qué palabra empieza (p0), para ubicar las palabras "botón"
export function partesDeVersiculo(texto, { max = 200, lineas = 4 } = {}) {
  const versos = lineasDe(texto).flatMap((l, k) => {
    if (!l) return [];
    let p0 = 0;
    return partirLargo(l, max).map(t => { const x = { t, l: k, p0 }; p0 += t.split(' ').filter(Boolean).length; return x; });
  });
  const out = [];
  let act = [];
  for (const v of versos) {
    const largo = act.reduce((t, x) => t + x.t.length, 0) + v.t.length;
    if (act.length && (largo > max || act.length >= lineas)) { out.push(act); act = []; }
    act.push(v);
  }
  if (act.length) out.push(act);
  return out;
}
// Resaltados de un versículo ({ l, p, n, texto, estilo }) para una pantalla: cada parte pasa a ser la línea k
function resaltadosDePartes(partes, resaltados, mov) {
  if (!resaltados?.length) return null;
  if (mov) resaltados = resaltados.map(r => r.estilo?.modo === 'boton' ? { ...r, estilo: { ...r.estilo, mov } } : r);
  const out = [];
  partes.forEach((x, k) => {
    const w = x.t.split(' ').filter(Boolean);
    for (const r of resaltados) {
      if (r.l !== x.l || r.p < x.p0 || r.p >= x.p0 + w.length) continue;
      const p = r.p - x.p0;
      if (r.texto && w.slice(p, p + (r.n || 1)).join(' ').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() !== String(r.texto).replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()) continue;
      out.push({ ...r, b: 0, l: k, p, n: Math.min(r.n || 1, w.length - p) });
    }
  });
  return out.length ? out : null;
}
// Texto libre: cada párrafo (separado por una línea en blanco) en pantallas de hasta 6 líneas
export function trozosDeTexto(texto) {
  const parrafos = String(texto || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => lineasDe(p).filter(Boolean)).filter(p => p.length);
  return parrafos.flatMap(p => repartir(p.flatMap(l => partirLargo(l, 120)), 6));
}

// ---------- Hojas ----------
// Una pantalla de letra de la plantilla con estas líneas (ajustadas al cuadro) y un pie
export function hojaDeLetra(id, lineas, pie = '', resaltados = null) {
  const fuente = lineas.map((t, l) => resaltados ? { t, b: 0, l } : { t });
  const a = ajustar(id, fuente, resaltados);
  return { ...hojaDePantalla(id, a.tam), ver: 'letra', textos: { fuente, pie, partir: a.partir, chico: a.chico }, ...(resaltados ? { resaltados } : {}) };
}
export const hojaDePortada = (id) => ({ ...hojaDePlantilla(plantillaDe(id)), ver: 'portada' });
// Los elementos de una plantilla que se ven con letra, sin la zona de la letra ni el pie (para armar pantallas propias)
function decoradoDe(id) {
  const d = hojaDePlantilla(plantillaDe(id)).diseno;
  const z = d.elementos.find(e => e.vinculo === 'letra') || {};
  return {
    fondo: d.fondo,
    elementos: d.elementos.filter(e => (!e.en || e.en === 'letra') && !e.vinculo),
    estilo: { fuente: z.fuente, color: z.color || '#FFFFFF', peso: z.peso, cursiva: z.cursiva, efecto: z.efecto, sombra: z.sombra, espaciado: z.espaciado }
  };
}

// Cuenta regresiva
const segundosDe = (it) => Math.round(Math.max(0.25, Math.min(120, Number(it.minutos) || 5)) * 60);
export const fmtReloj = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function hojaDeRegresiva(it, id) {
  const d = decoradoDe(id);
  const seg = segundosDe(it);
  const elementos = [...d.elementos];
  if (it.texto) elementos.push({ id: 'reloj-txt', contenido: true, tipo: 'texto', texto: String(it.texto).slice(0, 120), x: 8, y: 15, w: 84, h: 12, rot: 0, tam: 3.2, alinear: 'center', ...d.estilo });
  elementos.push({ id: 'reloj', contenido: true, tipo: 'texto', texto: fmtReloj(seg), x: 4, y: it.texto ? 30 : 26, w: 92, h: 44, rot: 0, tam: 16, alinear: 'center', interlineado: 1, ...d.estilo, espaciado: 0.02 });
  return { tipo: 'contenido', regresiva: seg, diseno: { fondo: d.fondo, elementos } };
}

// Imagen: completa (sin recortar) sobre la misma imagen desenfocada
function hojaDeImagen(url) {
  return { tipo: 'contenido', diseno: {
    fondo: { tipo: 'imagen', valor: url, modo: 'cubrir', desenfoque: 20, oscurecer: 0.45, color: '#000000' },
    elementos: [{ id: 'img', contenido: true, tipo: 'imagen', url, ajuste: 'contain', x: 0, y: 0, w: 100, h: 100, rot: 0 }] } };
}
function hojaDeVideo(url) {
  const v = leerVideo(url);
  return { tipo: 'contenido', video: !!v, diseno: {
    fondo: { tipo: 'color', valor: '#000000' },
    elementos: v ? [{ id: 'video', contenido: true, tipo: 'video', ...v, auto: true, x: 0, y: 0, w: 100, h: 100, rot: 0 }]
      : [{ id: 'video', contenido: true, tipo: 'texto', texto: '▶ Falta el enlace del video', x: 10, y: 40, w: 80, h: 20, rot: 0, tam: 4, color: '#FFFFFF' }] } };
}

// Todas las pantallas de un elemento: [{ id, etiqueta, ...hoja }]
// canciones: Map id → canción (con bloques, opciones, resaltados y detalles)
export function hojasDeElemento(it, culto, canciones = new Map()) {
  const cancion = it.tipo === 'cancion' ? canciones.get(it.cancion) : null;
  const pid = plantillaDeElemento(it, culto, cancion);
  const con = (lista, etiqueta) => lista.map((h, i) => ({ ...h, id: `${it.id}-${i}`, etiqueta: typeof etiqueta === 'function' ? etiqueta(h, i) : etiqueta }));
  if (it.tipo === 'cancion') {
    if (!cancion) return con([hojaDeLetra(pid, ['Canción no encontrada'], 'Quizá se borró de la biblioteca')], 'Sin letra');
    const hojas = hojasDeCancion({ ...cancion, opciones: { ...(cancion.opciones || {}), plantilla: pid } });
    if (!hojas.length) return con([hojaDeLetra(pid, [cancion.titulo], 'Esta canción todavía no tiene letra')], 'Título');
    return hojas.map(h => ({ ...h, id: `${it.id}-${h.id}`, etiqueta: h.info?.nombre || 'Letra' }));
  }
  if (it.tipo === 'versiculo') {
    // porVerso: un versículo por pantalla (como se proyecta desde la Biblia)
    const trozos = partesDeVersiculo(it.texto, it.porVerso ? { lineas: 1, max: 260 } : undefined);
    const pie = String(it.cita || '').trim();
    if (!trozos.length) return con([hojaDeLetra(pid, [pie || 'Escribe el versículo'], '')], 'Cita');
    return con(trozos.map(t => hojaDeLetra(pid, t.map(x => x.t), pie, resaltadosDePartes(t, it.resaltados, it.mov))), (h, i) => trozos.length > 1 ? `Parte ${i + 1}` : 'Versículo');
  }
  if (it.tipo === 'texto') {
    const titulo = String(it.titulo || '').trim();
    const trozos = trozosDeTexto(it.texto);
    const hojas = [];
    if (it.portada) hojas.push({ ...hojaDePortada(pid), etiqueta: 'Portada' });
    if (trozos.length) hojas.push(...trozos.map((t, i) => ({ ...hojaDeLetra(pid, t, titulo), etiqueta: trozos.length > 1 ? `Texto ${i + 1}` : 'Texto' })));
    else if (titulo || !hojas.length) hojas.push({ ...hojaDeLetra(pid, [titulo || 'Bienvenidos'], ''), etiqueta: 'Título' });
    return hojas.map((h, i) => ({ ...h, id: `${it.id}-${i}` }));
  }
  if (it.tipo === 'anuncio') return con([it.url ? hojaDeImagen(it.url) : hojaDePortada(pid)], it.url ? 'Imagen' : 'Portada');
  if (it.tipo === 'video') return con([hojaDeVideo(it.url)], 'Video');
  if (it.tipo === 'diseno') return con([hojaDePortada(pid)], 'Diseño');
  if (it.tipo === 'regresiva') return con([hojaDeRegresiva(it, it.plantilla && existePlantilla(it.plantilla) ? it.plantilla : pid)], 'Reloj');
  return [];
}

// Pantallas de "Logo" (la portada de la plantilla base) y "Limpiar texto" (solo el fondo y los adornos)
export const hojaLogo = (culto) => ({ ...hojaDePortada(plantillaDe(culto?.plantilla_base).id), id: 'logo', etiqueta: 'Logo' });
export function sinTexto(h) {
  if (!h) return h;
  return { ...h, id: h.id + '-limpio', regresiva: null, textos: null,
    diseno: { ...h.diseno, elementos: (h.diseno?.elementos || []).filter(e => !e.contenido && e.vinculo !== 'letra' && e.vinculo !== 'pie' && (h.ver !== 'portada' || e.tipo !== 'texto')) } };
}

// El reloj de una cuenta regresiva dibujada en `lienzo`: cuenta desde `inicio` (ms) o se queda en el total.
// Devuelve una función para detenerlo.
export function montarReloj(lienzo, hoja, inicio = null) {
  const txt = hoja?.regresiva && lienzo?.querySelector('.pe[data-id="reloj"] .pe-txt');
  if (!txt) return () => {};
  const tic = () => { txt.textContent = fmtReloj(inicio ? hoja.regresiva - (Date.now() - inicio) / 1000 : hoja.regresiva); };
  tic();
  if (!inicio) return () => {};
  const t = setInterval(() => { if (!txt.isConnected) return clearInterval(t); tic(); }, 250);
  return () => clearInterval(t);
}

// Las canciones que usa un culto
export const idsDeCanciones = (items) => [...new Set((items || []).filter(it => it.tipo === 'cancion' && it.cancion).map(it => it.cancion))];
// Las plantillas que usa un culto (para cargar sus letras antes de medir)
export function plantillasDeCulto(culto, canciones) {
  return [...new Set([plantillaDe(culto?.plantilla_base).id, ...(culto?.items || []).map(it => plantillaDeElemento(it, culto, canciones.get(it.cancion)))])];
}
