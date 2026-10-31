// ============================================================
// Cultos: dibujo de las pantallas de una canción con el lienzo de Proyectos en grupo
// - La plantilla (js/cultos/plantillas.js o una del profesor) es una hoja del lienzo; en las pantallas
//   de letra se ven sus elementos "de letra" y "de las dos" (sin los de la portada).
// - El texto se ajusta solo: el tamaño más grande que quepa en la zona de la letra (en cqw, así una
//   miniatura y el proyector se ven igual), primero sin partir las líneas y, si no cabe, partiéndolas.
// ============================================================
import { pintarHoja, asegurarFuentes } from '../proyectos/lienzo.js';
import { fuenteValida, cargarFuente } from '../proyectos/recursos.js';
import { PLANTILLAS, PLANTILLA_DEFECTO, plantillaIncluida, hojaDePlantilla } from './plantillas.js';
import { diapositivas } from './letra.js';

const MIN_TAM = 2.6;       // letra mínima legible (cqw: % del ancho de la pantalla)
const SIN_PARTIR = 3.6;    // si sin partir las líneas cabe a este tamaño o más, no se parten

// Plantillas del profesor ya cargadas (id 'mi:<uuid>')
const mias = new Map();
export function registrarMisPlantillas(lista) {
  mias.clear();
  for (const p of lista || []) mias.set('mi:' + p.id, { ...p, id: 'mi:' + p.id, idBase: p.id, mia: true });
}
export const misPlantillas = () => [...mias.values()];
export function plantillaDe(id) {
  return mias.get(id) || plantillaIncluida(id) || plantillaIncluida(PLANTILLA_DEFECTO) || PLANTILLAS[0];
}
export const existePlantilla = (id) => mias.has(id) || !!plantillaIncluida(id);
const zonaLetra = (p) => hojaDePlantilla(p).diseno.elementos.find(e => e.vinculo === 'letra');
// La letra elegida para una canción (cancion.opciones.letra) o para una estrofa (cancion.opciones.letraEstrofas[bloque]),
// sobre la zona de la letra de la plantilla:
//   { fuente, peso, efecto, color, escala (tamaño base: × el máximo de la plantilla), mayus, interlineado, alinear, sombra }
// efecto: null = sin efecto (aunque la plantilla tenga uno); sin la clave = el de la plantilla.
export const CAMPOS_LETRA = ['fuente', 'peso', 'efecto', 'color', 'escala', 'mayus', 'interlineado', 'alinear', 'sombra'];
export function zonaConLetra(z, letra) {
  if (!z || !letra) return z;
  const r = { ...z };
  for (const k of CAMPOS_LETRA) if (k in letra && k !== 'escala') r[k] = letra[k];
  if (letra.efecto === null) delete r.efecto;
  const esc = Number(letra.escala);
  if (esc && esc !== 1) r.tam = Math.max(1.5, Math.min(16, (Number(z.tam) || 5.4) * Math.max(0.5, Math.min(1.6, esc))));
  return r;
}
// La letra de una pantalla: la de la canción y, encima, la de su estrofa
export function letraDePantalla(c, bloque) {
  const g = c?.opciones?.letra, e = bloque != null ? c?.opciones?.letraEstrofas?.[bloque] : null;
  return g || e ? { ...(g || {}), ...(e || {}) } : null;
}

// La hoja de una pantalla de letra, con el tamaño de letra ajustado
export function hojaDePantalla(id, tam) {
  const h = hojaDePlantilla(plantillaDe(id));
  return { tipo: 'contenido', diseno: { ...h.diseno, elementos: h.diseno.elementos.map(e => e.vinculo === 'letra' && tam ? { ...e, tam, tamMax: Number(e.tam) || 5.4 } : e) } };
}

