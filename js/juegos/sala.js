// ============================================================
// Salas en línea: el anfitrión comparte un PIN y todos entran desde su dispositivo.
// Dos modos:
//  · turnos  — una sola partida: todos ven el mismo tablero y, cuando te toca, solo tú puedes mover.
//              Cada jugada se guarda en el servidor y las demás pantallas la repiten igual.
//  · carrera — cada uno juega su propia partida a la vez, con ranking en vivo.
// Mismo cronómetro y podio al final en los dos.
// ============================================================
import { $, $$, esc, figura, sonar, confeti, relojBarra, alFinalizarPartida, prefs, selectorEmoji, silenciar, COLORES_SALA, pararRelojTurno } from './util.js';
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
export function contenidoSala({ juego, set, campo, valor, pistas, modo = 'turnos', extra = {} }) {
  if (juego === 'rompecabezas' && set.id === 'foto') throw new Error('Para jugar en línea con una foto, el profesor debe crear el rompecabezas en su panel.');
  const tipo = juego === 'quiz' && set.remoto ? 'quizpublico' : juego === 'relampago' ? 'quiz' : juego;   // el relámpago usa el módulo del Quiz
  const opciones = { [campo]: valor, pistas, ...extra, semilla: Math.floor(Math.random() * 2 ** 31) };   // extra: tiempo por turno, dificultad
  if (juego === 'sopa') { const s = sopaDe(set, valor, pistas); opciones.sopa = { grilla: s.grilla, ubicaciones: s.ubicaciones }; }
  return { juego: tipo, set, opciones, modo };
}

/**
 * Pantallas de una sala.
 * ctx: { rpc, cont, barra, volverA, nuevaRonda? (función que arma otro contenido, solo anfitrión) }
 */
