// ============================================================
// Cultos: el culto descargado (un solo archivo .html que funciona sin internet; lo arma js/cultos/sin-red.js)
// Dentro del archivo van:
//   <script type="application/json" id="culto-datos">     { nombre, fecha, elementos: [{ it: { id, tipo }, titulo, hojas }], logo }
//   <script type="application/json" id="culto-archivos">  { "<url original>": { tipo, b64 } }  imágenes y videos propios
// Las pantallas ya vienen armadas (las mismas que proyecta la consola); los archivos se abren como blob:
// y reemplazan a sus URLs originales.
// - Sin #pantalla: la misma consola de siempre (js/cultos/consola.js), sin control remoto.
// - Con #pantalla: la pantalla de proyección (js/cultos/escena.js), en otra ventana del mismo archivo.
// Consola y pantalla se hablan con postMessage (con file:// el BroadcastChannel no siempre funciona).
// ============================================================
import { montarConsola } from './consola.js';
import { montarEscena } from './escena.js';

const leer = (id) => { try { return JSON.parse(document.getElementById(id)?.textContent || 'null'); } catch { return null; } };

// los archivos: base64 → blob: (cada ventana los suyos: con file:// un blob: de otra ventana no se puede abrir)
const blobs = {}, urls = {};   // url original → blob: y al revés
for (const [url, a] of Object.entries(leer('culto-archivos') || {})) {
  try {
    const bin = atob(a.b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blobs[url] = URL.createObjectURL(new Blob([bytes], { type: a.tipo }));
    urls[blobs[url]] = url;
  } catch (e) { console.warn('No se pudo abrir un archivo del culto', url, e); }
}
// cambia las URLs de un objeto según el mapa (las hojas viajan entre ventanas con las URLs originales)
const cambiar = (v, mapa) => JSON.parse(JSON.stringify(v ?? null), (k, x) => typeof x === 'string' && mapa[x] ? mapa[x] : x);
let culto = null;
try { culto = cambiar(leer('culto-datos'), blobs); }
catch (e) { console.error(e); }

const raiz = document.getElementById('raiz');
if (!culto) raiz.innerHTML = '<div class="card empty" style="margin:40px auto; max-width:520px;"><span class="big">⚠️</span>Este archivo está incompleto o dañado. Descarga el culto otra vez.</div>';
else if (location.hash === '#pantalla') pantalla();
else consola();

// ---------- pantalla (ventana aparte, se arrastra al proyector o TV) ----------
function pantalla() {
  document.title = 'Pantalla · ' + culto.nombre;
  document.body.className = 'cu-pantalla';
  raiz.outerHTML = `<div id="escena" class="cu-escena"></div>
    <div id="espera" class="cu-espera"><b>🖥 Pantalla del culto</b><span>Esperando la consola…</span><small>Arrastra esta ventana al proyector o TV y ponla en pantalla completa (F11 o doble clic).</small></div>
    <button id="completa" class="cu-completa" type="button">⛶ Pantalla completa</button>`;
  const consola = () => window.opener && !window.opener.closed ? window.opener : null;
  const enviar = (m) => consola()?.postMessage({ culto: 1, ...m }, '*');
  const escena = montarEscena(enviar);
  let ultimo = 0;
  addEventListener('message', (e) => {
    if (e.source !== consola() || !e.data?.culto) return;
    ultimo = Date.now();
    escena.alMensaje(cambiar(e.data, blobs));
  });
  enviar({ t: 'hola' });
  // si la consola se recargó, vuelve a saludar
  setInterval(() => { if (Date.now() - ultimo > 4000) enviar({ t: 'hola' }); }, 2000);
  addEventListener('pagehide', () => enviar({ t: 'adios' }));
  if (!consola()) escena.textoEspera('Esta ventana se abre desde la consola: abre el archivo del culto y toca “🖥 Abrir pantalla”.');
}

// ---------- consola ----------
function consola() {
  document.title = culto.nombre;
  raiz.innerHTML = `<main class="sr-principal">
    <p class="sr-nota">💾 Culto descargado${culto.fecha ? ' · ' + culto.fecha : ''}: funciona sin internet${culto.enLinea ? ` (los videos de YouTube o Vimeo sí necesitan internet)` : ''}.</p>
    <div data-consola></div></main>`;
  let ventana = null;
  const local = {
    ok: true, alMensaje: null,
    enviar: (m) => { if (ventana && !ventana.closed) ventana.postMessage(cambiar({ culto: 1, ...m }, urls), '*'); },
    abrir: () => {
      ventana = window.open(location.href.split('#')[0] + '#pantalla', 'culto-pantalla-sin-red', 'popup=yes,width=1024,height=600');
      if (!ventana) alert('El navegador bloqueó la ventana de la pantalla: permite las ventanas emergentes para este archivo y toca “🖥 Abrir pantalla” otra vez.');
      else ventana.focus?.();
    },
    cerrar: () => {}
  };
  addEventListener('message', (e) => {
    if (!e.data?.culto) return;
    if (e.data.t === 'hola' && e.source && e.source !== window) ventana = e.source;   // la pantalla ya estaba abierta (esta ventana se recargó)
    if (e.source === ventana) local.alMensaje?.(e.data);
  });
  montarConsola(raiz.querySelector('[data-consola]'), {
    culto: { id: 'sin-red', nombre: culto.nombre }, elementos: culto.elementos || [], logo: culto.logo, local, remoto: false,
    alFinalizar: () => {
      ventana = null;
      raiz.innerHTML = `<div class="card empty" style="margin:40px auto; max-width:520px;"><span class="big">⏹</span>La proyección terminó.<br><br>
        <button class="btn btn-primary" data-otra>▶ Proyectar otra vez</button></div>`;
      raiz.querySelector('[data-otra]').onclick = () => location.reload();
    }
  });
}
