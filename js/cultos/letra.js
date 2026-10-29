// ============================================================
// Cultos · Canciones: la letra como texto (sin DOM, se puede probar con node)
// - El cuadro de la letra es la fuente de verdad: las estrofas se separan con una línea en blanco,
//   una línea "[Coro]" (o "Coro:", "Puente", "Verso 2"…) marca el tipo del bloque que sigue
//   y una línea "✂" fuerza un corte de pantalla.
// - Repeticiones: "//…//" (una o varias líneas) y "(x2)" al final de una línea o sola en una línea
//   (repite lo anterior del bloque). Se escriben repetidas o se muestran como "×2", según la opción.
// ============================================================

export const TIPOS_BLOQUE = {
  estrofa: { nombre: 'Estrofa', corto: 'E' },
  precoro: { nombre: 'Pre-coro', corto: 'PC' },
  coro: { nombre: 'Coro', corto: 'C' },
  puente: { nombre: 'Puente', corto: 'P' },
  intro: { nombre: 'Intro', corto: 'I' },
  final: { nombre: 'Final', corto: 'F' }
};
export const CORTE = '✂';
export const LINEAS_POR_PANTALLA = [2, 4, 6];
export const OPCIONES_DEFECTO = { lineas: 4, repeticiones: 'expandir' };

const SINONIMOS = {
  estrofa: 'estrofa', verso: 'estrofa', estrofas: 'estrofa', coro: 'coro', estribillo: 'coro', precoro: 'precoro', 'pre-coro': 'precoro',
  'pre coro': 'precoro', puente: 'puente', interludio: 'puente', intro: 'intro', introduccion: 'intro', final: 'final', outro: 'final',
  coda: 'final', cierre: 'final'
};
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// "(x2)", "x2", "2x", "(bis)", "(2 veces)", "(×3)" → número de veces
const REP = String.raw`\(?\s*(?:[x×]\s*(\d)|(\d)\s*[x×]|(\d)\s*veces|(bis))\s*\)?`;
const RE_REP_SOLA = new RegExp(`^${REP}$`, 'i');
const RE_REP_FINAL = new RegExp(`\\s+${REP}$`, 'i');
const vecesDe = (m) => m[4] ? 2 : Math.min(9, Math.max(2, Number(m[1] || m[2] || m[3]) || 2));

// Línea que solo es una etiqueta: "[Coro]", "CORO:", "Verso 2", "(Puente)", "Coro (x2)", "2."
const RE_ETIQUETA = new RegExp(String.raw`^[\[(]?\s*(estrofa|verso|coro|estribillo|pre[\s-]?coro|puente|interludio|intro|introduccion|final|outro|coda)\s*(\d+)?\s*[\])]?\s*[:.\-–]?\s*(?:${REP})?\s*$`, 'i');
const RE_ETIQUETA_TEXTO = /^\[?\s*(estrofa|verso|coro|estribillo|pre[\s-]?coro|puente|intro|final)\s*(\d+)?\s*\]?\s*:\s*(.+)$/i;
const RE_NUMERO = /^\d{1,2}\s*[.)]?$/;

export function leerEtiqueta(linea) {
  const l = sinTildes(String(linea || '').trim());
  if (RE_NUMERO.test(l)) return { tipo: 'estrofa', veces: 1 };
  const m = l.match(RE_ETIQUETA);
  if (!m) return null;
  const tipo = SINONIMOS[m[1].toLowerCase().replace(/\s+/g, ' ')] || SINONIMOS[m[1].toLowerCase().replace(/[\s-]/g, '')] || 'estrofa';
  const veces = m.slice(3).some(Boolean) ? vecesDe(m.slice(2)) : 1;
  return { tipo, veces };
}

