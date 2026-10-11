// ============================================================
// Quiz en vivo: participante (con o sin cuenta) y control del profesor
// ============================================================
import {
  supabase, $, $$, esc, toast, confirmar, cargando, mensajeError, miPerfil, iniciarSesion,
  avatarHtml, selectorAvatar, AVATARES_ALUMNO, urlBase, dibujarQR, mostrarQRGrande, copiar, fmtSeg, TIPOS
} from './comun.js';
import { pintarPregunta, mostrarCorreccion, cronometro, decir, callar, tono } from './juego.js';
import { descargarVivo } from './excel.js';

const app = $('#app');
const params = new URLSearchParams(location.search);
const COLORES = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#864CBF', '#0AA3A3', '#E05D00', '#7A5C3E'];
const FIGURAS = ['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚'];
const COLS_SESION = 'id,titulo,modo,estado,codigo,seg_por_pregunta,seg_total,pregunta_actual,pregunta_iniciada_en,permite_invitados,profesor_id,quiz_id,puntos_velocidad,publicacion_id,registrar_notas';

let timers = [], canal = null;
function limpiar() {
  timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = [];
  if (canal) { try { supabase.removeChannel(canal); } catch { } canal = null; }
  callar();
}
function cada(fn, ms) { const t = setInterval(fn, ms); timers.push(t); return t; }
function anchoHoja(ancho) { app.className = 'hoja' + (ancho ? ' ancha' : ''); window.scrollTo(0, 0); }
async function rpc(n, a) { const { data, error } = await supabase.rpc(n, a); if (error) throw error; return data; }
async function leerSesion(id) {
  const { data } = await supabase.from('sesiones_vivo').select(COLS_SESION).eq('id', id).maybeSingle();
  return data;
}
function enlace(s) { return `${urlBase()}vivo.html?s=${s.id}`; }

// Escucha cambios de la sesión: tiempo real + respaldo por consulta cada 2.5 s
function escucharSesion(id, alCambiar) {
  let previa = null, ocupado = false;
  const revisar = async (nueva) => {
    if (ocupado) return;
    ocupado = true;
    try {
      const s = nueva || await leerSesion(id);
      if (s && (!previa || s.estado !== previa.estado || s.pregunta_actual !== previa.pregunta_actual)) {
        const ant = previa; previa = s; await alCambiar(s, ant);
      }
    } finally { ocupado = false; }
  };
  try {
    canal = supabase.channel('sv-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sesiones_vivo', filter: `id=eq.${id}` }, (p) => revisar(p.new))
      .subscribe();
  } catch { }
  cada(() => revisar(), 2500);
  return { forzar: (s) => { previa = s; } };
}

// =====================================================================
// PARTICIPANTE
// =====================================================================
const P = { sesion: null, part: null, perfil: null, skew: 0, preguntas: [], total: 0, indice: -1, vista: null, crono: null, respuestas: new Map() };
const clave = (sid) => 'vivo_part_' + sid;
function guardarPart(sid, d) { try { localStorage.setItem(clave(sid), JSON.stringify(d)); } catch { } }
function leerPart(sid) { try { return JSON.parse(localStorage.getItem(clave(sid))); } catch { return null; } }
function borrarPart(sid) { try { localStorage.removeItem(clave(sid)); } catch { } }

function pantallaPin(error = '') {
  limpiar(); anchoHoja(false);
  app.innerHTML = `
    <div class="hero"><div class="logo">🏆</div><h1>Quiz en vivo</h1><p class="muted" style="font-weight:700;">Escribe el PIN que te muestra tu profesor</p></div>
    <form id="f"><input class="input pin-input" id="pin" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="off">
      <button class="btn btn-amber btn-block" style="margin-top:14px; font-size:17px;">Entrar</button>
      <div class="err center">${esc(error)}</div></form>
    <p class="center small" style="margin-top:14px;"><a href="index.html">← Volver al inicio</a></p>`;
  $('#pin').oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, ''); };
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const pin = $('#pin').value.trim();
    if (pin.length !== 6) return pantallaPin('El PIN tiene 6 números.');
    const s = await rpc('vivo_por_codigo', { p_codigo: pin }).catch(() => null);
    if (!s) return pantallaPin('No hay ninguna sesión abierta con ese PIN.');
    history.replaceState(null, '', `vivo.html?s=${s.id}`);
    entrarSesion(s.id);
  };
  setTimeout(() => $('#pin').focus(), 50);
}

async function entrarSesion(id) {
  limpiar(); anchoHoja(false);
  app.innerHTML = '<div class="center"><div class="spinner"></div></div>';
  const s = await leerSesion(id);
  if (!s) { app.innerHTML = `<div class="center"><div style="font-size:50px;">🤔</div><h2>Esta sesión ya no existe</h2><a class="btn btn-primary" href="vivo.html" style="margin-top:12px;">Ingresar otro PIN</a></div>`; return; }
  P.sesion = s;
  try { P.perfil = await miPerfil(); } catch { P.perfil = null; }

  if (s.estado === 'armado') {
    app.innerHTML = `<h1 class="center">${esc(s.titulo)}</h1><div class="card center" style="margin-top:12px;"><div class="spinner"></div><b>El profesor todavía no abre la sala.</b><p class="small muted">Esta pantalla se actualiza sola.</p></div>`;
    escucharSesion(id, (n) => { if (n.estado !== 'armado') entrarSesion(id); });
    return;
  }
  // ¿ya estaba dentro desde este navegador?
  const g = leerPart(id);
  if (g) {
    try { const yo = await rpc('vivo_mi_estado', { p_participante: g.id, p_token: g.token }); P.part = g; return continuar(yo); }
    catch { borrarPart(id); }
  }
  if (s.estado === 'finalizado') return ranking();
  pantallaUnirse();
}

