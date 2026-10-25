// ============================================================
// Ordena la palabra: toca las letras en orden. Más puntos si no usas ayuda.
// En una sala por turnos, cada palabra la arma un jugador distinto.
// ============================================================
import { $, $$, esc, barajar, base, sonar, confeti, pantallaFinal, figura, mezclador, hudJugadores, turnos } from './util.js';

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const total = Math.min(Number(opciones.cantidad) || 8, set.palabras.length);
  const lista = mezclar(set.palabras.filter(p => !p.palabra.includes(' '))).slice(0, total);
  jugadores.forEach(j => { j.puntos = 0; });
  let i = 0, aciertos = 0;
  let w, letras, fichas, puestas, ayudas;   // la palabra en juego
  const turno = () => i % N;

  function pintar() {
    const jug = jugadores[turno()];
    cont.innerHTML = `
      ${N > 1 ? hudJugadores(jugadores, turno(), (j) => `⭐ ${j.puntos}`) : ''}
      <div class="sopa-top"><span class="pill">🔀 ${esc(set.titulo)}</span><span class="pill">Palabra ${i + 1} de ${lista.length}</span>${N > 1 ? '' : `<span class="pill">⭐ ${jug.puntos}</span>`}</div>
      <div class="tabla-juego">
        ${w.imagen ? `<div class="pista-fig">${figura(w.imagen)}</div>` : ''}
        ${w.pista ? `<p class="ordena-pista">💬 ${esc(w.pista)}</p>` : ''}
        <div class="ordena-resp" aria-live="polite">${letras.map((_, k) => `<span class="hueco ${puestas[k] ? 'puesta' : ''}">${puestas[k] ? puestas[k].l : ''}</span>`).join('')}</div>
        <div class="ordena-fichas">${fichas.map(f => `<button class="ficha" data-k="${f.k}" ${puestas.includes(f) ? 'disabled' : ''}>${f.l}</button>`).join('')}</div>
        <div class="final-botones"><button class="b3 morado chico" data-borrar ${puestas.length ? '' : 'disabled'}>⌫ Borrar</button>
          <button class="b3 amarillo chico" data-ayuda>💡 Una letra</button><button class="b3 azul chico" data-saltar>Saltar</button></div>
      </div>`;
    $$('[data-k]', cont).forEach(b => b.onclick = () => accion({ t: 'k', k: Number(b.dataset.k) }));
    $('[data-borrar]', cont).onclick = () => accion({ t: 'borrar' });
    $('[data-ayuda]', cont).onclick = () => accion({ t: 'ayuda' });
    $('[data-saltar]', cont).onclick = () => accion({ t: 'saltar' });
  }
  function ronda() {
    w = lista[i];
    letras = [...w.palabra.toUpperCase()];
    fichas = mezclar(letras.map((l, k) => ({ k, l })));
    if (fichas.map(f => f.l).join('') === letras.join('') && letras.length > 1) fichas = [...fichas.slice(1), fichas[0]];
    puestas = [];
    ayudas = 0;
    pintar();
  }
  function poner(f) {
    if (!f || puestas.includes(f) || puestas.length >= letras.length) return;
    puestas.push(f); sonar.clic();
    if (puestas.length < letras.length) return pintar();
    const ok = puestas.map(x => base(x.l)).join('') === letras.map(base).join('');
    if (ok) { jugadores[turno()].puntos += Math.max(2, 10 - ayudas * 3); aciertos++; sonar.bien(); }
    else sonar.mal();
    pintar();
    $('.ordena-resp', cont).classList.add(ok ? 'correcta' : 'incorrecta');
    T.despues(ok ? 900 : 700, () => ok ? siguiente(true) : (puestas.length = 0, pintar()));
  }
  function aplicar(a) {
    if (puestas.length >= letras.length) return;   // la palabra ya está completa (esperando la animación)
    if (a.t === 'k') poner(fichas.find(f => f.k === a.k));
    else if (a.t === 'borrar') { puestas.pop(); pintar(); }
    else if (a.t === 'ayuda') {
      // quita lo que esté mal y coloca la siguiente letra correcta
      while (puestas.length && base(puestas[puestas.length - 1].l) !== base(letras[puestas.length - 1])) puestas.pop();
      const sig = fichas.find(f => !puestas.includes(f) && base(f.l) === base(letras[puestas.length]));
      if (sig) { ayudas++; poner(sig); }
    } else if (a.t === 'saltar' || a.t === 'pasar' || a.t === 'tiempo') siguiente(false);   // si se acaba el tiempo, la palabra se pierde y le toca al siguiente
  }
  const accion = (a) => T.hacer(turno, a, aplicar);
  function siguiente(gano) {
    if (!gano) sonar.pierde();
    i++;
    if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Terminaste!', detalle: `${N > 1 ? 'Ordenaron' : 'Ordenaste'} ${aciertos} de ${lista.length} palabras.`, alRepetir, alMenu });
    if (gano && aciertos % 3 === 0) confeti();
    ronda();
  }
  ronda();
  T.reloj(opciones.seg_turno, turno, () => T.hacer(turno, { t: 'tiempo' }, aplicar));
  return { aplicar: (a) => T.recibir(a, aplicar), turno };
}
