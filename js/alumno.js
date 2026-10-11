// ============================================================
// Pantalla del alumno
// ============================================================
import {
  supabase, $, $$, esc, toast, abrirModal, confirmar, pedirDatos, cargando, mensajeError,
  exigirRol, salir, menuUsuario, cierreInactividad, avatarHtml, selectorAvatar, subirAvatar, AVATARES_ALUMNO,
  fmtFecha, MODOS, textoNota, claseNota, notaLiteral
} from './comun.js';
import { detenerMusica, alternarMusica, musicaActiva, vozActiva, alternarVoz, callar } from './juego.js';
import { jugarPublicacion } from './partida.js';

const app = $('#app');
let perfil = null;
let filtroGrupo = '';

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

// ======================= INICIO =======================
async function inicio() {
  detenerMusica(); callar();
  app.innerHTML = '<div class="center"><div class="spinner"></div></div>';
  let pubs, grupos, historial;
  try { [pubs, grupos, historial] = await Promise.all([rpc('mis_publicaciones'), rpc('mis_grupos'), rpc('mi_historial', { p_limite: 60 })]); }
  catch (e) { app.innerHTML = `<div class="empty">⚠️ ${esc(mensajeError(e))}<br><button class="btn btn-sm" style="margin-top:10px;" onclick="location.reload()">Reintentar</button></div>`; return; }

  // estadísticas
  const notas = historial.map(h => Number(h.nota));
  const promedio = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const dias = new Set(historial.map(h => new Date(h.finalizado_en).toDateString()));
  let racha = 0;
  for (let d = 0; d < 60; d++) {
    const f = new Date(); f.setDate(f.getDate() - d);
    if (dias.has(f.toDateString())) racha++; else if (d > 0) break;
  }

  const profesores = [...new Map(grupos.map(g => [g.grupo, g])).values()];
  const visibles = pubs.filter(p => !filtroGrupo || p.grupo === filtroGrupo);
  const primerNombre = (perfil.nombre || perfil.usuario).split(' ')[0];

  app.innerHTML = `
    <div class="row between" style="margin-bottom:18px; flex-wrap:nowrap;">
      <div class="row" style="flex-wrap:nowrap;">
        <button id="bAvatar" title="Cambiar avatar" style="border:none; background:none; cursor:pointer; padding:0;">${avatarHtml(perfil.avatar, 'lg')}</button>
        <div><h2 class="titulo" style="font-size:21px;">¡Hola, ${esc(primerNombre)}!</h2><p class="small muted" style="font-weight:800;">¿Listo para aprender?</p></div>
      </div>
      <div class="row" style="gap:6px; flex-wrap:nowrap;">
        <button class="btn btn-sm btn-outline btn-icon" id="bVoz" title="Leer preguntas en voz alta">${vozActiva() ? '🔊' : '🔈'}</button>
        <button class="btn btn-sm btn-outline btn-icon" id="bMusica" title="Música">${musicaActiva() ? '🎵' : '🔇'}</button>
        <button type="button" class="btn btn-sm btn-outline btn-icon" id="bCuenta" title="Mi cuenta" aria-label="Mi cuenta">☰</button>
      </div>
    </div>
    <a href="vivo.html" class="btn btn-amber btn-block" style="justify-content:space-between; padding:14px 18px; margin-bottom:16px;"><span>🏆 Unirme a un quiz en vivo</span><span>›</span></a>
    <div class="grid grid-3" style="margin-bottom:18px; grid-template-columns:repeat(3,1fr);">
      <div class="stat center"><span>🏆 Hechos</span><b>${historial.length}</b></div>
      <div class="stat center"><span>⭐ Promedio</span><b>${promedio == null ? '—' : promedio.toFixed(1).replace(/\.0$/, '')}</b></div>
      <div class="stat center"><span>🔥 Racha</span><b>${racha}</b></div>
    </div>
    ${!grupos.length ? `<div class="feedback neutro">Aún no estás en ningún grupo. Pide a tu profesor el enlace o el código del grupo y toca ⚙️ para unirte.</div>` : ''}
    ${profesores.length > 1 ? `<div class="chips" style="margin-bottom:12px;"><button class="chip ${filtroGrupo ? '' : 'activo'}" data-grupo="">Todos</button>
      ${profesores.map(g => `<button class="chip ${filtroGrupo === g.grupo ? 'activo' : ''}" data-grupo="${esc(g.grupo)}">${esc(g.curso || g.grupo)}</button>`).join('')}</div>` : ''}
    <h3 style="margin-bottom:10px;">📚 Tus quizzes</h3>
    <div id="lista">${visibles.length ? '' : '<div class="empty"><span class="big">📭</span>No hay quizzes publicados por ahora.</div>'}</div>
    ${historial.length ? `<details style="margin-top:16px;"><summary class="titulo" style="cursor:pointer; font-size:16px;">🕘 Mis últimos resultados</summary>
      <div class="stack" style="margin-top:10px;">${historial.slice(0, 15).map(h => `<div class="row between" style="padding:8px 10px; border:1px solid var(--line); border-radius:12px;">
        <span class="grow"><b>${esc(h.titulo)}</b><br><span class="small muted">${MODOS[h.modo].ico} ${MODOS[h.modo].nombre} · ${fmtFecha(h.finalizado_en, true)}</span></span>
        <span class="badge ${claseNota(h.nota)}" style="font-size:13px;">${textoNota(h.nota, h.escala)}</span></div>`).join('')}</div></details>` : ''}`;


  $('#bVoz').onclick = (e) => { e.currentTarget.textContent = alternarVoz() ? '🔊' : '🔈'; };
  $('#bMusica').onclick = (e) => { const a = alternarMusica(); detenerMusica(); e.currentTarget.textContent = a ? '🎵' : '🔇'; };
  $('#bAvatar').onclick = cambiarAvatar;
  menuUsuario($('#bCuenta'), [
    { ico: '🧑‍🎤', txt: 'Cambiar mi avatar', id: 'avatar', accion: cambiarAvatar },
    { ico: '⚙️', txt: 'Mis grupos y cuenta', id: 'config', accion: () => configuracion(grupos) },
    'sep',
    { ico: '🚪', txt: 'Cerrar sesión', id: 'salir', peligro: true, accion: salir }
  ]);
  $$('[data-grupo]').forEach(b => b.onclick = () => { filtroGrupo = b.dataset.grupo; inicio(); });

  const lista = $('#lista');
  visibles.forEach(p => lista.appendChild(tarjeta(p)));

  // llegó desde el enlace o QR de una publicación (alumno.html?pub=ID)
  const pedido = new URLSearchParams(location.search).get('pub');
  if (pedido) {
    history.replaceState(null, '', location.pathname);
    const p = pubs.find(x => x.id === pedido);
    if (!p) toast('Ese quiz no está disponible para ti en este momento.', 'error');
    else if (!p.disponible) toast('Ese quiz no está disponible en este momento.', 'error');
    else if (p.intentos_max != null && p.intentos_usados >= p.intentos_max) toast('Ya usaste todos tus intentos en ese quiz.', 'error');
    else if (p.num_preguntas === 0) toast('Ese quiz todavía no tiene preguntas.', 'error');
    else empezar(p, p.modo === 'estudio' ? Math.min(p.cantidad_preguntas || 10, p.num_preguntas) : null, p.modo === 'estudio' ? (p.seg_por_pregunta || 20) : null);
  }
}

