// ============================================================
// Memoria: voltea dos cartas; si forman pareja, sumas un punto y vuelves a jugar.
// ============================================================
import { $, $$, esc, barajar, sonar, hudJugadores, pantallaFinal, lado, figura, ladoTexto, mezclador, turnos } from './util.js';

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const n = Math.min(Number(opciones.parejas) || 6, set.parejas.length);
  const cartas = mezclar(mezclar(set.parejas).slice(0, n).flatMap((par, i) => [
    { id: `${i}a`, par: i, ...lado(par[0]) }, { id: `${i}b`, par: i, ...lado(par[1]) }]));
  jugadores.forEach(j => { j.puntos = 0; });
  let turno = 0, abiertas = [], movs = 0;
  const hechas = new Set();
  const cara = (c) => c.imagen
    ? `<span class="cara frente con-fig">${figura(c.imagen)}${c.texto ? `<small>${esc(c.texto)}</small>` : ''}</span>`
    : `<span class="cara frente ${c.texto.length <= 3 ? 'grande' : ''}">${esc(c.texto)}</span>`;

  cont.innerHTML = `<div data-hud></div>
    <div class="mem-info"><span class="pill">🃏 ${esc(set.titulo)}</span><span class="pill" data-movs>Intentos: 0</span></div>
    <div class="memoria" style="--cols:${n <= 6 ? 4 : n <= 8 ? 4 : 5}">
      ${cartas.map(c => `<button class="carta" data-c="${c.id}" aria-label="Carta tapada"><span class="cara dorso" aria-hidden="true">?</span>${cara(c)}</button>`).join('')}
    </div>`;
  const hud = () => { $('[data-hud]', cont).innerHTML = hudJugadores(jugadores, turno, (j) => `⭐ ${j.puntos}`); };
  const tapar = (lista) => lista.forEach(x => { const el = $(`[data-c="${x.id}"]`, cont); if (el) { el.classList.remove('abierta'); el.setAttribute('aria-label', 'Carta tapada'); } });
  hud();

  function voltear(id) {
    const c = cartas.find(x => x.id === id);
    if (!c || hechas.has(c.par) || abiertas.includes(c)) return;
    const b = $(`[data-c="${id}"]`, cont);
    b.classList.add('abierta'); b.setAttribute('aria-label', c.texto || 'imagen'); sonar.clic();
    abiertas.push(c);
    if (abiertas.length < 2) return;
    movs++; $('[data-movs]', cont).textContent = `Intentos: ${movs}`;
    const [a, d] = abiertas;
    abiertas = [];
    if (a.par === d.par) {
      hechas.add(a.par); jugadores[turno].puntos++; sonar.bien();
      [a, d].forEach(x => $(`[data-c="${x.id}"]`, cont).classList.add('hecha', jugadores[turno].color));
      hud();
      if (hechas.size === n) T.despues(600, () => pantallaFinal(cont, { jugadores, titulo: '¡Todas las parejas!', detalle: `${movs} intentos para ${n} parejas.`, alRepetir, alMenu }));
      return;
    }
    sonar.mal();
    if (N > 1) turno = (turno + 1) % N;   // el turno cambia ya; las cartas se tapan después de verlas
    T.despues(1000, () => { tapar([a, d]); hud(); });
  }
  function aplicar(a) {
    if (a.t === 'c') voltear(a.id);
    else if (a.t === 'pasar' || a.t === 'tiempo') { tapar(abiertas); abiertas = []; turno = (turno + 1) % N; hud(); }
  }

  $$('[data-c]', cont).forEach(b => b.onclick = () => {
    const c = cartas.find(x => x.id === b.dataset.c);
    if (hechas.has(c.par) || abiertas.includes(c)) return;
    T.hacer(() => turno, { t: 'c', id: c.id }, aplicar);
  });
  T.reloj(opciones.seg_turno, () => turno, () => T.hacer(() => turno, { t: 'tiempo' }, aplicar));
  return { aplicar: (a) => T.recibir(a, aplicar), turno: () => turno };
}
