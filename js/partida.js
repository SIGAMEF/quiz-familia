// ============================================================
// Partida de un quiz publicado (la usan el alumno con cuenta y el invitado del enlace/QR)
// ============================================================
import { $, esc, toast, confirmar, cargando, mensajeError, avatarHtml, textoNota, notaLiteral } from './comun.js';
import { pintarPregunta, mostrarCorreccion, cronometro, iniciarMusica, detenerMusica, callar, vozActiva, decir } from './juego.js';

/**
 * Inicia y juega una publicación.
 * @param {object} o
 *  - app: contenedor
 *  - pub: { id, titulo, modo, intentos_max, intentos_usados, seg_por_pregunta }
 *  - jugador: { nombre, avatar }
 *  - api: { iniciar(cantidad) -> ref, preguntas(ref), responder(ref, args), finalizar(ref) }
 *  - cantidad, segundos (modo estudio)
 *  - alSalir(): al abandonar o al tocar "volver"
 *  - textoVolver: texto del botón final
 */
export async function jugarPublicacion(o) {
  const { pub } = o;
  if (pub.modo === 'examen') {
    const quedan = pub.intentos_max != null ? pub.intentos_max - (pub.intentos_usados || 0) : null;
    const ok = await confirmar(`${pub.titulo}\n\n• No verás si aciertas hasta el final.${quedan != null ? `\n• Te quedan ${quedan} intento(s).` : ''}${pub.seg_por_pregunta ? `\n• Tienes ${pub.seg_por_pregunta} segundos por pregunta.` : ''}\n• Si sales a la mitad, el intento queda sin terminar.`, { titulo: '📝 ¿Empezar el examen?', boton: 'Empezar', peligro: false });
    if (!ok) return false;
  }
  const c = cargando('Preparando tu quiz...');
  try {
    const ref = await o.api.iniciar(o.cantidad ?? null);
    const datos = await o.api.preguntas(ref);
    const j = { ...o, ref, datos, preguntas: datos.preguntas, i: 0, aciertos: 0, respondidas: 0,
                segundos: o.segundos || datos.publicacion.seg_por_pregunta, crono: null, activo: true };
    iniciarMusica();
    pintarJuego(j);
    return true;
  } catch (e) { toast(mensajeError(e), 'error'); return false; }
  finally { c.cerrar(); }
}

function pintarJuego(j) {
  const { app } = j;
  const p = j.preguntas[j.i];
  const esExamen = j.pub.modo === 'examen';
  const ultima = j.i === j.preguntas.length - 1;
  app.innerHTML = `
    <div class="row between" style="margin-bottom:12px; flex-wrap:nowrap;">
      <div class="row" style="flex-wrap:nowrap;">${avatarHtml(j.jugador.avatar, 'sm')}<b class="titulo" style="font-size:14px;">${esc(j.jugador.nombre)}</b></div>
      <div class="row" style="flex-wrap:nowrap; gap:6px;">${esExamen ? `<span class="badge red">📝 Examen</span>` : `<span class="badge green" data-aciertos>✅ ${j.aciertos} / ${j.respondidas}</span>`}
        <button class="btn btn-sm btn-outline btn-icon" id="bSalirQuiz" title="Salir del quiz">✕</button></div>
    </div>
    <div class="row between" style="margin-bottom:10px;">
      <span class="small muted" style="font-weight:800;">Pregunta ${j.i + 1} de ${j.preguntas.length}</span><div id="crono"></div></div>
    <div class="barra" style="margin:0 0 14px;"><div style="width:${(j.i / j.preguntas.length) * 100}%"></div></div>
    <div id="preg"></div>
    <button class="btn btn-primary btn-block hidden" id="bSig" style="margin-top:10px;">${ultima ? '🎉 Finalizar' : 'Siguiente →'}</button>`;

  $('#bSalirQuiz', app).onclick = async () => {
    if (!await confirmar('Tu intento quedará sin terminar.', { titulo: '¿Salir del quiz?', boton: 'Salir' })) return;
    if (j.crono) j.crono.detener();
    j.activo = false; detenerMusica(); callar();
    j.alSalir();
  };
  const bSig = $('#bSig', app);
  bSig.onclick = () => { if (j.crono) j.crono.detener(); callar(); if (ultima) terminar(j); else { j.i++; pintarJuego(j); } };

  const vista = pintarPregunta($('#preg', app), p, {
    numero: '',
    onResponder: async (ids, textos) => {
      if (j.crono) j.crono.detener();
      try {
        const tiempo = j.segundos && j.crono ? j.segundos - j.crono.restante() : null;
        const r = await j.api.responder(j.ref, { p_pregunta: p.id, p_opciones: ids, p_textos: textos, p_tiempo_seg: tiempo });
        j.respondidas++;
        if (r.es_correcta) j.aciertos++;
        mostrarCorreccion($('#preg', app), p, r, { voz: true });
        const badge = $('[data-aciertos]', app); if (badge) badge.textContent = `✅ ${j.aciertos} / ${j.respondidas}`;
      } catch (e) {
        if (/Ya respondiste/.test(mensajeError(e))) toast('Esta pregunta ya estaba respondida');
        else toast(mensajeError(e), 'error');
      }
      bSig.classList.remove('hidden');
      bSig.focus();
    }
  });

  if (j.segundos) {
    j.crono = cronometro($('#crono', app), j.segundos, {
      alTerminar: () => { toast('⏰ Se acabó el tiempo', 'error'); vista.forzar(); }
    });
  } else j.crono = null;
  const arrancar = () => { if (j.crono && j.activo && j.preguntas[j.i] === p) j.crono.iniciar(); };
  if (vozActiva()) decir(p.enunciado, arrancar); else arrancar();
}