function tarjeta(p) {
  const m = MODOS[p.modo];
  const agotado = p.intentos_max != null && p.intentos_usados >= p.intentos_max;
  const bloqueado = !p.disponible || agotado || p.num_preguntas === 0;
  const colores = { practica: ['var(--primary-light)', 'var(--primary-dark)'], examen: ['var(--red-bg)', 'var(--red)'], estudio: ['var(--amber-bg)', 'var(--amber)'] }[p.modo];
  const div = document.createElement('div');
  div.className = 'preg-card';
  div.style.cssText = `display:flex; gap:12px; align-items:flex-start; cursor:${bloqueado || p.modo === 'estudio' ? 'default' : 'pointer'}; position:relative; ${bloqueado ? 'opacity:.6;' : ''}`;
  let estado = '';
  if (!p.disponible) estado = p.inicio && new Date(p.inicio) > new Date() ? `🔒 Disponible desde ${fmtFecha(p.inicio, true)}` : '🔒 Ya cerró';
  else if (agotado) estado = '✔ Ya usaste todos tus intentos';
  else if (p.fin) estado = `⏰ Hasta ${fmtFecha(p.fin, true)}`;
  const nota = p.ultimo ? `<span class="badge ${claseNota(p.ultimo.nota)}" style="position:absolute; top:10px; right:10px;">${textoNota(p.mejor_nota, p.escala)}</span>` : '';
  div.innerHTML = `${nota}
    <div style="width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; background:${colores[0]};">${m.ico}</div>
    <div class="grow" style="padding-right:${p.ultimo ? '54px' : '0'};">
      <div class="titulo" style="font-size:16px;">${esc(p.titulo)}</div>
      <div class="row" style="gap:6px; margin:3px 0;"><span class="badge ${m.clase}">${m.nombre}</span>
        <span class="small muted" style="font-weight:700;">${p.cantidad_preguntas && p.modo !== 'estudio' ? Math.min(p.cantidad_preguntas, p.num_preguntas) : p.num_preguntas} preguntas${p.seg_por_pregunta && p.modo !== 'estudio' ? ` · ⏱ ${p.seg_por_pregunta}s` : ''}</span></div>
      <div class="small muted" style="font-weight:700;">${esc(p.profesor)}${p.curso ? ' · ' + esc(p.curso) : ''}${p.periodo ? ' · ' + esc(p.periodo) : ''}${p.intentos_max ? ` · intentos ${p.intentos_usados}/${p.intentos_max}` : ''}</div>
      ${estado ? `<div class="small" style="font-weight:800; margin-top:3px; color:${agotado || !p.disponible ? 'var(--muted)' : 'var(--amber)'};">${estado}</div>` : ''}
      ${p.modo === 'estudio' && !bloqueado ? `<div class="row" style="gap:6px; margin-top:8px;">
        <input class="input" type="number" min="1" max="${p.num_preguntas}" value="${Math.min(p.cantidad_preguntas || 10, p.num_preguntas)}" data-cant style="width:66px; padding:6px;">
        <span class="small muted" style="font-weight:700;">preg.</span>
        <input class="input" type="number" min="5" value="${p.seg_por_pregunta || 20}" data-seg style="width:62px; padding:6px;">
        <span class="small muted" style="font-weight:700;">seg/preg.</span>
        <button class="btn btn-sm btn-primary" data-ir>▶ Ir</button></div>` : ''}
    </div>`;
  if (bloqueado) return div;
  if (p.modo === 'estudio') {
    $('[data-ir]', div).onclick = () => {
      const cant = Math.max(1, Math.min(p.num_preguntas, parseInt($('[data-cant]', div).value, 10) || 10));
      const seg = Math.max(5, parseInt($('[data-seg]', div).value, 10) || 20);
      empezar(p, cant, seg);
    };
    $$('input', div).forEach(i => i.onclick = (e) => e.stopPropagation());
  } else div.onclick = () => empezar(p);
  return div;
}