function pantallaUnirse(error = '') {
  const s = P.sesion;
  limpiar(); anchoHoja(false);
  const alumno = P.perfil && P.perfil.rol === 'alumno' ? P.perfil : null;
  app.innerHTML = `
    <div class="center"><div style="font-size:46px;">🏆</div><h1>${esc(s.titulo)}</h1>
      <p class="muted" style="font-weight:700;">${s.modo === 'vivo' ? '🎤 En vivo' : '⏱ Cada uno a su ritmo'} · ${s.estado === 'en_curso' ? '<span class="badge green">en curso</span>' : '<span class="badge amber">sala abierta</span>'}</p></div>
    ${alumno ? `<div class="card center" style="margin-top:12px;">${avatarHtml(alumno.avatar, 'lg')}<p style="font-weight:800; margin:8px 0;">${esc(alumno.nombre || alumno.usuario)}</p>
        <button class="btn btn-primary btn-block" id="bUnirme">Unirme con mi cuenta</button></div>`
      : `${s.permite_invitados ? `<label class="lbl">Tu nombre o apodo</label><input class="input" id="alias" maxlength="30" placeholder="Ej: Lucas">
        <label class="lbl">Elige tu avatar</label><div id="av"></div>
        <button class="btn btn-amber btn-block" id="bUnirme" style="margin-top:14px; font-size:17px;">¡Entrar!</button>` : '<div class="feedback neutro">Esta sesión es solo para alumnos con cuenta.</div>'}
        <details style="margin-top:14px;" ${s.permite_invitados ? '' : 'open'}><summary style="cursor:pointer; font-weight:800; color:var(--primary-dark);">¿Tienes cuenta de alumno? Inicia sesión</summary>
          <form id="fLogin" style="margin-top:8px;"><input class="input" id="u" placeholder="Usuario" autocapitalize="none" style="margin-bottom:8px;">
            <input class="input" id="c" type="password" placeholder="Contraseña"><button class="btn btn-primary btn-block" style="margin-top:8px;">Entrar con mi cuenta</button></form></details>`}
    <div class="err center" id="err">${esc(error)}</div>`;
  let av = null;
  if ($('#av')) av = selectorAvatar($('#av'), { emojis: AVATARES_ALUMNO, permitirFoto: false, actual: AVATARES_ALUMNO[Math.floor(Math.random() * AVATARES_ALUMNO.length)] });
  const b = $('#bUnirme');
  if (b) b.onclick = async () => {
    const alias = alumno ? null : ($('#alias').value || '').trim();
    if (!alumno && !alias) { $('#err').textContent = 'Escribe tu nombre.'; return; }
    b.disabled = true;
    try {
      const r = await rpc('vivo_unirse', { p_sesion: s.id, p_alias: alias, p_avatar: av ? av.valor() : null });
      P.part = { id: r.participante_id, token: r.token };
      guardarPart(s.id, P.part);
      continuar(await rpc('vivo_mi_estado', { p_participante: P.part.id, p_token: P.part.token }));
    } catch (e) { $('#err').textContent = mensajeError(e); b.disabled = false; }
  };
  const f = $('#fLogin');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const perfil = await iniciarSesion($('#u').value, $('#c').value);
      if (perfil.rol !== 'alumno') { $('#err').textContent = 'Esa cuenta no es de alumno.'; return; }
      P.perfil = perfil; pantallaUnirse();
    } catch (er) { $('#err').textContent = mensajeError(er); }
  };
}

async function continuar(yo) {
  P.yo = yo;
  P.respuestas = new Map((yo.respuestas || []).map(r => [r.pregunta_id, r]));
  const s = P.sesion = await leerSesion(P.sesion.id);
  limpiar();
  escucharSesion(s.id, cambioSesion).forzar(s);
  await mostrarEstado(s);
}

async function cambioSesion(s, previa) {
  P.sesion = s;
  // el profesor reinició ("jugar de nuevo") o me quitó de la sala
  if (s.estado === 'esperando' && previa && previa.estado !== 'esperando') {
    try { await rpc('vivo_mi_estado', { p_participante: P.part.id, p_token: P.part.token }); }
    catch { borrarPart(s.id); toast('El profesor reinició la sesión. Vuelve a entrar.'); return pantallaUnirse(); }
  }
  await mostrarEstado(s);
}

async function mostrarEstado(s) {
  if (s.estado === 'esperando') return sala();
  if (s.estado === 'finalizado') {
    if (s.modo === 'plazo' && P.yo && P.yo.estado !== 'finalizado') await rpc('vivo_finalizar', { p_participante: P.part.id, p_token: P.part.token }).catch(() => { });
    return ranking();
  }
  if (s.estado === 'en_curso') {
    if (s.modo === 'vivo') return preguntaVivo(s);
    return P.yo.estado === 'finalizado' ? esperarFinal() : (P.yo.iniciado_en ? preguntaPlazo() : inicioPlazo());
  }
}