// ---------- Ajuste del texto ----------
let medidor = null;
const cache = new Map();
function caja() {
  if (medidor?.isConnected) return medidor;
  medidor = document.createElement('div');
  medidor.setAttribute('aria-hidden', 'true');
  Object.assign(medidor.style, { position: 'fixed', left: '-12000px', top: '0', width: '800px', visibility: 'hidden', pointerEvents: 'none' });
  document.body.appendChild(medidor);
  return medidor;
}
// ¿Cabe el texto a ese tamaño? (sin cortar palabras)
function cabe(txt, pe, tam) {
  txt.style.fontSize = tam + 'cqw';
  return txt.scrollHeight <= pe.clientHeight + 1 && txt.scrollWidth <= pe.clientWidth + 1;
}
function mayorQueCabe(txt, pe, max) {
  if (cabe(txt, pe, max)) return max;
  let lo = MIN_TAM * 0.6, hi = max;
  if (!cabe(txt, pe, lo)) return lo;
  for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2; if (cabe(txt, pe, m)) lo = m; else hi = m; }
  return Math.floor(lo * 20) / 20;
}
// Devuelve { tam, partir, chico } para unas líneas en una plantilla.
// lineas: textos o { t, b, l } (con resaltados, que pueden agrandar algunas palabras)
// geo: otra posición o tamaño de la zona ({ x, y, w, h, rot }: la letra movida en el editor o una línea separada)
export function ajustar(id, lineas, resaltados = null, letra = null, geo = null) {
  const p = plantillaDe(id), z0 = zonaConLetra(zonaLetra(p), letra), z = z0 && geo ? { ...z0, ...geo } : z0;
  if (!z) return { tam: 5, partir: true, chico: false };
  const fuente = (lineas || []).map(x => typeof x === 'string' ? { t: x } : x);
  return medirZona(z, fuente, resaltados, { clave: `${p.id}|${p.updated_at || ''}|${letra ? JSON.stringify(letra) : ''}|${geo ? JSON.stringify(geo) : ''}` });
}
// El tamaño más grande que quepa para unas líneas { t, b, l } en la zona z (un elemento de texto del lienzo).
// alto: la proporción del lienzo (16/9 = celular vertical); max: el tamaño máximo (cqw; sin él, z.tam);
// umbral: si sin partir las líneas cabe a este tamaño o más, no se parten (Infinity: lo que deje la letra más grande)
export function medirZona(z, fuente, resaltados = null, { alto = 0.5625, max = Number(z?.tam) || 5.4, umbral = SIN_PARTIR, clave = JSON.stringify(z) } = {}) {
  clave = `${clave}|${alto}|${max}|${umbral}|${JSON.stringify(fuente)}|${resaltados?.length ? JSON.stringify(resaltados) : ''}`;
  if (cache.has(clave)) return cache.get(clave);
  // se mide solo la zona de la letra, sobre un fondo liso y sin animaciones
  const lienzo = pintarHoja(caja(), { diseno: { fondo: { tipo: 'color', valor: '#000000' }, elementos: [{ ...z, tam: max }] } },
    { modo: 'miniatura', ver: 'letra', textos: { fuente }, resaltados, animar: false, alto });
  const pe = lienzo.querySelector('.pe-texto'), txt = pe?.querySelector('.pe-txt');
  if (!txt) return { tam: max, partir: true, chico: false };
  Object.assign(txt.style, { display: 'block', height: 'auto', overflowWrap: 'normal', wordBreak: 'normal', whiteSpace: 'pre' });
  let tam = mayorQueCabe(txt, pe, max), partir = false;
  if (tam < umbral) {
    txt.style.whiteSpace = 'pre-wrap';
    const conPartir = mayorQueCabe(txt, pe, max);
    if (conPartir > tam) { tam = conPartir; partir = true; }
  }
  const r = { tam, partir, chico: tam < MIN_TAM };
  if (cache.size > 800) cache.clear();
  cache.set(clave, r);
  return r;
}

// Olvida las medidas guardadas (p. ej. cuando termina de cargar una fuente)
export function olvidarMedidas() { cache.clear(); }

// Espera la fuente de la letra de la plantilla (para medir con la letra real), como máximo ~1,5 s.
// id: una plantilla, o 'fuente:<nombre>' para la letra elegida de una canción
const fuentesListas = new Set();
export async function prepararFuente(id) {
  asegurarFuentes();
  const f = String(id || '').startsWith('fuente:') ? fuenteValida(id.slice(7)) : fuenteValida(zonaLetra(plantillaDe(id))?.fuente);
  if (fuentesListas.has(f) || !document.fonts?.load) return;
  await Promise.race([cargarFuente(f).then(() => Promise.all([document.fonts.load(`800 40px "${f}"`), document.fonts.load(`400 40px "${f}"`)])).catch(() => {}),
    new Promise(r => setTimeout(r, 1500))]);
  fuentesListas.add(f);
  cache.clear();
}

