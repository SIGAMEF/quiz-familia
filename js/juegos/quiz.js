// ============================================================
// Quiz relámpago: 15 segundos por pregunta; más rápido = más puntos.
// ============================================================
import { $, $$, esc, barajar, sonar, pantallaFinal, mezclador } from './util.js';

const SEG = 15;
const COLORES = ['rojo', 'azul', 'amarillo', 'verde'];
const FORMAS = ['▲', '◆', '●', '■'];

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir }) {
  const mezclar = mezclador(opciones.semilla);
  const lista = mezclar(set.preguntas).slice(0, Math.min(Number(opciones.cantidad) || 10, set.preguntas.length));
  const jug = jugadores[0]; jug.puntos = 0;
  let i = 0, aciertos = 0, reloj = null;

  function pregunta() {
    const pr = lista[i];
    const ops = mezclar(pr.opciones.map((t, k) => ({ t, ok: k === 0 })));
    const t0 = performance.now();
    let respondida = false;
    cont.innerHTML = `
      <div class="sopa-top"><span class="pill">⚡ ${esc(set.titulo)}</span><span class="pill">${i + 1} / ${lista.length}</span><span class="pill">⭐ ${jug.puntos}</span></div>
      <div class="tiempo" aria-hidden="true"><div data-barra></div></div>
      <div class="tabla-juego"><h2 class="quiz-enun">${esc(pr.enunciado)}</h2></div>
      <div class="quiz-ops">${ops.map((o, k) => `<button class="op-q ${COLORES[k]}" data-o="${k}"><span aria-hidden="true">${FORMAS[k]}</span>${esc(o.t)}</button>`).join('')}</div>
      <div data-msg class="quiz-msg" aria-live="polite"></div>`;
    const barra = $('[data-barra]', cont);
    clearInterval(reloj);
    reloj = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      if (!barra.isConnected) return clearInterval(reloj);
      barra.style.width = `${Math.max(0, 100 - t / SEG * 100)}%`;
      if (t >= SEG && !respondida) responder(null);
    }, 100);
    const responder = (k) => {
      if (respondida) return;
      respondida = true; clearInterval(reloj);
      const t = (performance.now() - t0) / 1000;
      const ok = k != null && ops[k].ok;
      const pts = ok ? Math.round(500 + 500 * Math.max(0, 1 - t / SEG)) : 0;
      jug.puntos += pts; if (ok) aciertos++;
      $$('[data-o]', cont).forEach((b, j) => { b.disabled = true; b.classList.add(ops[j].ok ? 'correcta' : j === k ? 'incorrecta' : 'apagada'); });
      $('[data-msg]', cont).innerHTML = ok ? `<b>¡Correcto! +${pts}</b>` : k == null ? '<b>⏰ Se acabó el tiempo</b>' : '<b>Esta vez no</b>';
      ok ? sonar.bien() : sonar.mal();
      setTimeout(() => {
        i++;
        if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Quiz terminado!', detalle: `${aciertos} de ${lista.length} correctas.`, alRepetir, alMenu });
        pregunta();
      }, 1400);
    };
    $$('[data-o]', cont).forEach(b => b.onclick = () => responder(Number(b.dataset.o)));
  }
  pregunta();
}