function cabecera() {
  return `<div class="row between" style="margin-bottom:10px; flex-wrap:nowrap;"><div class="row" style="flex-wrap:nowrap;">${avatarHtml(P.yo.avatar, 'sm')}<b class="titulo" style="font-size:15px;">${esc(P.yo.alias)}</b></div>
    <span class="badge green" id="misPts" style="font-size:13px;">⭐ ${Number(P.yo.puntaje)} pts</span></div>`;
}

async function sala() {
  anchoHoja(false);
  app.innerHTML = `${cabecera()}<div class="center"><h1>${esc(P.sesion.titulo)}</h1>
    <div class="card" style="margin-top:12px;"><div class="spinner"></div><b>¡Ya estás dentro!</b><p class="small muted">Esperando a que el profesor empiece. No cierres esta pantalla.</p></div>
    <p class="small muted" style="font-weight:800; margin-top:12px;" id="nPart"></p><div class="participantes" id="parts" style="justify-content:center; margin-top:8px;"></div></div>`;
  const pintar = async () => {
    const { data } = await supabase.from('vivo_participantes').select('id,alias,avatar').eq('sesion_id', P.sesion.id).order('created_at');
    if (!$('#parts')) return;
    $('#nPart').textContent = `${(data || []).length} conectado(s)`;
    $('#parts').innerHTML = (data || []).map(x => `<span class="participante">${avatarHtml(x.avatar, 'sm')}${esc(x.alias)}</span>`).join('');
  };
  pintar(); cada(pintar, 4000);
}

async function cargarPreguntas() {
  const r = await rpc('vivo_preguntas_publicas', { p_sesion: P.sesion.id });
  P.preguntas = r.preguntas; P.total = r.total;
  P.skew = Date.now() - Date.parse(r.ahora);
}

async function preguntaVivo(s) {
  if (P.crono) { P.crono.detener(); P.crono = null; }
  await cargarPreguntas();
  const p = P.preguntas.find(x => x.indice === s.pregunta_actual);
  anchoHoja(false);
  if (!p) { app.innerHTML = `${cabecera()}<div class="card center"><div class="spinner"></div><b>Preparando la pregunta...</b></div>`; return; }
  P.indice = s.pregunta_actual;
  const ya = P.respuestas.get(p.id);
  app.innerHTML = `${cabecera()}
    <div class="row between" style="margin-bottom:10px;"><span class="small muted" style="font-weight:800;">Pregunta ${p.indice + 1} de ${P.total} · ${Number(p.puntos)} pts</span><div id="crono"></div></div>
    <div id="preg"></div><p class="center muted hidden" id="espera" style="font-weight:800; margin-top:10px;">⏳ Esperando a que el profesor pase a la siguiente...</p>
    <div id="pizarra"></div>`;
  const vista = pintarPregunta($('#preg'), p, {
    colores: true,
    onResponder: async (ids, textos) => {
      if (P.crono) P.crono.detener();
      try {
        const r = await rpc('vivo_responder', { p_participante: P.part.id, p_token: P.part.token, p_pregunta: p.id, p_opciones: ids, p_textos: textos });
        P.respuestas.set(p.id, r);
        P.yo.puntaje = Number(P.yo.puntaje) + Number(r.puntos || 0);
        $('#misPts').textContent = `⭐ ${P.yo.puntaje} pts`;
        mostrarCorreccion($('#preg'), p, { ...r, mostrar: true }, { extra: r.tiempo_seg != null ? `<span class="small">(${Number(r.tiempo_seg).toFixed(1)} s)</span>` : '' });
      } catch (e) {
        $('[data-feedback]', $('#preg')).innerHTML = `<div class="feedback mal">${esc(mensajeError(e))}</div>`;
      }
      $('#espera').classList.remove('hidden');
      if (p.tipo === 'lluvia_ideas') verPizarra(p);
    }
  });
  if (ya) {
    vista.forzar = () => { };
    $$('button.opcion, [data-blank], [data-idea], [data-enviar]', $('#preg')).forEach(e => { e.disabled = true; });
    $('[data-feedback]', $('#preg')).innerHTML = '<div class="feedback neutro">Ya respondiste esta pregunta.</div>';
    $('#espera').classList.remove('hidden');
    if (p.tipo === 'lluvia_ideas') verPizarra(p);
    return;
  }
  if (s.seg_por_pregunta) {
    const transcurrido = (Date.now() - P.skew - Date.parse(s.pregunta_iniciada_en)) / 1000;
    const resto = Math.max(1, Math.min(s.seg_por_pregunta, Math.round(s.seg_por_pregunta - transcurrido)));
    P.crono = cronometro($('#crono'), resto, { sonido: false, alTerminar: () => { vista.forzar(); } });
    P.crono.iniciar();
  }
}

