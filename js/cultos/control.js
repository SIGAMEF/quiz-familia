// ============================================================
// Cultos: control remoto en el celular (culto-control.html?k=<código de control>)
// No necesita sesión: el código largo y secreto es la llave. Se conecta a la consola por Realtime
// (canal cc-<código>) y muestra lo que la consola le manda:
//   consola → celular: { t: 'estado', nombre, els: [{ t, ico, p: [etiquetas] }], i, j, modo, sig } · { t: 'fin' }
//   celular → consola: { t: 'hola' } · { t: 'cmd', a: 'sig' | 'ant' | 'negro' | 'logo' | 'limpio' | 'ir', i, j }
// ============================================================
import { esc } from '../comun.js';
import { abrirCanal, pantallaEncendida } from './remoto.js';

const raiz = document.getElementById('raiz');
const codigo = new URLSearchParams(location.search).get('k') || '';
let est = null, abierto = null, tEspera;

function pintarEspera(txt) {
  raiz.innerHTML = `<div class="cr-espera"><b>📱 Control del culto</b><span>${esc(txt)}</span></div>`;
}
if (codigo.length < 24) pintarEspera('Este enlace no es válido. Pide el código QR otra vez en la consola (📱 Control remoto).');
else {
  pintarEspera('Conectando…');
  pantallaEncendida();
  const canal = abrirCanal('cc-' + codigo, {
    alEstado: (e) => {
      if (e === 'SUBSCRIBED') {
        canal.enviar({ t: 'hola' });
        clearTimeout(tEspera);
        tEspera = setTimeout(() => { if (!est) pintarEspera('Esperando la consola… Abre el culto en la PC y toca ▶ Proyectar.'); }, 3500);
      } else if (e === 'CHANNEL_ERROR' || e === 'TIMED_OUT') pintarEspera('Sin conexión. Se reintentará sola; revisa el internet del celular.');
    },
    alMensaje: (m) => {
      if (m.t === 'estado') { est = m; pintar(); }
      else if (m.t === 'fin') { est = null; pintarEspera('La proyección terminó. Ya puedes cerrar esta página.'); }
    }
  });
  const cmd = (a, extra = {}) => { canal.enviar({ t: 'cmd', a, ...extra }); if (navigator.vibrate) navigator.vibrate(15); };
  // al volver a la página (el celular se bloqueó) se pide el estado otra vez
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') canal.enviar({ t: 'hola' }); });

  function pintar() {
    const e = est.els?.[est.i];
    const que = est.modo === 'negro' ? '⬛ Negro' : est.modo === 'logo' || !e ? '🖼 Logo' : `${e.ico || ''} ${e.t} · ${e.p?.[est.j] || ''}${est.modo === 'limpio' ? ' (sin texto)' : ''}`;
    if (abierto == null) abierto = est.i;
    raiz.innerHTML = `
      <div class="cr-cab"><b>${esc(est.nombre || 'Culto')}</b><span class="cr-ok">● Conectado</span></div>
      <div class="cr-ahora"><small>🔴 En pantalla</small><b>${esc(que)}</b>${est.sig ? `<small>Siguiente: ${esc(est.sig)}</small>` : ''}</div>
      <div class="cr-botones">
        <button class="btn" data-a="ant">◀ Anterior</button>
        <button class="btn btn-primary" data-a="sig">Siguiente ▶</button>
        <button class="btn ${est.modo === 'negro' ? 'activo' : ''}" data-a="negro">⬛ Negro</button>
        <button class="btn ${est.modo === 'logo' ? 'activo' : ''}" data-a="logo">🖼 Logo</button>
        <button class="btn ${est.modo === 'limpio' ? 'activo' : ''}" data-a="limpio">🧹 Limpiar</button></div>
      <div class="cr-lista">${(est.els || []).map((x, k) => `<div class="cr-el ${k === est.i && est.modo !== 'logo' ? 'aire' : ''}">
          <button class="cr-el-cab" data-el="${k}"><span>${x.ico || ''}</span><b>${esc(x.t)}</b><small>${(x.p || []).length}</small></button>
          ${k === abierto ? `<div class="cr-pant">${(x.p || []).map((p, j) => `<button class="${k === est.i && j === est.j && est.modo !== 'logo' ? 'aire' : ''}" data-i="${k}" data-j="${j}">${j + 1}. ${esc(p)}</button>`).join('')}</div>` : ''}
        </div>`).join('')}</div>`;
    raiz.querySelectorAll('[data-a]').forEach(b => b.onclick = () => cmd(b.dataset.a));
    raiz.querySelectorAll('[data-el]').forEach(b => b.onclick = () => { const k = Number(b.dataset.el); abierto = abierto === k ? -1 : k; pintar(); });
    raiz.querySelectorAll('[data-j]').forEach(b => b.onclick = () => cmd('ir', { i: Number(b.dataset.i), j: Number(b.dataset.j) }));
  }
}
