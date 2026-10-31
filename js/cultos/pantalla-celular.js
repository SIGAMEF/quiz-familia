// ============================================================
// Cultos: una pantalla de la proyección adaptada al celular (modo "🎞 Como en pantalla" de letras.html)
// - Horizontal: la misma hoja de la proyección (16:9), con la posición de la letra que se eligió en el editor.
// - Vertical: la hoja se recompone en 9:16. El fondo cubre todo; la letra va al centro, casi a todo el ancho,
//   con el tamaño más grande que quepa (partiendo las líneas largas); los emojis, objetos e imágenes pequeñas
//   pasan a una franja arriba o abajo para no tapar la letra; las líneas separadas vuelven a la letra.
// Nada se sale: cada tamaño se mide antes de dibujar (medirZona en js/cultos/diapositivas.js).
// ============================================================
import { pintarHoja } from '../proyectos/lienzo.js';
import { medirZona } from './diapositivas.js';

export const ALTO_VERTICAL = 16 / 9;   // alto entre ancho de la pantalla vertical
const ALTO_HORIZONTAL = 0.5625;
const MAX_VERTICAL = 11;              // letra máxima en vertical (cqw: % del ancho del celular)
const FRANJA = 14;                    // alto máximo de la franja de arriba y la de abajo (% del alto)
const PEQUENOS = ['emoji', 'icono', 'objeto', 'imagen', 'forma', 'texto'];

const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const r1 = (n) => Math.round(n * 10) / 10;
const lineasDe = (h) => h.textos?.todas || h.textos?.fuente || [];

// Lo que se ve de una hoja en vertical: { hoja, alto }
export function hojaVertical(h, { escala = 1 } = {}) {
  const els = h?.diseno?.elementos || [];
  const zona = els.find(e => e.vinculo === 'letra'), pie = els.find(e => e.vinculo === 'pie');
  // sin zona de letra (portada, imagen, reloj): todo se ve centrado a lo ancho, con su forma
  if (!zona) return { hoja: centrarSinLetra(h), alto: ALTO_VERTICAL };
  const zx0 = num(zona.x), zy0 = num(zona.y), zx1 = zx0 + num(zona.w), zy1 = zy0 + num(zona.h);
  const fondos = [], arriba = [], abajo = [];
  for (const e of els) {
    if (e === zona || e === pie || e.vinculo === 'linea' || e.tipo === 'video') continue;
    const w = num(e.w, 10), hh = num(e.h, 10), cy = num(e.y) + hh / 2;
    // un panel detrás de la letra (casi todo dentro de la zona) acompaña a la letra
    const dentro = Math.max(0, Math.min(zx1, num(e.x) + w) - Math.max(zx0, num(e.x))) * Math.max(0, Math.min(zy1, num(e.y) + hh) - Math.max(zy0, num(e.y)));
    if (e.tipo === 'forma' && dentro >= w * hh * 0.6) { fondos.push({ e, rel: true }); continue; }
    // algo grande (una banda, un marco): se estira igual, detrás de todo
    if (w * hh > 2200 || w >= 70 || !PEQUENOS.includes(e.tipo)) { fondos.push({ e, rel: false }); continue; }
    (cy < 50 ? arriba : abajo).push(e);
  }
  // las franjas: cada cosa con su misma forma, más grande que en 16:9 pero sin pasar la franja
  const franja = (lista) => {
    const out = lista.map(e => {
      const w = num(e.w, 10), hh = num(e.h, 10);
      const prop = (hh * ALTO_HORIZONTAL) / Math.max(1, w);   // alto entre ancho, en pixeles
      let w2 = e.tipo === 'texto' ? 90 : Math.max(10, Math.min(e.tipo === 'imagen' ? 44 : 30, w * 1.6));
      let h2 = w2 * prop / ALTO_VERTICAL;
      if (h2 > FRANJA) { w2 *= FRANJA / h2; h2 = FRANJA; }
      const cx = num(e.x) + w / 2;
      return { ...e, w: r1(w2), h: r1(h2), x: r1(Math.max(2, Math.min(98 - w2, cx - w2 / 2))), rot: e.tipo === 'texto' ? 0 : num(e.rot),
        ...(e.tipo === 'texto' ? { tam: Math.min(num(e.tam, 3) * 1.6, 5) } : {}) };
    });
    return { out, alto: out.reduce((m, e) => Math.max(m, e.h), 0) };
  };
  const A = franja(arriba), B = franja(abajo);
  const pieAlto = pie ? 5 : 0;
  const top = 3, fondoAbajo = 97 - pieAlto;
  A.out.forEach(e => { e.y = r1(top + (A.alto - e.h) / 2); });
  B.out.forEach(e => { e.y = r1(fondoAbajo - B.alto + (B.alto - e.h) / 2); });
  const y0 = A.alto ? top + A.alto + 2 : 6, y1 = B.alto ? fondoAbajo - B.alto - 2 : fondoAbajo - 1;
  const geo = { x: 5, y: r1(y0), w: 90, h: r1(y1 - y0), rot: 0 };
  // la letra: el tamaño más grande que quepa (con la escala de la letra de la canción y A−/A+)
  const lineas = lineasDe(h);
  const max = Math.min(18, MAX_VERTICAL * (num(zona.tamMax, 5.4) / 5.4) * escala);
  const z = { ...zona, ...geo };
  const a = medirZona(z, lineas, h.resaltados, { alto: ALTO_VERTICAL, max, umbral: Infinity });
  const elementos = [
    // lo grande, igual que en 16:9; un panel detrás de la letra se ubica igual respecto a la nueva zona
    ...fondos.map(({ e, rel }) => rel ? {
      ...e, rot: 0,
      x: r1(geo.x + (num(e.x) - zx0) / num(zona.w, 1) * geo.w), w: r1(num(e.w) / num(zona.w, 1) * geo.w),
      y: r1(geo.y + (num(e.y) - zy0) / num(zona.h, 1) * geo.h), h: r1(num(e.h) / num(zona.h, 1) * geo.h)
    } : e),
    ...A.out, ...B.out,
    { ...z, tam: a.tam },
    ...(pie ? [{ ...pie, x: 5, w: 90, y: 97 - pieAlto + 0.5, h: pieAlto - 1, rot: 0, tam: Math.max(2.4, num(pie.tam, 1.2) * 2) }] : [])
  ];
  return { hoja: { ...h, textos: { ...h.textos, fuente: lineas, partir: a.partir, chico: a.chico }, diseno: { ...h.diseno, elementos } }, alto: ALTO_VERTICAL };
}

