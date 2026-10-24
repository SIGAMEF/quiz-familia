// ============================================================
// Salas en línea: el anfitrión comparte un PIN, todos juegan lo mismo a la vez,
// con el mismo cronómetro, ranking en vivo y podio al final.
// ============================================================
import { $, $$, esc, figura, sonar, confeti, relojBarra, alFinalizarPartida, prefs, selectorEmoji } from './util.js';
import { sopaDe } from './sopa.js';
import { enPausa } from '../reposo.js';

const CARGADORES = {
  ahorcado: () => import('./ahorcado.js'), sopa: () => import('./sopa.js'), memoria: () => import('./memoria.js'),
  ordena: () => import('./ordena.js'), quiz: () => import('./quiz.js'), trivia: () => import('./quiz.js'), relampago: () => import('./quiz.js'),
  frase: () => import('./frase.js'), rompecabezas: () => import('./rompecabezas.js'), quizpublico: () => import('./quizlibre.js')
};
const avatarDe = (a) => /^(https?:|data:)/.test(a || '') ? `<img src="${esc(a)}" alt="">` : esc(a || '🙂');
const guardarSesion = (sala, datos) => { try { sessionStorage.setItem('sala_' + sala, JSON.stringify(datos)); } catch { /* sin almacenamiento */ } };
const leerSesion = (sala) => { try { return JSON.parse(sessionStorage.getItem('sala_' + sala) || 'null'); } catch { return null; } };

// Lo que juegan todos: el mismo tema, el mismo orden (semilla) y, en la sopa, la misma grilla
export function contenidoSala({ juego, set, campo, valor, pistas }) {
  if (juego === 'rompecabezas' && set.id === 'foto') throw new Error('Para jugar en línea con una foto, el profesor debe crear el rompecabezas en su panel.');
  const tipo = juego === 'quiz' && set.remoto ? 'quizpublico' : juego === 'relampago' ? 'quiz' : juego;   // el relámpago usa el módulo del Quiz
  const opciones = { [campo]: valor, pistas, semilla: Math.floor(Math.random() * 2 ** 31) };
  if (juego === 'sopa') { const s = sopaDe(set, valor, pistas); opciones.sopa = { grilla: s.grilla, ubicaciones: s.ubicaciones }; }
  return { juego: tipo, set, opciones };
}

/**
 * Pantallas de una sala.
 * ctx: { rpc, cont, barra, volverA, nuevaRonda? (función que arma otro contenido, solo anfitrión) }
 */