async function terminar(j) {
  const { app } = j;
  detenerMusica();
  const c = cargando('Calculando tu resultado...');
  let r;
  try { r = await j.api.finalizar(j.ref); }
  catch (e) { c.cerrar(); toast(mensajeError(e), 'error'); return; }
  c.cerrar();
  j.activo = false;
  const escala = r.escala || 'vigesimal';
  const pct = r.puntaje_max > 0 ? (r.puntaje / r.puntaje_max) * 100 : 0;
  const estrellas = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
  const perfecto = r.puntaje_max > 0 && Number(r.puntaje) === Number(r.puntaje_max);
  const titulo = perfecto ? '¡Perfecto!' : pct >= 70 ? '¡Excelente!' : pct >= 50 ? '¡Buen intento!' : 'Sigue practicando';
  const quedan = j.pub.intentos_max != null ? j.pub.intentos_max - ((j.pub.intentos_usados || 0) + 1) : null;
  const textoWA = `📝 *${j.datos.publicacion.titulo}*\n👤 ${j.jugador.nombre}\n✅ Aciertos: ${r.aciertos}/${r.total}\n⭐ Puntaje: ${Number(r.puntaje)}/${Number(r.puntaje_max)}\n🎯 Nota: ${textoNota(r.nota, escala === 'literal' ? 'ambas' : escala)}\n📱 QuizApp`;

  app.innerHTML = `
    <div class="center">
      <div style="font-size:66px; animation:flotar 3s ease-in-out infinite; display:inline-block;">${perfecto ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
      <h1 style="margin:4px 0;">${titulo}</h1>
      <p class="muted" style="font-weight:700;">${esc(j.datos.publicacion.titulo)}</p>
      <div style="font-size:34px; margin:10px 0;">${[1, 2, 3].map(n => `<span style="opacity:${estrellas >= n ? 1 : .2};">⭐</span>`).join('')}</div>
      <div class="titulo" data-nota style="font-size:44px; color:#fff; background:linear-gradient(135deg,#8B7EF7,#6C5CE7); border-radius:22px; display:inline-block; padding:12px 30px; box-shadow:0 12px 28px rgba(108,92,231,.35);">${textoNota(r.nota, escala)}</div>
      <p style="font-weight:800; margin-top:10px;">${r.aciertos} de ${r.total} correctas · ${Number(r.puntaje)}/${Number(r.puntaje_max)} pts${escala === 'vigesimal' ? ` · nivel ${notaLiteral(r.nota)}` : ''}</p>
      ${j.nota ? `<p class="small muted" style="font-weight:700;">${esc(j.nota)}</p>` : ''}
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
      <button class="btn btn-block" id="bVolver">${esc(j.textoVolver || '← Volver a mis quizzes')}</button>
    </div>`;
  if (perfecto && window.confetti) { [0.2, 0.8, 0.5].forEach((x, i) => setTimeout(() => window.confetti({ particleCount: 80, spread: 70, origin: { x, y: 0.6 } }), i * 250)); }
  $('#bVolver', app).onclick = () => j.alSalir();
  $('#bWA', app).onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoWA)}`, '_blank');
  const otro = $('#bOtro', app);
  if (otro) otro.onclick = () => {
    j.pub.intentos_usados = (j.pub.intentos_usados || 0) + 1;
    const { app: a, pub, jugador, api, cantidad, alSalir, textoVolver, nota } = j;
    jugarPublicacion({ app: a, pub, jugador, api, cantidad, segundos: pub.modo === 'estudio' ? j.segundos : null, alSalir, textoVolver, nota });
  };
}