// Una pantalla sin letra (portada, anuncio): el contenido 16:9 en una banda centrada, con el fondo cubriendo todo
function centrarSinLetra(h) {
  const k = ALTO_HORIZONTAL / ALTO_VERTICAL, y0 = (100 - 100 * k) / 2;
  const elementos = (h?.diseno?.elementos || []).map(e => ({ ...e, y: r1(y0 + num(e.y) * k), h: r1(num(e.h) * k) }));
  return { ...h, diseno: { ...h.diseno, elementos } };
}

// Horizontal: la hoja de la proyección; A−/A+ cambia el tamaño de la letra sin que se salga
export function hojaHorizontal(h, { escala = 1 } = {}) {
  if (escala === 1) return { hoja: h, alto: ALTO_HORIZONTAL };
  const els = (h?.diseno?.elementos || []).map(e => {
    if (e.vinculo !== 'letra' && e.vinculo !== 'linea') return e;
    const lineas = e.vinculo === 'linea' ? e.lineas : h.textos?.fuente || [];
    const a = medirZona(e, lineas, h.resaltados, { max: Math.min(16, num(e.tamMax, e.tam) * escala) });
    return e.vinculo === 'linea' ? { ...e, tam: a.tam, partir: a.partir, chico: a.chico } : { ...e, tam: a.tam, _a: a };
  });
  const z = els.find(e => e._a);
  const textos = z ? { ...h.textos, partir: z._a.partir, chico: z._a.chico } : h.textos;
  return { hoja: { ...h, textos, diseno: { ...h.diseno, elementos: els.map(({ _a, ...e }) => e) } }, alto: ALTO_HORIZONTAL };
}

// Dibuja la pantalla en `cont` para un celular vertical u horizontal. Devuelve el lienzo
export function pintarComoPantalla(cont, h, { vertical = true, escala = 1, animar = true } = {}) {
  const { hoja, alto } = vertical ? hojaVertical(h, { escala }) : hojaHorizontal(h, { escala });
  // el video de fondo no se baja en el celular: se ve su portada
  const lienzo = pintarHoja(cont, hoja, { modo: 'ver', animar, alto, video: false });
  sinDesbordes(lienzo);
  // si una fuente llega después de dibujar, la letra puede ensancharse: se revisa otra vez
  document.fonts?.ready?.then(() => requestAnimationFrame(() => sinDesbordes(lienzo)));
  for (const ms of [400, 1500]) setTimeout(() => sinDesbordes(lienzo), ms);
  return lienzo;
}
// Última protección (p. ej. si la fuente llegó después de medir): un texto que no cabe se achica hasta caber
export function sinDesbordes(lienzo) {
  if (!lienzo?.isConnected) return;
  for (const t of lienzo?.querySelectorAll('.pe-txt') || []) {
    const pe = t.parentElement;
    for (let k = 0; k < 14 && (t.scrollHeight > pe.clientHeight + 1 || t.scrollWidth > pe.clientWidth + 1); k++) {
      const tam = parseFloat(t.style.fontSize);
      if (!tam) break;
      t.style.fontSize = (tam * 0.94).toFixed(2) + 'cqw';
    }
  }
}
