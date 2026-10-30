// ============================================================
// Cultos: letras para los coristas (letras.html?c=<código de coristas>)
// - Sin sesión: lee la copia publicada con culto_letras(código). Se guarda en el celular (localStorage),
//   así funciona aunque falle la señal; al abrir se busca la versión nueva.
// - Lista de canciones (y versículos) en orden; al tocar una, la letra completa en vertical, con
//   estrofas y coro marcados, tamaño de letra, modo oscuro y pantalla siempre encendida.
// - "📡 Seguir proyección": salta a lo que se está proyectando (canal cv-<código>, js/cultos/remoto.js).
//   Lo que hace el corista nunca cambia la proyección.
// ============================================================
import { supabase, esc } from '../comun.js';
import { htmlDeLetra } from './resaltar.js';
import { abrirCanal, pantallaEncendida, sondeo, conRespaldo } from './remoto.js';

const raiz = document.getElementById('raiz');
const codigo = new URLSearchParams(location.search).get('c') || '';
const guardar = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* sin espacio */ } };
const leer = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const CLAVE = 'letras.' + codigo;

const pref = { tam: Number(leer('letras.tam', 20)) || 20, oscuro: leer('letras.oscuro', '1') === '1', seguir: leer('letras.seguir', '0') === '1' };
let culto = null, abierto = null, enVivo = null, sinConexion = false;
document.body.classList.toggle('oscuro', pref.oscuro);

const fechaBonita = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
const items = () => (culto?.items || []).filter(x => x.tipo === 'cancion' || x.tipo === 'versiculo');

function aviso(titulo, txt) {
  raiz.innerHTML = `<div class="le-aviso"><b>${esc(titulo)}</b><span>${esc(txt)}</span></div>`;
}

async function cargar() {
  const cache = leer(CLAVE);
  if (cache) { try { culto = JSON.parse(cache); pintar(); } catch { /* caché dañada */ } }
  else aviso('🎵 Letras del culto', 'Cargando…');
  try {
    const { data, error } = await supabase.rpc('culto_letras', { p_codigo: codigo });
    if (error) throw error;
    if (!data) {
      try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
      culto = null;
      return aviso('🔒 Este enlace no está disponible', 'El culto ya no está publicado. Pide el enlace nuevo a quien dirige la alabanza.');
    }
    sinConexion = false;
    const nuevo = JSON.stringify(data);
    if (nuevo !== cache) { culto = data; guardar(CLAVE, nuevo); pintar(); }
    else pintar();
  } catch {
    sinConexion = true;
    if (culto) pintar();
    else aviso('📶 Sin conexión', 'No se pudieron bajar las letras. Revisa el internet y vuelve a abrir el enlace.');
  }
}

function pintar() {
  if (!culto) return;
  if (abierto != null) return pintarLetra();
  const lista = items();
  raiz.innerHTML = `
    <header class="le-cab"><div><b>${esc(culto.nombre || 'Culto')}</b><small>${esc(fechaBonita(culto.fecha))}</small></div>${barra()}</header>
    ${sinConexion ? '<p class="le-nota">📶 Sin conexión: ves la última versión guardada.</p>' : ''}
    <main class="le-lista">${lista.map((x, k) => `<button class="le-item ${x.id === enVivo ? 'vivo' : ''}" data-k="${k}">
        <span class="le-n">${k + 1}</span><span class="le-t"><b>${esc(x.titulo || '')}</b><small>${esc(x.tipo === 'versiculo' ? '📖 Versículo' : [x.autor, x.tono ? 'Tono ' + x.tono : ''].filter(Boolean).join(' · '))}</small></span>
        ${x.id === enVivo ? '<span class="le-vivo">● En pantalla</span>' : ''}</button>`).join('') || '<p class="le-nota">Este culto todavía no tiene canciones.</p>'}</main>`;
  raiz.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { abierto = Number(b.dataset.k); pintar(); scrollTo(0, 0); });
  enlazarBarra();
}

