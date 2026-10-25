// ============================================================
// Proyectos en grupo "a su ritmo": el alumno abre el proyecto y avanza las hojas solo.
//   proyecto.html?pub=<publicación en su grupo>   (alumno con su cuenta, o invitado si el profesor lo permite)
//   proyecto.html?p=<proyecto público>            (desde la biblioteca de la portada)
// Las respuestas y los puntajes de los juegos se guardan; el profesor los ve por alumno.
// ============================================================
import { supabase, esc, mensajeError } from '../comun.js';
import { pintarHoja, pintarHojaMovil, pintarCelular } from './lienzo.js';
import { esPregunta } from './preguntas.js';
import { pintarRegistro } from './agrupar.js';
import { CARGAR, infoJuego } from './juego-hoja.js';
import { relojBarra, alFinalizarPartida } from '../juegos/util.js?v=202610242346';

const raiz = document.getElementById('raiz');
const params = new URLSearchParams(location.search);
const PUB = params.get('pub'), PROY = params.get('p');
const CLAVE = 'qa_ritmo_' + (PUB || 'p' + PROY);
const leerToken = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarToken = (t) => { try { if (t) localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento */ } };

let datos = null;   // { proyecto, intento, hojas }
let i = 0;
let partida = null; // juego en curso (para detenerlo al cambiar de hoja)

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw new Error(mensajeError(error));
  return data;
}
const tok = () => datos.intento.token || null;

function pantalla(html) {
  document.body.className = 'centrado participante';
  raiz.innerHTML = `<div class="hoja center">${html}</div>`;
}

// ---------- Entrar ----------
async function abrir(alias = null, avatar = null) {
  pantalla('<div class="spinner"></div>');
  let r;
  try { r = await rpc('proyecto_ritmo_abrir', { p_pub: PUB || null, p_proyecto: PUB ? null : PROY, p_token: leerToken(), p_alias: alias, p_avatar: avatar }); }
  catch (e) {
    return pantalla(`<div style="font-size:54px;">🙈</div><h2>No se pudo abrir el proyecto</h2><p class="muted" style="font-weight:700;">${esc(e.message)}</p>
      <p style="margin-top:14px;"><a class="btn btn-primary" href="index.html">Ir al inicio</a></p>`);
  }
  if (r.necesita === 'cuenta') {
    return pantalla(`<div style="font-size:54px;">🔐</div><h2>${esc(r.proyecto)}</h2><p class="muted" style="font-weight:700;">Este proyecto es para los alumnos del grupo. Entra con tu cuenta para abrirlo y guardar tu avance.</p>
      <p style="margin-top:14px;"><a class="btn btn-primary" href="entrar.html">Iniciar sesión</a></p>`);
  }
  if (r.necesita === 'nombre') {
    document.body.className = 'participante';
    raiz.innerHTML = '<div class="part-pantalla"><div class="movil-pantalla"><div class="lienzo-fondo" style="background:linear-gradient(160deg,#8B7EF7,#6C5CE7)"></div><div class="movil-scroll part-scroll" data-reg></div></div></div>';
    pintarRegistro(raiz.querySelector('[data-reg]'), { titulo: r.proyecto, subtitulo: 'Escribe tu nombre para empezar', alUnirse: async ({ nombre, alias: al, avatar: av }) => abrir(al || nombre, av) });
    return;
  }
  datos = r;
  guardarToken(r.intento.token);
  if (!datos.hojas.length) return pantalla('<div style="font-size:54px;">📭</div><h2>Este proyecto no tiene hojas para recorrer</h2>');
  i = Math.min(datos.intento.hoja_actual || 0, datos.hojas.length - 1);
  document.title = `${datos.proyecto.nombre} · Proyecto`;
  pintar();
}