// Las hojas de una canción (una por pantalla): la plantilla de la canción (sus elementos quedan bloqueados),
// la letra con sus resaltados y los detalles propios de esa pantalla (cancion.detalles[clave] = { el, fondo }).
export const plantillaDeCancion = (c) => plantillaDe(c?.opciones?.plantilla).id;
// La plantilla de una estrofa: la suya (cancion.opciones.plantillasEstrofas[bloque], p. ej. un coro distinto) o la de la canción
export function plantillaDeEstrofa(c, bloque) {
  const e = c?.opciones?.plantillasEstrofas?.[bloque];
  return e && existePlantilla(e) ? plantillaDe(e).id : plantillaDeCancion(c);
}
// ---------- La letra movida en el editor ----------
// La posición de la zona de la letra: la de esta pantalla (cancion.detalles[clave].zona), la de su estrofa
// (opciones.zonaEstrofas[bloque]) o la de toda la canción (opciones.zona); sin ninguna, la de la plantilla.
// Las líneas separadas (opciones.lineasSueltas['estrofa:línea'] = { x, y, w, h, rot }) son su propio cuadro.
export const CAMPOS_GEO = ['x', 'y', 'w', 'h', 'rot'];
export function geoValida(g) {
  if (!g || typeof g !== 'object') return null;
  const r = {};
  for (const k of CAMPOS_GEO) { const n = Number(g[k]); if (Number.isFinite(n)) r[k] = Math.round(n * 10) / 10; }
  return r.w > 0 && r.h > 0 ? r : null;
}
// La posición de la zona de la letra en la plantilla de una estrofa (sin cambios de la canción)
export function geoDePlantilla(c, bloque) {
  const z = zonaLetra(plantillaDe(plantillaDeEstrofa(c, bloque)));
  return z ? geoValida({ rot: 0, ...z }) : null;
}
export const geoDeZona = (c, d) => geoValida(c?.detalles?.[d.clave]?.zona) || geoValida(c?.opciones?.zonaEstrofas?.[d.bloque]) || geoValida(c?.opciones?.zona);
export const claveLinea = (f) => `${f.b}:${f.l}`;
export const idLinea = (f) => `suelta-${f.b}-${f.l}`;
export function hojasDeCancion(c) {
  const bases = new Map();
  const baseDe = (id) => { if (!bases.has(id)) bases.set(id, hojaDePlantilla(plantillaDe(id)).diseno); return bases.get(id); };
  const sueltas = c.opciones?.lineasSueltas || {};
  const esSuelta = (f) => f.l != null && geoValida(sueltas[claveLinea(f)]);
  return diapositivas(c).map(d => {
    const id = plantillaDeEstrofa(c, d.bloque), base = baseDe(id);
    const det = c.detalles?.[d.clave] || {};
    const letra = letraDePantalla(c, d.bloque);
    const geo = geoDeZona(c, d);
    const enZona = d.fuente.filter(f => !esSuelta(f)), aparte = d.fuente.filter(esSuelta);
    const a = ajustar(id, enZona, c.resaltados, letra, geo);
    const zona = base.elementos.find(e => e.vinculo === 'letra');
    const elementos = base.elementos.filter(e => !e.en || e.en === 'letra')
      .map(e => e.vinculo === 'letra' ? { ...zonaConLetra(e, letra), ...(geo || {}), bloqueado: true, tam: a.tam, tamMax: Number(zonaConLetra(e, letra).tam) || 5.4 } : { ...e, bloqueado: true });
    // cada línea separada: un cuadro con el estilo de la letra, con la letra más grande que quepa
    const lineas = zona ? aparte.map(f => {
      const g = geoValida(sueltas[claveLinea(f)]), aj = ajustar(id, [f], c.resaltados, letra, g);
      return { ...zonaConLetra(zona, letra), ...g, id: idLinea(f), vinculo: 'linea', suelta: claveLinea(f), lineas: [f],
        tam: aj.tam, tamMax: Number(zonaConLetra(zona, letra).tam) || 5.4, partir: aj.partir, chico: aj.chico, bloqueado: true };
    }) : [];
    return {
      id: d.clave, tipo: 'contenido', config: {}, info: d, ver: 'letra', resaltados: c.resaltados || [], chico: a.chico,
      // todas: la letra completa, para el celular vertical (acomodo automático, sin cuadros separados)
      textos: { fuente: enZona, pie: `${c.titulo || 'Canción'} · ${d.nombre}`, partir: a.partir, chico: a.chico, ...(aparte.length ? { todas: d.fuente } : {}) },
      diseno: {
        fondo: det.fondo || base.fondo,
        elementos: [...elementos, ...lineas, ...(Array.isArray(det.el) ? det.el : [])]
      }
    };
  });
}

// Dibuja una pantalla de letra en `cont` (líneas de texto o { t, b, l }). Devuelve el ajuste usado.
// pie: "Título · Estrofa 1" para el pie de la plantilla (si tiene)
export function pintarPantalla(cont, id, lineas, { modo = 'miniatura', pie = '', animar, resaltados = null, letra = null } = {}) {
  const fuente = (lineas || []).map(x => typeof x === 'string' ? { t: x } : x);
  const a = ajustar(id, fuente, resaltados, letra);
  const h = hojaDePantalla(id, a.tam);
  if (letra) h.diseno.elementos = h.diseno.elementos.map(e => e.vinculo === 'letra' ? zonaConLetra(e, letra) : e);
  pintarHoja(cont, h, { modo, ver: 'letra', textos: { fuente, pie, partir: a.partir, chico: a.chico }, resaltados,
    ...(animar === undefined ? {} : { animar }) });
  return a;
}

// La portada de una plantilla (galería y vista grande)
export function pintarPortada(cont, id, { modo = 'miniatura', animar } = {}) {
  return pintarHoja(cont, hojaDePlantilla(plantillaDe(id)), { modo, ver: 'portada', ...(animar === undefined ? {} : { animar }) });
}
