// ============================================================
// Cultos: pantalla de proyección
//   culto-pantalla.html?c=<id>      en el mismo equipo que la consola (BroadcastChannel, sin internet de por medio)
//   culto-pantalla.html?p=<código>  en otro equipo (TV, PC de cabina), por Realtime con el código secreto de pantalla
// No necesita sesión: la consola ya le pasa la pantalla armada. Lo que se ve (fundido, videos, teclas)
// está en js/cultos/escena.js; aquí solo se conecta con la consola.
// ============================================================
import { montarEscena } from './escena.js';
import { abrirCanal, sondeo, conRespaldo } from './remoto.js';

const q = new URLSearchParams(location.search);
const id = q.get('c') || '', codigo = q.get('p') || '';

// el canal con la consola: { enviar(m) }
let canal = null;
const escena = montarEscena((m) => canal?.enviar(m));
const { alMensaje, textoEspera } = escena;
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
        if (e === 'SUBSCRIBED') { ch.enviar({ t: 'hola' }); if (!escena.mostrando()) textoEspera('Esperando la consola… Abre el culto en la PC y toca ▶ Proyectar.'); }
        else if ((e === 'CHANNEL_ERROR' || e === 'TIMED_OUT') && !escena.mostrando()) textoEspera('Sin conexión. Se reintentará sola; revisa el internet de este equipo.');
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