function verPizarra(p) {
  const cont = $('#pizarra');
  if (!cont) return;
  const pintar = async () => {
    const ideas = await rpc('vivo_pizarra', { p_sesion: P.sesion.id, p_pregunta: p.id }).catch(() => []);
    if (!$('#pizarra')) return;
    cont.innerHTML = `<h3 style="margin:14px 0 8px;">💭 Ideas de todos (${ideas.length})</h3><div class="pizarra">${ideas.map(i => `<div class="nota-idea">${esc(i.texto)}<small>${esc(i.alias)}</small></div>`).join('')}</div>`;
  };
  pintar(); cada(pintar, 3000);
}

function inicioPlazo() {
  const s = P.sesion;
  anchoHoja(false);
  app.innerHTML = `${cabecera()}<div class="center"><h1>⏱ ${esc(s.titulo)}</h1>
    <div class="grid grid-2" style="margin:14px 0;"><div class="stat"><span>Tiempo</span><b>${s.seg_total ? fmtSeg(s.seg_total) : '∞'}</b></div><div class="stat"><span>Modo</span><b style="font-size:18px;">A tu ritmo</b></div></div>
    <div class="feedback neutro">Cuando pulses "Empezar" arranca tu cronómetro y no se puede pausar. Si se acaba el tiempo, se entrega solo.</div>
    <button class="btn btn-amber btn-block" id="bEmpezar" style="font-size:18px;">▶ Empezar</button></div>`;
  $('#bEmpezar').onclick = async () => {
    $('#bEmpezar').disabled = true;
    try { P.yo.iniciado_en = await rpc('vivo_empezar', { p_participante: P.part.id, p_token: P.part.token }); preguntaPlazo(); }
    catch (e) { toast(mensajeError(e), 'error'); $('#bEmpezar').disabled = false; }
  };
}

async function preguntaPlazo() {
  limpiarTimersPregunta();
  const zona = $('#preg'); if (zona) zona.innerHTML = '<div class="center" style="padding:30px;"><div class="spinner"></div></div>';
  await cargarPreguntas();
  const s = P.sesion;
  const pendientes = P.preguntas.filter(p => !P.respuestas.has(p.id));
  const fin = s.seg_total ? Date.parse(P.yo.iniciado_en) + s.seg_total * 1000 + P.skew : null;
  if (!pendientes.length || (fin && Date.now() >= fin)) return terminarPlazo();
  const p = pendientes[0];
  anchoHoja(false);
  app.innerHTML = `${cabecera()}
    <div class="row between" style="margin-bottom:10px;"><span class="small muted" style="font-weight:800;">Pregunta ${P.respuestas.size + 1} de ${P.preguntas.length}</span>
      ${fin ? '<span class="badge amber titulo" id="reloj" style="font-size:16px;"></span>' : ''}</div>
    <div id="preg"></div><button class="btn btn-primary btn-block hidden" id="bSig">${pendientes.length === 1 ? '🏁 Terminar' : 'Siguiente →'}</button>`;
  if (fin) {
    const tick = () => {
      const r = (fin - Date.now()) / 1000;
      const el = $('#reloj'); if (el) { el.textContent = '⏱ ' + fmtSeg(r); el.className = 'badge titulo ' + (r <= 30 ? 'red' : 'amber'); }
      if (r <= 0) terminarPlazo();
    };
    tick(); P.reloj = cada(tick, 1000);
  }
  pintarPregunta($('#preg'), p, {
    colores: true,
    onResponder: async (ids, textos) => {
      try {
        const r = await rpc('vivo_responder', { p_participante: P.part.id, p_token: P.part.token, p_pregunta: p.id, p_opciones: ids, p_textos: textos });
        P.respuestas.set(p.id, r);
        P.yo.puntaje = Number(P.yo.puntaje) + Number(r.puntos || 0);
        $('#misPts').textContent = `⭐ ${P.yo.puntaje} pts`;
        mostrarCorreccion($('#preg'), p, { ...r, mostrar: true });
      } catch (e) {
        if (/tiempo/.test(mensajeError(e))) return terminarPlazo();
        $('[data-feedback]', $('#preg')).innerHTML = `<div class="feedback mal">${esc(mensajeError(e))}</div>`;
        P.respuestas.set(p.id, {});
      }
      $('#bSig').classList.remove('hidden');
    }
  });
  $('#bSig').onclick = () => preguntaPlazo();
}
function limpiarTimersPregunta() { if (P.reloj) { clearInterval(P.reloj); timers = timers.filter(t => t !== P.reloj); P.reloj = null; } }

async function terminarPlazo() {
  limpiarTimersPregunta();
  if (P.terminando) return;
  P.terminando = true;
  try { P.yo = await rpc('vivo_finalizar', { p_participante: P.part.id, p_token: P.part.token }); } catch { }
  P.terminando = false;
  esperarFinal();
}

function esperarFinal() {
  anchoHoja(false);
  app.innerHTML = `${cabecera()}<div class="center"><div style="font-size:54px;">🎉</div><h1>¡Terminaste!</h1>
    <div class="titulo" style="font-size:40px; color:var(--primary-dark); margin:10px 0;">${Number(P.yo.puntaje)} pts</div>
    <p class="muted" style="font-weight:700;">Cuando el profesor cierre la sesión verás el podio. También puedes ver cómo va ahora.</p>
    <button class="btn btn-primary btn-block" id="bRank" style="margin-top:12px;">🏆 Ver posiciones</button></div>`;
  $('#bRank').onclick = ranking;
}

