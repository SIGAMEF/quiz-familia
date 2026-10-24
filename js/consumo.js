// ============================================================
// Consumo de Supabase frente a la cuota gratis (solo el admin; lo usan el panel del admin y el del profesor)
// Lee consumo_supabase() (sql/10_consumo.sql). La transferencia y los mensajes de tiempo real solo se ven en Supabase → Usage.
// ============================================================
import { $, esc, mensajeError, fmtFecha, SUPABASE_URL } from './comun.js';

// Límites del plan gratis (Free) de Supabase; si cambias de plan o cambian los límites, actualízalos aquí
const CUOTA = { db: 500 * 1024 ** 2, storage: 1024 ** 3, egress: 5 * 1024 ** 3, mau: 50000, realtime: 200 };
const PANEL_SUPABASE = `https://supabase.com/dashboard/project/${new URL(SUPABASE_URL).hostname.split('.')[0]}`;
const fmtBytes = (b) => b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
function barraCuota(titulo, usado, limite, fmt = (n) => n.toLocaleString('es')) {
  const pct = Math.min(100, (usado / limite) * 100);
  return `<div class="uso-cuota ${pct >= 85 ? 'alto' : pct >= 60 ? 'medio' : ''}">
      <div class="cab">${titulo}<small>${fmt(usado)} de ${fmt(limite)} · ${pct < 1 && usado ? '<1' : Math.round(pct)}%</small></div>
      <div class="barra" role="progressbar" aria-label="${esc(titulo)}" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div></div>`;
}
export async function vistaConsumo(cont, { rpc }) {
  cont.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>';
  let u;
  try { u = await rpc('consumo_supabase'); }
  catch (e) { cont.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}<br><span class="hint">¿Ya ejecutaste sql/10_consumo.sql y luego el 06?</span></div>`; return; }
  const vivos = u.vivo_quiz + u.vivo_salas + u.vivo_proyectos;
  cont.innerHTML = `
    <div class="card"><div class="row between"><h2>📊 Cuota gratis de Supabase</h2><button class="btn btn-sm" data-actualizar>🔄 Actualizar</button></div>
      <p class="sub">Lo que se puede medir desde la base de datos, comparado con los límites del plan gratis. Al pasar el 85 % la barra se pone roja.</p>
      <div class="stack" style="gap:16px; margin-top:12px;">
        ${barraCuota('🗄 Base de datos', u.db_bytes, CUOTA.db, fmtBytes)}
        ${barraCuota('🖼 Almacenamiento (Storage)', u.storage_bytes, CUOTA.storage, fmtBytes)}
        ${barraCuota('👤 Usuarios activos del mes', u.usuarios_mes, CUOTA.mau)}
      </div>
      <p class="hint" style="margin-top:14px;">La <b>transferencia</b> (egress, ${fmtBytes(CUOTA.egress)} al mes) y los <b>mensajes de tiempo real</b> no se pueden leer desde la app:
        míralos en <a href="${PANEL_SUPABASE}/usage" target="_blank" rel="noopener">Supabase → Usage ↗</a>.</p></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); margin-top:16px;">
      ${[['👥', u.usuarios.toLocaleString('es'), 'Cuentas'], ['🧑‍🏫', (u.por_rol.profesor || 0) + (u.por_rol.admin || 0), 'Profesores'], ['🎒', u.por_rol.alumno || 0, 'Alumnos'],
         ['📁', u.storage_archivos.toLocaleString('es'), 'Archivos'], ['📡', vivos, 'Sesiones abiertas']]
        .map(([ico, n, t]) => `<div class="stat"><span>${ico} ${t}</span><b>${n}</b></div>`).join('')}</div>
    <div class="card" style="margin-top:16px;"><h2>📡 Sesiones abiertas ahora</h2>
      <p class="sub">Cada pantalla abierta de estas consulta al servidor cada pocos segundos. Si alguien deja la ventana abierta sin usarla,
        se pone en pausa sola: a los 15 minutos sin tocarla o a los 2 minutos en otra pestaña.</p>
      <ul class="stack" style="gap:4px; margin:10px 0 0; padding-left:18px; font-weight:700;">
        <li>🏆 Quiz en vivo: ${u.vivo_quiz}</li><li>🎮 Salas de juego: ${u.vivo_salas}</li>
        <li>🎨 Proyectos en vivo: ${u.vivo_proyectos} (${u.proyectos_participantes} participantes)</li></ul>
      ${vivos ? '<p class="hint" style="margin-top:8px;">Las sesiones que ya no se usan conviene finalizarlas (en “En vivo” o en la tarjeta del proyecto).</p>' : ''}</div>
    <div class="card"><h2>🗂 Dónde se ocupa el espacio</h2>
      <div class="grid grid-2" style="gap:16px;">
        <div><h3 style="margin:6px 0;">Tablas más grandes</h3><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Tabla</th><th>Filas</th><th>Tamaño</th></tr></thead><tbody>
          ${u.tablas.map(t => `<tr><td>${esc(t.tabla)}</td><td>${Number(t.filas).toLocaleString('es')}</td><td>${fmtBytes(t.bytes)}</td></tr>`).join('')}</tbody></table></div></div>
        <div><h3 style="margin:6px 0;">Storage por carpeta</h3><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Bucket</th><th>Archivos</th><th>Tamaño</th></tr></thead><tbody>
          ${u.buckets.map(b => `<tr><td>${esc(b.bucket)}</td><td>${Number(b.archivos).toLocaleString('es')}</td><td>${fmtBytes(b.bytes)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sin archivos</td></tr>'}</tbody></table></div></div>
      </div>
      <p class="hint" style="margin-top:10px;">Medido el ${fmtFecha(u.ahora, true)}. Los límites del plan gratis están en <code>CUOTA</code> (js/consumo.js).</p></div>`;
  $('[data-actualizar]', cont).onclick = () => vistaConsumo(cont, { rpc });
}
