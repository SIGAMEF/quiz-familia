// ============================================================
// Enlace / QR de una publicación: jugar.html?p=<publicación>
//  - Alumno del grupo: entra con su cuenta y resuelve (cuenta para la libreta)
//  - Alumno de otro grupo: puede unirse al grupo si este acepta alumnos
//  - Cualquiera sin cuenta: juega como invitado si el profesor lo permitió
// ============================================================
import {
  supabase, $, esc, toast, mensajeError, miPerfil, iniciarSesion, mostrarRestringido, paginaDeRol,
  avatarHtml, selectorAvatar, AVATARES_ALUMNO, MODOS, fmtFecha
} from './comun.js';
import { detenerMusica, alternarMusica, musicaActiva, vozActiva, alternarVoz, callar } from './juego.js';
import { jugarPublicacion } from './partida.js';

const app = $('#app');
const pubId = new URLSearchParams(location.search).get('p');
let perfil = null;
let pub = null;

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

function aviso(ico, titulo, texto, extra = '') {
  app.innerHTML = `<div class="center"><div style="font-size:54px;">${ico}</div><h1 style="margin:6px 0;">${esc(titulo)}</h1>
    <p class="muted" style="font-weight:700;">${esc(texto)}</p>${extra}</div>`;
}

async function cargar() {
  detenerMusica(); callar();
  app.innerHTML = '<div class="center"><div class="spinner"></div></div>';
  if (!pubId) return aviso('🔗', 'Enlace incompleto', 'Pide a tu profesor el enlace o el QR del quiz.');
  try {
    perfil = await miPerfil();
    pub = await rpc('pub_publica', { p_pub: pubId });
  } catch (e) {
    return aviso('⚠️', 'No se pudo abrir el quiz', mensajeError(e), '<button class="btn btn-primary" style="margin-top:14px;" onclick="location.reload()">Reintentar</button>');
  }
  if (perfil && perfil.estado === 'restringido') return mostrarRestringido(perfil);
  // alumno del grupo: directo a su panel con el quiz abierto
  if (perfil && perfil.rol === 'alumno' && pub.soy_miembro) {
    location.replace(`alumno.html?pub=${encodeURIComponent(pub.id)}`);
    return;
  }
  portada();
}

function cabecera() {
  const m = MODOS[pub.modo];
  const n = pub.cantidad_preguntas && pub.modo !== 'estudio' ? Math.min(pub.cantidad_preguntas, pub.num_preguntas) : pub.num_preguntas;
  return `
    <div class="row between" style="margin-bottom:8px;">
      <a href="index.html" class="small muted" style="font-weight:800; text-decoration:none;">QuizApp</a>
      <div class="row" style="gap:6px;">
        <button class="btn btn-sm btn-outline btn-icon" id="bVoz" title="Leer preguntas en voz alta">${vozActiva() ? '🔊' : '🔈'}</button>
        <button class="btn btn-sm btn-outline btn-icon" id="bMusica" title="Música">${musicaActiva() ? '🎵' : '🔇'}</button>
      </div>
    </div>
    <div class="center">
      <div style="font-size:50px;">${m.ico}</div>
      <h1 style="margin:4px 0;">${esc(pub.titulo)}</h1>
      <div class="row" style="justify-content:center; gap:6px; margin:4px 0;">
        <span class="badge ${m.clase}">${m.nombre}</span>
        <span class="small muted" style="font-weight:800;">${n} preguntas${pub.seg_por_pregunta && pub.modo !== 'estudio' ? ` · ⏱ ${pub.seg_por_pregunta}s` : ''}</span>
      </div>
      <div class="row" style="justify-content:center; gap:8px; margin-top:6px;">${avatarHtml(pub.avatar_profesor, 'sm', '👩‍🏫')}
        <span class="small" style="font-weight:700;">${esc(pub.profesor)} · ${esc(pub.grupo)}${pub.institucion ? `<br><span class="muted">🏫 ${esc(pub.institucion)}</span>` : ''}</span></div>
      ${pub.fin && pub.disponible ? `<p class="small" style="font-weight:800; color:var(--amber); margin-top:6px;">⏰ Hasta ${fmtFecha(pub.fin, true)}</p>` : ''}
    </div>`;
}

function activarCabecera() {
  $('#bVoz').onclick = (e) => { e.currentTarget.textContent = alternarVoz() ? '🔊' : '🔈'; };
  $('#bMusica').onclick = (e) => { const a = alternarMusica(); detenerMusica(); e.currentTarget.textContent = a ? '🎵' : '🔇'; };
}