async function ranking() {
  limpiar();
  const s = P.sesion = await leerSesion(P.sesion.id) || P.sesion;
  anchoHoja(false);
  const { data } = await supabase.from('vivo_participantes').select('id,alias,avatar,puntaje,tiempo_total_seg,estado').eq('sesion_id', s.id).order('puntaje', { ascending: false }).order('tiempo_total_seg', { ascending: true, nullsFirst: false });
  const lista = data || [];
  const miId = P.part?.id;
  const miPos = lista.findIndex(x => x.id === miId) + 1;
  app.innerHTML = `<h1 class="center">🏆 Posiciones</h1><p class="center muted" style="font-weight:700;">${esc(s.titulo)}${s.estado !== 'finalizado' ? ' · todavía en juego' : ''}</p>
    ${miPos ? `<div class="feedback neutro center" style="font-size:16px;">Quedaste en el puesto <b>${miPos}°</b> de ${lista.length}</div>` : ''}
    ${podio(lista)}
    <div>${lista.slice(3).map((x, i) => `<div class="fila-pos ${x.id === miId ? 'yo' : ''}"><span>${i + 4}</span>${avatarHtml(x.avatar, 'sm')}<span>${esc(x.alias)}</span><span class="pts">${Number(x.puntaje)} pts</span></div>`).join('')}</div>
    <div class="stack" style="margin-top:16px;">${s.estado !== 'finalizado' ? '<button class="btn btn-block" id="bAct">🔄 Actualizar</button>' : ''}
      <a class="btn btn-ghost btn-block" href="${P.perfil?.rol === 'alumno' ? 'alumno.html' : 'vivo.html'}">${P.perfil?.rol === 'alumno' ? '← Volver a mis quizzes' : 'Entrar a otro quiz'}</a></div>`;
  if (miPos === 1 && s.estado === 'finalizado' && window.confetti) window.confetti({ particleCount: 140, spread: 90, origin: { y: 0.5 } });
  if (miPos && miPos <= 3 && s.estado === 'finalizado') tono('correcto');
  const b = $('#bAct'); if (b) b.onclick = ranking;
  if (s.estado !== 'finalizado') escucharSesion(s.id, (n) => { if (n.estado === 'finalizado') ranking(); else if (n.estado === 'esperando') entrarSesion(n.id); });
}

function podio(lista) {
  if (!lista.length) return '<div class="empty">Todavía nadie tiene puntaje.</div>';
  const lugar = (x, n) => x ? `<div class="lugar l${n}">${avatarHtml(x.avatar, n === 1 ? 'lg' : '')}<div style="font-weight:800; margin:4px 0; word-break:break-word;">${esc(x.alias)}</div>
    <div class="bloque">${n}°<br><span style="font-size:14px;">${Number(x.puntaje)} pts</span></div></div>` : '<div class="lugar"></div>';
  return `<div class="podio">${lugar(lista[1], 2)}${lugar(lista[0], 1)}${lugar(lista[2], 3)}</div>`;
}

// =====================================================================
// CONTROL DEL PROFESOR
// =====================================================================
const C = { sesion: null, preguntas: [], revelada: false, stats: null, skew: 0, crono: null };

async function control(id) {
  limpiar();
  let perfil = null;
  try { perfil = await miPerfil(); } catch { }
  if (!perfil || !['profesor', 'admin'].includes(perfil.rol)) { location.href = 'index.html'; return; }
  const s = await leerSesion(id);
  if (!s || (s.profesor_id !== perfil.id && perfil.rol !== 'admin')) {
    app.innerHTML = '<div class="center"><h2>No se encontró la sesión</h2><a class="btn btn-primary" href="profesor.html#vivo" style="margin-top:10px;">Volver al panel</a></div>'; return;
  }
  C.sesion = s;
  try { C.preguntas = await rpc('vivo_preguntas_profesor', { p_sesion: id }); } catch (e) { toast(mensajeError(e), 'error'); }
  pintarControl();
  escucharSesion(id, (n) => { C.sesion = n; C.revelada = false; pintarControl(); }).forzar(s);
  cada(refrescarStats, 2000);
}

async function actualizarSesion(cambios) {
  const { data, error } = await supabase.from('sesiones_vivo').update(cambios).eq('id', C.sesion.id).select(COLS_SESION).single();
  if (error) { toast(mensajeError(error), 'error'); return; }
  C.sesion = data; C.revelada = false;
  pintarControl();
}