export function abrirSala(ctx, { sala_id, codigo, host_token = null, yo = null }) {
  const { rpc, cont, barra } = ctx;
  const S = { fase: '', ronda: 0, offset: 0, est: null, jug: null, reloj: null, enviado: -1, terminado: false, modulo: null, timer: null,
    // por turnos
    sinTurnos: false, n: 0, ctrl: null, jugs: [], orden: [], cola: Promise.resolve(), desfase: false, vigia: null, turnoPintado: null, canal: null,
    ocupado: false, otraVez: false, epoca: 0, enVuelo: 0, desfaseDesde: 0, adelantadoDesde: 0, ultimoAviso: 0 };
  const esHost = !!host_token;
  if (yo) guardarSesion(sala_id, { yo, host_token, codigo });

  const ahoraServidor = () => Date.now() + S.offset;
  const aLocal = (iso) => Date.parse(iso) - S.offset;
  const porTurnos = () => (S.est?.modo || S.est?.contenido?.modo) === 'turnos';
  const firma = () => ({ p_jugador: yo?.id || null, p_token: yo?.token || null, p_host: host_token });

  // una consulta que no responde (señal del celular que se corta) no debe dejar la partida esperando para siempre
  const conLimite = (promesa, ms = 10000) => Promise.race([promesa, new Promise((_, no) => setTimeout(() => no(new Error('Sin respuesta del servidor')), ms))]);
  // sala_turnos (paso 11 del SQL) trae además el modo y las jugadas nuevas; si no está instalado, sala_estado
  async function leerEstado(desde = S.n) {
    if (!S.sinTurnos) {
      try { return await conLimite(rpc('sala_turnos', { p_sala: sala_id, p_desde: desde })); }
      catch (e) { if (!/sala_turnos|PGRST202|schema cache/i.test(`${e.message} ${e.code}`)) throw e; S.sinTurnos = true; }
    }
    return conLimite(rpc('sala_estado', { p_sala: sala_id }));
  }
  async function sondear() {
    if (enPausa()) return;   // en pausa por inactividad (el intervalo sigue y consulta al reanudar)
    if (S.ocupado) { S.otraVez = true; return; }
    S.ocupado = true;
    try { await revisar(); } finally { S.ocupado = false; }
    if (S.otraVez) { S.otraVez = false; sondear(); }
  }
  async function revisar() {
    let est;
    try { est = await leerEstado(); } catch (e) { return; }
    const jugadas = est.jugadas || [];
    S.est = est; S.offset = Date.parse(est.ahora) - Date.now();
    if (est.estado === 'esperando') {
      if (S.fase !== 'lobby' || est.ronda !== S.ronda) { S.ronda = est.ronda; return lobby(); }
      return pintarJugadores();
    }
    if (est.estado === 'en_curso') {
      if (S.fase === 'lobby' || S.fase === 'podio' || !S.fase) return yo || porTurnos() ? cuentaAtras() : tablero();
      if (S.fase === 'jugando') { if (!porTurnos()) return actualizarEnJuego(); recibirJugadas(jugadas); return vigilar(est); }
      if (S.fase === 'esperando' || S.fase === 'tablero') return pintarRanking();
      return;
    }
    if (est.estado === 'finalizado' && S.fase !== 'podio') {
      if (porTurnos()) { if (S.fase === 'jugando') recibirJugadas(jugadas); if (S.fase !== 'podio') podio(); return; }
      if (S.fase === 'jugando' && !S.terminado) await terminarYo('Se acabó el tiempo');
      return podio();
    }
  }
  const iniciarSondeo = () => { clearInterval(S.timer); S.timer = setInterval(sondear, 1500); sondear(); };
  const pararTurnos = () => { clearInterval(S.vigia); S.vigia = null; S.ctrl = null; S.epoca++; pararRelojTurno(); cont.classList.remove('no-es-mi-turno'); };
  const pararTodo = () => {
    clearInterval(S.timer); pararTurnos(); if (S.reloj) S.reloj.ocultar(); alFinalizarPartida(null);
    if (S.canal) { S.canal.cerrar(); S.canal = null; }
  };
  // aviso instantáneo entre pantallas (Realtime); si no hay, igual se consulta cada 1,5 s
  if (ctx.canal) ctx.canal('sala-' + sala_id, () => sondear()).then(c => { S.canal = c; }).catch(() => {});

  // ---------- Sala de espera ----------
  function lobby() {
    S.fase = 'lobby'; S.terminado = false; S.enviado = -1; if (S.reloj) { S.reloj.ocultar(); S.reloj = null; }
    pararTurnos();
    const est = S.est, enlace = `${location.origin}${location.pathname}?sala=${est.codigo}`;
    cont.classList.add('jugando');
    cont.innerHTML = `<div class="tabla-juego center">
        <div class="rotulo-tabla">${esc(est.titulo)}</div>
        <p class="ordena-pista" style="margin-top:10px;">${esHost ? 'Comparte el PIN, el QR o el enlace. Cuando estén todos, toca “Iniciar para todos”.' : '¡Ya estás en la sala! Espera a que el anfitrión inicie.'}</p>
        ${est.modo === 'turnos' ? '<p class="sala-modo">🎲 Por turnos: una sola partida para todos. Cuando te toque, mueves desde tu dispositivo.</p>'
          : est.modo === 'carrera' ? '<p class="sala-modo">🏁 Todos a la vez: cada uno juega su propia partida.</p>' : ''}
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
        try {
          const modo = S.est.modo;
          S.est = { ...await rpc('sala_iniciar', { p_sala: sala_id, p_host: host_token }), modo }; S.offset = Date.parse(S.est.ahora) - Date.now();
          yo || porTurnos() ? cuentaAtras() : tablero();
        }
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
      if (s <= 0) return porTurnos() ? jugarTurnos() : jugar();
      if (s !== ultimo) {
        ultimo = s; sonar.clic();
        cont.innerHTML = `<div class="cuenta-atras">${s}</div><p class="lema" style="text-align:center;">¡Prepárate! ${esc(S.est.titulo)}</p>`;
      }
      setTimeout(paso, 100);
    };
    paso();
  }
  async function jugar() {
    S.fase = 'jugando'; S.terminado = false; cont.classList.add('jugando');   // también si se entra directo (al recargar)
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

  // ---------- Una sola partida por turnos ----------
  // Todas las pantallas cargan el mismo juego y repiten las mismas jugadas en el mismo orden.
  // cada vez que se arma la partida hay una "época" nueva: lo pendiente de una partida anterior ya no pinta nada
  function nuevaRed() {
    const epoca = ++S.epoca;
    const vigente = () => S.fase === 'jugando' && S.epoca === epoca;
    return {
      yo: yo?.id || null, vigente,
      puedo: (i) => !!yo && vigente() && !S.desfase && S.jugs[i]?.id === yo.id,
      enviar: (accion) => { if (vigente()) enviarJugada(accion); }
    };
  }
  let red = nuevaRed();
  const puntajes = () => Object.fromEntries(S.jugs.map(j => [j.id, Math.round(Number(j.puntos) || 0)]));
  // las jugadas salen de a una, en orden; cada una lleva su número para que nadie se adelante a otro
  function enviarJugada(accion) {
    const n = ++S.n, p = puntajes();
    S.enVuelo++;
    S.cola = S.cola.then(async () => {
      if (S.desfase) return;
      try { await conLimite(rpc('sala_jugar', { p_sala: sala_id, p_n: n, p_accion: accion, p_puntajes: p, ...firma() })); if (S.canal) S.canal.avisar(); }
      catch (e) {
        if (/se acabó el tiempo|no está en curso/i.test(e.message || '')) return sondear();
        resincronizar();   // otro jugó antes (o se cortó la conexión): se vuelve a armar la partida desde el servidor
      }
    }).finally(() => { S.enVuelo--; });
  }
  function resincronizar() {
    if (S.desfase) return;
    S.desfase = true; S.desfaseDesde = Date.now();
    S.cola.finally(async () => { try { await sincronizar(); } finally { S.desfase = false; pintarTurno(); } });
  }
  // Autorreparación: si esta pantalla quedó adelantada al servidor (una jugada que nunca llegó)
  // o lleva mucho rato sincronizándose, vuelve a armar la partida desde el servidor
  function vigilar(est) {
    if (S.desfase) {
      if (Date.now() - S.desfaseDesde > 15000) { S.desfase = false; resincronizar(); }
      return;
    }
    if (typeof est.jugadas_n === 'number' && S.n > est.jugadas_n && !S.enVuelo) {
      if (!S.adelantadoDesde) S.adelantadoDesde = Date.now();
      else if (Date.now() - S.adelantadoDesde > 4000) { S.adelantadoDesde = 0; resincronizar(); }
    } else S.adelantadoDesde = 0;
  }
  // Si alguien toca el tablero cuando no es su turno, se le avisa (el juego no acepta la jugada)
  cont.addEventListener('pointerdown', (e) => {
    if (S.fase !== 'jugando' || !porTurnos() || !S.ctrl || !cont.classList.contains('no-es-mi-turno') || e.target.closest('[data-ver]')) return;
    if (Date.now() - S.ultimoAviso < 1500) return;
    S.ultimoAviso = Date.now();
    const j = S.jugs[S.ctrl.turno()];
    const el = document.createElement('div');
    el.className = 'aviso-turno'; el.setAttribute('role', 'status');
    el.textContent = S.desfase ? '🔄 Sincronizando…' : `⏳ Espera tu turno: le toca a ${j ? j.nombre : 'otro jugador'}`;
    if (!yo && !S.desfase) el.textContent = `👀 Solo miras: le toca a ${j ? j.nombre : 'otro jugador'}`;
    document.body.append(el);
    setTimeout(() => el.remove(), 1400);
  }, true);
  function recibirJugadas(jugadas) {
    if (!S.ctrl || S.desfase) return;
    for (const j of jugadas) {
      if (j.n <= S.n) continue;                        // ya está (por ejemplo, una jugada mía)
      if (j.n !== S.n + 1) return resincronizar();     // falta alguna
      S.n = j.n;
      try { S.ctrl.aplicar(j.accion); } catch (e) { console.error(e); }
      if (S.fase !== 'jugando') return;
    }
    pintarTurno();
  }
  async function jugarTurnos() {
    S.fase = 'jugando'; S.terminado = false; cont.classList.add('jugando');   // también si se entra directo (al recargar)
    if (S.sinTurnos) {
      cont.innerHTML = `<div class="tabla-juego center"><div style="font-size:50px;">🛠</div><h2>Falta activar el modo por turnos</h2>
        <p class="ordena-pista">Quien administra la app debe ejecutar <b>sql/11_salas_turnos.sql</b> y luego <b>sql/06_permisos.sql</b> en Supabase.</p></div>`;
      return;
    }
    const c = S.est.contenido;
    S.modulo = await (CARGADORES[c.juego] || CARGADORES.ahorcado)();
    alFinalizarPartida(() => { finTurnos(); return true; });
    if (S.reloj) S.reloj.ocultar();
    if (S.est.fin) S.reloj = relojBarra(barra, aLocal(S.est.fin), { total: S.est.segundos, alAcabar: () => sondear() });
    else { barra.hidden = false; S.reloj = relojBarra(barra, Date.now() + 864e5, {}); $('[data-rt]', barra).parentElement.innerHTML = '⏱ Sin límite'; }
    window.scrollTo(0, 0);
    await sincronizar();
    clearInterval(S.vigia); S.vigia = setInterval(pintarTurno, 300);
  }
  // Arma la partida desde cero y repite todas las jugadas guardadas (al empezar, al volver a entrar o si hubo un desfase)
  async function sincronizar() {
    let est;
    try { est = await leerEstado(0); } catch { setTimeout(() => { if (S.fase === 'jugando') resincronizar(); }, 2000); return; }
    S.adelantadoDesde = 0;
    S.est = est;
    if (S.fase !== 'jugando' || (est.estado !== 'en_curso' && est.estado !== 'finalizado')) return;
    const c = est.contenido;
    S.orden = est.orden || [];
    S.jugs = S.orden.map((id, i) => {
      const j = est.jugadores.find(x => x.id === id) || {};
      return { id, nombre: j.alias || 'Jugador', avatar: /^(https?:|data:)/.test(j.avatar || '') ? '🙂' : (j.avatar || '🙂'), color: COLORES_SALA[i % COLORES_SALA.length], puntos: 0 };
    });
    if (!S.jugs.length) return;
    S.n = 0; S.turnoPintado = null;
    red = nuevaRed();
    silenciar(true);
    try {
      S.ctrl = await S.modulo.iniciar(cont, { set: c.set, jugadores: S.jugs, opciones: c.opciones, alMenu: () => {}, alRepetir: () => {}, red });
      for (const j of est.jugadas || []) {
        if (j.n !== S.n + 1) break;
        S.n = j.n;
        try { S.ctrl.aplicar(j.accion); } catch (e) { console.error(e); }
        if (S.fase !== 'jugando') break;
      }
    } finally { silenciar(false); }
    if (est.estado === 'finalizado' && S.fase === 'jugando') return podio();
    pintarTurno();
  }
  // Barra de arriba: de quién es el turno (y, para el anfitrión, pasar el turno o terminar)
  function pintarTurno() {
    if (S.fase !== 'jugando' || !S.ctrl || !S.reloj) return;
    const i = S.ctrl.turno(), j = S.jugs[i];
    if (!j) return;
    const mio = red.puedo(i);
    cont.classList.toggle('no-es-mi-turno', !mio);
    const clave = `${i}|${mio}`;
    if (clave === S.turnoPintado) return;
    const antes = S.turnoPintado;
    S.turnoPintado = clave;
    S.reloj.extra(`<span class="pill pill-turno ${mio ? 'mio' : ''}" aria-live="polite">${mio ? '🎯 ¡Es tu turno!' : `🎯 Turno de <b>${esc(j.avatar)} ${esc(j.nombre)}</b>`}</span>
      <button class="b3 chico" data-resinc title="Volver a sincronizar con los demás" aria-label="Volver a sincronizar">🔄</button>
      ${esHost ? '<button class="b3 azul chico" data-pasar title="Si alguien no está, salta su turno">⏭ Pasar</button><button class="b3 morado chico" data-fin-todos>Terminar</button>' : ''}`);
    $('[data-resinc]', barra).onclick = () => { S.turnoPintado = null; resincronizar(); };
    const bp = $('[data-pasar]', barra);
    if (bp) bp.onclick = () => {
      if (!S.ctrl || S.desfase) return;
      const accion = { t: 'pasar' };
      S.ctrl.aplicar(accion); enviarJugada(accion); pintarTurno();
    };
    const bf = $('[data-fin-todos]', barra); if (bf) bf.onclick = terminarTodos;
    if (mio && antes) { sonar.bien(); try { navigator.vibrate?.(120); } catch { /* sin vibración */ } }
  }
  function finTurnos() {
    if (S.fase !== 'jugando') return;
    const p = puntajes();
    S.est.jugadores = S.est.jugadores.map(j => ({ ...j, puntaje: p[j.id] ?? j.puntaje })).sort((a, b) => Number(b.puntaje) - Number(a.puntaje));
    if (yo || esHost) rpc('sala_fin_turnos', { p_sala: sala_id, p_puntajes: p, ...firma() }).then(() => S.canal?.avisar()).catch(() => {});
    podio();
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
    alFinalizarPartida(null); pararTurnos();
    // por turnos, el podio es de los que jugaron la partida (los que llegaron tarde solo miraron)
    const js = porTurnos() && S.orden.length ? S.est.jugadores.filter(j => S.orden.includes(j.id)) : S.est.jugadores;
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
