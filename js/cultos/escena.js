// ============================================================
// Cultos: la escena de la pantalla de proyección (lo que se ve en el proyector o TV)
// La usan culto-pantalla.html (js/cultos/pantalla.js) y el culto descargado (js/cultos/proyectar-sin-red.js).
// Necesita en la página #escena, #espera (con <b>, <span> y <small>) y el botón #completa.
// Solo muestra la hoja que le manda la consola (js/cultos/consola.js), con un fundido:
//   { t: 'mostrar', hoja, inicio, ahora } · { t: 'quien' } · { t: 'fin' } · { t: 'video', a: 'play' | 'pausa' | 'inicio' }
// Las teclas (un clicker conectado a este equipo) se reenvían a la consola: { t: 'tecla', k }.
// Videos: si el navegador no deja empezar con sonido, el video empieza sin sonido, se avisa a la consola
// ({ t: 'video-mudo' }) y el sonido vuelve con un clic aquí.
// ============================================================
import { pintarHoja } from '../proyectos/lienzo.js';
import { montarReloj } from './elementos.js';

// enviar(m): manda un mensaje a la consola. Devuelve { alMensaje(m), textoEspera(t), mostrando() }.
export function montarEscena(enviar) {
  const escena = document.getElementById('escena');
  const espera = document.getElementById('espera');
  const boton = document.getElementById('completa');
  const textoEspera = (t) => { espera.querySelector('span').textContent = t; };

  function alMensaje(m) {
    // el reloj de la cuenta regresiva se corrige con la diferencia de hora entre los equipos
    if (m.t === 'mostrar') mostrar(m.hoja || null, m.inicio ? m.inicio + (m.ahora ? Date.now() - m.ahora : 0) : null);
    else if (m.t === 'quien') enviar({ t: 'hola' });
    else if (m.t === 'fin') terminar();
    else if (m.t === 'video') video(m.a);
  }

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
      enviar({ t: 'video-mudo' });
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
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'b', 'B', '.', 'l', 'L', 'c', 'C', 'p', 'P', 'k', 'K'].includes(e.key)) {
      e.preventDefault();
      enviar({ t: 'tecla', k: e.key });
    }
  });

  return { alMensaje, textoEspera, mostrando: () => !!actual };
}
