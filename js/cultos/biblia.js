// ============================================================
// Cultos · Biblia: libros, lector de referencias y texto de los versículos
// - Incluida: Reina-Valera 1909 (dominio público), un archivo por libro en datos/biblia/rv1909/NN.json
//   ({ c: [[vers1, vers2, …], …] }). Se baja solo el libro que se usa y queda en la caché del navegador.
// - Otras versiones (por ejemplo la RVR1960, que tiene derechos de autor) no vienen en la app:
//   · YouVersion (bible.com): con la clave gratuita de platform.youversion.com se traen por su API oficial,
//     versículo por versículo, las versiones que YouVersion habilite para esa clave (se guarda en este navegador).
//   · o la iglesia que tenga el archivo con permiso lo importa y queda solo en ese navegador (IndexedDB).
// - Referencias: "Jn 3:16", "Juan 3:16-18", "Sal 23", "1 Co 13:4-7", "1Co 13.4", "Juan 3:16,18".
// ============================================================

// [nombre, abreviaturas (sin tildes, en minúsculas)]
const L = [
  ['Génesis', 'gn gen gé'], ['Éxodo', 'ex exo exod'], ['Levítico', 'lv lev'], ['Números', 'nm num nu'], ['Deuteronomio', 'dt deut deu'],
  ['Josué', 'jos'], ['Jueces', 'jue jc juec'], ['Rut', 'rt'], ['1 Samuel', '1s 1sa 1sam'], ['2 Samuel', '2s 2sa 2sam'],
  ['1 Reyes', '1r 1re 1rey'], ['2 Reyes', '2r 2re 2rey'], ['1 Crónicas', '1cr 1cro 1cron'], ['2 Crónicas', '2cr 2cro 2cron'], ['Esdras', 'esd'],
  ['Nehemías', 'neh ne'], ['Ester', 'est'], ['Job', 'jb'], ['Salmos', 'sal salmo sl ps'], ['Proverbios', 'pr prov pro'],
  ['Eclesiastés', 'ec ecl ecle'], ['Cantares', 'cnt cant cantar cantico canticos'], ['Isaías', 'is isa'], ['Jeremías', 'jer jr'], ['Lamentaciones', 'lm lam'],
  ['Ezequiel', 'ez eze'], ['Daniel', 'dn dan'], ['Oseas', 'os'], ['Joel', 'jl'], ['Amós', 'am'],
  ['Abdías', 'abd ab'], ['Jonás', 'jon'], ['Miqueas', 'mi miq'], ['Nahúm', 'nah na'], ['Habacuc', 'hab'],
  ['Sofonías', 'sof'], ['Hageo', 'hag'], ['Zacarías', 'zac'], ['Malaquías', 'mal'],
  ['Mateo', 'mt mat'], ['Marcos', 'mr mc mar'], ['Lucas', 'lc luc'], ['Juan', 'jn jua'], ['Hechos', 'hch hech hec'],
  ['Romanos', 'ro rom'], ['1 Corintios', '1co 1cor'], ['2 Corintios', '2co 2cor'], ['Gálatas', 'ga gal'], ['Efesios', 'ef efe'],
  ['Filipenses', 'fil flp'], ['Colosenses', 'col'], ['1 Tesalonicenses', '1ts 1tes'], ['2 Tesalonicenses', '2ts 2tes'], ['1 Timoteo', '1ti 1tim'],
  ['2 Timoteo', '2ti 2tim'], ['Tito', 'tit'], ['Filemón', 'flm filem'], ['Hebreos', 'heb he'], ['Santiago', 'stg sant'],
  ['1 Pedro', '1p 1pe 1ped'], ['2 Pedro', '2p 2pe 2ped'], ['1 Juan', '1jn 1jua'], ['2 Juan', '2jn 2jua'], ['3 Juan', '3jn 3jua'],
  ['Judas', 'jud'], ['Apocalipsis', 'ap apoc apc']
];
const CAPITULOS = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22];
export const LIBROS = L.map(([nombre], i) => ({ i, nombre, capitulos: CAPITULOS[i], nuevo: i >= 39 }));

