// ============================================================
// Quiz público de un profesor: todos los tipos de pregunta, corregido en el servidor
// En una sala por turnos, cada pregunta la responde un jugador distinto.
// ============================================================
import { $, $$, esc, barajar, pantallaFinal, mezclador, hudJugadores, turnos } from './util.js?v=202610242304';

export async function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const [{ supabase, mensajeError }, { pintarPregunta, mostrarCorreccion, tono, deshabilitar }] = await Promise.all([import('../comun.js'), import('../juego.js')]);
  const rpc = async (n, a) => { const { data, error } = await supabase.rpc(n, a); if (error) throw error; return data; };
  const n = Number(opciones.cantidad) || 10;
  const lista = mezclar(set.preguntas).slice(0, Math.min(n, set.preguntas.length));
  jugadores.forEach(j => { j.puntos = 0; });
  let i = 0, aciertos = 0, calificables = 0, respondida = false;
  let caja, sig, vista;
  const turno = () => i % N;
  const mio = () => !red || red.puedo(turno());

  function pregunta() {
    const p = lista[i];
    respondida = false;
    cont.innerHTML = `
      ${N > 1 ? hudJugadores(jugadores, turno(), (j) => `⭐ ${j.puntos}`) : ''}
      <div class="sopa-top"><span class="pill">📝 ${esc(set.titulo)}</span><span class="pill">${i + 1} / ${lista.length}</span>${N > 1 ? '' : `<span class="pill">⭐ ${jugadores[0].puntos}</span>`}</div>
      <div class="tabla-juego quiz-libre"><div data-preg></div>
        <button class="b3 azul hidden" data-sig style="margin-top:12px; width:100%;">${i === lista.length - 1 ? 'Ver resultado' : 'Siguiente →'}</button>
        <p class="ordena-pista hidden" data-espera></p></div>`;
    caja = $('[data-preg]', cont); sig = $('[data-sig]', cont);
    vista = pintarPregunta(caja, p, {
      onResponder: async (ids, textos) => {
        if (respondida || !mio()) return;
        let r = null, error = '';
        try { r = await rpc('quiz_libre_calificar', { p_quiz: set.id, p_pregunta: p.id, p_opciones: ids, p_textos: textos }); }
        catch (e) { error = mensajeError(e); }
        T.hacer(turno, { t: 'r', ids, textos, r, error }, aplicar);
      }
    });
    if (!mio()) deshabilitar(caja);   // los demás solo miran cómo responde
    sig.onclick = () => T.hacer(turno, { t: 'sig' }, aplicar);
  }
  function mostrar({ ids = [], textos = [], r, error }) {
    if (respondida) return;
    respondida = true;
    const p = lista[i];
    deshabilitar(caja);
    // en las otras pantallas se marca lo que eligió quien respondió
    (ids || []).forEach(id => $(`[data-op="${id}"]`, caja)?.classList.add('sel'));
    $$('[data-blank]', caja).forEach((inp, k) => { if (textos[k] != null) inp.value = textos[k]; });
    const idea = $('[data-idea]', caja); if (idea && textos[0]) idea.value = textos[0];
    if (r) {
      if (p.tipo !== 'lluvia_ideas') { calificables++; if (r.es_correcta) aciertos++; jugadores[turno()].puntos += Math.round(100 * Number(r.fraccion || 0)); }
      tono(r.es_correcta || p.tipo === 'lluvia_ideas' ? 'correcto' : 'incorrecto');
      if (r.es_correcta)
      mostrarCorreccion(caja, p, r, { voz: false });
      if (N > 1) { const hud = $('.hud', cont); if (hud) hud.outerHTML = hudJugadores(jugadores, turno(), (j) => `⭐ ${j.puntos}`); }
    } else caja.insertAdjacentHTML('beforeend', `<p class="err">${esc(error || 'No se pudo calificar')}</p>`);
    if (mio()) { sig.classList.remove('hidden'); sig.focus(); }
    else { const e = $('[data-espera]', cont); e.textContent = `Esperando a que ${jugadores[turno()].nombre} continúe…`; e.classList.remove('hidden'); }
  }
  function siguiente() {
    i++;
    if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Quiz terminado!', detalle: `${aciertos} de ${calificables} correctas.`, alRepetir, alMenu });
    pregunta();
  }
  function aplicar(a) {
    if (a.t === 'r') mostrar(a);
    else if (a.t === 'sig') { if (respondida) siguiente(); }
    else if (a.t === 'pasar') siguiente();
  }
  pregunta();
  // tiempo por pregunta: al acabarse se envía lo que haya marcado o escrito
  T.reloj(opciones.seg_turno, turno, () => { if (respondida) T.hacer(turno, { t: 'sig' }, aplicar); else vista?.forzar(); });
  return { aplicar: (a) => T.recibir(a, aplicar), turno };
}
