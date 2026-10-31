// ============================================================
// Cultos: 💾 descargar un culto para proyectarlo sin internet
// Arma UN archivo .html que lleva todo adentro y se abre con doble clic en cualquier PC (Chrome, Edge o Firefox):
//   - las pantallas ya armadas (las mismas que proyecta la consola) y el logo
//   - las imágenes y los videos propios (en base64; al abrir se vuelven blob:)
//   - las fuentes que usa el culto (Google Fonts, solo latín, en base64)
//   - el código de la consola y de la pantalla (los módulos de js/, cada uno como data: en un importmap)
//   - los estilos (css/app.css, css/proyectos.css, css/cultos.css)
// Lo que corre dentro del archivo está en js/cultos/proyectar-sin-red.js.
// Los videos de YouTube o Vimeo no se pueden guardar: en el archivo siguen necesitando internet.
// ============================================================
import { $, esc, toast, abrirModal, mensajeError } from '../comun.js';
import { FUENTES, FUENTES_EXTRA, URL_FUENTES, urlFuente, urlSegura } from '../proyectos/recursos.js';
import { prepararFuente } from './diapositivas.js';
import { plantillasDeCulto, hojaLogo } from './elementos.js';
import { armarElementos } from './consola.js';
import { datosCanciones, datosCultos } from './datos.js';

const ENTRADA = 'js/cultos/proyectar-sin-red.js';
const ESTILOS = ['css/app.css', 'css/proyectos.css', 'css/cultos.css'];
const SUBCONJUNTOS = ['latin', 'latin-ext'];   // las fuentes solo con letras latinas (español)
// supabase-js no hace falta sin internet: un objeto que acepta cualquier llamada
const SIN_SUPABASE = `const nada = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : nada, apply: () => nada });
export const createClient = () => nada;`;

// ---------- utilidades ----------
function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const base64Texto = (t) => base64(new TextEncoder().encode(t));
const jsonEnHtml = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
function recorrer(v, fn) {
  if (typeof v === 'string') fn(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) recorrer(x, fn);
}
async function traer(url, como = 'texto') {
  const r = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!r.ok) throw new Error(`${r.status} al leer ${url}`);
  return como === 'bytes' ? { bytes: new Uint8Array(await r.arrayBuffer()), tipo: (r.headers.get('content-type') || '').split(';')[0].trim() } : r.text();
}