function cabeceraControl() {
  const s = C.sesion;
  const est = { armado: ['Borrador', 'gray'], esperando: ['Sala abierta', 'amber'], en_curso: ['En curso', 'green'], finalizado: ['Finalizado', 'gray'] }[s.estado];
  return `<div class="row between" style="margin-bottom:12px;">
    <div><a href="profesor.html#vivo" class="small" style="font-weight:800;">← Panel</a><h1 style="margin-top:2px;">${esc(s.titulo)}</h1>
      <div class="row" style="gap:6px;"><span class="badge ${est[1]}">${est[0]}</span><span class="badge gray">${s.modo === 'vivo' ? '🎤 En vivo' : '⏱ Por plazo'}</span>
      <span class="badge gray">${C.preguntas.length} preguntas</span></div></div>
    ${s.estado !== 'finalizado' ? `<div class="center" style="background:var(--primary-soft); border-radius:16px; padding:10px 18px;">
      <div class="small muted" style="font-weight:800;">PIN para unirse</div><div class="codigo-grande" style="font-size:30px;">${esc(s.codigo)}</div>
      <div class="row" style="gap:6px; justify-content:center;"><button class="btn btn-sm" id="bCopiar">🔗 Enlace</button><button class="btn btn-sm" id="bQR">📱 QR</button><button class="btn btn-sm" id="bFull" title="Pantalla completa">⛶</button></div></div>` : ''}
  </div>`;
}

function pintarControl() {
  const s = C.sesion;
  anchoHoja(true);
  if (C.crono) { C.crono.detener(); C.crono = null; }
  let cuerpo = '';
  if (s.estado === 'armado' || s.estado === 'esperando') {
    cuerpo = `<div class="card"><div class="row between"><h2>🚪 Sala de espera</h2><span class="titulo" style="font-size:28px; color:var(--primary-dark);" id="nConect">0</span></div>
      <p class="sub">${s.modo === 'vivo' ? 'Cuando todos estén dentro, empieza. Tú decides cuándo pasa cada pregunta.' : 'Al empezar, cada uno inicia su propio cronómetro cuando pulsa "Empezar".'}</p>
      <div class="participantes" id="parts"></div>
      <div class="row" style="margin-top:16px;">${s.estado === 'armado' ? '<button class="btn btn-amber" id="bAbrir">🚪 Abrir la sala</button>' : ''}
        <button class="btn btn-primary" id="bIniciar" style="font-size:17px;">▶ Empezar</button></div></div>
      <div class="card center"><div class="qr-caja" id="qrSala"></div><p class="small muted" style="margin-top:6px;">${esc(enlace(s))}</p></div>`;
  } else if (s.estado === 'en_curso' && s.modo === 'vivo') {
    const p = C.preguntas[s.pregunta_actual];
    const ultima = s.pregunta_actual >= C.preguntas.length - 1;
    cuerpo = p ? `<div class="card">
        <div class="row between"><span class="small muted" style="font-weight:800;">Pregunta ${s.pregunta_actual + 1} de ${C.preguntas.length} · ${TIPOS[p.tipo].ico} ${TIPOS[p.tipo].nombre} · ${Number(p.puntos)} pts</span><div id="crono"></div></div>
        ${p.imagen_url ? `<img src="${esc(p.imagen_url)}" style="max-height:260px; border-radius:12px; margin:8px 0; display:block;">` : ''}
        <p class="titulo enun-proy" style="font-size:26px; margin:8px 0 14px; white-space:pre-wrap;">${esc(p.enunciado)}</p>
        <div id="zonaOps">${zonaOpciones(p)}</div>
        <div class="row" style="margin-top:14px;">
          <button class="btn" id="bRevelar">${p.tipo === 'lluvia_ideas' ? '💭 Mostrar pizarra' : '👁 Mostrar respuesta'}</button>
          <span class="grow"></span>
          <span class="badge gray" style="font-size:14px;" id="nResp">0 respondieron</span>
          ${ultima ? '<button class="btn btn-red" id="bTerminar">🏁 Terminar y ver podio</button>' : '<button class="btn btn-primary" id="bSiguiente" style="font-size:16px;">Siguiente →</button>'}
        </div></div>
      <div class="grid grid-2"><div class="card" style="margin-top:0;"><h3>📊 Respuestas</h3><div id="dist" style="margin-top:8px;"></div></div>
        <div class="card" style="margin-top:0;"><h3>🏆 Ranking</h3><div id="rank"></div></div></div>`
      : `<div class="card center"><p>No hay más preguntas.</p><button class="btn btn-red" id="bTerminar">🏁 Terminar</button></div>`;
  } else if (s.estado === 'en_curso') {
    cuerpo = `<div class="card"><div class="row between"><h2>⏱ En curso — cada uno a su ritmo</h2><button class="btn btn-red" id="bTerminar">⏹ Terminar para todos</button></div>
      <div class="grid grid-3" style="margin:12px 0;"><div class="stat"><span>Participantes</span><b id="sTot">0</b></div><div class="stat"><span>Respondiendo</span><b id="sJug">0</b></div><div class="stat"><span>Terminaron</span><b id="sFin">0</b></div></div>
      <div class="tabla-wrap scroll-y"><table class="tabla"><thead><tr><th>#</th><th>Nombre</th><th>Estado</th><th>Avance</th><th>Aciertos</th><th>Puntos</th></tr></thead><tbody id="tPlazo"></tbody></table></div></div>`;
  } else {
    cuerpo = `<div class="card"><div class="row between"><h2>🏆 Resultados finales</h2>
        <div class="row" style="gap:6px;"><button class="btn btn-sm btn-primary" id="bXls">⬇️ Excel</button><button class="btn btn-sm btn-amber" id="bOtraVez">🔄 Jugar de nuevo</button><button class="btn btn-sm btn-red" id="bInvitados">Quitar invitados</button></div></div>
      <div id="podio"></div><div class="tabla-wrap" style="margin-top:10px;"><table class="tabla"><thead><tr><th>#</th><th>Nombre</th><th>Tipo</th><th>Puntos</th><th>Aciertos</th><th>Tiempo</th></tr></thead><tbody id="tFinal"></tbody></table></div></div>`;
  }
  app.innerHTML = cabeceraControl() + cuerpo;

  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#bCopiar', () => copiar(enlace(s)));
  on('#bQR', () => mostrarQRGrande(s.titulo, enlace(s), s.codigo, 'Escanea o entra a la app con este PIN'));
  on('#bFull', () => { document.body.classList.toggle('proyector'); if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => { }); else document.exitFullscreen?.(); });
  on('#bAbrir', () => actualizarSesion({ estado: 'esperando' }));
  on('#bIniciar', async () => {
    if (!C.preguntas.length) return toast('La sesión no tiene preguntas', 'error');
    actualizarSesion({ estado: 'en_curso', pregunta_actual: 0 });
  });
  on('#bSiguiente', () => actualizarSesion({ pregunta_actual: s.pregunta_actual + 1 }));
  on('#bTerminar', async () => {
    if (s.modo === 'plazo' && !await confirmar('Se cierra para todos y se calculan los puntajes con lo que cada uno haya respondido.', { titulo: '¿Terminar ahora?', boton: 'Terminar' })) return;
    try {
      await rpc('vivo_terminar', { p_sesion: s.id }); C.sesion = await leerSesion(s.id); pintarControl();
      if (s.publicacion_id && s.registrar_notas) toast('📒 Las notas de los alumnos del grupo quedaron en la publicación');
    } catch (e) { toast(mensajeError(e), 'error'); }
  });
  on('#bRevelar', () => { C.revelada = !C.revelada; revelar(); });
  on('#bOtraVez', async () => {
    if (!await confirmar(`Se borran los participantes y sus respuestas de esta partida. Las preguntas se mantienen y el PIN cambia.${s.publicacion_id && s.registrar_notas ? '\nTambién se quitan de la libreta las notas que registró esta partida.' : ''}`, { titulo: '¿Jugar de nuevo?', boton: 'Sí, de nuevo', peligro: false })) return;
    try { await rpc('vivo_reiniciar', { p_sesion: s.id }); C.sesion = await leerSesion(s.id); pintarControl(); } catch (e) { toast(mensajeError(e), 'error'); }
  });
  on('#bInvitados', async () => {
    if (!await confirmar('Se quitarán de los resultados todos los participantes sin cuenta.', { titulo: '¿Quitar invitados?', boton: 'Quitar' })) return;
    const { error } = await supabase.from('vivo_participantes').delete().eq('sesion_id', s.id).is('alumno_id', null);
    if (error) return toast(mensajeError(error), 'error');
    toast('Invitados quitados'); refrescarStats();
  });
  on('#bXls', () => { if (C.stats) descargarVivo(s.titulo, C.stats.participantes).catch(e => toast(mensajeError(e), 'error')); });
  if ($('#qrSala')) dibujarQR($('#qrSala'), enlace(s), 200);
  // cronómetro del profesor (con la hora del servidor)
  if (s.estado === 'en_curso' && s.modo === 'vivo' && s.seg_por_pregunta && $('#crono')) {
    const trans = (Date.now() - C.skew - Date.parse(s.pregunta_iniciada_en)) / 1000;
    const resto = Math.max(0, Math.round(s.seg_por_pregunta - trans));
    if (resto > 0) { C.crono = cronometro($('#crono'), resto, { sonido: true, alTerminar: () => { tono('incorrecto'); } }); C.crono.iniciar(); }
    else $('#crono').innerHTML = '<span class="badge red">⏰ Tiempo</span>';
  }
  refrescarStats();
}

