// ============================================================
// Cultos: letras para los coristas (letras.html?c=<código de coristas>)
// - Sin sesión: lee la copia publicada con culto_letras(código). Se guarda en el celular (localStorage), así
//   funciona aunque falle la señal. Al abrir, al volver a la página, cada pocos minutos y cuando se publica
//   (aviso por el canal cv-<código>) se busca la versión nueva: la copia del celular se actualiza y, si ya se
//   estaba viendo otra, aparece "Hay cambios nuevos · Actualizar".
// - Dos modos (se recuerdan en el celular):
//   📜 Letra: toda la letra por secciones, sin el formato de la proyección; los resaltados en negrita y color dentro
//      de la misma línea; A−/A+, fondo oscuro, claro o sepia; menú arriba para saltar a otra canción.
//   🎞 Como en pantalla: una pantalla a la vez, igual que la proyección (fondo, fuentes, resaltados con efecto,
//      emojis y objetos), recompuesta en 9:16 en vertical (js/cultos/pantalla-celular.js) y en 16:9 en horizontal.
//      Tocar el lado derecho o deslizar = siguiente; el izquierdo = anterior; al terminar pasa al siguiente elemento.
// - "📡 Seguir proyección": salta a lo que se está proyectando (js/cultos/remoto.js). Nunca cambia la proyección.
// ============================================================
import { supabase, esc } from '../comun.js';
import { htmlDeLetra } from './resaltar.js';
import { urlSegura } from '../proyectos/recursos.js';
import { abrirCanal, pantallaEncendida, sondeo, conRespaldo } from './remoto.js';

const raiz = document.getElementById('raiz');
const codigo = new URLSearchParams(location.search).get('c') || '';
const guardar = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* sin espacio */ } };
const leer = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const CLAVE = 'letras.' + codigo;
const TEMAS = ['oscuro', 'claro', 'sepia'];
const ICONO_TEMA = { oscuro: '🌙', claro: '☀️', sepia: '🟤' };

const pref = {
  tam: Number(leer('letras.tam', 20)) || 20,
  tema: TEMAS.includes(leer('letras.tema')) ? leer('letras.tema') : leer('letras.oscuro', '1') === '1' ? 'oscuro' : 'claro',
  seguir: leer('letras.seguir', '0') === '1',
  modo: leer('letras.modo') === 'pantalla' ? 'pantalla' : 'letra',
  escala: Math.max(0.6, Math.min(1.6, Number(leer('letras.escala', 1)) || 1)),
  quieto: leer('letras.quieto', '0') === '1'
};
let culto = null, abierto = null, enVivo = null, sinConexion = false, pendiente = null;
let j = 0;   // la pantalla del elemento abierto (modo "Como en pantalla")
const ponerTema = () => { document.body.classList.remove(...TEMAS.map(t => 'tema-' + t), 'oscuro'); document.body.classList.add('tema-' + pref.tema); document.body.classList.toggle('oscuro', pref.tema === 'oscuro'); };
ponerTema();