// "I Corintios", "Primera de Corintios", "1ra. Juan" → "1corintios"… (el número romano solo si va separado: "Isaías" no)
const llave = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  .replace(/^(iii|3ra|3ro|3a|3o|tercera|tercero)\.?\s+(de\s+)?/, '3').replace(/^(ii|2da|2do|2a|2o|segunda|segundo)\.?\s+(de\s+)?/, '2')
  .replace(/^(i|1ra|1ro|1a|1o|primera|primero)\.?\s+(de\s+)?/, '1').replace(/[\s.]+/g, '');
// nombre o abreviatura → índice del libro
const INDICE = new Map();
L.forEach(([nombre, abrev], i) => { INDICE.set(llave(nombre), i); abrev.split(' ').forEach(a => INDICE.set(llave(a), i)); });
INDICE.set('salmo', 18); INDICE.set('cantardeloscantares', 21); INDICE.set('apocalipsisdejuan', 65);
function buscarLibro(txt) {
  const k = llave(txt).replace(/^(de|del)/, '');
  if (!k) return null;
  if (INDICE.has(k)) return INDICE.get(k);
  // un prefijo que solo corresponde a un libro ("filipe", "apoca")
  const cand = new Set();
  for (const [n, i] of INDICE) if (n.startsWith(k) && k.length >= 3) cand.add(i);
  return cand.size === 1 ? [...cand][0] : null;
}

// "Juan 3:16-18" → { libro, cap, versos: [16, 17, 18] | null (todo el capítulo) }; null si no se entiende
export function leerReferencia(texto) {
  const m = String(texto || '').trim().match(/^((?:[123]|i{1,3})\s*\.?\s*)?([^\d:]+?)\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}(?:\s*[-–,]\s*\d{1,3})*))?\s*$/i);
  if (!m) return null;
  const libro = buscarLibro((m[1] || '') + m[2]);
  if (libro == null) return null;
  const cap = Number(m[3]);
  if (cap < 1 || cap > CAPITULOS[libro]) return null;
  if (!m[4]) return { libro, cap, versos: null };
  const versos = [];
  for (const parte of m[4].split(',')) {
    const [a, b] = parte.split(/[-–]/).map(x => Number(x.trim()));
    if (!a) continue;
    for (let v = a; v <= Math.max(a, b || a) && versos.length < 200; v++) if (!versos.includes(v)) versos.push(v);
  }
  return versos.length ? { libro, cap, versos } : null;
}

// "Juan 3:16-18" / "Juan 3:16, 18" / "Salmos 23"
export function citaDe(ref) {
  if (!ref) return '';
  const nombre = ref.libro === 18 ? 'Salmo' : LIBROS[ref.libro].nombre;
  if (!ref.versos?.length) return `${nombre} ${ref.cap}`;
  const tramos = [];
  for (const v of [...ref.versos].sort((a, b) => a - b)) {
    const t = tramos[tramos.length - 1];
    if (t && v === t[1] + 1) t[1] = v; else tramos.push([v, v]);
  }
  return `${nombre} ${ref.cap}:${tramos.map(([a, b]) => a === b ? a : `${a}-${b}`).join(', ')}`;
}

// ---------- Versiones ----------
const INCLUIDAS = [{ id: 'rv1909', nombre: 'Reina-Valera 1909', corto: 'RV1909', carpeta: 'rv1909', incluida: true }];
const BASE = new URL('../../datos/biblia/', import.meta.url);
const CACHE = 'biblia-v1';