function zonaOpciones(p, revelada = false) {
  if (['verdadero_falso', 'opcion_unica', 'opcion_multiple'].includes(p.tipo)) {
    return `<div class="grid grid-2">${p.opciones.map((o, i) => `<div class="op-proy ${revelada && !o.es_correcta ? 'revelada-no' : ''}" style="background:${COLORES[i % 8]};">
      <span style="font-size:22px;">${FIGURAS[i % 8]}</span><span class="grow">${esc(o.texto)}</span>${o.imagen_url ? `<img src="${esc(o.imagen_url)}">` : ''}${revelada && o.es_correcta ? ' ✔' : ''}</div>`).join('')}</div>`;
  }
  if (p.tipo === 'completar') return revelada ? `<div class="feedback bien">Respuesta: ${esc((p.respuestas_texto || []).map(r => r.split('|')[0]).join(', '))}</div>` : '<div class="feedback neutro">✏️ Los participantes escriben la respuesta en su pantalla.</div>';
  return revelada ? '<div class="pizarra" id="pizProf"></div>' : '<div class="feedback neutro">💭 Los participantes están escribiendo sus ideas...</div>';
}

function revelar() {
  const s = C.sesion, p = C.preguntas[s.pregunta_actual];
  if (!p) return;
  $('#zonaOps').innerHTML = zonaOpciones(p, C.revelada);
  $('#bRevelar').textContent = C.revelada ? '🙈 Ocultar' : (p.tipo === 'lluvia_ideas' ? '💭 Mostrar pizarra' : '👁 Mostrar respuesta');
  if (C.revelada && p.tipo === 'lluvia_ideas') refrescarStats();
}

