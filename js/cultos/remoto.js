// ============================================================
// Cultos: canales de tiempo real entre equipos (Supabase Realtime, broadcast)
// El nombre del canal sale de un código largo y secreto (sql/12_cultos.sql: culto_accesos / culto_publicar):
//   cc-<código de control>   consola ⇄ celular con el control remoto
//   cp-<código de pantalla>  consola → pantalla en otro equipo (TV, PC de cabina)
//   cv-<código de coristas>  consola → coristas ("Seguir proyección")
// Los mensajes no pasan por la base de datos: no gastan filas ni consultas. En el mismo equipo
// la consola y la pantalla se hablan por BroadcastChannel (consola.js), sin Realtime.
// ============================================================
import { supabase, urlBase } from '../comun.js';

export const urlControl = (codigo) => `${urlBase()}culto-control.html?k=${encodeURIComponent(codigo)}`;
export const urlPantallaRemota = (codigo) => `${urlBase()}culto-pantalla.html?p=${encodeURIComponent(codigo)}`;
export const urlLetras = (codigo) => `${urlBase()}letras.html?c=${encodeURIComponent(codigo)}`;
export const enlaceWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

// Abre un canal. alMensaje(m) con cada mensaje; alEstado('SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED').
// Devuelve { enviar(m), cerrar(), listo() }.
export function abrirCanal(nombre, { alMensaje, alEstado } = {}) {
  let unido = false;
  const ch = supabase.channel(nombre, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => alMensaje?.(payload || {}));
  ch.subscribe((estado) => { unido = estado === 'SUBSCRIBED'; alEstado?.(estado); });
  return {
    enviar(m) {
      if (!unido) return;   // antes de unirse no se manda nada (al unirse, el otro lado pide el estado con "hola")
      try { ch.send({ type: 'broadcast', event: 'm', payload: m }).catch(() => {}); } catch { /* sin conexión */ }
    },
    cerrar() { try { supabase.removeChannel(ch); } catch { /* ya estaba cerrado */ } },
    listo: () => unido
  };
}

// Respaldo si Realtime no conecta: pregunta cada `cada` ms lo que está en vivo (culto_vivo, con versión:
// si nada cambió la respuesta es mínima). Devuelve { iniciar(), detener() }. alEstado(estado) con cada cambio.
export function sondeo(codigo, alEstado, cada = 3000) {
  let t = null, version = 0, ocupado = false;
  const paso = async () => {
    if (ocupado || document.visibilityState === 'hidden') return;
    ocupado = true;
    try {
      const { data, error } = await supabase.rpc('culto_vivo', { p_codigo: codigo, p_version: version });
      if (!error && data && !data.sin_cambios) { version = data.version; if (data.estado) alEstado(data.estado); }
    } catch { /* sin conexión: se intenta otra vez */ }
    ocupado = false;
  };
  return {
    iniciar() { if (!t) { paso(); t = setInterval(paso, cada); } },
    detener() { clearInterval(t); t = null; },
    activo: () => !!t
  };
}
// Usa Realtime y, si no conecta en `espera` ms (o se cae), el sondeo hasta que Realtime vuelva
export function conRespaldo(respaldo, espera = 8000) {
  let tEspera = setTimeout(() => respaldo.iniciar(), espera);
  return (estado) => {
    if (estado === 'SUBSCRIBED') { clearTimeout(tEspera); respaldo.detener(); }
    else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') { clearTimeout(tEspera); respaldo.iniciar(); }
  };
}

// Mantiene la pantalla del celular encendida mientras la página está abierta (si el navegador lo permite)
export function pantallaEncendida() {
  let lock = null;
  const pedir = async () => { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* sin permiso */ } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pedir(); });
  pedir();
  return () => { try { lock?.release(); } catch { /* ya liberado */ } };
}
