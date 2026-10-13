// ============================================================
// Memoria: voltea dos cartas; si forman pareja, sumas un punto y vuelves a jugar.
// ============================================================
import { $, $$, esc, barajar, sonar, hudJugadores, pantallaFinal, lado, figura, ladoTexto, mezclador } from './util.js';

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir }) {
  const mezclar = mezclador(opciones.semilla);
  const n = Math.min(Number(opciones.parejas) || 6, set.parejas.length);
  const cartas = mezclar(mezclar(set.parejas).slice(0, n).flatMap((par, i) => [
    { id: `${i}a`, par: i, ...lado(par[0]) }, { id: `${i}b`, par: i, ...lado(par[1]) }]));
  jugadores.forEach(j => { j.puntos = 0; });
  let turno = 0, abiertas = [], bloqueo = false, movs = 0;
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
  hud();

  $$('[data-c]', cont).forEach(b => b.onclick = () => {
    const c = cartas.find(x => x.id === b.dataset.c);
    if (bloqueo || hechas.has(c.par) || abiertas.includes(c)) return;
    b.classList.add('abierta'); b.setAttribute('aria-label', c.texto || 'imagen'); sonar.clic();
    abiertas.push(c);
    if (abiertas.length < 2) return;
    movs++; $('[data-movs]', cont).textContent = `Intentos: ${movs}`;
    const [a, d] = abiertas;
    if (a.par === d.par) {
      hechas.add(a.par); jugadores[turno].puntos++; sonar.bien();
      [a, d].forEach(x => $(`[data-c="${x.id}"]`, cont).classList.add('hecha', jugadores[turno].color));
      abiertas = []; hud();
      if (hechas.size === n) setTimeout(() => pantallaFinal(cont, { jugadores, titulo: '¡Todas las parejas!', detalle: `${movs} intentos para ${n} parejas.`, alRepetir, alMenu }), 600);
      return;
    }
    bloqueo = true; sonar.mal();
    setTimeout(() => {
      [a, d].forEach(x => { const el = $(`[data-c="${x.id}"]`, cont); if (el) { el.classList.remove('abierta'); el.setAttribute('aria-label', 'Carta tapada'); } });
      abiertas = []; bloqueo = false;
      if (jugadores.length > 1) { turno = 1 - turno; hud(); }
    }, 1000);
  });
}
