// ============================================================
// Ordena la frase: toca las palabras en el orden correcto.
// ============================================================
import { $, $$, esc, barajar, sinTildes, sonar, confeti, pantallaFinal, figura, mezclador } from './util.js';

const COLORES = ['#14A3B8', '#F5B700', '#8E5BE8', '#F28C0F', '#4CAF2E', '#EC4C93', '#2F80ED'];
const limpia = (t) => sinTildes(t).replace(/[^A-ZÑ0-9]/g, '');

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir }) {
  const mezclar = mezclador(opciones.semilla);
  const lista = mezclar(set.frases).slice(0, Math.min(Number(opciones.cantidad) || 6, set.frases.length));
  const jug = jugadores[0]; jug.puntos = 0;
  let i = 0, aciertos = 0;

  function ronda() {
    const fr = lista[i];
    const palabras = fr.frase.split(/\s+/);
    let fichas = mezclar(palabras.map((t, k) => ({ k, t, color: COLORES[k % COLORES.length] })));
    if (fichas.every((x, k) => x.k === k) && fichas.length > 1) fichas = [...fichas.slice(1), fichas[0]];
    const puestas = [];
    let ayudas = 0;
    const pintar = (estado = '') => {
      cont.innerHTML = `
        <div class="sopa-top"><span class="pill">🔤 ${esc(set.titulo)}</span><span class="pill">Frase ${i + 1} de ${lista.length}</span><span class="pill">⭐ ${jug.puntos}</span></div>
        <div class="tabla-juego">
          ${fr.imagen ? `<div class="pista-fig">${figura(fr.imagen)}</div>` : ''}
          ${fr.pista ? `<p class="ordena-pista">💬 ${esc(fr.pista)}</p>` : ''}
          <div class="frase-resp ${estado}" aria-live="polite">${puestas.length ? puestas.map(x => `<span class="palabra-ficha" style="--c:${x.color}">${esc(x.t)}</span>`).join('') : '<span class="frase-vacia">Toca las palabras en orden</span>'}</div>
          <div class="frase-fichas">${fichas.map(x => `<button class="palabra-ficha" style="--c:${x.color}" data-k="${x.k}" ${puestas.includes(x) ? 'disabled' : ''}>${esc(x.t)}</button>`).join('')}</div>
          <div class="final-botones"><button class="b3 morado chico" data-borrar ${puestas.length ? '' : 'disabled'}>⌫ Borrar</button>
            <button class="b3 amarillo chico" data-ayuda>💡 Una palabra</button><button class="b3 azul chico" data-saltar>Saltar</button></div>
        </div>`;
      $$('[data-k]', cont).forEach(b => b.onclick = () => poner(fichas.find(x => x.k === Number(b.dataset.k))));
      $('[data-borrar]', cont).onclick = () => { puestas.pop(); pintar(); };
      $('[data-ayuda]', cont).onclick = () => {
        while (puestas.length && limpia(puestas[puestas.length - 1].t) !== limpia(palabras[puestas.length - 1])) puestas.pop();
        const sig = fichas.find(x => !puestas.includes(x) && limpia(x.t) === limpia(palabras[puestas.length]));
        if (sig) { ayudas++; poner(sig); }
      };
      $('[data-saltar]', cont).onclick = () => siguiente(false);
    };
    const poner = (x) => {
      if (!x || puestas.includes(x)) return;
      puestas.push(x); sonar.clic();
      if (puestas.length < palabras.length) return pintar();
      const ok = puestas.map(y => limpia(y.t)).join(' ') === palabras.map(limpia).join(' ');
      if (ok) { jug.puntos += Math.max(3, 10 - ayudas * 2); aciertos++; sonar.bien(); } else sonar.mal();
      pintar(ok ? 'correcta' : 'incorrecta');
      setTimeout(() => ok ? siguiente(true) : (puestas.length = 0, pintar()), ok ? 1000 : 800);
    };
    pintar();
  }
  function siguiente(gano) {
    if (!gano) sonar.pierde();
    i++;
    if (i >= lista.length) return pantallaFinal(cont, { jugadores, titulo: '¡Muy bien!', detalle: `Ordenaste ${aciertos} de ${lista.length} frases.`, alRepetir, alMenu });
    if (gano && aciertos % 3 === 0) confeti();
    ronda();
  }
  ronda();
}
