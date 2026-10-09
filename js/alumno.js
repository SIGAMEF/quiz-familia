// ============================================================
// Pantalla del alumno
// ============================================================
import {
  supabase, $, $$, esc, toast, abrirModal, confirmar, pedirDatos, cargando, mensajeError,
  exigirRol, salir, cierreInactividad, avatarHtml, selectorAvatar, subirAvatar, AVATARES_ALUMNO,
  fmtFecha, MODOS, textoNota, claseNota, notaLiteral
} from './comun.js';
import {
  pintarPregunta, mostrarCorreccion, cronometro, iniciarMusica, detenerMusica, alternarMusica, musicaActiva,
  vozActiva, alternarVoz, decir, callar
} from './juego.js';

const app = $('#app');
let perfil = null;
let filtroGrupo = '';
let juego = null; // estado del quiz en curso

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

// ======================= INICIO =======================
async function inicio() {
  detenerMusica(); callar();
  juego = null;
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
        <button class="btn btn-sm btn-outline btn-icon" id="bConfig" title="Mis grupos y cuenta">⚙️</button>
        <button class="btn btn-sm btn-outline btn-icon" id="bSalir" title="Salir">🚪</button>
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

  $('#bSalir').onclick = salir;
  $('#bVoz').onclick = (e) => { e.currentTarget.textContent = alternarVoz() ? '🔊' : '🔈'; };
  $('#bMusica').onclick = (e) => { const a = alternarMusica(); detenerMusica(); e.currentTarget.textContent = a ? '🎵' : '🔇'; };
  $('#bAvatar').onclick = cambiarAvatar;
  $('#bConfig').onclick = () => configuracion(grupos);
  $$('[data-grupo]').forEach(b => b.onclick = () => { filtroGrupo = b.dataset.grupo; inicio(); });

  const lista = $('#lista');
  visibles.forEach(p => lista.appendChild(tarjeta(p)));
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
async function empezar(pub, cantidad = null, segundos = null) {
  if (pub.modo === 'examen') {
    const ok = await confirmar(`${pub.titulo}\n\n• No verás si aciertas hasta el final.${pub.intentos_max ? `\n• Te quedan ${pub.intentos_max - pub.intentos_usados} intento(s).` : ''}${pub.seg_por_pregunta ? `\n• Tienes ${pub.seg_por_pregunta} segundos por pregunta.` : ''}\n• Si sales a la mitad, el intento queda sin terminar.`, { titulo: '📝 ¿Empezar el examen?', boton: 'Empezar', peligro: false });
    if (!ok) return;
  }
  const c = cargando('Preparando tu quiz...');
  try {
    const intento = await rpc('iniciar_intento', { p_publicacion: pub.id, p_cantidad: cantidad });
    const datos = await rpc('preguntas_de_intento', { p_intento: intento });
    juego = { pub, intento, datos, preguntas: datos.preguntas, i: 0, aciertos: 0, respondidas: 0, segundos: segundos || datos.publicacion.seg_por_pregunta, cantidad, crono: null };
    iniciarMusica();
    pintarJuego();
  } catch (e) { toast(mensajeError(e), 'error'); }
  finally { c.cerrar(); }
}

function pintarJuego() {
  const j = juego;
  const p = j.preguntas[j.i];
  const esExamen = j.pub.modo === 'examen';
  const ultima = j.i === j.preguntas.length - 1;
  app.innerHTML = `
    <div class="row between" style="margin-bottom:12px; flex-wrap:nowrap;">
      <div class="row" style="flex-wrap:nowrap;">${avatarHtml(perfil.avatar, 'sm')}<b class="titulo" style="font-size:14px;">${esc(perfil.nombre || perfil.usuario)}</b></div>
      <div class="row" style="flex-wrap:nowrap; gap:6px;">${esExamen ? `<span class="badge red">📝 Examen</span>` : `<span class="badge green">✅ ${j.aciertos} / ${j.respondidas}</span>`}
        <button class="btn btn-sm btn-outline btn-icon" id="bSalirQuiz" title="Salir del quiz">✕</button></div>
    </div>
    <div class="row between" style="margin-bottom:10px;">
      <span class="small muted" style="font-weight:800;">Pregunta ${j.i + 1} de ${j.preguntas.length}</span><div id="crono"></div></div>
    <div class="barra" style="margin:0 0 14px;"><div style="width:${(j.i / j.preguntas.length) * 100}%"></div></div>
    <div id="preg"></div>
    <button class="btn btn-primary btn-block hidden" id="bSig" style="margin-top:10px;">${ultima ? '🎉 Finalizar' : 'Siguiente →'}</button>`;

  $('#bSalirQuiz').onclick = async () => {
    if (!await confirmar('Tu intento quedará sin terminar.', { titulo: '¿Salir del quiz?', boton: 'Salir' })) return;
    if (juego?.crono) juego.crono.detener();
    inicio();
  };
  const bSig = $('#bSig');
  bSig.onclick = () => { if (j.crono) j.crono.detener(); callar(); if (ultima) terminar(); else { j.i++; pintarJuego(); } };

  const vista = pintarPregunta($('#preg'), p, {
    numero: '',
    onResponder: async (ids, textos) => {
      if (j.crono) j.crono.detener();
      try {
        const tiempo = j.segundos && j.crono ? j.segundos - j.crono.restante() : null;
        const r = await rpc('responder', { p_intento: j.intento, p_pregunta: p.id, p_opciones: ids, p_textos: textos, p_tiempo_seg: tiempo });
        j.respondidas++;
        if (r.es_correcta) j.aciertos++;
        mostrarCorreccion($('#preg'), p, r, { voz: true });
        if (!esExamen) { const badge = $('.badge.green', app); if (badge) badge.textContent = `✅ ${j.aciertos} / ${j.respondidas}`; }
      } catch (e) {
        if (/Ya respondiste/.test(mensajeError(e))) toast('Esta pregunta ya estaba respondida');
        else toast(mensajeError(e), 'error');
      }
      bSig.classList.remove('hidden');
      bSig.focus();
    }
  });

  if (j.segundos) {
    j.crono = cronometro($('#crono'), j.segundos, {
      alTerminar: () => {
        toast('⏰ Se acabó el tiempo', 'error');
        vista.forzar();
      }
    });
  } else j.crono = null;
  const arrancar = () => { if (j.crono && juego === j && j.preguntas[j.i] === p) j.crono.iniciar(); };
  if (vozActiva()) decir(p.enunciado, arrancar); else arrancar();
}

async function terminar() {
  const j = juego;
  detenerMusica();
  const c = cargando('Calculando tu resultado...');
  let r;
  try { r = await rpc('finalizar_intento', { p_intento: j.intento }); }
  catch (e) { c.cerrar(); toast(mensajeError(e), 'error'); return; }
  c.cerrar();
  const escala = r.escala || 'vigesimal';
  const pct = r.puntaje_max > 0 ? (r.puntaje / r.puntaje_max) * 100 : 0;
  const estrellas = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
  const perfecto = r.puntaje_max > 0 && Number(r.puntaje) === Number(r.puntaje_max);
  const titulo = perfecto ? '¡Perfecto!' : pct >= 70 ? '¡Excelente!' : pct >= 50 ? '¡Buen intento!' : 'Sigue practicando';
  const quedan = j.pub.intentos_max != null ? j.pub.intentos_max - (j.pub.intentos_usados + 1) : null;
  const textoWA = `📝 *${j.datos.publicacion.titulo}*\n👤 ${perfil.nombre || perfil.usuario}\n✅ Aciertos: ${r.aciertos}/${r.total}\n⭐ Puntaje: ${Number(r.puntaje)}/${Number(r.puntaje_max)}\n🎯 Nota: ${textoNota(r.nota, escala === 'literal' ? 'ambas' : escala)}\n📱 QuizApp`;

  app.innerHTML = `
    <div class="center">
      <div style="font-size:66px; animation:flotar 3s ease-in-out infinite; display:inline-block;">${perfecto ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
      <h1 style="margin:4px 0;">${titulo}</h1>
      <p class="muted" style="font-weight:700;">${esc(j.datos.publicacion.titulo)}</p>
      <div style="font-size:34px; margin:10px 0;">${[1, 2, 3].map(n => `<span style="opacity:${estrellas >= n ? 1 : .2};">⭐</span>`).join('')}</div>
      <div class="titulo" style="font-size:44px; color:#fff; background:linear-gradient(135deg,#8B7EF7,#6C5CE7); border-radius:22px; display:inline-block; padding:12px 30px; box-shadow:0 12px 28px rgba(108,92,231,.35);">${textoNota(r.nota, escala)}</div>
      <p style="font-weight:800; margin-top:10px;">${r.aciertos} de ${r.total} correctas · ${Number(r.puntaje)}/${Number(r.puntaje_max)} pts${escala === 'vigesimal' ? ` · nivel ${notaLiteral(r.nota)}` : ''}</p>
    </div>
    ${r.revision ? `<details style="margin-top:14px;" ${pct < 100 ? 'open' : ''}><summary class="titulo" style="cursor:pointer;">📋 Revisa tus respuestas</summary>
      <div class="stack" style="margin-top:10px; max-height:340px; overflow-y:auto;">${r.revision.map((x, k) => `
        <div style="border:2px solid ${x.es_correcta === true ? 'var(--green-strong)' : x.es_correcta === false ? 'var(--red-strong)' : 'var(--line)'}; border-radius:12px; padding:10px;">
          <b>${k + 1}. ${esc(x.enunciado)}</b>
          <p class="small" style="margin-top:4px;">${x.es_correcta === true ? '✅' : x.es_correcta === false ? '❌' : '💭'} Tu respuesta: <b>${esc(x.tu_respuesta || 'sin responder')}</b></p>
          ${x.es_correcta === false && x.correcta_texto ? `<p class="small">Correcta: <b>${esc(x.correcta_texto)}</b></p>` : ''}
          ${x.explicacion ? `<p class="small muted">💡 ${esc(x.explicacion)}</p>` : ''}</div>`).join('')}</div></details>` : ''}
    <div class="stack" style="margin-top:16px;">
      ${j.pub.modo === 'estudio' ? '<button class="btn btn-primary btn-block" id="bOtro">🔄 Generar otro quiz</button>' : (quedan === null || quedan > 0) ? '<button class="btn btn-primary btn-block" id="bOtro">🔄 Intentar de nuevo</button>' : ''}
      <button class="btn btn-block" style="background:linear-gradient(135deg,#25D366,#128C7E); color:#fff;" id="bWA">📱 Compartir por WhatsApp</button>
      <button class="btn btn-block" id="bVolver">← Volver a mis quizzes</button>
    </div>`;
  if (perfecto && window.confetti) { [0.2, 0.8, 0.5].forEach((x, i) => setTimeout(() => window.confetti({ particleCount: 80, spread: 70, origin: { x, y: 0.6 } }), i * 250)); }
  $('#bVolver').onclick = inicio;
  $('#bWA').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoWA)}`, '_blank');
  const otro = $('#bOtro');
  if (otro) otro.onclick = () => { j.pub.intentos_usados++; empezar(j.pub, j.cantidad, j.pub.modo === 'estudio' ? j.segundos : null); };
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