const fechaBonita = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
const TIPOS = { versiculo: '📖 Versículo', texto: '👋 Texto', anuncio: '📢 Anuncio', video: '▶️ Video' };
const items = () => (culto?.items || []).filter(x => x.tipo === 'cancion' || TIPOS[x.tipo]);
const subtitulo = (x) => TIPOS[x.tipo] || [x.autor, x.tono ? 'Tono ' + x.tono : ''].filter(Boolean).join(' · ');
const lineas = (t) => `<div class="cu-letra-bloque">${String(t || '').split('\n').map(l => `<div>${esc(l) || '&nbsp;'}</div>`).join('')}</div>`;
const version = (c) => c?.publicado_en || JSON.stringify(c?.items || null);
function cuerpo(x) {
  if (x.tipo === 'versiculo') return lineas(x.texto);
  if (x.tipo === 'texto') return x.texto ? lineas(x.texto) : '';
  if (x.tipo === 'anuncio') return urlSegura(x.url) ? `<img class="le-img" src="${esc(x.url)}" alt="${esc(x.titulo || 'Anuncio')}">` : '<p>Sin imagen.</p>';
  if (x.tipo === 'video') return htmlVideo(x);
  return htmlDeLetra(x.bloques) || '<p>Sin letra.</p>';
}
// un video propio muestra su portada (una imagen): el celular solo baja el video si el corista lo abre
const htmlVideo = (x) => urlSegura(x.url) ? `${urlSegura(x.portada) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener"><img class="le-img" src="${esc(x.portada)}" alt="${esc(x.titulo || 'Video')}" loading="lazy"></a>` : ''}
    <a class="le-enlace" href="${esc(x.url)}" target="_blank" rel="noopener" style="margin-top:10px;">▶ Ver el video</a>` : '<p>Sin enlace.</p>';

function aviso(titulo, txt) {
  raiz.innerHTML = `<div class="le-aviso"><b>${esc(titulo)}</b><span>${esc(txt)}</span></div>`;
}

// ---------- La versión publicada ----------
let cargando = false;
async function cargar() {
  if (cargando) return;
  cargando = true;
  const cache = leer(CLAVE);
  if (!culto && cache) { try { culto = JSON.parse(cache); pintar(); } catch { /* caché dañada */ } }
  if (!culto) aviso('🎵 Letras del culto', 'Cargando…');
  try {
    const { data, error } = await supabase.rpc('culto_letras', { p_codigo: codigo });
    if (error) throw error;
    if (!data) {
      try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
      culto = null; pendiente = null; mostrarNuevo();
      return aviso('🔒 Este enlace no está disponible', 'El culto ya no está publicado. Pide el enlace nuevo a quien dirige la alabanza.');
    }
    const estaba = sinConexion;
    sinConexion = false;
    const nuevo = JSON.stringify(data);
    if (nuevo !== cache) guardar(CLAVE, nuevo);   // la copia del celular queda al día (para usarla sin señal)
    if (!culto) { culto = data; pintar(); }
    else if (version(data) !== version(culto)) { pendiente = data; mostrarNuevo(); }   // no cambia lo que se está leyendo
    else if (estaba) pintar();
  } catch {
    sinConexion = true;
    if (culto) pintar();
    else aviso('📶 Sin conexión', 'No se pudieron bajar las letras. Revisa el internet y vuelve a abrir el enlace.');
  } finally { cargando = false; }
}
function mostrarNuevo() {
  let b = document.querySelector('.le-nuevo');
  if (!pendiente) { b?.remove(); return; }
  if (!b) {
    b = document.createElement('div');
    b.className = 'le-nuevo';
    b.setAttribute('role', 'status');
    b.innerHTML = '<span>✨ Hay cambios nuevos</span><button type="button">Actualizar</button>';
    document.body.appendChild(b);
    b.querySelector('button').onclick = actualizar;
  }
}
function actualizar() {
  if (!pendiente) return;
  const id = items()[abierto]?.id;
  culto = pendiente; pendiente = null;
  datosPantalla = null; hojasCache.clear();
  mostrarNuevo();
  if (abierto != null) { const k = items().findIndex(x => x.id === id); abierto = k >= 0 ? k : null; }
  pintar();
}

// ---------- Pintar ----------
function pintar() {
  if (!culto) return;
  if (abierto != null && pref.modo === 'pantalla') return pintarPantalla();
  document.body.classList.remove('le-cine');
  if (abierto != null) return pintarLetra();
  const lista = items();
  raiz.innerHTML = `${modos()}
    <header class="le-cab"><div><b>${esc(culto.nombre || 'Culto')}</b><small>${esc(fechaBonita(culto.fecha))}</small></div>${barra()}</header>
    ${sinConexion ? '<p class="le-nota">📶 Sin conexión: ves la última versión guardada.</p>' : ''}
    <main class="le-lista">${lista.map((x, k) => `<button class="le-item ${x.id === enVivo ? 'vivo' : ''}" data-k="${k}">
        <span class="le-n">${k + 1}</span><span class="le-t"><b>${esc(x.titulo || '')}</b><small>${esc(subtitulo(x))}</small></span>
        ${x.id === enVivo ? '<span class="le-vivo">● En pantalla</span>' : ''}</button>`).join('') || '<p class="le-nota">Este culto todavía no tiene canciones ni avisos.</p>'}</main>`;
  raiz.querySelectorAll('[data-k]').forEach(b => b.onclick = () => abrir(Number(b.dataset.k)));
  enlazar();
}
function abrir(k, pantalla = 0) {
  abierto = k; j = pantalla;
  pintar();
  scrollTo(0, 0);
}

// Los dos modos, arriba
const modos = () => `<div class="le-modos" role="tablist">
    <button role="tab" data-modo="letra" aria-selected="${pref.modo === 'letra'}" class="${pref.modo === 'letra' ? 'activo' : ''}">📜 Letra</button>
    <button role="tab" data-modo="pantalla" aria-selected="${pref.modo === 'pantalla'}" class="${pref.modo === 'pantalla' ? 'activo' : ''}">🎞 Como en pantalla</button></div>`;
// Menú para saltar a otra canción o aviso
const menu = () => `<select class="le-menu" data-menu aria-label="Ir a otra canción">${items().map((x, k) =>
  `<option value="${k}" ${k === abierto ? 'selected' : ''}>${k + 1}. ${esc(x.titulo || '')}${x.id === enVivo ? ' ●' : ''}</option>`).join('')}</select>`;

// 📜 Letra: lectura sencilla
function pintarLetra() {
  const lista = items(), x = lista[abierto];
  if (!x) { abierto = null; return pintar(); }
  raiz.innerHTML = `${modos()}
    <header class="le-cab"><button class="le-volver" data-volver aria-label="Volver a la lista">☰</button>${menu()}${barra()}</header>
    ${sinConexion ? '<p class="le-nota">📶 Sin conexión: ves la última versión guardada.</p>' : ''}
    ${x.id === enVivo ? '<p class="le-nota vivo">● Esto se está proyectando</p>' : ''}
    <main class="le-letra" style="font-size:${pref.tam}px;"><h1 class="le-titulo">${esc(x.titulo || '')}<small>${esc(subtitulo(x))}</small></h1>${cuerpo(x)}</main>
    <nav class="le-pie">
      <button data-mover="-1" ${abierto === 0 ? 'disabled' : ''}>◀ Anterior</button>
      <button data-mover="1" ${abierto >= lista.length - 1 ? 'disabled' : ''}>Siguiente ▶</button></nav>`;
  raiz.querySelector('[data-volver]').onclick = () => { abierto = null; pintar(); };
  raiz.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => abrir(abierto + Number(b.dataset.mover)));
  enlazar();
}

const barra = () => `<div class="le-barra">
    <button data-tam="-1" aria-label="Letra más chica">A−</button><button data-tam="1" aria-label="Letra más grande">A+</button>
    <button data-tema aria-label="Fondo: ${pref.tema}" title="Fondo oscuro, claro o sepia">${ICONO_TEMA[pref.tema]}</button>
    <button data-seguir class="${pref.seguir ? 'activo' : ''}" title="Saltar a lo que se está proyectando" aria-label="Seguir proyección">📡</button></div>`;
function enlazar() {
  raiz.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
    if (pref.modo === b.dataset.modo) return;
    pref.modo = b.dataset.modo; guardar('letras.modo', pref.modo);
    j = 0; pintar(); scrollTo(0, 0);
  });
  const m = raiz.querySelector('[data-menu]');
  if (m) m.onchange = () => abrir(Number(m.value));
  raiz.querySelectorAll('[data-tam]').forEach(b => b.onclick = () => {
    pref.tam = Math.max(14, Math.min(40, pref.tam + Number(b.dataset.tam) * 2)); guardar('letras.tam', String(pref.tam));
    const l = raiz.querySelector('.le-letra'); if (l) l.style.fontSize = pref.tam + 'px';
  });
  const t = raiz.querySelector('[data-tema]');
  if (t) t.onclick = () => {
    pref.tema = TEMAS[(TEMAS.indexOf(pref.tema) + 1) % TEMAS.length]; guardar('letras.tema', pref.tema);
    ponerTema(); pintar();
    aviso2({ oscuro: '🌙 Fondo oscuro', claro: '☀️ Fondo claro', sepia: '🟤 Fondo sepia' }[pref.tema]);
  };
  raiz.querySelectorAll('[data-seguir]').forEach(b => b.onclick = () => {
    pref.seguir = !pref.seguir; guardar('letras.seguir', pref.seguir ? '1' : '0');
    aviso2(pref.seguir ? '📡 Seguir proyección: activado. Saltarás a lo que se proyecta.' : '📡 Seguir proyección: apagado.');
    if (pref.seguir) seguir();
    pintar();
  });
}
let tAviso;
function aviso2(txt) {
  let t = document.querySelector('.le-toast');
  if (!t) { t = document.createElement('div'); t.className = 'le-toast'; document.body.appendChild(t); }
  t.textContent = txt; t.hidden = false;
  clearTimeout(tAviso); tAviso = setTimeout(() => { t.hidden = true; }, 2600);
}
function seguir() {
  if (!pref.seguir || !enVivo) return;
  const k = items().findIndex(x => x.id === enVivo);
  if (k >= 0 && k !== abierto) abrir(k);
}

// ---------- 🎞 Como en pantalla ----------
// El código de la proyección se baja solo al usar este modo
let motor = null, datosPantalla = null;
const hojasCache = new Map();
async function prepararPantalla() {
  if (!motor) {
    const [el, dia, pc, fo] = await Promise.all([import('./elementos.js'), import('./diapositivas.js'), import('./pantalla-celular.js'), import('./fondos.js')]);
    motor = { ...el, ...dia, ...pc, ...fo };
  }
  motor.fondosQuietos(pref.quieto);
  if (datosPantalla) return datosPantalla;
  const lista = items();
  const p = lista.find(x => x.pantalla)?.pantalla;
  if (!p) return (datosPantalla = { listo: false });
  motor.registrarMisPlantillas(p.plantillas || []);
  const canciones = new Map(lista.filter(x => x.src && x.it?.cancion).map(x => [x.it.cancion, { ...x.src, id: x.it.cancion }]));
  const cultoP = { plantilla_base: p.base, items: lista.map(x => x.it).filter(Boolean) };
  await Promise.all(motor.plantillasDeCulto(cultoP, canciones).map(motor.prepararFuente));
  return (datosPantalla = { listo: true, canciones, culto: cultoP });
}
function hojasDe(x) {
  if (!x?.it || !datosPantalla?.listo || x.tipo === 'video') return [];
  if (!hojasCache.has(x.id)) {
    let h = [];
    try { h = motor.hojasDeElemento(x.it, datosPantalla.culto, datosPantalla.canciones); } catch (e) { console.warn('No se pudo armar la pantalla', e); }
    hojasCache.set(x.id, h);
  }
  return hojasCache.get(x.id);
}
const vertical = () => innerHeight >= innerWidth;
async function pintarPantalla() {
  const lista = items(), x = lista[abierto];
  if (!x) { abierto = null; return pintar(); }
  const v = vertical();
  document.body.classList.add('le-cine');
  raiz.innerHTML = `<div class="lp ${v ? 'lp-v' : 'lp-h'}">
    ${v ? `<header class="lp-cab">${modos()}<div class="lp-fila"><button class="le-volver" data-volver aria-label="Volver a la lista">☰</button>${menu()}</div></header>` : ''}
    <div class="lp-esc" data-esc><div class="lp-marco" data-marco></div></div>
    <nav class="lp-pie">
      ${v ? '' : '<button data-volver aria-label="Volver a la lista" title="Lista">☰</button><button data-modo="letra" title="📜 Letra" aria-label="Ver la letra">📜</button>'}
      <button data-ir="-1" aria-label="Anterior">◀</button><span class="lp-pos" data-pos>…</span><button data-ir="1" aria-label="Siguiente">▶</button>
      <span class="lp-sep"></span>
      <button data-esc-tam="-1" aria-label="Letra más chica">A−</button><button data-esc-tam="1" aria-label="Letra más grande">A+</button>
      <button data-quieto class="${pref.quieto ? 'activo' : ''}" title="Menos movimiento" aria-label="Menos movimiento" aria-pressed="${pref.quieto}">🐢</button>
      ${document.fullscreenEnabled ? '<button data-full title="Pantalla completa" aria-label="Pantalla completa">⛶</button>' : ''}
      <button data-seguir class="${pref.seguir ? 'activo' : ''}" title="Seguir proyección" aria-label="Seguir proyección">📡</button>
    </nav></div>`;
  enlazar();
  raiz.querySelectorAll('[data-volver]').forEach(b => b.onclick = () => { abierto = null; pintar(); });
  raiz.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => ir(Number(b.dataset.ir)));
  raiz.querySelectorAll('[data-esc-tam]').forEach(b => b.onclick = () => {
    pref.escala = Math.round(Math.max(0.6, Math.min(1.6, pref.escala + Number(b.dataset.escTam) * 0.1)) * 10) / 10;
    guardar('letras.escala', String(pref.escala));
    aviso2(`Letra ×${pref.escala.toFixed(1)}`);
    dibujar();
  });
  raiz.querySelector('[data-quieto]').onclick = () => {
    pref.quieto = !pref.quieto; guardar('letras.quieto', pref.quieto ? '1' : '0');
    aviso2(pref.quieto ? '🐢 Menos movimiento: activado' : '🐢 Menos movimiento: apagado');
    pintarPantalla();
  };
  const full = raiz.querySelector('[data-full]');
  if (full) full.onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* no se puede */ } };
  conectarToques(raiz.querySelector('[data-esc]'));
  await dibujar();
}
async function dibujar() {
  const marco = raiz.querySelector('[data-marco]'), esc_ = raiz.querySelector('[data-esc]');
  if (!marco) return;
  await prepararPantalla();
  const x = items()[abierto];
  if (!x || !marco.isConnected) return;
  const hojas = hojasDe(x), pos = raiz.querySelector('[data-pos]');
  if (!hojas.length) {
    // sin pantallas: un video (se abre aparte) o un culto publicado antes de este modo
    marco.style.width = '';
    marco.className = 'lp-marco lp-sin';
    marco.innerHTML = x.tipo === 'video' ? `<div class="lp-video"><b>${esc(x.titulo || 'Video')}</b>${htmlVideo(x)}</div>`
      : `<div class="lp-video"><b>${esc(x.titulo || '')}</b><p>Para verlo como en pantalla, quien dirige debe volver a publicar el culto (📤 Publicar cambios).</p><button class="le-enlace" data-modo="letra">📜 Ver la letra</button></div>`;
    enlazar();
    if (pos) pos.textContent = `${abierto + 1}/${items().length}`;
    return;
  }
  if (j < 0) j = hojas.length - 1;
  j = Math.max(0, Math.min(hojas.length - 1, j));
  const h = hojas[j], v = vertical();
  const r = esc_.getBoundingClientRect(), alto = v ? motor.ALTO_VERTICAL : 9 / 16;
  marco.className = 'lp-marco';
  marco.style.width = Math.floor(Math.min(r.width, r.height / alto)) + 'px';
  motor.pintarComoPantalla(marco, h, { vertical: v, escala: pref.escala, animar: !pref.quieto });
  if (pos) pos.textContent = `${j + 1}/${hojas.length}${h.info?.codigo ? ' · ' + h.info.codigo : ''}`;
}
// Avanza (d = 1) o retrocede (-1) una pantalla; al terminar un elemento pasa al siguiente
function ir(d) {
  const lista = items(), n = hojasDe(lista[abierto]).length;
  const k = j + d;
  if (k >= 0 && k < n) { j = k; return dibujar(); }
  if (d > 0 && abierto < lista.length - 1) { abierto++; j = 0; return pintarPantalla(); }
  if (d < 0 && abierto > 0) { abierto--; j = -1; return pintarPantalla(); }
  aviso2(d > 0 ? 'Es el final del culto' : 'Es el principio');
}
// Tocar el lado derecho = siguiente; el izquierdo = anterior; también deslizando
function conectarToques(esc_) {
  let ini = null;
  esc_.addEventListener('pointerdown', (e) => { ini = { x: e.clientX, y: e.clientY }; });
  esc_.addEventListener('pointerup', (e) => {
    if (!ini || e.target.closest('a, button')) { ini = null; return; }
    const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
    ini = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return ir(dx < 0 ? 1 : -1);
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
    const r = esc_.getBoundingClientRect();
    ir(e.clientX < r.left + r.width / 2 ? -1 : 1);
  });
}
document.addEventListener('keydown', (e) => {
  if (pref.modo !== 'pantalla' || abierto == null || e.target.closest?.('select, input')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); ir(1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(-1); }
});
// cuando llega una fuente, se vuelve a medir (el tamaño de la letra depende de la fuente real)
let tFuentes;
document.fonts?.addEventListener?.('loadingdone', () => {
  clearTimeout(tFuentes);
  tFuentes = setTimeout(() => { if (pref.modo === 'pantalla' && abierto != null && motor) { motor.olvidarMedidas?.(); hojasCache.clear(); dibujar(); } }, 250);
});
let tTam, ultimo = vertical();
addEventListener('resize', () => {
  clearTimeout(tTam);
  tTam = setTimeout(() => {
    if (pref.modo !== 'pantalla' || abierto == null) return;
    if (vertical() !== ultimo) { ultimo = vertical(); pintarPantalla(); } else dibujar();
  }, 150);
});

// ---------- Arranque ----------
if (codigo.length < 24) aviso('🔗 Enlace incompleto', 'Abre el enlace completo que te enviaron (o escanea el QR).');
else {
  pantallaEncendida();
  cargar();
  // lo que se proyecta (solo si alguien está proyectando este culto) y el aviso de una versión nueva
  const alVivo = (m) => {
    if (m.t === 'publicado') return cargar();
    if (m.t !== 'vivo') return;
    if (m.id === enVivo) return;
    enVivo = m.id || null;
    if (pref.seguir && enVivo) seguir(); else if (!(pref.modo === 'pantalla' && abierto != null)) pintar();
  };
  // si Realtime no conecta, se pregunta cada 5 s qué se proyecta
  const vigilar = conRespaldo(sondeo(codigo, (e) => alVivo({ t: 'vivo', id: e.id || null }), 5000));
  const canal = abrirCanal('cv-' + codigo, {
    alEstado: (e) => { vigilar(e); if (e === 'SUBSCRIBED') canal.enviar({ t: 'hola' }); },
    alMensaje: alVivo
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { canal.enviar({ t: 'hola' }); cargar(); } });
  setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 5 * 60 * 1000);
}
