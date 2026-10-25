// ============================================================
// Rompecabezas: toca una pieza y luego otra para cambiarlas de lugar.
// Cada pieza que dejas en su sitio vale 1 punto. En una sala por turnos, si tu cambio deja piezas en su sitio sigues; si no, pasa el turno.
// ============================================================
import { $, $$, esc, barajar, sonar, fmtTiempo, pantallaFinal, mezclador, hudJugadores, turnos } from './util.js?v=202610242346';
import { imagenPuzzle, fotoCuadrada } from './imagenes.js?v=202610242346';

let fotoGuardada = null;   // la foto elegida se mantiene mientras la página esté abierta

export function iniciar(cont, ctx) {
  if (ctx.set.id === 'foto' && !fotoGuardada) return elegirFoto(cont, ctx);
  return jugar(cont, ctx, ctx.set.imagen_url || (ctx.set.id === 'foto' ? fotoGuardada : imagenPuzzle(ctx.set.id)));
}

function elegirFoto(cont, ctx) {
  cont.innerHTML = `<div class="tabla-juego center">
      <div style="font-size:54px;" aria-hidden="true">📷</div>
      <h2>Elige una foto</h2>
      <p class="ordena-pista">Una foto de la familia, de la mascota o de un paseo. Se usa solo en este celular o computadora: no se sube a internet.</p>
      <label class="b3 rosa" for="foto" style="display:inline-block; margin-top:12px;">📷 Elegir foto</label>
      <input type="file" id="foto" accept="image/*" class="oculto-accesible">
      <p class="err" data-err></p></div>`;
  $('#foto', cont).onchange = async (e) => {
    const a = e.target.files[0]; if (!a) return;
    try { fotoGuardada = await fotoCuadrada(a); jugar(cont, ctx, fotoGuardada); }
    catch (er) { $('[data-err]', cont).textContent = er.message; }
  };
}

function jugar(cont, { set, jugadores, opciones, alMenu, alRepetir, red = null }, imagen) {
  const T = turnos(red);
  const N = jugadores.length;
  let turno = 0;
  jugadores.forEach(j => { j.puntos = 0; });
  const mezclar = mezclador(opciones.semilla);
  const n = Number(opciones.piezas) || 3;
  const total = n * n;
  let orden = mezclar([...Array(total).keys()]);
  while (orden.every((p, i) => p === i)) orden = mezclar(orden);
  let elegida = null, movs = 0;
  const t0 = Date.now();
  const jug = jugadores[0]; jug.puntos = 0;

  cont.innerHTML = `${red ? '<div data-hud></div>' : ''}
    <div class="sopa-top"><span class="pill">🧩 ${esc(set.titulo)}</span><span class="pill" data-reloj>⏱ 0:00</span><span class="pill" data-movs>Movimientos: 0</span></div>
    <div class="puzzle" data-tablero style="--n:${n}" role="grid" aria-label="Rompecabezas de ${n} por ${n}"></div>
    <div class="final-botones"><button class="b3 morado chico" data-ver aria-pressed="false">👁 Ver la imagen</button>
      ${set.id === 'foto' ? '<button class="b3 rosa chico" data-otra>📷 Otra foto</button>' : ''}</div>
    <p class="ayuda-juego">Toca una pieza y luego otra para cambiarlas de lugar. Las piezas bien puestas se marcan en verde.</p>`;
  const tablero = $('[data-tablero]', cont);
  const hud = () => { const h = $('[data-hud]', cont); if (h) h.innerHTML = hudJugadores(jugadores, turno, (j) => `⭐ ${j.puntos}`); };
  hud();
  const reloj = setInterval(() => { const el = $('[data-reloj]', cont); if (!el || !tablero.isConnected) return clearInterval(reloj); el.textContent = `⏱ ${fmtTiempo((Date.now() - t0) / 1000)}`; }, 500);

  const pintar = () => {
    tablero.innerHTML = orden.map((p, i) => {
      const r = Math.floor(p / n), c = p % n;
      return `<button class="pieza ${p === i ? 'bien' : ''} ${elegida === i ? 'elegida' : ''}" data-i="${i}" aria-label="Pieza ${p + 1}${p === i ? ', en su lugar' : ''}"
        style="background-image:url('${imagen}'); background-position:${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%"></button>`;
    }).join('');
    $$('[data-i]', tablero).forEach(b => b.onclick = () => tocar(Number(b.dataset.i)));
  };
  // elegir la primera pieza es solo de esta pantalla; el cambio de lugar es la jugada que ven todos
  const tocar = (i) => {
    if (T.pendiente() || (red && !red.puedo(turno))) return;
    if (elegida === null) { elegida = i; sonar.clic(); return pintar(); }
    if (elegida === i) { elegida = null; return pintar(); }
    const a = elegida; elegida = null;
    T.hacer(() => turno, { t: 'cambiar', a, b: i }, aplicar);
  };
  function cambiar(a, b) {
    if (![a, b].every(x => Number.isInteger(x) && x >= 0 && x < total) || a === b || orden.every((p, k) => p === k)) return;
    const antes = [a, b].filter(x => orden[x] === x).length;
    [orden[a], orden[b]] = [orden[b], orden[a]];
    const bien = [a, b].filter(x => orden[x] === x).length - antes;
    elegida = null; movs++;
    $('[data-movs]', cont).textContent = `Movimientos: ${movs}`;
    bien > 0 ? sonar.bien() : sonar.clic();
    const listo = orden.every((p, k) => p === k);
    if (bien > 0) jugadores[turno].puntos += bien;
    if (red) {
      if (!listo && bien <= 0 && N > 1) turno = (turno + 1) % N;
      hud();
    }
    pintar();
    if (listo) {
      clearInterval(reloj);
      const seg = (Date.now() - t0) / 1000;
      tablero.classList.add('completo');
      T.despues(900, () => pantallaFinal(cont, { jugadores, titulo: '¡Rompecabezas armado!', detalle: `${movs} movimientos en ${fmtTiempo(seg)}.`, alRepetir, alMenu }));
    }
  }
  function aplicar(x) {
    if (x.t === 'cambiar') cambiar(x.a, x.b);
    else if (x.t === 'pasar' || x.t === 'tiempo') { elegida = null; turno = (turno + 1) % N; hud(); pintar(); }
  }
  $('[data-ver]', cont).onclick = (e) => {
    const ver = tablero.classList.toggle('mostrar');
    e.currentTarget.setAttribute('aria-pressed', String(ver));
    tablero.style.setProperty('--img', `url('${imagen}')`);
  };
  const otra = $('[data-otra]', cont);
  if (otra) otra.onclick = () => { clearInterval(reloj); fotoGuardada = null; elegirFoto(cont, { set, jugadores, opciones, alMenu, alRepetir }); };
  pintar();
  T.cronometro(jugadores, () => turno);
  T.reloj(opciones.seg_turno, () => turno, () => { elegida = null; T.hacer(() => turno, { t: 'tiempo' }, aplicar); });
  return { aplicar: (x) => T.recibir(x, aplicar), turno: () => turno };
}