// ---------- el código: los módulos de js/ desde la entrada, con sus imports cambiados a nombres del importmap ----------
async function empaquetar() {
  const base = new URL('.', location.href);
  const clave = (u) => 'culto/' + u.pathname.slice(base.pathname.length);
  const mods = new Map();
  async function cargar(url) {
    const k = clave(url);
    if (mods.has(k)) return;
    mods.set(k, '');
    const deps = [];
    const src = (await traer(url)).replace(/(\bfrom\s*|\bimport\s*)(['"])([^'"\n]+)\2/g, (m, pre, q, spec) => {
      if (/^https?:\/\//.test(spec)) return `${pre}${q}culto/externo${q}`;
      if (!/^\.{1,2}\//.test(spec)) return m;
      const u = new URL(spec, url); u.search = '';
      deps.push(u);
      return `${pre}${q}${clave(u)}${q}`;
    });
    if (/\bimport\.meta\b/.test(src)) throw new Error(`${k} usa import.meta y no puede ir dentro del archivo.`);
    mods.set(k, src);
    await Promise.all(deps.map(cargar));
  }
  await cargar(new URL(ENTRADA, base));
  const imports = { 'culto/externo': 'data:text/javascript;base64,' + base64Texto(SIN_SUPABASE) };
  for (const [k, src] of mods) imports[k] = 'data:text/javascript;base64,' + base64Texto(src);
  return { imports, entrada: 'culto/' + ENTRADA };
}

// ---------- las fuentes que usa el culto ----------
async function fuentesCss(usadas) {
  const urls = [URL_FUENTES, ...[...usadas].filter(f => FUENTES_EXTRA.includes(f)).map(urlFuente)];
  const partes = [], faltan = [];
  for (const u of urls) {
    let css;
    try { css = await traer(u); } catch { faltan.push(u); continue; }
    for (const [, sub, regla] of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)) {
      const fam = regla.match(/font-family:\s*['"]?([^;'"]+)/)?.[1];
      const src = regla.match(/url\((https:[^)]+)\)/)?.[1];
      if (!SUBCONJUNTOS.includes(sub) || !usadas.has(fam) || !src) continue;
      try { const { bytes } = await traer(src, 'bytes'); partes.push(regla.replace(src, 'data:font/woff2;base64,' + base64(bytes))); }
      catch { faltan.push(fam); }
    }
  }
  return { css: partes.join('\n'), faltan: [...new Set(faltan)] };
}

// ---------- descargar ----------
export async function descargarCulto(id, { datos = datosCultos, canciones: datosCanc = datosCanciones } = {}) {
  const m = abrirModal(`<h3>💾 Descargar para proyectar sin internet</h3>
    <p class="hint">Se arma un solo archivo con todo el culto: pantallas, imágenes, videos propios, fuentes y la consola.</p>
    <p data-paso><span class="spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></span> Preparando…</p>`);
  const paso = (t) => { const p = $('[data-paso]', m.el); if (p) p.lastChild.textContent = ' ' + t; };
  try {
    // 1) las pantallas, igual que en la consola
    const [culto, lista] = await Promise.all([datos.obtener(id), datosCanc.listar()]);
    if (!culto) throw new Error('Este culto ya no existe.');
    const canciones = new Map(lista.map(x => [x.id, x]));
    await Promise.all(plantillasDeCulto(culto, canciones).map(prepararFuente));
    const elementos = armarElementos(culto, canciones).map(e => ({ it: { id: e.it.id, tipo: e.it.tipo }, titulo: e.titulo, hojas: e.hojas }));
    const datosCulto = { nombre: culto.nombre, fecha: culto.fecha || '', elementos, logo: hojaLogo(culto) };

    // 2) qué archivos y fuentes usa
    const urls = new Set(), usadas = new Set(['Nunito', 'Baloo 2']);
    recorrer(datosCulto, (s) => {
      if (urlSegura(s) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(s)) urls.add(s);
      else if (FUENTES.includes(s) || FUENTES_EXTRA.includes(s)) usadas.add(s);
    });
    datosCulto.enLinea = elementos.some(e => e.hojas.some(h => (h.diseno?.elementos || []).some(x => x.tipo === 'video' && (x.fuente === 'youtube' || x.fuente === 'vimeo'))));

    // 3) los archivos (imágenes y videos propios)
    const archivos = {}, sinBajar = [];
    let n = 0, peso = 0;
    for (const u of urls) {
      paso(`Guardando imágenes y videos (${++n} de ${urls.size})…`);
      try {
        const { bytes, tipo } = await traer(u, 'bytes');
        if (!/^(image|video|audio)\//.test(tipo)) continue;   // no es un archivo para mostrar: queda como enlace
        archivos[u] = { tipo, b64: base64(bytes) };
        peso += bytes.length;
      } catch { sinBajar.push(u); }
    }

    // 4) fuentes, código y estilos
    paso('Guardando las fuentes…');
    const fuentes = await fuentesCss(usadas);
    paso('Guardando la consola y la pantalla…');
    const { imports, entrada } = await empaquetar();
    const estilos = (await Promise.all(ESTILOS.map(e => traer(new URL(e, location.href))))).join('\n').replace(/<\/style/gi, '<\\/style');

    // 5) el archivo
    paso('Armando el archivo…');
    const partes = [`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(culto.nombre)}</title>
<!-- Culto descargado de QuizApp el ${new Date().toLocaleString('es-PE')}. Funciona sin internet: ábrelo con Chrome, Edge o Firefox. -->
<style>${fuentes.css}</style>
<style>${estilos}
.sr-principal { max-width: 1240px; margin: 0 auto; padding: 18px 24px 60px; }
.sr-nota { margin: 0 0 12px; font-size: 13px; font-weight: 700; color: var(--muted, #6b6880); }
@media (max-width: 760px) { .sr-principal { padding: 12px 16px 60px; } }</style>
<script>window.__CULTO_SIN_RED__ = true;</script>
<script type="importmap">${jsonEnHtml({ imports })}</script>
</head>
<body>
<div id="raiz"></div>
<script type="application/json" id="culto-datos">${jsonEnHtml(datosCulto)}</script>
<script type="application/json" id="culto-archivos">`, jsonEnHtml(archivos), `</script>
<script type="module">import '${entrada}';</script>
</body>
</html>
`];
    const archivo = new Blob(partes, { type: 'text/html' });
    const nombre = `${culto.nombre}${culto.fecha ? ' ' + culto.fecha : ''}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'culto';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(archivo); a.download = nombre + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);

    // 6) resumen
    const pantallas = elementos.reduce((t, e) => t + e.hojas.length, 0);
    const avisos = [
      datosCulto.enLinea ? '▶️ Los videos de YouTube o Vimeo no se pueden guardar: al proyectar necesitan internet. Para tenerlos sin internet, súbelos como archivo (Mis archivos).' : '',
      sinBajar.length ? `⚠️ ${sinBajar.length === 1 ? 'Una imagen o video no se pudo' : sinBajar.length + ' imágenes o videos no se pudieron'} guardar (el sitio de origen no lo permite): sin internet no se verán.` : '',
      fuentes.faltan.length ? '🔤 Algunas fuentes no se pudieron guardar: sin internet se verá una letra parecida.' : ''
    ].filter(Boolean);
    const p = $('[data-paso]', m.el);
    if (p) p.outerHTML = `
      <div class="card" style="margin:8px 0;"><b>✅ ${esc(nombre)}.html</b><br>
        <span class="small muted">${esc(String(elementos.length))} elementos · ${esc(String(pantallas))} pantallas · ${esc(mb(archivo.size))}${peso ? ` (imágenes y videos: ${esc(mb(peso))})` : ''}</span></div>
      ${avisos.map(t => `<p class="hint">${esc(t)}</p>`).join('')}
      <p class="small"><b>Cómo usarlo:</b> copia el archivo a la PC del proyector (USB, WhatsApp, correo…), ábrelo con doble clic y toca <b>🖥 Abrir pantalla</b>. Arrastra esa ventana al proyector y ponla en pantalla completa. Si cambias el culto, descárgalo otra vez.</p>
      <div class="modal-pie"><button class="btn btn-primary" data-ok>Listo</button></div>`;
    $('[data-ok]', m.el)?.addEventListener('click', () => m.cerrar());
  } catch (e) {
    console.error(e);
    m.cerrar();
    toast('No se pudo descargar el culto: ' + mensajeError(e), 'error');
  }
}