function pintarLetra() {
  const lista = items(), x = lista[abierto];
  if (!x) { abierto = null; return pintar(); }
  raiz.innerHTML = `
    <header class="le-cab"><button class="le-volver" data-volver aria-label="Volver a la lista">←</button><div><b>${esc(x.titulo || '')}</b><small>${esc(x.tipo === 'versiculo' ? 'Versículo' : [x.autor, x.tono ? 'Tono ' + x.tono : ''].filter(Boolean).join(' · '))}</small></div>${barra()}</header>
    ${x.id === enVivo ? '<p class="le-nota vivo">● Esta se está proyectando</p>' : ''}
    <main class="le-letra" style="font-size:${pref.tam}px;">${x.tipo === 'versiculo'
      ? `<div class="cu-letra-bloque">${String(x.texto || '').split('\n').map(l => `<div>${esc(l)}</div>`).join('')}</div>`
      : htmlDeLetra(x.bloques) || '<p>Sin letra.</p>'}</main>
    <nav class="le-pie">
      <button data-mover="-1" ${abierto === 0 ? 'disabled' : ''}>◀ Anterior</button>
      <button data-mover="1" ${abierto >= lista.length - 1 ? 'disabled' : ''}>Siguiente ▶</button></nav>`;
  raiz.querySelector('[data-volver]').onclick = () => { abierto = null; pintar(); };
  raiz.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => { abierto += Number(b.dataset.mover); pintar(); scrollTo(0, 0); });
  enlazarBarra();
}

const barra = () => `<div class="le-barra">
    <button data-tam="-1" aria-label="Letra más chica">A−</button><button data-tam="1" aria-label="Letra más grande">A+</button>
    <button data-oscuro aria-label="Modo oscuro">${pref.oscuro ? '☀️' : '🌙'}</button>
    <button data-seguir class="${pref.seguir ? 'activo' : ''}" title="Saltar a lo que se está proyectando">📡</button></div>`;
function enlazarBarra() {
  raiz.querySelectorAll('[data-tam]').forEach(b => b.onclick = () => {
    pref.tam = Math.max(14, Math.min(40, pref.tam + Number(b.dataset.tam) * 2)); guardar('letras.tam', String(pref.tam));
    const l = raiz.querySelector('.le-letra'); if (l) l.style.fontSize = pref.tam + 'px';
  });
  raiz.querySelector('[data-oscuro]').onclick = () => { pref.oscuro = !pref.oscuro; guardar('letras.oscuro', pref.oscuro ? '1' : '0'); document.body.classList.toggle('oscuro', pref.oscuro); pintar(); };
  raiz.querySelector('[data-seguir]').onclick = () => {
    pref.seguir = !pref.seguir; guardar('letras.seguir', pref.seguir ? '1' : '0');
    aviso2(pref.seguir ? '📡 Seguir proyección: activado. Saltarás a lo que se proyecta.' : '📡 Seguir proyección: apagado.');
    if (pref.seguir) seguir();
    pintar();
  };
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
  if (k >= 0 && k !== abierto) { abierto = k; pintar(); scrollTo(0, 0); }
}

if (codigo.length < 24) aviso('🔗 Enlace incompleto', 'Abre el enlace completo que te enviaron (o escanea el QR).');
else {
  pantallaEncendida();
  cargar();
  // lo que se proyecta (solo si alguien está proyectando este culto)
  const alVivo = (m) => {
      if (m.t !== 'vivo') return;
      if (m.id === enVivo) return;
      enVivo = m.id || null;
      if (pref.seguir && enVivo) seguir(); else pintar();
  };
  // si Realtime no conecta, se pregunta cada 5 s qué se proyecta
  const vigilar = conRespaldo(sondeo(codigo, (e) => alVivo({ t: 'vivo', id: e.id || null }), 5000));
  const canal = abrirCanal('cv-' + codigo, {
    alEstado: (e) => { vigilar(e); if (e === 'SUBSCRIBED') canal.enviar({ t: 'hola' }); },
    alMensaje: alVivo
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { canal.enviar({ t: 'hola' }); cargar(); } });
}