// ---------- Limpieza al pegar ----------
const RE_BASURA = [
  /^letras?\s+(de|-|:)\s/i,
  /^(ver|mira|escuchar?|reproducir|descargar)\b.{0,25}\b(video|v[ií]deo|videoclip|canci[oó]n|mp3|audio|letra)/i,
  /^(compartir|enviar|imprimir|corregir( la)? letra|traducir|traducci[oó]n|publicidad|anuncio|advertisement|suscr[ií]bete|comentarios?|ver m[aá]s|ver todo|mostrar m[aá]s|ver letra completa|agregar a .*|añadir a .*|playlist|cifra|acordes|más canciones.*|otras canciones.*|canciones relacionadas.*|videos? relacionados?.*)$/i,
  /^(compositor(es)?|escrita por|escrito por|fuente|letra|m[uú]sica|[aá]lbum|album|disco|artista|int[eé]rprete|cantante|publicado|subido)\s*:/i,
  /^(https?:\/\/|www\.)\S+$/i,
  /^(©|\(c\)\s|copyright\b|todos los derechos)/i,
  /\b(letras\.com|musixmatch|cifraclub|azlyrics|genius\.com|lyrics?\b|letras\.mus)/i
];
const ACORDE_LAT = /^[A-G](#|b)?(m|maj|min|sus|dim|aug|add|M)?\d*(\/[A-G](#|b)?)?$/;
const ACORDE_ES = /^(do|re|mi|fa|sol|la|si)(#|b)?(m|maj|min|sus|dim|aug|add|7|9)*(\/(do|re|mi|fa|sol|la|si)(#|b)?)?$/i;
function esLineaDeAcordes(l) {
  const t = l.split(/\s+/).filter(Boolean);
  if (!t.length) return false;
  if (t.every(x => ACORDE_LAT.test(x))) return true;
  return t.length >= 2 && t.every(x => ACORDE_ES.test(x) || ACORDE_LAT.test(x));
}
const mayusculaInicial = (l) => RE_REP_SOLA.test(l) || l === CORTE ? l : l.replace(/^([¡¿"'«“(/\-–—\s]*)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase());

// Devuelve { texto, autor, tono } (autor y tono si la letra los traía: "Autor: …", "Tono: G")
export function limpiarLetra(texto, { mayusculas = true } = {}) {
  let autor = '', tono = '';
  const lineas = String(texto || '')
    .replace(/\r\n?/g, '\n').replace(/[​-‍﻿]/g, '').replace(/[ \t]/g, ' ')
    .split('\n').map(l => l.replace(/ {2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim());
  const salida = [];
  for (let l of lineas) {
    let m = l.match(/^(tono|tonalidad|key)\s*:\s*(.{1,12})$/i);
    if (m) { tono = tono || m[2].trim(); continue; }
    m = l.match(/^(autor(es)?|compositor(es)?|escrita por|escrito por)\s*:?\s*(.{2,80})$/i);
    if (m && /^(autor|compositor|escrit)/i.test(l)) { autor = autor || m[4].trim(); continue; }
    if (/^[-_*=~·•.]{3,}$/.test(l)) l = '';   // separadores → línea en blanco
    if (l && (RE_BASURA.some(re => re.test(l)) || esLineaDeAcordes(l))) continue;
    l = l.replace(/^\/\s*\/\s*/, '//').replace(/\s*\/\s*\/$/, '//');
    const rep = l.match(RE_REP_FINAL);
    if (rep && !RE_REP_SOLA.test(l)) l = l.slice(0, rep.index) + ` (x${vecesDe(rep)})`;
    else if (RE_REP_SOLA.test(l)) l = `(x${vecesDe(l.match(RE_REP_SOLA))})`;
    salida.push(l);
  }
  const bloques = textoABloques(salida.join('\n'));
  if (mayusculas) bloques.forEach(b => { b.texto = b.texto.split('\n').map(mayusculaInicial).join('\n'); });
  return { texto: bloquesATexto(bloques), autor, tono };
}

// ---------- Texto ↔ bloques ----------
// bloques: [{ tipo, texto }] (texto sin la línea de etiqueta; puede tener líneas "✂" y marcas de repetición)
export function textoABloques(texto) {
  const bloques = [];
  let actual = null;
  const cerrar = () => {
    if (actual && actual.lineas.some(l => l !== CORTE)) {
      while (actual.lineas[0] === CORTE) actual.lineas.shift();
      while (actual.lineas[actual.lineas.length - 1] === CORTE) actual.lineas.pop();
      if (actual.veces > 1) actual.lineas.push(`(x${actual.veces})`);
      bloques.push({ tipo: actual.tipo, texto: actual.lineas.join('\n') });
      actual = null;
    } else if (actual && !actual.etiquetado) actual = null;   // un bloque vacío sin etiqueta no cuenta
  };
  for (const cruda of String(texto || '').replace(/\r\n?/g, '\n').split('\n')) {
    const l = cruda.trim();
    if (!l) { if (actual && actual.lineas.some(x => x !== CORTE)) cerrar(); continue; }
    const et = leerEtiqueta(l);
    if (et) { cerrar(); actual = { tipo: et.tipo, veces: et.veces, lineas: [], etiquetado: true }; continue; }
    const conTexto = l.match(RE_ETIQUETA_TEXTO);
    if (conTexto && !RE_REP_SOLA.test(conTexto[3])) {
      cerrar();
      const tipo = leerEtiqueta(conTexto[1])?.tipo || 'estrofa';
      actual = { tipo, veces: 1, lineas: [conTexto[3].trim()], etiquetado: true };
      continue;
    }
    if (!actual) actual = { tipo: 'estrofa', veces: 1, lineas: [] };
    actual.lineas.push(l === '--' ? CORTE : l);
  }
  cerrar();
  return bloques;
}

export function bloquesATexto(bloques) {
  return (bloques || []).map(b => {
    const cab = b.tipo && b.tipo !== 'estrofa' ? `[${TIPOS_BLOQUE[b.tipo]?.nombre || 'Estrofa'}]\n` : '';
    return cab + String(b.texto || '').trim();
  }).join('\n\n');
}

// Etiquetas y códigos: Estrofa 1/E1, Coro/C1 (si hay dos coros: Coro 1/C1, Coro 2/C2), Pre-coro/PC1…
// (los códigos siempre llevan número; un orden de canto viejo con "C" se lee como "C1")
export function etiquetas(bloques) {
  const total = {}, cuenta = {};
  for (const b of bloques) total[b.tipo] = (total[b.tipo] || 0) + 1;
  return bloques.map(b => {
    const t = TIPOS_BLOQUE[b.tipo] || TIPOS_BLOQUE.estrofa;
    const n = cuenta[b.tipo] = (cuenta[b.tipo] || 0) + 1;
    const conNumero = b.tipo === 'estrofa' || total[b.tipo] > 1;
    return { nombre: conNumero ? `${t.nombre} ${n}` : t.nombre, codigo: `${t.corto}${n}` };
  });
}
const codigoNormal = (c) => { const s = String(c || '').toUpperCase().trim(); return /\d$/.test(s) ? s : s + '1'; };

// Índices de los bloques en el orden en que se cantan (orden de canto válido o el orden natural)
export function ordenDeCanto(bloques, orden) {
  const codigos = etiquetas(bloques).map(e => e.codigo);
  const idx = (orden || []).map(c => codigos.indexOf(codigoNormal(c))).filter(i => i >= 0);
  return idx.length ? idx : bloques.map((_, i) => i);
}
export const ordenNormal = (orden) => (orden || []).map(codigoNormal);
// "Coro después de cada estrofa": E1, C1, E2, C1, … (y el puente o el final donde estaban)
export function ordenSugerido(bloques) {
  const et = etiquetas(bloques);
  if (!bloques.some(b => b.tipo === 'coro')) return et.map(e => e.codigo);
  // el coro que sigue en la letra (o, si no hay, el último que hubo)
  const coroPara = (i) => {
    for (let j = i + 1; j < bloques.length; j++) if (bloques[j].tipo === 'coro') return j;
    for (let j = i - 1; j >= 0; j--) if (bloques[j].tipo === 'coro') return j;
    return -1;
  };
  const orden = [];
  bloques.forEach((b, i) => {
    if (b.tipo === 'coro') { if (i === 0) orden.push(et[i].codigo); return; }
    orden.push(et[i].codigo);
    const sig = bloques[i + 1];
    if ((b.tipo === 'estrofa' && sig?.tipo !== 'precoro') || b.tipo === 'precoro' || b.tipo === 'puente') orden.push(et[coroPara(i)].codigo);
  });
  return orden.filter((c, i) => c !== orden[i - 1]);
}

// ---------- Líneas de contenido (para anclar los resaltados) ----------
// Las líneas con palabras de un bloque, sin "✂", sin "(x2)" sola y sin las marcas // y (x2).
const esMarca = (l) => !l || l === CORTE || l === '--' || RE_REP_SOLA.test(l) || /^\/\/$/.test(l);
const sinMarcas = (l) => { const f = l.match(RE_REP_FINAL); if (f) l = l.slice(0, f.index).trim(); return l.replace(/^\/\/\s*/, '').replace(/\s*\/\/$/, '').trim(); };
export function lineasDeContenido(texto) {
  return String(texto || '').split('\n').map(x => x.trim()).filter(l => !esMarca(l)).map(sinMarcas).filter(Boolean);
}
export const palabras = (linea) => String(linea || '').split(/\s+/).filter(Boolean);

// ---------- Líneas para mostrar (repeticiones resueltas) ----------
// Devuelve segmentos (separados por "✂"), cada uno una lista de líneas { t, l } (l: línea de contenido de origen).
// conFuente = false devuelve solo los textos (como antes).
export function segmentosDeBloque(texto, modo = 'expandir', { conFuente = false } = {}) {
  const segmentos = [];
  let seg = [], grupo = null, li = -1;
  const marcar = (arr, n) => { if (arr.length) { const u = arr[arr.length - 1]; arr[arr.length - 1] = { ...u, t: `${u.t} ×${n}` }; } };
  const poner = (lineas, n) => {
    if (modo === 'expandir') for (let k = 0; k < n; k++) seg.push(...lineas);
    else { seg.push(...lineas); if (n > 1) marcar(seg, n); }
  };
  for (const cruda of String(texto || '').split('\n')) {
    let l = cruda.trim();
    if (!l) continue;
    if (l === CORTE || l === '--') { if (grupo) { poner(grupo, 2); grupo = null; } if (seg.length) segmentos.push(seg); seg = []; continue; }
    const sola = l.match(RE_REP_SOLA);
    if (sola) {
      if (grupo) { poner(grupo, 2); grupo = null; }
      const n = vecesDe(sola);
      if (modo === 'expandir') seg = Array.from({ length: n }, () => seg).flat(); else marcar(seg, n);
      continue;
    }
    let n = 1;
    const fin = l.match(RE_REP_FINAL);
    if (fin) { n = vecesDe(fin); l = l.slice(0, fin.index).trim(); }
    const abre = l.startsWith('//'), cierra = l.length > 2 && l.endsWith('//');
    l = l.replace(/^\/\/\s*/, '').replace(/\s*\/\/$/, '');
    if (!l) {   // "//" sola en una línea: abre o cierra el grupo
      if (grupo) { poner(grupo, Math.max(n, 2)); grupo = null; } else grupo = [];
      continue;
    }
    const linea = { t: l, l: ++li };
    if (abre && cierra) { poner([linea], Math.max(n, 2)); continue; }
    if (abre) { grupo = [linea]; continue; }
    if (grupo) { grupo.push(linea); if (cierra) { poner(grupo, Math.max(n, 2)); grupo = null; } continue; }
    poner([linea], n);
  }
  if (grupo) poner(grupo, 2);
  if (seg.length) segmentos.push(seg);
  return conFuente ? segmentos : segmentos.map(s => s.map(x => x.t));
}

// Reparte n líneas en pantallas de máximo `max`, lo más parejas posible (5 → 3 + 2, 6 → 3 + 3)
export function repartir(lineas, max = 4) {
  const k = Math.ceil(lineas.length / max);
  if (k <= 1) return lineas.length ? [lineas] : [];
  const base = Math.floor(lineas.length / k), extra = lineas.length % k;
  const out = [];
  let i = 0;
  for (let p = 0; p < k; p++) { const t = base + (p < extra ? 1 : 0); out.push(lineas.slice(i, i + t)); i += t; }
  return out;
}

// Pantallas de una canción: [{ clave, bloque, codigo, nombre, vez, parte, lineas: [texto], fuente: [{ t, b, l }] }]
// clave = "C1-2-1": segunda vez que se canta el C1, primera pantalla. Con ella se guardan los detalles de cada pantalla.
export function diapositivas(cancion) {
  const bloques = cancion?.bloques || [];
  const op = { ...OPCIONES_DEFECTO, ...(cancion?.opciones || {}) };
  const max = LINEAS_POR_PANTALLA.includes(Number(op.lineas)) ? Number(op.lineas) : 4;
  const et = etiquetas(bloques);
  const veces = {};
  const out = [];
  for (const i of ordenDeCanto(bloques, cancion?.orden_canto)) {
    const vez = veces[i] = (veces[i] || 0) + 1;
    let parte = 0;
    for (const seg of segmentosDeBloque(bloques[i].texto, op.repeticiones, { conFuente: true })) {
      for (const trozo of repartir(seg, max)) {
        parte++;
        out.push({ clave: `${et[i].codigo}-${vez}-${parte}`, bloque: i, codigo: et[i].codigo, nombre: et[i].nombre, vez, parte,
          lineas: trozo.map(x => x.t), fuente: trozo.map(x => ({ t: x.t, b: i, l: x.l })) });
      }
    }
  }
  return out;
}
// Cuántas pantallas tiene un bloque cada vez que se canta
export function pantallasDeBloque(cancion, i) {
  const op = { ...OPCIONES_DEFECTO, ...(cancion?.opciones || {}) };
  const max = LINEAS_POR_PANTALLA.includes(Number(op.lineas)) ? Number(op.lineas) : 4;
  return segmentosDeBloque(cancion.bloques[i]?.texto, op.repeticiones).reduce((n, s) => n + repartir(s, max).length, 0);
}

// ---------- Coros casi iguales ----------
const normal = (s) => sinTildes(String(s || '').toLowerCase()).replace(/[^a-zñ0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
function parecido(a, b) {   // palabras en común / palabras en total
  const A = normal(a), B = normal(b);
  if (!A.length || !B.length) return 0;
  const cuenta = new Map();
  A.forEach(w => cuenta.set(w, (cuenta.get(w) || 0) + 1));
  let comun = 0;
  B.forEach(w => { const c = cuenta.get(w); if (c) { comun++; cuenta.set(w, c - 1); } });
  return (2 * comun) / (A.length + B.length);
}
const cantado = (texto) => segmentosDeBloque(texto, 'expandir').flat().join(' ');
// Pares de bloques del mismo tipo (coro o pre-coro) que son casi iguales: [[i, j], …]
export function corosParecidos(bloques) {
  const pares = [];
  for (let i = 0; i < bloques.length; i++) {
    if (!['coro', 'precoro'].includes(bloques[i].tipo)) continue;
    for (let j = i + 1; j < bloques.length; j++) {
      if (bloques[j].tipo === bloques[i].tipo && parecido(cantado(bloques[i].texto), cantado(bloques[j].texto)) >= 0.85) pares.push([i, j]);
    }
  }
  return pares;
}
// Deja solo el bloque i: quita el j y en el orden de canto lo reemplaza por i (si no había orden, se arma con el de la letra)
export function unirBloques(cancion, i, j) {
  const et = etiquetas(cancion.bloques);
  const ordenIdx = ordenDeCanto(cancion.bloques, cancion.orden_canto).map(k => (k === j ? i : k));
  const bloques = cancion.bloques.filter((_, k) => k !== j);
  const nuevos = etiquetas(bloques);
  const mapa = (k) => nuevos[k > j ? k - 1 : k].codigo;
  const orden = ordenIdx.map(mapa);
  // los resaltados del bloque quitado pasan al que queda; los de después se corren
  const resaltados = (cancion.resaltados || []).map(r => r.b === j ? { ...r, b: i } : r.b > j ? { ...r, b: r.b - 1 } : r);
  return { bloques, orden_canto: orden, resaltados, codigoQueda: et[i].codigo, codigoQuitado: et[j].codigo };
}

// ---------- Resaltados anclados al texto ----------
// r = { id, b (bloque), l (línea de contenido), p (palabra), n (cuántas), texto ("Mientras viva"), todas, estilo }
const igual = (a, b) => normal(a).join(' ') === normal(b).join(' ');
function buscarEn(lineas, texto) {   // [l, p] donde aparece la frase en esas líneas
  const n = palabras(texto).length;
  for (let l = 0; l < lineas.length; l++) {
    const w = palabras(lineas[l]);
    for (let p = 0; p + n <= w.length; p++) if (igual(w.slice(p, p + n).join(' '), texto)) return [l, p];
  }
  return null;
}
// Vuelve a ubicar cada resaltado después de editar la letra. Devuelve { validos, perdidos }.
export function ubicarResaltados(bloques, resaltados) {
  const validos = [], perdidos = [];
  const lineas = bloques.map(b => lineasDeContenido(b.texto));
  for (const r of resaltados || []) {
    const n = Math.max(1, Number(r.n) || 1);
    const aqui = palabras(lineas[r.b]?.[r.l]).slice(r.p, r.p + n).join(' ');
    if (aqui && igual(aqui, r.texto)) { validos.push(r); continue; }
    let pos = lineas[r.b] ? buscarEn(lineas[r.b], r.texto) : null;
    let b = r.b;
    if (!pos) for (let k = 0; k < lineas.length && !pos; k++) { pos = buscarEn(lineas[k], r.texto); if (pos) b = k; }
    if (pos) validos.push({ ...r, b, l: pos[0], p: pos[1] });
    else perdidos.push(r);
  }
  return { validos, perdidos };
}
// Resaltados que tocan una línea: [{ desde, hasta, r }] (posiciones de palabra en esa línea)
export function resaltadosDeLinea(fuente, resaltados) {
  const out = [];
  if (!fuente) return out;
  const w = palabras(fuente.t);
  for (const r of resaltados || []) {
    const n = Math.max(1, Number(r.n) || 1);
    if (r.b === fuente.b && r.l === fuente.l) out.push({ desde: r.p, hasta: r.p + n, r });
    else if (r.todas) {
      for (let p = 0; p + n <= w.length; p++) if (igual(w.slice(p, p + n).join(' '), r.texto)) out.push({ desde: p, hasta: p + n, r });
    }
  }
  return out;
}

// Texto donde buscar (título, autor, etiquetas y letra sin marcas)
export function textoBuscable(c) {
  const letra = (c.bloques || []).map(b => String(b.texto || '').replace(/\/\/|✂|\(x\d\)/g, ' ')).join(' ');
  return `${c.titulo || ''} ${c.autor || ''} ${(c.etiquetas || []).join(' ')} ${letra}`;
}