// ---------- Recorrido ----------
function pintar() {
  partida?.detener(); partida = null;
  const h = datos.hojas[i], n = datos.hojas.length, ultima = i === n - 1;
  document.body.className = 'participante ritmo-pag';
  raiz.innerHTML = `<div class="ritmo">
    <header class="ritmo-cab"><b class="grow">${esc(datos.proyecto.nombre)}</b><span class="ritmo-yo">${esc(datos.intento.avatar || '🙂')} ${esc(datos.intento.alias || '')}</span>
      <span class="ritmo-n">${i + 1} / ${n}</span><span class="ritmo-prog"><i style="width:${Math.round((i + 1) * 100 / n)}%"></i></span></header>
    <main class="ritmo-hoja" data-hoja></main>
    <nav class="ritmo-nav"><button class="btn btn-outline" data-ant ${i === 0 ? 'disabled' : ''}>◀ Anterior</button>
      <button class="btn btn-primary" data-sig>${ultima ? '🏁 Terminar' : 'Siguiente ▶'}</button></nav></div>`;
  const cont = raiz.querySelector('[data-hoja]');
  if (h.tipo === 'juego') pintarJuego(cont, h);
  else if (esPregunta(h.tipo)) pintarPregunta(cont, h);
  else {
    // contenido: la hoja tal cual (en una pantalla ancha, 16:9; en el celular, acomodada)
    const ancha = innerWidth >= 900 && innerWidth > innerHeight;
    cont.classList.toggle('ancha', ancha);
    if (ancha) { cont.innerHTML = '<div class="ritmo-marco"></div>'; pintarHoja(cont.firstChild, h, { modo: 'ver' }); }
    else pintarHojaMovil(cont, h, { modo: 'ver' });
  }
  raiz.querySelector('[data-ant]').onclick = () => ir(i - 1);
  raiz.querySelector('[data-sig]').onclick = () => ultima ? terminar() : ir(i + 1);
}
function ir(n) {
  if (n < 0 || n >= datos.hojas.length) return;
  i = n;
  rpc('proyecto_ritmo_avanzar', { p_intento: datos.intento.id, p_token: tok(), p_hoja: i }).catch(() => {});
  pintar();
  scrollTo(0, 0);
}

function pintarPregunta(cont, h) {
  const r = datos.intento.respuestas[h.id];
  const respondida = !!r && h.tipo !== 'lluvia';
  const respuestas = h.tipo === 'lluvia' ? (r?.valores || []).map(valor => ({ valor, mia: true })) : r ? [{ valor: r.valor, mia: true }] : [];
  pintarCelular(cont, h, datos.proyecto.nombre, {
    vivo: { respuestas, cerrado: respondida, revelar: respondida, fija: true },
    alEnviar: async (valor) => {
      const c = await rpc('proyecto_ritmo_responder', { p_intento: datos.intento.id, p_token: tok(), p_hoja: h.id, p_valor: valor });
      if (c?.config) Object.assign(h.config, c.config);   // ahora ya se puede mostrar la respuesta correcta
      if (h.tipo === 'lluvia') datos.intento.respuestas[h.id] = { valores: [...(r?.valores || []), valor] };
      else datos.intento.respuestas[h.id] = { valor, correcta: c?.correcta ?? null };
      setTimeout(pintar, 50);
    }
  });
}