// ======================= JUEGO =======================
function empezar(pub, cantidad = null, segundos = null) {
  return jugarPublicacion({
    app, pub, cantidad, segundos,
    jugador: { nombre: perfil.nombre || perfil.usuario, avatar: perfil.avatar },
    api: {
      iniciar: (cant) => rpc('iniciar_intento', { p_publicacion: pub.id, p_cantidad: cant }),
      preguntas: (id) => rpc('preguntas_de_intento', { p_intento: id }),
      responder: (id, args) => rpc('responder', { p_intento: id, ...args }),
      finalizar: (id) => rpc('finalizar_intento', { p_intento: id })
    },
    alSalir: inicio
  });
}

// ======================= AJUSTES =======================
async function cambiarAvatar() {
  const m = abrirModal(`<h3>🧑‍🎤 Elige tu avatar</h3><div data-av></div><div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok>Guardar</button></div>`);
  const av = selectorAvatar($('[data-av]', m.el), { emojis: AVATARES_ALUMNO, actual: perfil.avatar && !perfil.avatar.startsWith('http') ? perfil.avatar : '' });
  $('[data-ok]', m.el).onclick = async () => {
    const c = cargando('Guardando...');
    try {
      const avatar = av.archivo() ? await subirAvatar(av.archivo(), perfil.id) : av.valor();
      const { error } = await supabase.from('perfiles').update({ avatar }).eq('id', perfil.id);
      if (error) throw error;
      perfil.avatar = avatar; m.cerrar(); inicio();
    } catch (e) { toast(mensajeError(e), 'error'); }
    finally { c.cerrar(); }
  };
}

