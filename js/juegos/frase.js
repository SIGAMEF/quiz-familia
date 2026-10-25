// ============================================================
// Ordena la frase: toca las palabras en el orden correcto.
// En una sala por turnos, cada frase la arma un jugador distinto.
// ============================================================
import { $, $$, esc, barajar, sinTildes, sonar, confeti, pantallaFinal, figura, mezclador, hudJugadores, turnos } from './util.js';

const COLORES = ['#14A3B8', '#F5B700', '#8E5BE8', '#F28C0F', '#4CAF2E', '#EC4C93', '#2F80ED'];
const limpia = (t) => sinTildes(t).replace(/[^A-ZÑ0-9]/g, '');

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const lista = mezclar(set.frases).slice(0, Math.min(Number(opciones.cantidad) || 6, set.frases.length));
  jugadores.forEach(j => { j.puntos = 0; });
  let i = 0, aciertos = 0;
  let fr, palabras, fichas, puestas, ayudas;   // la frase en juego
  const turno = () => i % N;

  function pintar(estado = '') {
    const jug = jugadores[turno()];
    cont.innerHTML = `
      ${N > 1 ? hudJugadores(jugadores, turno(), (j) => `⭐ ${j.puntos}`) : ''}
      <div class="sopa-top"><span class="pill">🔤 ${esc(set.titulo)}</span><span class="pill">Frase ${i + 1} de ${lista.length}</span>${N > 1 ? '' : `<span class="pill">⭐ ${jug.puntos}</span>`}</div>
      <div class="tabla-juego">
        ${fr.imagen ? `<div class="pista-fig">${figura(fr.imagen)}</div>` : ''}
        ${fr.pista ? `<p class="ordena-pista">💬 ${esc(fr.pista)}</p>` : ''}
        <div class="frase-resp ${estado}" aria-live="polite">${puestas.length ? puestas.map(x => `<span class="palabra-ficha" style="--c:${x.color}">${esc(x.t)}</span>`).join('') : '<span class="frase-vacia">Toca las palabras en orden</span>'}</div>
        <div class="frase-fichas">${fichas.map(x => `<button class="palabra-ficha" style="--c:${x.color}" data-k="${x.k}" ${puestas.includes(x) ? 'disabled' : ''}>${esc(x.t)}</button>`).join('')}</div>
        <div class="final-botones"><button class="b3 morado chico" data-borrar ${puestas.length ? '' : 'disabled'}>⌫ Borrar</button>
          <button class="b3 amarillo chico" data-ayuda>💡 Una palabra</button><button class="b3 azul chico" data-saltar>Saltar</button></div>
      </div>`;
    $$('[data-k]', cont).forEach(b => b.onclick = () => accion({ t: 'k', k: Number(b.dataset.k) }));
    $('[data-borrar]', cont).onclick = () => accion({ t: 'borrar' });
    $('[data-ayuda]', cont).onclick = () => accion({ t: 'ayuda' });
    $('[data-saltar]', cont).onclick = () => accion({ t: 'saltar' });
  }
  function ronda() {
    fr = lista[i];
    palabras = fr.frase.split(/\s+/);
    fichas = mezclar(palabras.map((t, k) => ({ k, t, color: COLORES[k % COLORES.length] })));
    if (fichas.every((x, k) => x.k === k) && fichas.length > 1) fichas = [...fichas.slice(1), fichas[0]];
    puestas = [];
    ayudas = 0;
    pintar();
  }
  function poner(x) {
    if (!x || puestas.includes(x) || puestas.length >= palabras.length) return;
    puestas.push(x); sonar.clic();
    if (puestas.length < palabras.length) return pintar();
    const ok = puestas.map(y => limpia(y.t)).join(' ') === palabras.map(limpia).join(' ');
    if (ok) { jugadores[turno()].puntos += Math.max(3, 10 - ayudas * 2); aciertos++; sonar.bien(); } else sonar.mal();
    pintar(ok ? 'correcta' : 'incorrecta');
    T.despues(ok ? 1000 : 800, () => ok ? siguiente(true) : (puestas.length = 0, pintar()));
  }
  function aplicar(a) {
    if (puestas.length >= palabras.length) return;   // la frase ya está completa (esperando la animación)
    if (a.t === 'k') poner(fichas.find(x => x.k === a.k));
    else if (a.t === 'borrar') { puestas.pop(); pintar(); }
    else if (a.t === 'ayuda') {
      while (puestas.length && limpia(puestas[puestas.length - 1].t) !== limpia(palabras[puestas.length - 1])) puestas.pop();
      const sig = fichas.find(x => !puestas.includes(x) && limpia(x.t) === limpia(palabras[puestas.length]));
      if (sig) { ayudas++; poner(sig); }
    } else if (a.t === 'saltar' || a.t === 'pasar') siguiente(false);
  }
  const accion = (a) => T.hacer(turno, a, aplicar);
  function siguiente(gano) {
    if (!gano) sonar.pierde();
    i++;
    if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Muy bien!', detalle: `${N > 1 ? 'Ordenaron' : 'Ordenaste'} ${aciertos} de ${lista.length} frases.`, alRepetir, alMenu });
    if (gano && aciertos % 3 === 0) confeti();
    ronda();
  }
  ronda();
  return { aplicar: (a) => T.recibir(a, aplicar), turno };
}
