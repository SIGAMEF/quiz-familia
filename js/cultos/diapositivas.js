// ============================================================
// Cultos: dibujo de las pantallas de una canción con el lienzo de Proyectos en grupo
// - La plantilla (js/cultos/plantillas.js o una del profesor) es una hoja del lienzo; en las pantallas
//   de letra se ven sus elementos "de letra" y "de las dos" (sin los de la portada).
// - El texto se ajusta solo: el tamaño más grande que quepa en la zona de la letra (en cqw, así una
//   miniatura y el proyector se ven igual), primero sin partir las líneas y, si no cabe, partiéndolas.
// ============================================================
import { pintarHoja, asegurarFuentes } from '../proyectos/lienzo.js';
import { fuenteValida } from '../proyectos/recursos.js';
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

// La hoja de una pantalla de letra, con el tamaño de letra ajustado
export function hojaDePantalla(id, tam) {
  const h = hojaDePlantilla(plantillaDe(id));
  return { tipo: 'contenido', diseno: { ...h.diseno, elementos: h.diseno.elementos.map(e => e.vinculo === 'letra' && tam ? { ...e, tam } : e) } };
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
export function ajustar(id, lineas, resaltados = null) {
  const p = plantillaDe(id), z = zonaLetra(p);
  if (!z) return { tam: 5, partir: true, chico: false };
  const max = Number(z.tam) || 5.4;
  const fuente = (lineas || []).map(x => typeof x === 'string' ? { t: x } : x);
  const clave = `${p.id}|${p.updated_at || ''}|${JSON.stringify(fuente)}|${resaltados?.length ? JSON.stringify(resaltados) : ''}`;
  if (cache.has(clave)) return cache.get(clave);
  // se mide solo la zona de la letra, sobre un fondo liso y sin animaciones
  const lienzo = pintarHoja(caja(), { diseno: { fondo: { tipo: 'color', valor: '#000000' }, elementos: [z] } },
    { modo: 'miniatura', ver: 'letra', textos: { fuente }, resaltados, animar: false });
  const pe = lienzo.querySelector('.pe-texto'), txt = pe?.querySelector('.pe-txt');
  if (!txt) return { tam: max, partir: true, chico: false };
  Object.assign(txt.style, { display: 'block', height: 'auto', overflowWrap: 'normal', wordBreak: 'normal', whiteSpace: 'pre' });
  let tam = mayorQueCabe(txt, pe, max), partir = false;
  if (tam < SIN_PARTIR) {
    txt.style.whiteSpace = 'pre-wrap';
    const conPartir = mayorQueCabe(txt, pe, max);
    if (conPartir > tam) { tam = conPartir; partir = true; }
  }
  const r = { tam, partir, chico: tam < MIN_TAM };
  if (cache.size > 800) cache.clear();
  cache.set(clave, r);
  return r;
}

// Espera la fuente de la letra de la plantilla (para medir con la letra real), como máximo ~1,5 s
const fuentesListas = new Set();
export async function prepararFuente(id) {
  asegurarFuentes();
  const z = zonaLetra(plantillaDe(id));
  const f = fuenteValida(z?.fuente);
  if (fuentesListas.has(f) || !document.fonts?.load) return;
  await Promise.race([Promise.all([document.fonts.load(`800 40px "${f}"`), document.fonts.load(`400 40px "${f}"`)]).catch(() => {}),
    new Promise(r => setTimeout(r, 1500))]);
  fuentesListas.add(f);
  cache.clear();
}

// Las hojas de una canción (una por pantalla): la plantilla de la canción (sus elementos quedan bloqueados),
// la letra con sus resaltados y los detalles propios de esa pantalla (cancion.detalles[clave] = { el, fondo }).
export const plantillaDeCancion = (c) => plantillaDe(c?.opciones?.plantilla).id;
export function hojasDeCancion(c) {
  const id = plantillaDeCancion(c);
  const base = hojaDePlantilla(plantillaDe(id)).diseno;
  return diapositivas(c).map(d => {
    const det = c.detalles?.[d.clave] || {};
    const a = ajustar(id, d.fuente, c.resaltados);
    return {
      id: d.clave, tipo: 'contenido', config: {}, info: d, ver: 'letra', resaltados: c.resaltados || [], chico: a.chico,
      textos: { fuente: d.fuente, pie: `${c.titulo || 'Canción'} · ${d.nombre}`, partir: a.partir, chico: a.chico },
      diseno: {
        fondo: det.fondo || base.fondo,
        elementos: [
          ...base.elementos.filter(e => !e.en || e.en === 'letra').map(e => ({ ...e, bloqueado: true, ...(e.vinculo === 'letra' ? { tam: a.tam } : {}) })),
          ...(Array.isArray(det.el) ? det.el : [])
        ]
      }
    };
  });
}

// Dibuja una pantalla de letra en `cont` (líneas de texto o { t, b, l }). Devuelve el ajuste usado.
// pie: "Título · Estrofa 1" para el pie de la plantilla (si tiene)
export function pintarPantalla(cont, id, lineas, { modo = 'miniatura', pie = '', animar, resaltados = null } = {}) {
  const fuente = (lineas || []).map(x => typeof x === 'string' ? { t: x } : x);
  const a = ajustar(id, fuente, resaltados);
  pintarHoja(cont, hojaDePantalla(id, a.tam), { modo, ver: 'letra', textos: { fuente, pie, partir: a.partir, chico: a.chico }, resaltados,
    ...(animar === undefined ? {} : { animar }) });
  return a;
}

// La portada de una plantilla (galería y vista grande)
export function pintarPortada(cont, id, { modo = 'miniatura', animar } = {}) {
  return pintarHoja(cont, hojaDePlantilla(plantillaDe(id)), { modo, ver: 'portada', ...(animar === undefined ? {} : { animar }) });
}
