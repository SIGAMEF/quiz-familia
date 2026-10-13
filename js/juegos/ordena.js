// ============================================================
// Ordena la palabra: toca las letras en orden. Más puntos si no usas ayuda.
// ============================================================
import { $, $$, esc, barajar, base, sonar, confeti, pantallaFinal, figura, mezclador } from './util.js';

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir }) {
  const mezclar = mezclador(opciones.semilla);
  const total = Math.min(Number(opciones.cantidad) || 8, set.palabras.length);
  const lista = mezclar(set.palabras.filter(p => !p.palabra.includes(' '))).slice(0, total);
  const jug = jugadores[0]; jug.puntos = 0;
  let i = 0, aciertos = 0;

  function ronda() {
    const w = lista[i];
    const letras = [...w.palabra.toUpperCase()];
    let fichas = mezclar(letras.map((l, k) => ({ k, l })));
    if (fichas.map(f => f.l).join('') === letras.join('') && letras.length > 1) fichas = [...fichas.slice(1), fichas[0]];
    const puestas = [];
    let ayudas = 0;
    const pintar = () => {
      cont.innerHTML = `
        <div class="sopa-top"><span class="pill">🔀 ${esc(set.titulo)}</span><span class="pill">Palabra ${i + 1} de ${lista.length}</span><span class="pill">⭐ ${jug.puntos}</span></div>
        <div class="tabla-juego">
          ${w.imagen ? `<div class="pista-fig">${figura(w.imagen)}</div>` : ''}
          ${w.pista ? `<p class="ordena-pista">💬 ${esc(w.pista)}</p>` : ''}
          <div class="ordena-resp" aria-live="polite">${letras.map((_, k) => `<span class="hueco ${puestas[k] ? 'puesta' : ''}">${puestas[k] ? puestas[k].l : ''}</span>`).join('')}</div>
          <div class="ordena-fichas">${fichas.map(f => `<button class="ficha" data-k="${f.k}" ${puestas.includes(f) ? 'disabled' : ''}>${f.l}</button>`).join('')}</div>
          <div class="final-botones"><button class="b3 morado chico" data-borrar ${puestas.length ? '' : 'disabled'}>⌫ Borrar</button>
            <button class="b3 amarillo chico" data-ayuda>💡 Una letra</button><button class="b3 azul chico" data-saltar>Saltar</button></div>
        </div>`;
      $$('[data-k]', cont).forEach(b => b.onclick = () => poner(fichas.find(f => f.k === Number(b.dataset.k))));
      $('[data-borrar]', cont).onclick = () => { puestas.pop(); pintar(); };
      $('[data-ayuda]', cont).onclick = () => {
        // quita lo que esté mal y coloca la siguiente letra correcta
        while (puestas.length && base(puestas[puestas.length - 1].l) !== base(letras[puestas.length - 1])) puestas.pop();
        const sig = fichas.find(f => !puestas.includes(f) && base(f.l) === base(letras[puestas.length]));
        if (sig) { ayudas++; poner(sig); }
      };
      $('[data-saltar]', cont).onclick = () => siguiente(false);
    };
    const poner = (f) => {
      if (!f || puestas.includes(f)) return;
      puestas.push(f); sonar.clic();
      if (puestas.length < letras.length) return pintar();
      const ok = puestas.map(x => base(x.l)).join('') === letras.map(base).join('');
      if (ok) { jug.puntos += Math.max(2, 10 - ayudas * 3); aciertos++; sonar.bien(); }
      else sonar.mal();
      pintar();
      $('.ordena-resp', cont).classList.add(ok ? 'correcta' : 'incorrecta');
      setTimeout(() => ok ? siguiente(true) : (puestas.length = 0, pintar()), ok ? 900 : 700);
    };
    pintar();
  }
  function siguiente(gano) {
    if (!gano) sonar.pierde();
    i++;
    if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Terminaste!', detalle: `Ordenaste ${aciertos} de ${lista.length} palabras.`, alRepetir, alMenu });
    if (gano && aciertos % 3 === 0) confeti();
    ronda();
  }
  ronda();
}