// Juego: se juega aquí con su cronómetro; se guarda el mejor puntaje
function pintarJuego(cont, h) {
  const g = h.config.juego, info = infoJuego(g.tipo);
  const mejor = datos.intento.juegos[h.id];
  cont.innerHTML = `<div class="part"><div class="part-card" style="text-align:center;"><div style="font-size:16cqw;">${info.ico}</div>
    <div class="part-enun">${esc(g.titulo)}</div><div class="part-tipo">${esc(info.nombre)}${Number(g.segundos) ? ` · ⏱ ${Math.round(g.segundos / 6) / 10} min` : ''}</div>
    ${mejor ? `<div class="part-hecho">⭐<b>Tu mejor puntaje: ${mejor.puntos}</b><small>Jugaste ${mejor.veces} ${mejor.veces === 1 ? 'vez' : 'veces'}.</small></div>` : ''}
    <button class="part-btn" data-jugar>${mejor ? '🔄 Jugar otra vez' : '▶ Jugar'}</button></div></div>`;
  cont.querySelector('[data-jugar]').onclick = () => jugar(cont, h);
}
async function jugar(cont, h) {
  const g = h.config.juego, seg = Number(g.segundos) || 0, c = g.contenido;
  cont.innerHTML = '<div class="part-juego"><div class="barra-tiempo" data-barra hidden></div><div class="zona-juego" data-zona></div></div>';
  const jug = { nombre: datos.intento.alias || 'Tú', avatar: datos.intento.avatar || '🙂', color: 'j1', puntos: 0 };
  const m = await (CARGAR[c.juego] || CARGAR[g.tipo])();
  let reloj = null, listo = false;
  const fin = async (porTiempo) => {
    if (listo) return;
    listo = true;
    alFinalizarPartida(null);
    const bono = seg && !porTiempo && reloj ? Math.round(reloj.restante()) : 0;
    jug.puntos += bono;
    if (reloj) { reloj.ocultar(); reloj = null; }
    let r = null;
    try { r = await rpc('proyecto_ritmo_responder', { p_intento: datos.intento.id, p_token: tok(), p_hoja: h.id, p_valor: { puntos: jug.puntos } }); } catch { /* sin conexión */ }
    const prev = datos.intento.juegos[h.id];
    datos.intento.juegos[h.id] = { puntos: r?.mejor ?? Math.max(jug.puntos, prev?.puntos || 0), veces: (prev?.veces || 0) + 1 };
    setTimeout(() => { if (partida?.h === h) { partida = null; pintarJuego(cont, h); } }, porTiempo ? 800 : 2400);
  };
  partida = { h, detener: () => { listo = true; alFinalizarPartida(null); if (reloj) reloj.ocultar(); } };
  alFinalizarPartida(() => fin(false));
  if (seg) reloj = relojBarra(cont.querySelector('[data-barra]'), Date.now() + seg * 1000, { total: seg, alAcabar: () => fin(true) });
  m.iniciar(cont.querySelector('[data-zona]'), { set: c.set, jugadores: [jug], opciones: c.opciones, alMenu: () => {}, alRepetir: () => {} });
}

// ---------- Final ----------
async function terminar() {
  partida?.detener(); partida = null;
  rpc('proyecto_ritmo_avanzar', { p_intento: datos.intento.id, p_token: tok(), p_hoja: i, p_completado: true }).catch(() => {});
  const rs = Object.values(datos.intento.respuestas).filter(r => r.correcta != null);
  const bien = rs.filter(r => r.correcta).length;
  const puntos = Object.values(datos.intento.juegos).reduce((t, j) => t + Number(j.puntos || 0), 0);
  const pendientes = datos.hojas.filter(h => esPregunta(h.tipo) && !datos.intento.respuestas[h.id]).length;
  pantalla(`<div style="font-size:60px;">🏁</div><h2>¡Terminaste “${esc(datos.proyecto.nombre)}”!</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin:16px 0;">
      ${rs.length ? `<div class="stat"><span>✅ Aciertos</span><b>${bien} / ${rs.length}</b></div>` : ''}
      ${Object.keys(datos.intento.juegos).length ? `<div class="stat"><span>🎮 Puntos en juegos</span><b>${puntos}</b></div>` : ''}</div>
    ${pendientes ? `<p class="muted" style="font-weight:700;">Te faltan ${pendientes} ${pendientes === 1 ? 'pregunta' : 'preguntas'} por responder.</p>` : ''}
    <p class="muted" style="font-weight:700;">${PUB ? 'Tu profesor ya puede ver tus respuestas.' : '¡Gracias por participar!'}</p>
    <div class="row" style="justify-content:center; gap:8px; margin-top:14px;"><button class="btn btn-outline" data-repasar>◀ Repasar</button>
      <a class="btn btn-primary" href="${PUB && !datos.intento.token ? 'alumno.html' : 'index.html'}">Salir</a></div>`);
  raiz.querySelector('[data-repasar]').onclick = () => { i = 0; pintar(); };
}

abrir();