// Versiones importadas en este navegador (IndexedDB "biblias": { id, nombre, corto, libros: [{ c }] })
function bd() {
  return new Promise((ok, mal) => {
    if (!('indexedDB' in window)) return mal(new Error('Este navegador no puede guardar versiones de la Biblia.'));
    const r = indexedDB.open('biblias', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('versiones', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function enBd(modo, fn) {
  const db = await bd();
  return new Promise((ok, mal) => {
    const tx = db.transaction('versiones', modo);
    const r = fn(tx.objectStore('versiones'));
    tx.oncomplete = () => { ok(r?.result); db.close(); };
    tx.onerror = () => { mal(tx.error); db.close(); };
  });
}
let importadas = null;
async function listaImportadas() {
  if (importadas) return importadas;
  try {
    const todas = await enBd('readonly', s => s.getAll());
    importadas = (todas || []).map(v => ({ id: v.id, nombre: v.nombre, corto: v.corto, importada: true }));
  } catch { importadas = []; }
  return importadas;
}
export async function versiones() { return [...INCLUIDAS, ...versionesYV(), ...await listaImportadas()]; }
export const VERSION_DEFECTO = 'rv1909';

// Importa un archivo JSON con la Biblia (formato { books: [{ chapters: [{ verses: [{ text }] }] }] } o { libros: [{ c: [[…]] }] })
export async function importarVersion(archivo, { nombre, corto }) {
  if (archivo.size > 30 * 1024 * 1024) throw new Error('El archivo es demasiado grande.');
  let d;
  try { d = JSON.parse(await archivo.text()); } catch { throw new Error('El archivo no es un JSON válido.'); }
  const libros = Array.isArray(d.libros) ? d.libros.map(b => ({ c: b.c }))
    : Array.isArray(d.books) ? d.books.map(b => ({ c: (b.chapters || []).map(c => (c.verses || []).map(v => String(v.text ?? '').replace(/\s+/g, ' ').trim())) }))
      : null;
  if (!libros || libros.length !== 66 || libros.some((b, i) => !Array.isArray(b.c) || b.c.length !== CAPITULOS[i])) {
    throw new Error('El archivo debe tener los 66 libros (Génesis a Apocalipsis) con todos sus capítulos.');
  }
  const id = 'loc-' + llave(corto || nombre).slice(0, 20);
  await enBd('readwrite', s => s.put({ id, nombre: String(nombre).slice(0, 60), corto: String(corto).slice(0, 12), libros }));
  importadas = null;
  memoria.forEach((_, k) => { if (k.startsWith(id + '/')) memoria.delete(k); });
  return id;
}
export async function borrarVersion(id) {
  await enBd('readwrite', s => s.delete(id));
  importadas = null;
}

// ---------- YouVersion (API oficial de bible.com: https://api.youversion.com/v1) ----------
const USFM = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB',
  'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];
const YV_API = 'https://api.youversion.com/v1';
const YV_CLAVE = 'biblia.youversion';
function leerYV() { try { return JSON.parse(localStorage.getItem(YV_CLAVE) || 'null'); } catch { return null; } }
const versionesYV = () => (leerYV()?.versiones || []).map(v => ({ ...v, youversion: true }));
export const youversionConectado = () => !!leerYV()?.clave;
const sinEtiquetas = (h) => { const d = document.createElement('div'); d.innerHTML = String(h || ''); return d.textContent; };
async function pedirYV(ruta, clave = leerYV()?.clave) {
  let r;
  try { r = await fetch(YV_API + ruta, { headers: { 'X-YVP-App-Key': clave, Accept: 'application/json' } }); }
  catch { throw new Error('No se pudo conectar con YouVersion. Revisa el internet.'); }
  if (r.status === 401) throw new Error('La clave de YouVersion no es válida. Revísala en platform.youversion.com.');
  if (r.status === 403) throw new Error('YouVersion no habilita esta versión para tu clave: acepta su licencia en platform.youversion.com.');
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`YouVersion respondió con un error (${r.status}).`);
  return r.json();
}
// Guarda la clave y lista las Biblias en español que YouVersion habilita para ella
export async function conectarYouVersion(clave) {
  clave = String(clave || '').trim();
  if (clave.length < 8) throw new Error('Pega la clave (App Key) de tu app de YouVersion.');
  const d = await pedirYV('/bibles?language_ranges[]=es', clave);
  const lista = Array.isArray(d) ? d : d?.data || d?.bibles || [];
  const vs = lista.map(b => ({
    id: 'yv-' + b.id, yv: b.id,
    nombre: String(b.local_title || b.title || b.name || `Biblia ${b.id}`).slice(0, 60),
    corto: String(b.local_abbreviation || b.abbreviation || b.abbr || b.id).slice(0, 12)
  })).filter(v => v.yv != null);
  localStorage.setItem(YV_CLAVE, JSON.stringify({ clave, versiones: vs }));
  return vs;
}
export function desconectarYouVersion() { try { localStorage.removeItem(YV_CLAVE); } catch { /* nada */ } }
// Un versículo: texto plano (se pide así; si llega HTML se limpia)
async function versoYV(v, libro, cap, n) {
  const clave = `${v.id}/${libro}.${cap}.${n}`;
  if (memoria.has(clave)) return memoria.get(clave);
  const d = await pedirYV(`/bibles/${encodeURIComponent(v.yv)}/passages/${USFM[libro]}.${cap}.${n}?format=text`);
  const t = d ? sinEtiquetas(d.content ?? d.text ?? '').replace(/^\s*\d+\s*/, '').replace(/\s+/g, ' ').trim() : '';
  memoria.set(clave, t);
  return t;
}
// Varias peticiones a la vez, pero pocas (para no saturar la API)
async function enTandas(lista, fn, tanda = 6) {
  const out = new Array(lista.length);
  for (let i = 0; i < lista.length; i += tanda) await Promise.all(lista.slice(i, i + tanda).map((x, k) => fn(x).then(r => { out[i + k] = r; })));
  return out;
}

// ---------- Texto ----------
const memoria = new Map();   // "rv1909/42" → capítulos
async function libro(version, i) {
  const clave = `${version}/${i}`;
  if (memoria.has(clave)) return memoria.get(clave);
  let caps;
  const inc = INCLUIDAS.find(v => v.id === version);
  if (inc) {
    const url = new URL(`${inc.carpeta}/${String(i + 1).padStart(2, '0')}.json`, BASE).href;
    let r = null;
    const cache = 'caches' in window ? await caches.open(CACHE).catch(() => null) : null;
    if (cache) r = await cache.match(url).catch(() => null);
    if (!r) {
      r = await fetch(url);
      if (!r.ok) throw new Error('No se pudo cargar ' + LIBROS[i].nombre + '. Revisa la conexión.');
      if (cache) await cache.put(url, r.clone()).catch(() => {});
    }
    caps = (await r.json()).c;
  } else {
    const v = await enBd('readonly', s => s.get(version));
    if (!v) throw new Error('Esa versión ya no está en este navegador.');
    caps = v.libros[i].c;
  }
  memoria.set(clave, caps);
  return caps;
}
// (para YouVersion se usa la cuenta de versículos de la RV1909, que es la misma división)
export async function versosDelCapitulo(version, i, cap) {
  return (await libro(versionesYV().some(v => v.id === version) ? VERSION_DEFECTO : version, i))[cap - 1] || [];
}

// El texto de una referencia: { cita, versos: [{ n, t }] }
export async function textoDe(ref, version = VERSION_DEFECTO) {
  const yv = versionesYV().find(v => v.id === version);
  if (yv) {
    const total = (await versosDelCapitulo(VERSION_DEFECTO, ref.libro, ref.cap)).length;
    const nums = (ref.versos?.length ? ref.versos : Array.from({ length: total }, (_, k) => k + 1)).slice(0, 200);
    const textos = await enTandas(nums, n => versoYV(yv, ref.libro, ref.cap, n));
    const versos = nums.map((n, k) => ({ n, t: textos[k] })).filter(x => x.t);
    if (!versos.length) throw new Error(`${citaDe({ ...ref, versos: null })} no tiene esos versículos en ${yv.corto}.`);
    return { cita: citaDe({ ...ref, versos: ref.versos?.length ? versos.map(v => v.n) : null }), versos };
  }
  const caps = await libro(version, ref.libro);
  const cap = caps[ref.cap - 1] || [];
  const nums = ref.versos?.length ? ref.versos : cap.map((_, k) => k + 1);
  const versos = nums.filter(n => cap[n - 1]).map(n => ({ n, t: cap[n - 1] }));
  if (!versos.length) throw new Error(`${citaDe({ ...ref, versos: null })} no tiene esos versículos.`);
  return { cita: citaDe({ ...ref, versos: ref.versos?.length ? versos.map(v => v.n) : null }), versos };
}

// Búsqueda por palabra en toda la versión (baja los 66 libros la primera vez). alAvanzar(0..1)
// (en las versiones de YouVersion se busca en la RV1909: el resultado da la cita y el texto se trae de YouVersion)
export async function buscarPalabra(q, version = VERSION_DEFECTO, { max = 200, alAvanzar } = {}) {
  if (versionesYV().some(v => v.id === version)) version = VERSION_DEFECTO;
  const k = llaveTexto(q);
  if (k.length < 3) return [];
  const out = [];
  for (let i = 0; i < 66 && out.length < max; i++) {
    const caps = await libro(version, i);
    alAvanzar?.((i + 1) / 66);
    caps.forEach((vs, c) => vs.forEach((t, v) => { if (out.length < max && llaveTexto(t).includes(k)) out.push({ libro: i, cap: c + 1, verso: v + 1, t }); }));
  }
  return out;
}
const llaveTexto = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