function portada(error = '') {
  const noDisp = !pub.disponible;
  const formLogin = `
    <form id="fLogin" style="margin-top:8px;">
      <input class="input" id="u" placeholder="Usuario" autocapitalize="none" autocomplete="username" style="margin-bottom:8px;">
      <input class="input" id="c" type="password" placeholder="Contraseña" autocomplete="current-password">
      <button class="btn btn-primary btn-block" style="margin-top:8px;">Entrar con mi cuenta</button></form>`;
  const formInvitado = `
    <label class="lbl">Tu nombre</label><input class="input" id="alias" maxlength="40" placeholder="Ej: Lucía Ramos">
    <label class="lbl">Elige tu avatar</label><div id="av"></div>
    <button class="btn btn-amber btn-block" id="bInvitado" style="margin-top:14px; font-size:17px;">▶ ¡Empezar!</button>
    <p class="hint center">Tu resultado le llega a tu profesor como <b>invitado</b>.</p>`;

  let cuerpo = '';
  if (noDisp) {
    cuerpo = `<div class="feedback neutro" style="margin-top:14px;">🔒 ${esc(pub.motivo)}</div>`;
  } else if (perfil && perfil.rol === 'alumno') {
    // alumno con cuenta que no está en el grupo
    cuerpo = `<div class="card center" style="margin-top:14px;">${avatarHtml(perfil.avatar, 'lg')}
        <p style="font-weight:800; margin:8px 0;">${esc(perfil.nombre || perfil.usuario)}</p>
        ${pub.acepta_registros
          ? `<p class="small muted" style="font-weight:700; margin-bottom:10px;">Aún no estás en el grupo <b>${esc(pub.grupo)}</b>. Únete para que tu nota cuente.</p>
             <button class="btn btn-primary btn-block" id="bUnirme">👥 Unirme al grupo y empezar</button>`
          : `<div class="feedback neutro">Este quiz es del grupo <b>${esc(pub.grupo)}</b> y no estás en él. Pide a tu profesor que te agregue.</div>`}
        <button class="btn btn-sm btn-ghost" id="bOtraCuenta" style="margin-top:8px;">No soy yo · usar otra cuenta</button></div>
      ${pub.permite_invitados ? `<details style="margin-top:14px;"><summary style="cursor:pointer; font-weight:800; color:var(--primary-dark);">O resolverlo como invitado (no cuenta en la libreta)</summary>${formInvitado}</details>` : ''}`;
  } else if (perfil && (perfil.rol === 'profesor' || perfil.rol === 'admin')) {
    cuerpo = `<div class="feedback neutro" style="margin-top:14px;">👩‍🏫 Así verán este enlace tus alumnos. ${pub.permite_invitados ? 'Abajo puedes probarlo como invitado.' : 'Solo los alumnos del grupo pueden resolverlo (los invitados están desactivados).'}</div>
      <a class="btn btn-block" href="${paginaDeRol(perfil.rol)}" style="margin-top:8px;">← Volver a mi panel</a>
      ${pub.permite_invitados ? `<div class="card" style="margin-top:14px;">${formInvitado}</div>` : ''}`;
  } else if (pub.permite_invitados) {
    cuerpo = `<div class="card" style="margin-top:14px;">
        <h3 style="margin-bottom:4px;">🎒 ¿Eres alumno del grupo?</h3>
        <p class="small muted" style="font-weight:700;">Entra con tu cuenta para que tu nota quede en la libreta.</p>${formLogin}</div>
      <div class="card" style="margin-top:14px;"><h3 style="margin-bottom:4px;">🙋 ¿No tienes cuenta?</h3>${formInvitado}</div>`;
  } else {
    cuerpo = `<div class="card" style="margin-top:14px;">
        <h3 style="margin-bottom:4px;">🎒 Entra con tu cuenta de alumno</h3>
        <p class="small muted" style="font-weight:700;">Este quiz es para los alumnos del grupo ${esc(pub.grupo)}. Si aún no tienes cuenta, pide a tu profesor el enlace del grupo.</p>${formLogin}</div>`;
  }
  app.innerHTML = cabecera() + cuerpo + `<div class="err center" id="err">${esc(error)}</div>`;
  activarCabecera();

  const f = $('#fLogin');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const b = $('button', f); b.disabled = true;
    try {
      await iniciarSesion($('#u').value, $('#c').value);
      cargar();
    } catch (er) { $('#err').textContent = mensajeError(er); b.disabled = false; }
  };
  const bU = $('#bUnirme');
  if (bU) bU.onclick = async () => {
    bU.disabled = true;
    try { const r = await rpc('unirme_por_publicacion', { p_pub: pub.id }); toast(`Te uniste a ${r.nombre}`); location.replace(`alumno.html?pub=${encodeURIComponent(pub.id)}`); }
    catch (e) { $('#err').textContent = mensajeError(e); bU.disabled = false; }
  };
  const bO = $('#bOtraCuenta');
  if (bO) bO.onclick = async () => { await supabase.auth.signOut(); cargar(); };

  const av = $('#av') ? selectorAvatar($('#av'), { emojis: AVATARES_ALUMNO, permitirFoto: false, actual: AVATARES_ALUMNO[Math.floor(Math.random() * AVATARES_ALUMNO.length)] }) : null;
  const bI = $('#bInvitado');
  if (bI) bI.onclick = () => {
    const alias = ($('#alias').value || '').trim();
    if (!alias) { $('#err').textContent = 'Escribe tu nombre.'; $('#alias').focus(); return; }
    jugarComoInvitado(alias, av ? av.valor() : null);
  };
}

function jugarComoInvitado(alias, avatar) {
  const p = { ...pub, intentos_usados: 0, intentos_max: null };
  const estudio = p.modo === 'estudio';
  jugarPublicacion({
    app, pub: p,
    cantidad: estudio ? Math.min(p.cantidad_preguntas || 10, p.num_preguntas) : null,
    segundos: estudio ? (p.seg_por_pregunta || 20) : null,
    jugador: { nombre: alias, avatar },
    api: {
      iniciar: (cant) => rpc('invitado_iniciar', { p_pub: p.id, p_alias: alias, p_avatar: avatar, p_cantidad: cant }),
      preguntas: (r) => rpc('invitado_preguntas', { p_intento: r.intento_id, p_token: r.token }),
      responder: (r, args) => rpc('invitado_responder', { p_intento: r.intento_id, p_token: r.token, ...args }),
      finalizar: (r) => rpc('invitado_finalizar', { p_intento: r.intento_id, p_token: r.token })
    },
    alSalir: () => portada(),
    textoVolver: '← Volver al inicio',
    nota: 'Resolviste como invitado: tu profesor ve tu resultado, pero no va a la libreta de notas.'
  });
}

cargar();
