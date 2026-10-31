// ============================================================
// Cultos: pantalla de proyección
//   culto-pantalla.html?c=<id>      en el mismo equipo que la consola (BroadcastChannel, sin internet de por medio)
//   culto-pantalla.html?p=<código>  en otro equipo (TV, PC de cabina), por Realtime con el código secreto de pantalla
// Solo muestra la hoja que le manda la consola (js/cultos/consola.js), con un fundido. No necesita sesión:
// la consola ya le pasa la pantalla armada. Las teclas (un clicker conectado a este equipo) se reenvían a la consola.
// Videos: { t: 'video', a: 'play' | 'pausa' | 'inicio' } desde la consola. Si el navegador no deja empezar con sonido,
// el video empieza sin sonido, se avisa a la consola ({ t: 'video-mudo' }) y el sonido vuelve con un clic aquí.
// ============================================================
import { pintarHoja } from '../proyectos/lienzo.js';
import { montarReloj } from './elementos.js';
import { abrirCanal, sondeo, conRespaldo } from './remoto.js';

const q = new URLSearchParams(location.search);
const id = q.get('c') || '', codigo = q.get('p') || '';
const escena = document.getElementById('escena');
const espera = document.getElementById('espera');
const boton = document.getElementById('completa');
const textoEspera = (t) => { espera.querySelector('span').textContent = t; };

// el canal con la consola: { enviar(m) }
let canal = null;
function alMensaje(m) {
  // el reloj de la cuenta regresiva se corrige con la diferencia de hora entre los equipos
  if (m.t === 'mostrar') mostrar(m.hoja || null, m.inicio ? m.inicio + (m.ahora ? Date.now() - m.ahora : 0) : null);
  else if (m.t === 'quien') canal?.enviar({ t: 'hola' });
  else if (m.t === 'fin') terminar();
  else if (m.t === 'video') video(m.a);
}
if (codigo) {
  if (codigo.length < 24) textoEspera('Este enlace no es válido. Pide el QR otra vez en la consola (📱 Control remoto).');
  else {
    textoEspera('Conectando…');
    // si Realtime no conecta, se pregunta a la base cada 3 s (el reloj no se corrige: no se sabe cuándo se guardó)
    const respaldo = sondeo(codigo, (m) => alMensaje({ ...m, ahora: null }));
    const vigilar = conRespaldo(respaldo);
    const ch = abrirCanal('cp-' + codigo, {
      alMensaje,
      alEstado: (e) => {
        vigilar(e);
        if (e === 'SUBSCRIBED') { ch.enviar({ t: 'hola' }); if (!actual) textoEspera('Esperando la consola… Abre el culto en la PC y toca ▶ Proyectar.'); }
        else if ((e === 'CHANNEL_ERROR' || e === 'TIMED_OUT') && !actual) textoEspera('Sin conexión. Se reintentará sola; revisa el internet de este equipo.');
      }
    });
    canal = ch;
    addEventListener('pagehide', () => ch.enviar({ t: 'adios' }));
  }
} else if (id && 'BroadcastChannel' in window) {
  const bc = new BroadcastChannel('culto-' + id);
  canal = { enviar: (m) => bc.postMessage(m) };
  bc.onmessage = (e) => alMensaje(e.data || {});
  canal.enviar({ t: 'hola' });
  addEventListener('pagehide', () => canal.enviar({ t: 'adios' }));
} else textoEspera(id ? 'Este navegador no puede conectarse con la consola. Usa Chrome, Edge o Firefox actualizados.' : 'Falta el culto en el enlace. Ábrela desde ▶ Proyectar.');

let actual = '';
function mostrar(hoja, inicio) {
  const clave = hoja ? `${hoja.id}|${inicio || ''}` : 'negro';
  if (clave === actual) return;
  actual = clave;
  espera.hidden = true;
  const capa = document.createElement('div');
  capa.className = 'cu-capa';
  if (hoja) montarReloj(pintarHoja(capa, hoja, { modo: 'ver' }), hoja, inicio);
  capa.querySelectorAll('video').forEach(v => { v.autoplay = false; reproducir(v); });
  const viejas = [...escena.children];
  escena.appendChild(capa);
  requestAnimationFrame(() => requestAnimationFrame(() => capa.classList.add('ver')));
  setTimeout(() => viejas.forEach(v => v.remove()), 600);   // después del fundido (y los videos viejos dejan de sonar)
}

// ---------- videos ----------
function reproducir(v) {
  v.play()?.catch(() => {
    // sin un clic previo en esta ventana, el navegador no deja empezar con sonido
    v.muted = true; v.dataset.mudo = '1';
    v.play()?.catch(() => {});
    canal?.enviar({ t: 'video-mudo' });
  });
}
function video(a) {
  const capa = escena.lastElementChild;
  if (!capa) return;
  const v = capa.querySelector('video');
  if (v) {
    if (a === 'inicio') v.currentTime = 0;
    if (a === 'pausa') v.pause(); else reproducir(v);
    return;
  }
  // YouTube (enablejsapi=1) y Vimeo aceptan órdenes por postMessage
  const f = capa.querySelector('iframe[data-fuente]');
  if (!f?.contentWindow) return;
  const yt = f.dataset.fuente === 'youtube';
  const mandar = (func, args) => f.contentWindow.postMessage(JSON.stringify(yt ? { event: 'command', func, args: args ?? [] } : { method: func, value: args }), '*');
  if (a === 'inicio') { if (yt) mandar('seekTo', [0, true]); else mandar('setCurrentTime', 0); }
  if (a === 'pausa') mandar(yt ? 'pauseVideo' : 'pause');
  else mandar(yt ? 'playVideo' : 'play');
}
// un clic en esta ventana devuelve el sonido a los videos que empezaron sin sonido
document.addEventListener('pointerdown', () => escena.querySelectorAll('video[data-mudo]').forEach(v => { v.muted = false; delete v.dataset.mudo; }));

// "Finalizar" en la consola: negro y se cierra (si el navegador no deja cerrarla, queda el aviso)
function terminar() {
  mostrar(null, null);
  setTimeout(() => {
    window.close();
    espera.querySelector('b').textContent = '⏹ La proyección terminó';
    espera.querySelector('span').textContent = 'Ya puedes cerrar esta ventana.';
    espera.querySelector('small').textContent = '';
    espera.hidden = false;
    actual = '';
  }, 700);
}


// ---------- pantalla completa, cursor y teclas ----------
const completa = () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
boton.onclick = completa;
document.addEventListener('dblclick', completa);
let tQuieto;
const mover = () => {
  document.body.classList.add('activo');
  clearTimeout(tQuieto);
  tQuieto = setTimeout(() => document.body.classList.remove('activo'), 2500);
};
document.addEventListener('mousemove', mover);
mover();
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { completa(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || e.key === 'Escape') return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'b', 'B', '.', 'l', 'L', 'c', 'C'].includes(e.key)) {
    e.preventDefault();
    canal?.enviar({ t: 'tecla', k: e.key });
  }
});