export function abrirSala(ctx, { sala_id, codigo, host_token = null, yo = null }) {
  const { rpc, cont, barra } = ctx;
  const S = { fase: '', ronda: 0, offset: 0, est: null, jug: null, reloj: null, enviado: -1, terminado: false, modulo: null, timer: null };
  const esHost = !!host_token;
  if (yo) guardarSesion(sala_id, { yo, host_token, codigo });

  const ahoraServidor = () => Date.now() + S.offset;
  const aLocal = (iso) => Date.parse(iso) - S.offset;

  async function sondear() {
    if (enPausa()) return;   // en pausa por inactividad (el intervalo sigue y consulta al reanudar)
    let est;
    try { est = await rpc('sala_estado', { p_sala: sala_id }); } catch (e) { return; }
    S.est = est; S.offset = Date.parse(est.ahora) - Date.now();
    if (est.estado === 'esperando') {
      if (S.fase !== 'lobby' || est.ronda !== S.ronda) { S.ronda = est.ronda; return lobby(); }
      return pintarJugadores();
    }
    if (est.estado === 'en_curso') {
      if (S.fase === 'lobby' || S.fase === 'podio' || !S.fase) return yo ? cuentaAtras() : tablero();
      if (S.fase === 'jugando') return actualizarEnJuego();
      if (S.fase === 'esperando' || S.fase === 'tablero') return pintarRanking();
      return;
    }
    if (est.estado === 'finalizado' && S.fase !== 'podio') {
      if (S.fase === 'jugando' && !S.terminado) await terminarYo('Se acabó el tiempo');
      return podio();
    }
  }
  const iniciarSondeo = () => { clearInterval(S.timer); S.timer = setInterval(sondear, 1500); sondear(); };
  const pararTodo = () => { clearInterval(S.timer); if (S.reloj) S.reloj.ocultar(); alFinalizarPartida(null); };

  // ---------- Sala de espera ----------
  function lobby() {
    S.fase = 'lobby'; S.terminado = false; S.enviado = -1; if (S.reloj) { S.reloj.ocultar(); S.reloj = null; }
    const est = S.est, enlace = `${location.origin}${location.pathname}?sala=${est.codigo}`;
    cont.classList.add('jugando');
    cont.innerHTML = `<div class="tabla-juego center">
        <div class="rotulo-tabla">${esc(est.titulo)}</div>
        <p class="ordena-pista" style="margin-top:10px;">${esHost ? 'Comparte el PIN, el QR o el enlace. Cuando estén todos, toca “Iniciar para todos”.' : '¡Ya estás en la sala! Espera a que el anfitrión inicie.'}</p>
        <p class="small" style="font-weight:800; margin-top:6px;">PIN de la sala</p>
        <div class="sala-pin">${esc(est.codigo)}</div>
        ${esHost ? `<div class="sala-qr"><div data-qr></div></div>
          <div class="sala-enlace"><input class="input" readonly value="${esc(enlace)}" data-enlace><button class="b3 azul chico" data-copiar>Copiar</button>
            <a class="b3 verde chico" style="text-decoration:none;" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`¡Juguemos ${est.titulo}! Entra con el PIN ${est.codigo} o aquí: ${enlace}`)}">WhatsApp</a></div>` : ''}
        <p class="small" style="font-weight:800; margin-top:12px;">${est.segundos ? `⏱ Tiempo para todos: ${Math.round(est.segundos / 60 * 10) / 10} min` : '⏱ Sin límite de tiempo'}${est.ronda > 1 ? ` · Ronda ${est.ronda}` : ''}</p>
        <h2 style="margin-top:12px;">Jugadores (<span data-n>0</span>)</h2>
        <div class="sala-jugadores" data-jugadores></div>
        ${esHost ? `<div class="final-botones"><button class="b3 amarillo" data-iniciar>▶ Iniciar para todos</button><button class="b3 morado chico" data-cerrar>Cerrar sala</button></div>`
                 : '<div class="final-botones"><button class="b3 morado chico" data-salir>Salir de la sala</button></div>'}
      </div>`;
    if (esHost) {
      const qr = $('[data-qr]', cont);
      if (window.QRCode) { try { new window.QRCode(qr, { text: enlace, width: 170, height: 170, correctLevel: window.QRCode.CorrectLevel.M }); } catch { qr.parentElement.hidden = true; } }
      else qr.parentElement.hidden = true;
      $('[data-copiar]', cont).onclick = async () => { try { await navigator.clipboard.writeText(enlace); $('[data-copiar]', cont).textContent = '¡Copiado!'; } catch { $('[data-enlace]', cont).select(); } };
      $('[data-iniciar]', cont).onclick = async (e) => {
    const boton = e.currentTarget;
        boton.disabled = true;
        try { S.est = await rpc('sala_iniciar', { p_sala: sala_id, p_host: host_token }); S.offset = Date.parse(S.est.ahora) - Date.now(); yo ? cuentaAtras() : tablero(); }
        catch (er) { alert(er.message); boton.disabled = false; }
      };
      $('[data-cerrar]', cont).onclick = async () => { await rpc('sala_terminar', { p_sala: sala_id, p_host: host_token }).catch(() => {}); pararTodo(); location.href = ctx.volverA; };
    } else {
      $('[data-salir]', cont).onclick = async () => { await rpc('sala_salir', { p_jugador: yo.id, p_token: yo.token }).catch(() => {}); pararTodo(); location.href = ctx.volverA; };
    }
    pintarJugadores();
  }
  function pintarJugadores() {
    const caja = $('[data-jugadores]', cont); if (!caja) return;
    const js = S.est.jugadores;
    $('[data-n]', cont).textContent = js.length;
    caja.innerHTML = js.length ? js.map(j => `<span class="sala-jugador"><span class="av">${avatarDe(j.avatar)}</span>${esc(j.alias)}${j.anfitrion ? ' 👑' : ''}${yo && j.id === yo.id ? ' (tú)' : ''}</span>`).join('')
      : '<span class="small" style="font-weight:700;">Aún no entra nadie…</span>';
    const b = $('[data-iniciar]', cont); if (b) b.disabled = !js.length;
  }

  // ---------- Cuenta atrás y juego ----------
  function cuentaAtras() {
    S.fase = 'cuenta';
    const inicio = aLocal(S.est.inicio);
    let ultimo = null;
    const paso = () => {
      if (S.fase !== 'cuenta') return;
      const s = Math.ceil((inicio - Date.now()) / 1000);
      if (s <= 0) return jugar();
      if (s !== ultimo) {
        ultimo = s; sonar.clic();
        cont.innerHTML = `<div class="cuenta-atras">${s}</div><p class="lema" style="text-align:center;">¡Prepárate! ${esc(S.est.titulo)}</p>`;
      }
      setTimeout(paso, 100);
    };
    paso();
  }
  async function jugar() {
    S.fase = 'jugando'; S.terminado = false;
    const c = S.est.contenido;
    const guardado = prefs.leer('jugadores', [{ nombre: 'Tú', avatar: '🧒' }])[0];
    const mio = S.est.jugadores.find(j => j.id === yo.id);
    S.jug = { nombre: mio?.alias || guardado.nombre, avatar: mio?.avatar || guardado.avatar, color: 'j1', puntos: 0 };
    S.modulo = await (CARGADORES[c.juego] || CARGADORES.ahorcado)();
    alFinalizarPartida(({ detalle }) => { terminarYo(detalle); });
    if (S.est.fin) S.reloj = relojBarra(barra, aLocal(S.est.fin), { total: S.est.segundos, alAcabar: () => { if (!S.terminado) terminarYo('Se acabó el tiempo', true); } });
    else { barra.hidden = false; S.reloj = relojBarra(barra, Date.now() + 864e5, {}); $('[data-rt]', barra).parentElement.innerHTML = '⏱ Sin límite'; }
    if (esHost) S.reloj.extra(`<button class="b3 morado chico" data-fin-todos>Terminar para todos</button>`);
    const bf = $('[data-fin-todos]', barra); if (bf) bf.onclick = terminarTodos;
    window.scrollTo(0, 0);
    S.modulo.iniciar(cont, { set: c.set, jugadores: [S.jug], opciones: c.opciones, alMenu: () => {}, alRepetir: () => {} });
    actualizarEnJuego();
  }
  function actualizarEnJuego() {
    if (S.jug && S.jug.puntos !== S.enviado && !S.terminado) {
      S.enviado = S.jug.puntos;
      rpc('sala_progreso', { p_jugador: yo.id, p_token: yo.token, p_puntaje: S.jug.puntos, p_progreso: 0, p_terminado: false }).catch(() => {});
    }
    const js = S.est.jugadores, pos = js.findIndex(j => j.id === yo.id) + 1;
    if (S.reloj) S.reloj.extra(`<span class="pill">🏆 ${pos ? `${pos}° de ${js.length}` : ''}</span>${esHost ? '<button class="b3 morado chico" data-fin-todos>Terminar para todos</button>' : ''}`);
    const bf = $('[data-fin-todos]', barra); if (bf) bf.onclick = terminarTodos;
  }
  async function terminarYo(detalle, porTiempo = false) {
    if (S.terminado) return;
    S.terminado = true;
    const bono = S.reloj && S.est.fin && !porTiempo ? Math.round(S.reloj.restante()) : 0;
    S.jug.puntos += bono;
    await rpc('sala_progreso', { p_jugador: yo.id, p_token: yo.token, p_puntaje: S.jug.puntos, p_progreso: 0, p_terminado: true,
      p_detalle: `${detalle || ''}${bono ? ` · bono de tiempo +${bono}` : ''}`.replace(/^ · /, '') }).catch(() => {});
    if (porTiempo) {
      cont.innerHTML = `<div class="final"><div class="trofeo">⏰</div><h2 class="rotulo-tabla">¡Se acabó el tiempo!</h2><p class="final-sub">Hiciste ${S.jug.puntos} puntos</p></div>`;
    }
    setTimeout(() => { if (S.fase === 'jugando') esperarALosDemas(bono); }, porTiempo ? 1200 : 2200);
  }
  function esperarALosDemas(bono) {
    S.fase = 'esperando';
    cont.innerHTML = `<div class="tabla-juego center"><h2>✔ ¡Terminaste! ${S.jug.puntos} puntos${bono ? ` <small>(bono de tiempo +${bono})</small>` : ''}</h2>
      <p class="ordena-pista">Esperando a que terminen los demás…</p><ul class="ranking" data-ranking></ul></div>`;
    pintarRanking();
  }
  async function terminarTodos() {
    if (!confirm('¿Terminar la partida para todos ahora?')) return;
    await rpc('sala_terminar', { p_sala: sala_id, p_host: host_token }).catch(e => alert(e.message));
    sondear();
  }

  // ---------- Tablero del anfitrión que no juega ----------
  function tablero() {
    S.fase = 'tablero';
    if (S.est.fin) { S.reloj = relojBarra(barra, aLocal(S.est.fin), { total: S.est.segundos }); }
    cont.innerHTML = `<div class="tabla-juego center"><div class="rotulo-tabla">${esc(S.est.titulo)}</div>
      <p class="ordena-pista" style="margin-top:8px;">Están jugando… El ranking se actualiza solo.</p>
      <ul class="ranking" data-ranking style="margin-top:10px;"></ul>
      <div class="final-botones"><button class="b3 morado" data-fin>Terminar para todos</button></div></div>`;
    $('[data-fin]', cont).onclick = terminarTodos;
    pintarRanking();
  }
  function pintarRanking() {
    const ul = $('[data-ranking]', cont); if (!ul) return;
    ul.innerHTML = S.est.jugadores.map((j, i) => `<li class="${yo && j.id === yo.id ? 'yo' : ''}"><span class="pos">${i + 1}</span><span class="sala-jugador" style="box-shadow:none; padding:0;"><span class="av">${avatarDe(j.avatar)}</span>${esc(j.alias)}</span>
      ${j.terminado ? '<span class="ok">✔ terminó</span>' : ''}<span class="pts">${Number(j.puntaje)}</span></li>`).join('');
  }

  // ---------- Podio ----------
  function podio() {
    S.fase = 'podio'; if (S.reloj) { S.reloj.ocultar(); S.reloj = null; }
    alFinalizarPartida(null);
    const js = S.est.jugadores;
    const lugar = (j, n) => j ? `<div class="p${n}"><div class="cara-p">${avatarDe(j.avatar)}</div><b>${esc(j.alias)}</b><div class="bloque">${n}°<br>${Number(j.puntaje)}</div></div>` : '<div></div>';
    cont.innerHTML = `<div class="final"><div class="trofeo">🏆</div><h2 class="rotulo-tabla">¡Fin de la partida!</h2>
      <div class="podio-sala">${lugar(js[1], 2)}${lugar(js[0], 1)}${lugar(js[2], 3)}</div>
      <ul class="ranking">${js.map((j, i) => `<li class="${yo && j.id === yo.id ? 'yo' : ''}"><span class="pos">${i + 1}</span>${esc(j.alias)}${j.detalle ? ` <small class="muted">· ${esc(j.detalle)}</small>` : ''}<span class="pts">${Number(j.puntaje)}</span></li>`).join('')}</ul>
      <div class="final-botones">${esHost ? '<button class="b3 amarillo" data-otra>🔄 Otra ronda</button><button class="b3 azul" data-cerrar>Cerrar sala</button>'
        : '<p class="ordena-pista">Si el anfitrión inicia otra ronda, entrarás automáticamente.</p><button class="b3 azul" data-salir>Volver a los juegos</button>'}</div></div>`;
    sonar.gana(); confeti();
    if (esHost) {
      $('[data-otra]', cont).onclick = async () => {
        try { S.est = await rpc('sala_otra_ronda', { p_sala: sala_id, p_host: host_token, p_contenido: ctx.nuevaRonda ? ctx.nuevaRonda() : null }); S.ronda = -1; sondear(); }
        catch (e) { alert(e.message); }
      };
      $('[data-cerrar]', cont).onclick = async () => { await rpc('sala_terminar', { p_sala: sala_id, p_host: host_token }).catch(() => {}); pararTodo(); location.href = ctx.volverA; };
    } else $('[data-salir]', cont).onclick = () => { pararTodo(); location.href = ctx.volverA; };
  }

  iniciarSondeo();
  return { parar: pararTodo };
}

// ---------- Entrar a una sala con su PIN ----------
export async function unirseSala(ctx, codigo) {
  const { rpc, cont } = ctx;
  cont.classList.add('jugando');
  let sala;
  try { sala = await rpc('sala_por_codigo', { p_codigo: codigo }); } catch (e) { sala = null; }
  if (!sala) {
    cont.innerHTML = `<div class="tabla-juego center"><div style="font-size:50px;">🙈</div><h2>No encontramos esa sala</h2>
      <p class="ordena-pista">Revisa el PIN o pide uno nuevo a quien la compartió.</p><a class="b3 azul" style="display:inline-block; text-decoration:none; margin-top:10px;" href="${ctx.volverA}">Volver</a></div>`;
    return;
  }
  const previa = leerSesion(sala.id);
  if (previa?.yo) return abrirSala(ctx, { sala_id: sala.id, codigo, host_token: previa.host_token, yo: previa.yo });
  const g = prefs.leer('jugadores', [{ nombre: '', avatar: '🧒' }])[0];
  cont.innerHTML = `<div class="tabla-juego">
      <div class="center"><div class="rotulo-tabla">${esc(sala.titulo)}</div><p class="lema">Entra a la sala con tu nombre y un avatar.</p></div>
      <label class="lbl" for="aliasSala">Tu nombre</label><input class="input" id="aliasSala" maxlength="30" value="${esc(g.nombre && g.nombre !== 'Jugador 1' ? g.nombre : '')}" placeholder="Ej: Tío Carlos">
      <label class="lbl">Tu avatar</label><div data-av></div>
      <p class="err" data-err></p>
      <button class="b3 amarillo grande" data-entrar>¡Entrar a la sala!</button></div>`;
  const av = selectorEmoji($('[data-av]', cont), g.avatar);
  $('[data-entrar]', cont).onclick = async (e) => {
    const boton = e.currentTarget;
    const alias = $('#aliasSala', cont).value.trim();
    if (!alias) { $('[data-err]', cont).textContent = 'Escribe tu nombre.'; return; }
    boton.disabled = true;
    try {
      const r = await rpc('sala_unirse', { p_sala: sala.id, p_alias: alias, p_avatar: av() });
      prefs.guardar('jugadores', [{ nombre: alias, avatar: av() }, ...prefs.leer('jugadores', []).slice(1)]);
      abrirSala(ctx, { sala_id: sala.id, codigo, yo: { id: r.jugador_id, token: r.token } });
    } catch (er) { $('[data-err]', cont).textContent = er.message; boton.disabled = false; }
  };
}
