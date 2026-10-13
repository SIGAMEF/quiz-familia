// ============================================================
// Quiz público de un profesor: todos los tipos de pregunta, corregido en el servidor
// ============================================================
import { $, esc, barajar, pantallaFinal, mezclador } from './util.js';

export async function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir }) {
  const mezclar = mezclador(opciones.semilla);
  const [{ supabase, mensajeError }, { pintarPregunta, mostrarCorreccion, tono }] = await Promise.all([import('../comun.js'), import('../juego.js')]);
  const rpc = async (n, a) => { const { data, error } = await supabase.rpc(n, a); if (error) throw error; return data; };
  const n = Number(opciones.cantidad) || 10;
  const lista = mezclar(set.preguntas).slice(0, Math.min(n, set.preguntas.length));
  const jug = jugadores[0]; jug.puntos = 0;
  let i = 0, aciertos = 0, calificables = 0;

  function pregunta() {
    const p = lista[i];
    cont.innerHTML = `
      <div class="sopa-top"><span class="pill">📝 ${esc(set.titulo)}</span><span class="pill">${i + 1} / ${lista.length}</span><span class="pill">⭐ ${jug.puntos}</span></div>
      <div class="tabla-juego quiz-libre"><div data-preg></div>
        <button class="b3 azul hidden" data-sig style="margin-top:12px; width:100%;">${i === lista.length - 1 ? 'Ver resultado' : 'Siguiente →'}</button></div>`;
    const caja = $('[data-preg]', cont), sig = $('[data-sig]', cont);
    pintarPregunta(caja, p, {
      onResponder: async (ids, textos) => {
        try {
          const r = await rpc('quiz_libre_calificar', { p_quiz: set.id, p_pregunta: p.id, p_opciones: ids, p_textos: textos });
          if (p.tipo !== 'lluvia_ideas') { calificables++; if (r.es_correcta) aciertos++; jug.puntos += Math.round(100 * Number(r.fraccion || 0)); }
          tono(r.es_correcta || p.tipo === 'lluvia_ideas' ? 'correcto' : 'incorrecto');
          mostrarCorreccion(caja, p, r, { voz: false });
        } catch (e) { caja.insertAdjacentHTML('beforeend', `<p class="err">${esc(mensajeError(e))}</p>`); }
        sig.classList.remove('hidden'); sig.focus();
      }
    });
    sig.onclick = () => {
      i++;
      if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Quiz terminado!', detalle: `${aciertos} de ${calificables} correctas.`, alRepetir, alMenu });
      pregunta();
    };
  }
  pregunta();
}
