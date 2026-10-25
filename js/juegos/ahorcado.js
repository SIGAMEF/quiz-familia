// ============================================================
// Ahorcado en equipo: 1 o 2 jugadores, se turnan las letras.
// Letra correcta: +1 punto por cada vez que aparece y sigue el mismo jugador.
// Letra incorrecta: el cangurito pierde energía y pasa el turno.
// Quien completa la palabra gana +2. Cada jugador tiene 3 pistas (revelan una letra).
// Nivel difícil: el teclado no marca las letras que ya salieron; repetir una cuenta como error.
// Tiempo por turno (opcional): si se acaba, le toca al siguiente (jugando solo, el cangurito pierde energía).
// En una sala por turnos juegan todos en la misma partida, cada uno desde su dispositivo.
// ============================================================
import { $, $$, esc, barajar, base, sonar, confeti, canguro, horca, hudJugadores, pantallaFinal, figura, mezclador, turnos } from './util.js';

const VIDAS = 6;
let teclaActiva = null;   // un solo oyente del teclado físico aunque se juegue varias veces
const TECLAS = ['ABCDEFGHI', 'JKLMNÑOPQ', 'RSTUVWXYZ'];

export function iniciar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }) {
  const T = turnos(red);
  const N = jugadores.length;
  const mezclar = mezclador(opciones.semilla);
  const total = Number(opciones.cantidad) || 6;
  const palabras = mezclar(set.palabras).slice(0, Math.min(total, set.palabras.length));
  jugadores.forEach(j => { j.puntos = 0; j.pistas = 3; j.ganadas = 0; });
  const S = { idx: 0, turno: 0, usadas: new Set(), errores: 0, terminada: false, aviso: '' };
  const dificil = opciones.nivel === 'dificil';

  const actual = () => palabras[S.idx];
  const letras = () => [...actual().palabra.toUpperCase()];
  const faltan = () => letras().filter(l => l !== ' ' && !S.usadas.has(base(l)));
  const energia = () => 1 - S.errores / VIDAS;

  function pintar() {
    const w = actual();
    const visible = letras().map(l => l === ' ' ? '<span class="hueco espacio"></span>'
      : `<span class="hueco ${S.usadas.has(base(l)) || S.terminada ? 'puesta' : ''} ${S.terminada && !S.usadas.has(base(l)) ? 'perdida' : ''}">${S.usadas.has(base(l)) || S.terminada ? l : ''}</span>`).join('');
    const j = jugadores[S.turno];
    cont.innerHTML = `
      ${hudJugadores(jugadores, S.turno, (x) => `<span title="Puntos">⭐ ${x.puntos}</span><span title="Palabras completadas">✔ ${x.ganadas}</span>`)}
      <div class="ahor-barra">
        <div class="corazones" aria-label="Energía del cangurito: ${VIDAS - S.errores} de ${VIDAS}">${Array.from({ length: VIDAS }, (_, i) => `<span class="${i < VIDAS - S.errores ? '' : 'vacio'}">${i < VIDAS - S.errores ? '❤️' : '🤍'}</span>`).join('')}</div>
        <span class="ronda">Palabra ${S.idx + 1} de ${palabras.length}</span>
        <button class="b3 amarillo chico" data-pista ${j.pistas && !S.terminada ? '' : 'disabled'}>💡 Pista (${j.pistas})</button>
      </div>
      <div class="ahor-escena">
        <div class="ahor-horca ${S.errores >= VIDAS ? '' : 'balancea'}" style="--vel:${(2.4 - S.errores * 0.25).toFixed(2)}s; --ang:${2 + S.errores * 1.2}deg">${horca({ energia: energia(), estado: S.errores >= VIDAS ? 'cansado' : S.terminada ? 'gana' : 'normal' })}</div>
        <div class="pizarra">
          <span class="cat-lbl">Categoría</span><span class="cat">${esc(set.titulo)}</span>
          ${w.imagen ? `<div class="pista-fig">${figura(w.imagen)}</div>` : ''}
          <div class="palabra" aria-label="Palabra">${visible}</div>
          <p class="ahor-pista">${(S.ayudaTexto || S.terminada) && w.pista ? `💬 ${esc(w.pista)}` : ''}</p>
          ${S.aviso ? `<p class="ahor-aviso" role="alert">${esc(S.aviso)}</p>` : ''}
        </div>
      </div>
      <div class="teclado" role="group" aria-label="Teclado">${TECLAS.map(f => `<div>${[...f].map(l => {
        const usada = S.usadas.has(l) && !dificil;     // en difícil no se ve qué letras ya salieron
        const ok = usada && letras().some(x => base(x) === l);
        return `<button class="tecla ${usada ? (ok ? 'bien' : 'mal') : ''}" data-l="${l}" ${usada || S.terminada ? 'disabled' : ''} aria-label="Letra ${l}">${l}</button>`;
      }).join('')}</div>`).join('')}</div>
      <div data-cartel></div>`;
    S.aviso = '';
    $$('[data-l]', cont).forEach(b => b.onclick = () => accion({ t: 'l', l: b.dataset.l }));
    $('[data-pista]', cont).onclick = () => {
      if (!jugadores[S.turno].pistas || S.terminada) return;
      accion({ t: 'pista', l: base(barajar(faltan())[0]) });   // la letra se elige aquí y viaja con la jugada
    };
  }
  // Jugadas: letra, pista, siguiente palabra y "pasar" (el anfitrión salta el turno de alguien que no está)
  function aplicar(a) {
    if (a.t === 'l') jugar(a.l);
    else if (a.t === 'pista') pista(a.l);
    else if (a.t === 'sig') siguiente();
    else if (a.t === 'pasar') { if (S.terminada) siguiente(); else { S.turno = (S.turno + 1) % N; pintar(); } }
    else if (a.t === 'tiempo') {
      if (S.terminada) return siguiente();
      S.aviso = `⏰ Se acabó el tiempo de ${jugadores[S.turno].nombre}`;
      if (N > 1) S.turno = (S.turno + 1) % N;
      else { S.errores++; if (S.errores >= VIDAS) return fin(false); }
      pintar();
    }
  }
  const accion = (a) => T.hacer(() => S.turno, a, aplicar);

  function jugar(l) {
    if (S.terminada) return;
    if (S.usadas.has(l)) {
      if (!dificil) return;
      S.errores++; sonar.mal();                     // en difícil, repetir una letra es un error
      S.aviso = `La ${l} ya salió: pierdes el turno`;
      if (S.errores >= VIDAS) return fin(false);
      if (N > 1) S.turno = (S.turno + 1) % N;
      return pintar();
    }
    S.usadas.add(l);
    const veces = letras().filter(x => base(x) === l).length;
    const j = jugadores[S.turno];
    if (veces) { j.puntos += veces; sonar.bien(); }
    else { S.errores++; sonar.mal(); }
    if (!faltan().length) return fin(true);
    if (S.errores >= VIDAS) return fin(false);
    if (!veces && N > 1) S.turno = (S.turno + 1) % N;
    pintar();
    if (veces) cont.querySelector('.palabra')?.classList.add('brillo');
  }

  function pista(l) {
    const j = jugadores[S.turno];
    if (!j.pistas || S.terminada || !l || S.usadas.has(l)) return;
    j.pistas--;
    S.ayudaTexto = true;
    S.usadas.add(l);
    sonar.clic();
    if (!faltan().length) return fin(true, true);
    pintar();
  }

  function fin(gano, porPista = false) {
    S.terminada = true;
    const j = jugadores[S.turno];
    if (gano && !porPista) { j.puntos += 2; j.ganadas++; }
    pintar();
    const ultima = S.idx === palabras.length - 1;
    const cartel = $('[data-cartel]', cont);
    cartel.innerHTML = `<div class="cartel ${gano ? 'bien' : 'mal'}" role="alert"><div class="cartel-caja">
      <div class="cartel-canguro" aria-hidden="true">${canguro({ estado: gano ? 'gana' : 'cansado', tam: 120 })}</div>
      <div class="rotulo-tabla">${gano ? '¡Correcto!' : '¡Oh no!'}</div>
      <p>${gano ? (porPista ? 'La pista completó la palabra.' : `${esc(j.nombre)} completó la palabra: +2`) : 'El cangurito se cansó…'}</p>
      <div class="palabra-final">${esc(actual().palabra)}</div>
      ${!red || red.puedo(S.turno) ? `<button class="b3 ${gano ? 'verde' : 'azul'}" data-sig>${ultima ? 'Ver resultados' : gano ? 'Siguiente palabra' : 'Nueva palabra'}</button>`
        : `<p class="ordena-pista">Esperando a que ${esc(j.nombre)} continúe…</p>`}</div></div>`;
    if (gano) { sonar.gana(); confeti(); } else sonar.pierde();
    const b = $('[data-sig]', cartel);
    if (b) { b.focus(); b.onclick = () => accion({ t: 'sig' }); }
  }
  function siguiente() {
    if (!S.terminada) return;
    if (S.idx === palabras.length - 1) return pantallaFinal(cont, { jugadores, detalle: `${palabras.length} palabras de “${esc(set.titulo)}”`, alRepetir, alMenu });
    S.idx++; S.usadas = new Set(); S.errores = 0; S.terminada = false; S.ayudaTexto = false;
    if (N > 1) S.turno = S.idx % N;   // cada palabra la empieza un jugador distinto
    pintar();
  }

  // Teclado físico
  if (teclaActiva) document.removeEventListener('keydown', teclaActiva);
  const tecla = (e) => {
    if (!cont.querySelector('.teclado') || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, textarea')) return;
    const l = e.key.toUpperCase();
    if (/^[A-ZÑ]$/.test(l) && (dificil || !S.usadas.has(l)) && !S.terminada) accion({ t: 'l', l });
  };
  teclaActiva = tecla;
  document.addEventListener('keydown', tecla);
  pintar();
  T.reloj(opciones.seg_turno, () => S.turno, () => accion({ t: 'tiempo' }));
  return { aplicar: (a) => T.recibir(a, aplicar), turno: () => S.turno };
}