async function refrescarStats() {
  const s = C.sesion;
  if (!s) return;
  let st;
  try { st = await rpc('vivo_estadisticas', { p_sesion: s.id }); } catch { return; }
  C.stats = st;
  C.skew = Date.now() - Date.parse(st.ahora);
  const parts = st.participantes;
  if ($('#parts')) {
    $('#nConect').textContent = parts.length;
    $('#parts').innerHTML = parts.map(x => `<span class="participante">${avatarHtml(x.avatar, 'sm')}${esc(x.alias)}${x.es_alumno ? ' 🎓' : ''}<button data-kick="${x.id}" title="Quitar">✕</button></span>`).join('') || '<span class="muted">Aún no entra nadie. Comparte el PIN o el QR.</span>';
    $$('[data-kick]').forEach(b => b.onclick = async () => {
      const { error } = await supabase.from('vivo_participantes').delete().eq('id', b.dataset.kick);
      if (error) return toast(mensajeError(error), 'error');
      refrescarStats();
    });
  }
  if ($('#nResp') && st.actual) {
    $('#nResp').textContent = `${st.actual.respondieron} de ${parts.length} respondieron`;
    const total = Math.max(1, st.actual.respondieron);
    $('#dist').innerHTML = st.actual.distribucion.length ? st.actual.distribucion.map((d, i) => `<div class="barra-op"><span style="color:${COLORES[i % 8]}; font-size:18px;">${FIGURAS[i % 8]}</span>
      <div class="fondo"><div class="llena" style="width:${(d.votos / total) * 100}%; background:${COLORES[i % 8]}${C.revelada && !d.es_correcta ? '55' : ''};"></div><span class="lbl-op">${esc(d.texto)} ${C.revelada && d.es_correcta ? '✔' : ''}</span></div><b>${d.votos}</b></div>`).join('')
      : `<p class="muted" style="font-weight:700;">${st.actual.respondieron} respuesta(s)${st.actual.acertaron ? ` · ${st.actual.acertaron} correcta(s)` : ''}</p>`;
    $('#rank').innerHTML = parts.slice(0, 8).map((x, i) => `<div class="fila-pos"><span>${i + 1}</span>${avatarHtml(x.avatar, 'sm')}<span>${esc(x.alias)}</span><span class="pts">${Number(x.puntaje)} pts</span></div>`).join('') || '<p class="muted">Sin participantes.</p>';
    const p = C.preguntas[s.pregunta_actual];
    if (C.revelada && p && p.tipo === 'lluvia_ideas' && $('#pizProf')) {
      const ideas = await rpc('vivo_pizarra', { p_sesion: s.id, p_pregunta: p.id }).catch(() => []);
      $('#pizProf').innerHTML = ideas.map(i => `<div class="nota-idea">${esc(i.texto)}<small>${esc(i.alias)}</small></div>`).join('') || '<span style="color:#fff;">Aún no hay ideas</span>';
    }
  }
  if ($('#tPlazo')) {
    $('#sTot').textContent = parts.length;
    $('#sJug').textContent = parts.filter(x => x.estado === 'en_curso').length;
    $('#sFin').textContent = parts.filter(x => x.estado === 'finalizado').length;
    const est = { esperando: 'No empezó', en_curso: 'Respondiendo', finalizado: 'Terminó ✅' };
    $('#tPlazo').innerHTML = parts.map((x, i) => `<tr><td>${i + 1}</td><td><div class="row" style="gap:6px; flex-wrap:nowrap;">${avatarHtml(x.avatar, 'sm')}${esc(x.alias)}</div></td><td>${est[x.estado]}</td>
      <td>${x.respondidas}/${C.preguntas.length}</td><td>${x.aciertos}</td><td><b>${Number(x.puntaje)}</b></td></tr>`).join('');
  }
  if ($('#tFinal')) {
    $('#podio').innerHTML = podio(parts);
    $('#tFinal').innerHTML = parts.map((x, i) => `<tr><td>${i + 1}</td><td><div class="row" style="gap:6px; flex-wrap:nowrap;">${avatarHtml(x.avatar, 'sm')}<b>${esc(x.alias)}</b></div></td>
      <td>${x.es_alumno ? '🎓 Alumno' : 'Invitado'}</td><td><b>${Number(x.puntaje)}</b></td><td>${x.aciertos}/${C.preguntas.length}</td><td>${fmtSeg(x.tiempo_total_seg ?? x.tiempo)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nadie participó.</td></tr>';
  }
}

// =====================================================================
// ARRANQUE
// =====================================================================
if (params.get('control')) control(params.get('control'));
else if (params.get('s')) entrarSesion(params.get('s'));
else if (params.get('pin')) { const pin = params.get('pin'); rpc('vivo_por_codigo', { p_codigo: pin }).then(s => s ? entrarSesion(s.id) : pantallaPin('PIN no válido')).catch(() => pantallaPin()); }
else pantallaPin();
