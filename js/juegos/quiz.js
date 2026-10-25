// ============================================================
// Quiz relámpago: 15 segundos por pregunta (o el tiempo elegido); más rápido = más puntos.
// En una sala por turnos, cada pregunta la responde un jugador distinto.
// ============================================================
import { $, $$, esc, barajar, sonar, pantallaFinal, mezclador, hudJugadores, turnos } from './util.js';

const COLORES = ['rojo', 'azul', 'amarillo', 'verde'];
const FORMAS = ['▲', '◆', '●', '■'];

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const SEG = Number(opciones.seg_turno) > 0 ? Number(opciones.seg_turno) : 15;
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const lista = mezclar(set.preguntas).slice(0, Math.min(Number(opciones.cantidad) || 10, set.preguntas.length));
  jugadores.forEach(j => { j.puntos = 0; });
  let i = 0, aciertos = 0, reloj = null, ops = [], respondida = false;
  const turno = () => i % N;

  function pregunta() {
    const pr = lista[i];
    ops = mezclar(pr.opciones.map((t, k) => ({ t, ok: k === 0 })));
    const t0 = performance.now();
    let ultimo = null;
    respondida = false;
    cont.innerHTML = `
      ${N > 1 ? hudJugadores(jugadores, turno(), (j) => `⭐ ${j.puntos}`) : ''}
      <div class="sopa-top"><span class="pill">⚡ ${esc(set.titulo)}</span><span class="pill">${i + 1} / ${lista.length}</span>${N > 1 ? '' : `<span class="pill">⭐ ${jugadores[0].puntos}</span>`}</div>
      <div class="tiempo" aria-hidden="true"><div data-barra></div></div>
      <div class="tabla-juego"><h2 class="quiz-enun">${esc(pr.enunciado)}</h2></div>
      <div class="quiz-ops">${ops.map((o, k) => `<button class="op-q ${COLORES[k]}" data-o="${k}"><span aria-hidden="true">${FORMAS[k]}</span>${esc(o.t)}</button>`).join('')}</div>
      <div data-msg class="quiz-msg" aria-live="polite"></div>`;
    const barra = $('[data-barra]', cont);
    const puntos = (k) => k != null && ops[k].ok ? Math.round(500 + 500 * Math.max(0, 1 - (performance.now() - t0) / 1000 / SEG)) : 0;
    clearInterval(reloj);
    reloj = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      if (!barra.isConnected) return clearInterval(reloj);
      barra.style.width = `${Math.max(0, 100 - t / SEG * 100)}%`;
      const s = Math.ceil(SEG - t);
      if (!respondida && s !== ultimo) { ultimo = s; if (s > 0 && s <= 5) sonar.tic(); }   // ya casi se acaba
      // solo el dispositivo de quien responde avisa que se acabó su tiempo
      if (t >= SEG && !respondida && (!red || red.puedo(turno()))) accion({ t: 'r', k: null, pts: 0 });
    }, 100);
    $$('[data-o]', cont).forEach(b => b.onclick = () => { const k = Number(b.dataset.o); accion({ t: 'r', k, pts: puntos(k) }); });
  }
  // los puntos (que dependen de la rapidez) los calcula quien responde y viajan con la jugada
  function responder(k, pts) {
    if (respondida) return;
    respondida = true; clearInterval(reloj);
    const ok = k != null && !!ops[k]?.ok;
    pts = ok ? Math.max(0, Math.min(1000, Math.round(Number(pts) || 0))) : 0;
    jugadores[turno()].puntos += pts; if (ok) aciertos++;
    $$('[data-o]', cont).forEach((b, j) => { b.disabled = true; b.classList.add(ops[j].ok ? 'correcta' : j === k ? 'incorrecta' : 'apagada'); });
    $('[data-msg]', cont).innerHTML = ok ? `<b>¡Correcto! +${pts}</b>` : k == null ? '<b>⏰ Se acabó el tiempo</b>' : '<b>Esta vez no</b>';
    ok ? sonar.bien() : sonar.mal();
    T.despues(1400, () => {
      i++;
      if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Quiz terminado!', detalle: `${aciertos} de ${lista.length} correctas.`, alRepetir, alMenu });
      pregunta();
    });
  }
  function aplicar(a) {
    if (a.t === 'r') responder(a.k, a.pts);
    else if (a.t === 'pasar') responder(null, 0);
  }
  const accion = (a) => { if (!respondida) T.hacer(turno, a, aplicar); };
  pregunta();
  return { aplicar: (a) => T.recibir(a, aplicar), turno };
}