function configuracion(grupos) {
  const m = abrirModal(`<h3>⚙️ Mis grupos y cuenta</h3>
    ${grupos.map(g => `<div class="preg-card"><div class="row">${avatarHtml(g.avatar_profesor, '', '👩‍🏫')}
      <div class="grow"><b>${esc(g.grupo)}</b><br><span class="small muted" style="font-weight:700;">${esc(g.profesor)}${g.curso ? ' · ' + esc(g.curso) : ''}<br>🏫 ${esc(g.institucion || '')}</span></div></div>
      ${g.permite_cambio && g.otros_grupos.length ? `<div class="row" style="margin-top:8px;"><select class="input grow" data-cambio="${g.grupo_id}"><option value="">Cambiarme a…</option>${g.otros_grupos.map(o => `<option value="${o.id}">${esc(o.nombre)}</option>`).join('')}</select></div>` : ''}
    </div>`).join('') || '<p class="muted">Aún no perteneces a ningún grupo.</p>'}
    <label class="lbl">Unirme a otro grupo (código que te dio tu profesor)</label>
    <div class="row"><input class="input grow" data-codigo placeholder="Ej: K7P2QX9M" style="text-transform:uppercase;"><button class="btn btn-primary" data-unir>Unirme</button></div>
    <label class="lbl">Mi nombre</label>
    <div class="row"><input class="input grow" data-nombre value="${esc(perfil.nombre || '')}"><button class="btn" data-gnombre>Guardar</button></div>
    <label class="lbl">Cambiar contraseña</label>
    <div class="row"><input class="input grow" type="password" data-clave placeholder="Nueva contraseña (mínimo 6)" autocomplete="new-password"><button class="btn" data-gclave>Cambiar</button></div>
    <p class="hint">Tu usuario es <b>${esc(perfil.usuario)}</b>.</p>`);
  $$('[data-cambio]', m.el).forEach(s => s.onchange = async () => {
    if (!s.value) return;
    if (!await confirmar('Verás los quizzes del nuevo grupo. Tus resultados anteriores se conservan.', { titulo: '¿Cambiar de grupo?', boton: 'Cambiar', peligro: false })) { s.value = ''; return; }
    try { await rpc('cambiar_de_grupo', { p_grupo_actual: s.dataset.cambio, p_grupo_nuevo: s.value }); toast('Cambiaste de grupo'); m.cerrar(); inicio(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  });
  $('[data-unir]', m.el).onclick = async () => {
    const cod = $('[data-codigo]', m.el).value.trim();
    if (!cod) return;
    try { const r = await rpc('unirme_a_grupo', { p_codigo: cod }); toast(`Te uniste a ${r.nombre}`); m.cerrar(); inicio(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  };
  $('[data-gnombre]', m.el).onclick = async () => {
    const nombre = $('[data-nombre]', m.el).value.trim();
    if (!nombre) return toast('Escribe tu nombre', 'error');
    const { error } = await supabase.from('perfiles').update({ nombre }).eq('id', perfil.id);
    if (error) return toast(mensajeError(error), 'error');
    perfil.nombre = nombre; toast('Nombre guardado');
  };
  $('[data-gclave]', m.el).onclick = async () => {
    const clave = $('[data-clave]', m.el).value;
    if (clave.length < 6) return toast('Mínimo 6 caracteres', 'error');
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) return toast(mensajeError(error), 'error');
    $('[data-clave]', m.el).value = ''; toast('Contraseña cambiada');
  };
}

// ======================= ARRANQUE =======================
perfil = await exigirRol(['alumno']);
if (perfil) { cierreInactividad(20); inicio(); }
