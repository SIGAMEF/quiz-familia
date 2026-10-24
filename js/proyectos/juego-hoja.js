// ============================================================
// Proyectos en grupo: hoja de juego (sopa, ahorcado, memorama, rompecabezas, ordena, trivia, quiz relámpago…)
// - la hoja guarda una copia del juego de Mis actividades con el mismo contenido para todos (como las salas)
// - en vivo: el profesor inicia la partida, todos juegan a la vez en su celular con el mismo cronómetro
//   y la pantalla muestra el ranking en vivo (por participante o, si hay grupos, por grupo)
// ============================================================
import { JUEGOS } from '../juegos/contenido.js';
import { contenidoSala } from '../juegos/sala.js';
import { relojBarra, alFinalizarPartida } from '../juegos/util.js';
import { ahoraServidor } from './ruleta.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]+$/.test(u);
const cara = (x) => esUrl(x?.foto_url) ? `<img src="${esc(x.foto_url)}" alt="">` : esc(x?.avatar || x?.emoji || '🙂');
export const CARGAR = {
  ahorcado: () => import('../juegos/ahorcado.js'), sopa: () => import('../juegos/sopa.js'), memoria: () => import('../juegos/memoria.js'),
  ordena: () => import('../juegos/ordena.js'), quiz: () => import('../juegos/quiz.js'), trivia: () => import('../juegos/quiz.js'),
  relampago: () => import('../juegos/quiz.js'), frase: () => import('../juegos/frase.js'), rompecabezas: () => import('../juegos/rompecabezas.js')
};
export const UNIDAD = { memoria: 'parejas', frase: 'frases', rompecabezas: 'piezas', trivia: 'preguntas', relampago: 'preguntas' };
// (la Trivia de los profesores es de cualquier tema, no solo bíblica)
export const infoJuego = (tipo) => tipo === 'trivia' ? { ...JUEGOS.trivia, nombre: 'Trivia' } : JUEGOS[tipo] || { nombre: 'Juego', ico: '🎮', color: '#8E5BE8' };
export const TIEMPOS_JUEGO = [[0, 'Sin límite'], [60, '1 minuto'], [90, '1 min 30 s'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos']];

// Opciones con las que se juega en la hoja (como en juegos.html): en el celular, partidas cortas
function opcionDe(tipo, d) {
  const n = (k) => (d[k] || []).length;
  return {
    ahorcado: ['cantidad', Math.min(n('palabras'), 8)], sopa: ['nivel', 'facil'], memoria: ['parejas', Math.min(n('parejas'), 8)],
    ordena: ['cantidad', Math.min(n('palabras'), 10)], frase: ['cantidad', Math.min(n('frases'), 8)], rompecabezas: ['piezas', d.piezas || 3],
    trivia: ['cantidad', Math.min(n('preguntas'), 15)], relampago: ['cantidad', Math.min(n('preguntas'), 15)]
  }[tipo] || ['cantidad', 10];
}
const itemsDe = (tipo, d) => tipo === 'rompecabezas' ? (d.piezas || 3) ** 2
  : (d[{ memoria: 'parejas', frase: 'frases', trivia: 'preguntas', relampago: 'preguntas' }[tipo] || 'palabras'] || []).length;

// Configuración de la hoja a partir de un juego de Mis actividades (fila de la tabla juegos).
// Es una copia: la hoja sigue funcionando aunque después se cambie o se borre el juego.
export function configJuego(j, previa = {}) {
  const d = j.datos || {};
  const set = { ...d, id: j.id, remoto: true, tipo: j.tipo, titulo: j.titulo, tema: j.tema || '' };
  const [campo, valor] = opcionDe(j.tipo, d);
  return {
    modo: previa.modo === 'grupo' ? 'grupo' : 'persona',
    juego: { id: j.id, tipo: j.tipo, titulo: j.titulo, tema: j.tema || '', n: itemsDe(j.tipo, d),
      segundos: previa.juego ? Number(previa.juego.segundos) || 0 : Number(j.segundos) || 180,
      contenido: contenidoSala({ juego: j.tipo, set, campo, valor, pistas: d.pistas || 'palabras' }) }
  };
}

// ======================= RANKING =======================
// res: { participantes, respuestas: [{ participante_id, alias, avatar, grupo_id, valor: { puntos, terminado } }], grupos, modoGrupo }
export function ranking(res) {
  const porId = new Map((res.respuestas || []).map(r => [r.participante_id, r]));
  const personas = (res.participantes || []).map(p => {
    const r = porId.get(p.id);
    return { id: p.id, alias: p.alias, avatar: p.avatar, foto_url: p.foto_url, grupo_id: r?.grupo_id ?? p.grupo_id, puntos: Number(r?.valor?.puntos) || 0, terminado: !!r?.valor?.terminado, jugo: !!r };
  });
  // los que respondieron pero ya no están en la lista (p. ej. resultados guardados)
  for (const r of res.respuestas || []) if (!personas.some(p => p.id === r.participante_id)) {
    personas.push({ id: r.participante_id, alias: r.alias, avatar: r.avatar, grupo_id: r.grupo_id, puntos: Number(r.valor?.puntos) || 0, terminado: !!r.valor?.terminado, jugo: true });
  }
  if (!res.modoGrupo || !(res.grupos || []).length) return personas.sort((a, b) => b.puntos - a.puntos);
  // por grupo: el promedio de sus integrantes (así no gana el grupo más grande)
  return res.grupos.map(g => {
    const m = personas.filter(p => p.grupo_id === g.id);
    return { id: g.id, alias: g.nombre, emoji: g.emoji, color: g.color, miembros: m.length, terminado: m.length > 0 && m.every(p => p.terminado),
      puntos: m.length ? Math.round(m.reduce((t, p) => t + p.puntos, 0) / m.length) : 0 };
  }).sort((a, b) => b.puntos - a.puntos);
}

// ======================= ZONA DE LA PANTALLA =======================
// res: { ...ranking, inicio (ms, hora del servidor) | null, abiertas, servidor } o null (vista previa del editor)
const fase = (hoja, res, ahora) => {
  if (!res || res.inicio == null) return 'espera';
  if (ahora < res.inicio) return 'cuenta';
  const seg = Number(hoja.config?.juego?.segundos) || 0;
  if (!res.abiertas || (seg && ahora >= res.inicio + seg * 1000)) return 'fin';
  return 'jugando';
};
export function pintarZonaJuego(d, hoja, res) {
  clearInterval(d._t);
  const g = hoja.config?.juego || {};
  const info = infoJuego(g.tipo);
  const ahora = () => res?.servidor ? ahoraServidor() : Date.now();
  const f = fase(hoja, res, ahora());
  const muestra = !res ? [['Ana', '🦊', 820], ['Luis', '🐼', 640], ['Sofía', '🐸', 510]].map(([alias, avatar, puntos]) => ({ alias, avatar, puntos })) : null;
  const filas = muestra || ranking(res);
  const max = Math.max(1, ...filas.map(x => x.puntos));
  const porGrupo = !!res?.modoGrupo && (res.grupos || []).length > 0;
  const seg = Number(g.segundos) || 0;
  const cab = `<div class="zj-cab" style="--c:${info.color}"><span class="zj-ico">${info.ico}</span><span class="grow"><b>${esc(g.titulo || 'Juego')}</b>
      <small>${esc(info.nombre)}${g.n ? ` · ${g.n} ${UNIDAD[g.tipo] || 'palabras'}` : ''} · ${seg ? `⏱ ${Math.round(seg / 6) / 10} min` : 'sin límite de tiempo'}${porGrupo ? ' · 👥 por grupos' : ''}</small></span>
      ${f === 'jugando' && seg ? '<span class="zj-reloj" data-reloj-j></span>' : ''}</div>`;
  const lista = (n) => `<ol class="zj-rank">${filas.slice(0, n).map((x, i) => `<li class="${x.terminado ? 'ok' : ''}" ${x.color ? `style="--g:${esc(x.color)}"` : ''}>
      <span class="zj-pos">${i + 1}</span><span class="zj-cara">${cara(x)}</span><b>${esc(x.alias)}</b>${x.miembros != null ? `<small>${x.miembros} 👤</small>` : '<small></small>'}
      <span class="zj-barra"><i style="width:${Math.round(x.puntos * 100 / max)}%"></i></span><span class="zj-pts">${x.puntos}${x.terminado ? ' ✔' : ''}</span></li>`).join('')}</ol>`;
  let cuerpo;
  if (f === 'espera') {
    const n = res ? (res.participantes || []).length : 0;
    cuerpo = `<div class="zj-espera"><div class="zj-grande">${info.ico}</div>
      <p>${res ? `<b>${n}</b> ${n === 1 ? 'participante listo' : 'participantes listos'}. Todos jugarán a la vez en su celular.` : 'En vivo, cada participante juega en su celular con el mismo cronómetro y aquí se ve el ranking.'}</p>
      ${res?.profe ? '<button class="zj-btn" data-juego-accion="iniciar">▶ Empezar el juego</button>' : ''}</div>${muestra ? lista(3) : ''}`;
  } else if (f === 'cuenta') {
    cuerpo = `<div class="zj-espera"><div class="zj-cuenta" data-cuenta>${Math.ceil((res.inicio - ahora()) / 1000)}</div><p>¡Prepárense!</p></div>`;
  } else if (f === 'jugando') {
    cuerpo = filas.length ? lista(10) : '<div class="zona-vacia"><span>🎮</span>Están jugando…</div>';
  } else {
    const podio = filas.slice(0, 3);
    cuerpo = `<div class="zj-podio">${[1, 0, 2].map(i => podio[i] ? `<div class="p${i + 1}"><span class="zj-cara">${cara(podio[i])}</span><b>${esc(podio[i].alias)}</b><div>${i + 1}°<br>${podio[i].puntos}</div></div>` : '<div></div>').join('')}</div>
      ${filas.length > 3 ? lista(10) : ''}`;
  }
  d.innerHTML = `<div class="zona zona-juego-hoja fase-${f}">${cab}${cuerpo}</div>`;
  // reloj y cambios de fase sin esperar la próxima consulta
  if (f === 'cuenta' || (f === 'jugando' && seg)) {
    d._t = setInterval(() => {
      if (!d.isConnected) return clearInterval(d._t);
      const ff = fase(hoja, res, ahora());
      if (ff !== f) return pintarZonaJuego(d, hoja, res);
      const c = d.querySelector('[data-cuenta]');
      if (c) c.textContent = Math.max(1, Math.ceil((res.inicio - ahora()) / 1000));
      const r = d.querySelector('[data-reloj-j]');
      if (r) { const s = Math.max(0, Math.ceil((res.inicio + seg * 1000 - ahora()) / 1000)); r.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; r.classList.toggle('poco', s <= 10); }
    }, 250);
  }
}
export const faseJuego = fase;

// ======================= CELULAR =======================
// Lo que ve el participante mientras el profesor no inicia (también la vista previa del editor)
export function pintarEsperaJuego(cont, hoja, { grupo = null, texto = 'Espera a que el profesor inicie el juego.' } = {}) {
  const g = hoja.config?.juego || {};
  const info = infoJuego(g.tipo);
  const caja = document.createElement('div');
  caja.className = 'part';
  caja.innerHTML = `<div class="part-card" style="text-align:center;">
    <div style="font-size:16cqw;">${info.ico}</div><div class="part-enun">${esc(g.titulo || 'Juego')}</div>
    <div class="part-tipo">${esc(info.nombre)}${Number(g.segundos) ? ` · ⏱ ${Math.round(g.segundos / 6) / 10} min` : ''}</div>
    ${grupo ? `<div class="part-grupo" style="--c:${esc(grupo.color)}; align-self:center;">${esc(grupo.emoji || '')} Juegas por ${esc(grupo.nombre)}</div>` : ''}
    <div class="part-hecho">🎮<b>${esc(texto)}</b><small>Todos empiezan a la vez.</small></div></div>`;
  cont.appendChild(caja);
}

/**
 * Juego en el celular del participante. Devuelve { clave, cont, actualizar(e), destruir() }.
 * e: estado de proyecto_estado · enviar(valor): guarda el puntaje ({ puntos, terminado, detalle })
 */
export function juegoCelular(cont, hoja, e, { enviar }) {
  const g = hoja.config.juego;
  const seg = Number(g.segundos) || 0;
  const S = { fase: '', jug: null, enviado: -1, terminado: false, reloj: null, t: null, vivo: true, e };
  const inicio = e.sesion.juego_inicio ? Date.parse(e.sesion.juego_inicio) : null;
  const aLocal = (ms) => Date.now() + (ms - ahoraServidor());
  const yaTermino = e.respuestas?.[0]?.valor?.terminado;

  const lugar = () => S.e.juego?.total ? `<p class="part-cuenta">🏆 Vas en el lugar <b>${S.e.juego.pos}</b> de ${S.e.juego.total}</p>` : '';
  function espera(texto) {
    S.fase = 'espera';
    cont.innerHTML = '';
    pintarEsperaJuego(cont, hoja, { grupo: hoja.config.modo === 'grupo' ? e.yo.grupo : null, texto });
  }
  function terminadoPantalla(texto = '¡Terminaste!') {
    S.fase = 'terminado';
    const pts = S.jug ? S.jug.puntos : (Number(S.e.respuestas?.[0]?.valor?.puntos) || 0);
    cont.innerHTML = `<div class="part"><div class="part-card" style="text-align:center;"><div style="font-size:16cqw;">🏁</div>
      <div class="part-enun">${esc(texto)}</div><div class="part-hecho">⭐<b>${pts} puntos</b><small>Mira el ranking en la pantalla.</small></div><div data-lugar>${lugar()}</div></div></div>`;
  }
  function cuenta() {
    S.fase = 'cuenta';
    const paso = () => {
      if (!S.vivo || S.fase !== 'cuenta') return;
      const s = Math.ceil((inicio - ahoraServidor()) / 1000);
      if (s <= 0) return jugar();
      cont.innerHTML = `<div class="part-juego"><div class="cuenta-atras">${s}</div><p class="lema" style="text-align:center;">¡Prepárate! ${esc(g.titulo)}</p></div>`;
      S.t = setTimeout(paso, 200);
    };
    paso();
  }
  async function jugar() {
    S.fase = 'jugando'; S.terminado = false;
    const c = g.contenido;
    cont.innerHTML = '<div class="part-juego"><div class="barra-tiempo" data-barra hidden></div><div class="zona-juego" data-zona></div></div>';
    S.jug = { nombre: e.yo.alias, avatar: e.yo.avatar || '🙂', color: 'j1', puntos: 0 };
    const m = await (CARGAR[c.juego] || CARGAR[g.tipo])();
    if (!S.vivo) return;
    alFinalizarPartida(({ detalle }) => terminar(detalle));
    if (seg) S.reloj = relojBarra(cont.querySelector('[data-barra]'), aLocal(inicio + seg * 1000), { total: seg, alAcabar: () => terminar('Se acabó el tiempo', true) });
    m.iniciar(cont.querySelector('[data-zona]'), { set: c.set, jugadores: [S.jug], opciones: c.opciones, alMenu: () => {}, alRepetir: () => {} });
    // el puntaje se manda mientras juega (para el ranking en vivo)
    S.prog = setInterval(() => {
      if (S.terminado || !S.jug || S.jug.puntos === S.enviado) return;
      S.enviado = S.jug.puntos;
      enviar({ puntos: S.jug.puntos, terminado: false }).catch(() => {});
    }, 1500);
  }
  async function terminar(detalle, porTiempo = false) {
    if (S.terminado) return;
    S.terminado = true;
    clearInterval(S.prog);
    // bono por terminar antes de tiempo (como en las salas)
    const bono = seg && !porTiempo && S.reloj ? Math.round(S.reloj.restante()) : 0;
    S.jug.puntos += bono;
    alFinalizarPartida(null);
    if (S.reloj) { S.reloj.ocultar(); S.reloj = null; }
    await enviar({ puntos: S.jug.puntos, terminado: true, detalle: `${detalle || ''}${bono ? ` · bono de tiempo +${bono}` : ''}`.replace(/^ · /, '') }).catch(() => {});
    setTimeout(() => { if (S.vivo) terminadoPantalla(porTiempo ? '⏰ ¡Se acabó el tiempo!' : '✔ ¡Terminaste!'); }, porTiempo ? 600 : 2200);
  }

  if (!inicio) espera();
  else if (yaTermino) { S.terminado = true; terminadoPantalla(); }
  else if (!e.sesion.abiertas || (seg && ahoraServidor() > inicio + seg * 1000)) terminadoPantalla('El juego terminó');
  else if (ahoraServidor() < inicio) cuenta();
  else jugar();

  return {
    cont,
    actualizar(nuevo) {
      S.e = nuevo;
      const l = cont.querySelector('[data-lugar]'); if (l) l.innerHTML = lugar();
      if (S.fase === 'jugando' && !nuevo.sesion.abiertas) terminar('El profesor terminó el juego');
    },
    destruir() {
      S.vivo = false; clearTimeout(S.t); clearInterval(S.prog);
      if (S.reloj) { S.reloj.ocultar(); S.reloj = null; }
      if (S.fase === 'jugando') alFinalizarPartida(null);
      document.body.classList.remove('con-reloj');
    }
  };
}
