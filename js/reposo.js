// ============================================================
// Pausa por inactividad: una ventana olvidada no debe seguir consultando al servidor
// (gasta la cuota gratis de Supabase). Lo usan las pantallas que consultan cada pocos segundos:
// quiz en vivo, salas de juego y proyectos en vivo.
// - Sin tocar la pantalla (ni mover el mouse ni teclear) durante 15 min → pausa con un aviso; se reanuda al tocar.
// - Pestaña oculta más de 2 min → pausa sin aviso; se reanuda sola al volver a la pestaña.
// Solo se pausa si alguna pantalla está consultando (llamó a enPausa() hace poco).
// ============================================================
const MIN_SIN_TOCAR = 15, MIN_OCULTA = 2;

let pausado = false, ultimoToque = Date.now(), ocultaDesde = null, ultimaConsulta = 0, aviso = null;
const alPausar = new Set(), alVolver = new Set();

// Cada sondeo pregunta antes de consultar: si está en pausa, no consulta
export function enPausa() { ultimaConsulta = Date.now(); return pausado; }
// fn() al reanudar (para consultar enseguida o volver a conectarse); devuelve la función para quitarla
export function alReanudar(fn) { alVolver.add(fn); return () => alVolver.delete(fn); }
// fn() al entrar en pausa (por ejemplo, cerrar el canal de tiempo real)
export function alEntrarEnPausa(fn) { alPausar.add(fn); return () => alPausar.delete(fn); }

function pausar(conAviso) {
  if (pausado) return;
  pausado = true;
  alPausar.forEach(fn => { try { fn(); } catch { /* sigue con los demás */ } });
  if (conAviso) mostrarAviso();
}
function reanudar() {
  if (!pausado) return;
  pausado = false;
  aviso?.remove(); aviso = null;
  alVolver.forEach(fn => { try { fn(); } catch { /* sigue con los demás */ } });
}

function mostrarAviso() {
  aviso = document.createElement('div');
  aviso.className = 'reposo';
  aviso.setAttribute('role', 'alertdialog');
  aviso.setAttribute('aria-label', 'En pausa');
  aviso.innerHTML = `<div class="reposo-caja"><div class="reposo-ico">⏸</div><h2>En pausa</h2>
    <p>Nadie usó esta pantalla en ${MIN_SIN_TOCAR} minutos: dejamos de actualizarla para no gastar datos.</p>
    <button type="button" class="btn btn-primary btn-block">▶ Continuar</button></div>`;
  aviso.querySelector('button').onclick = reanudar;
  document.body.appendChild(aviso);
  aviso.querySelector('button').focus();
}

const tocar = () => { ultimoToque = Date.now(); if (pausado && !aviso) reanudar(); };
['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, tocar, { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ocultaDesde = Date.now(); return; }
  ocultaDesde = null; ultimoToque = Date.now();
  if (pausado && !aviso) reanudar();   // la pausa por pestaña oculta se quita sola al volver
});
setInterval(() => {
  if (pausado || Date.now() - ultimaConsulta > 60000) return;   // nada está consultando
  if (ocultaDesde && Date.now() - ocultaDesde > MIN_OCULTA * 60000) pausar(false);
  else if (!document.hidden && Date.now() - ultimoToque > MIN_SIN_TOCAR * 60000) pausar(true);
}, 15000);
