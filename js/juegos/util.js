// ============================================================
// Utilidades de los juegos libres (no necesitan cuenta ni Supabase)
// ============================================================
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export function esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// Barajado con semilla: con la misma semilla todos los jugadores de una sala reciben el mismo orden
export function mezclador(semilla) {
  if (semilla == null) return barajar;
  let st = Number(semilla) >>> 0;
  const rnd = () => { st = (st + 0x6D2B79F5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return (a) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
}
export function barajar(a) { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; }
// Letra base para comparar: quita tildes pero conserva la Ñ
export function base(letra) { return letra === 'Ñ' ? 'Ñ' : letra.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
export function sinTildes(t) { return [...t.toUpperCase()].map(base).join(''); }
// ---------- Imágenes: una URL (foto subida) o un emoji ----------
export const esUrl = (t) => /^(https?:|data:image|blob:)/.test(t || '');
export function figura(img, clase = '') {
  if (!img) return '';
  return esUrl(img) ? `<img class="fig ${clase}" src="${esc(img)}" alt="" loading="lazy" draggable="false">`
                    : `<span class="fig fig-emoji ${clase}" aria-hidden="true">${esc(img)}</span>`;
}
// Un lado de una pareja del memorama: "texto", "🐶" o { texto, imagen }
export function lado(x) {
  if (x && typeof x === 'object') return { texto: x.texto || '', imagen: x.imagen || '' };
  const t = String(x ?? '');
  return /^\p{Extended_Pictographic}/u.test(t) && [...t].length <= 4 ? { texto: '', imagen: t } : { texto: t, imagen: '' };
}
export const ladoTexto = (x) => { const l = lado(x); return l.texto || (esUrl(l.imagen) ? '(imagen)' : l.imagen); };
export function fmtTiempo(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ---------- Preferencias locales (solo comodidad) ----------
function leer(k, d) { try { const v = localStorage.getItem('qa_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function guardar(k, v) { try { localStorage.setItem('qa_' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
export const prefs = { leer, guardar };

// ---------- Sonidos sencillos (sin archivos) ----------
let ctx = null;
let mudo = leer('mudo', false);
let callado = false;   // mientras una sala repite jugadas ya hechas (no suenan de nuevo)
export function sonidoActivo() { return !mudo; }
export function alternarSonido() { mudo = !mudo; guardar('mudo', mudo); return !mudo; }
export function silenciar(si) { callado = !!si; }
function tono(f, dur = 0.12, tipo = 'sine', cuando = 0, vol = 0.18) {
  if (mudo || callado) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f;
    const t = ctx.currentTime + cuando;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* sin audio */ }
}
export const sonar = {
  clic: () => tono(660, 0.05, 'triangle', 0, 0.08),
  bien: () => { tono(660, 0.1, 'triangle'); tono(990, 0.14, 'triangle', 0.08); },
  // fallo: un "bup" suave y grave (antes era un zumbido que sonaba a error en cada intento)
  mal: () => { tono(330, 0.12, 'sine', 0, 0.07); tono(262, 0.16, 'sine', 0.09, 0.06); },
  tic: () => tono(1320, 0.06, 'square', 0, 0.07),     // ya casi se acaba el tiempo
  turno: () => { tono(784, 0.12, 'sine', 0, 0.09); tono(1046, 0.18, 'sine', 0.1, 0.08); },   // te toca
  // fanfarria de ganador
  gana: () => {
    [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36]].forEach(([f, t]) => tono(f, 0.16, 'triangle', t, 0.16));
    [[784, 0.56], [1046, 0.56], [1318, 0.56]].forEach(([f, t]) => tono(f, 0.7, 'triangle', t, 0.1));
  },
  pierde: () => [392, 330, 262].forEach((f, i) => tono(f, 0.22, 'sine', i * 0.16, 0.12))
};

// ---------- Música de fondo suave (se genera aquí: no descarga nada) ----------
// Una cajita de música lenta en escala pentatónica, muy bajita. Se apaga con 🔇 y cuando la pestaña no se ve.
const MELODIA = [0, 2, 4, 7, 4, 2, 9, 7, 4, 2, 0, 2, 4, 2, 0, -3];
const ESCALA = { '-3': 220, 0: 262, 2: 294, 4: 330, 7: 392, 9: 440 };
let fondoId = null, fondoPaso = 0, fondoQuiere = false;
function notaFondo() {
  if (mudo || document.hidden) return;
  const k = MELODIA[fondoPaso % MELODIA.length];
  tono(ESCALA[k], 1.1, 'sine', 0, 0.035);
  if (fondoPaso % 8 === 0) tono(ESCALA[k] / 2, 2.2, 'sine', 0, 0.03);   // un bajo suave cada tanto
  fondoPaso++;
}
// ---------- Voz: "Turno de Lucas", "¡Correcto!", "¡Ganó Ana!" (la voz del propio teléfono; no usa internet) ----------
let vozEs = null;
function buscarVoz() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    vozEs = vs.find(v => /es[-_](PE|419|MX|US|CO|AR|CL)/i.test(v.lang)) || vs[0] || null;
  } catch { vozEs = null; }
}
try { buscarVoz(); speechSynthesis.addEventListener?.('voiceschanged', buscarVoz); } catch { /* sin voz */ }
export function decir(texto, { cortar = false } = {}) {
  if (mudo || callado || !texto) return;
  try {
    if (!('speechSynthesis' in window)) return;
    if (cortar) speechSynthesis.cancel();
    else if (speechSynthesis.pending) return;      // no se acumulan frases atrasadas
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = vozEs?.lang || 'es-ES'; if (vozEs) u.voice = vozEs;
    u.rate = 1.02; u.pitch = 1.1; u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}
// Anuncia el turno solo cuando cambia (el tablero se vuelve a pintar muchas veces)
let turnoDicho = null;
export function anunciarTurno(jugadores, turno) {
  if (jugadores.length < 2 || !jugadores[turno]) return;
  const clave = `${jugadores.map(j => j.nombre).join('|')}#${turno}`;
  if (clave === turnoDicho) return;
  turnoDicho = clave;
  decir(`Turno de ${jugadores[turno].nombre}`);   // espera a que termine lo anterior (por ejemplo, "¡Correcto!")
}
export const olvidarTurno = () => { turnoDicho = null; };

export const fondo = {
  iniciar() { fondoQuiere = true; if (fondoId) return; fondoPaso = 0; fondoId = setInterval(notaFondo, 520); },
  parar() { fondoQuiere = false; clearInterval(fondoId); fondoId = null; },
  activo: () => fondoQuiere
};
export function confeti() {
  if (callado || !window.confetti || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  [0.2, 0.5, 0.8].forEach((x, i) => setTimeout(() => window.confetti({ particleCount: 70, spread: 75, origin: { x, y: 0.55 } }), i * 200));
}

// ---------- El cangurito (personaje original) ----------
// energia: 0..1 ; estado: 'normal' | 'gana' | 'cansado'
export function canguro({ energia = 1, estado = 'normal', tam = 200 } = {}) {
  const saluda = estado === 'saluda';
  const gana = estado === 'gana' || saluda, dormido = estado === 'cansado';
  const caida = dormido ? 62 : Math.round((1 - energia) * 45);       // orejas caídas
  const ojos = gana ? 'felices' : dormido ? 'cerrados' : energia > 0.6 ? 'abiertos' : 'medio';
  const boca = gana ? 'abierta' : dormido ? 'plana' : energia > 0.66 ? 'sonrisa' : energia > 0.34 ? 'plana' : 'triste';
  const sudor = !gana && !dormido ? (energia <= 0.34 ? 3 : energia <= 0.5 ? 2 : energia <= 0.67 ? 1 : 0) : 0;
  const C = '#C98A4B', CL = '#F4D6A6', OSC = '#3B2314', ROSA = '#F3A0A8';
  const ojo = (x) => {
    if (ojos === 'cerrados') return `<path d="M${x - 8} 90 q8 6 16 0" stroke="${OSC}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    if (ojos === 'felices') return `<path d="M${x - 8} 92 q8 -10 16 0" stroke="${OSC}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    const tapa = ojos === 'medio' ? `<path d="M${x - 9.5} 87 a9.5 11 0 0 1 19 0 z" fill="${C}"/><path d="M${x - 9.5} 87 h19" stroke="${OSC}" stroke-width="2.5" stroke-linecap="round"/>` : '';
    return `<ellipse cx="${x}" cy="88" rx="8.5" ry="10.5" fill="#fff" stroke="${OSC}" stroke-width="1.5"/>
      <circle cx="${x + 1}" cy="90" r="5.5" fill="${OSC}"/><circle cx="${x + 3}" cy="87" r="2" fill="#fff"/>${tapa}`;
  };
  const bocas = {
    sonrisa: `<path d="M89 112 q11 11 22 0" stroke="${OSC}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    abierta: `<path d="M87 110 q13 20 26 0 z" fill="${OSC}"/><path d="M93 117 q7 6 14 0" fill="#E8697A"/>`,
    plana: `<path d="M92 114 h16" stroke="${OSC}" stroke-width="3" stroke-linecap="round"/>`,
    triste: `<path d="M90 117 q10 -8 20 0" stroke="${OSC}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };
  const gotas = [[150, 70], [52, 78], [158, 98]].slice(0, sudor)
    .map(([x, y]) => `<path d="M${x} ${y} q-6 9 0 12 q6 -3 0 -12z" fill="#7CC8F2" stroke="#3A9AD9" stroke-width="1"/>`).join('');
  const brazos = saluda
    ? `<ellipse cx="74" cy="168" rx="9" ry="20" fill="${C}" transform="rotate(25 74 168)"/>
       <ellipse cx="140" cy="148" rx="10" ry="24" fill="${C}" transform="rotate(-150 140 148)"/>
       <circle cx="150" cy="126" r="12" fill="${C}" stroke="${OSC}" stroke-width="1.5"/>
       <ellipse cx="150" cy="108" rx="5" ry="10" fill="${C}" stroke="${OSC}" stroke-width="1.5"/>`
    : gana
    ? `<ellipse cx="62" cy="128" rx="9" ry="22" fill="${C}" transform="rotate(35 62 128)"/><ellipse cx="138" cy="128" rx="9" ry="22" fill="${C}" transform="rotate(-35 138 128)"/>`
    : `<ellipse cx="74" cy="168" rx="9" ry="20" fill="${C}" transform="rotate(25 74 168)"/><ellipse cx="126" cy="168" rx="9" ry="20" fill="${C}" transform="rotate(-25 126 168)"/>`;
  const zzz = dormido ? `<g fill="#5B4FCF" font-family="Baloo 2, sans-serif" font-weight="800"><text x="146" y="58" font-size="18">z</text><text x="160" y="40" font-size="24">z</text><text x="176" y="20" font-size="30">Z</text></g>` : '';
  return `<svg viewBox="0 0 200 260" width="${tam}" height="${tam * 1.3}" role="img" aria-label="Cangurito ${dormido ? 'cansado' : gana ? 'feliz' : 'saltando'}">
    <path d="M128 205 Q182 214 186 160" stroke="${C}" stroke-width="17" fill="none" stroke-linecap="round"/>
    <ellipse cx="74" cy="242" rx="30" ry="10" fill="${C}"/><ellipse cx="126" cy="242" rx="30" ry="10" fill="${C}"/>
    <ellipse cx="78" cy="212" rx="25" ry="30" fill="${C}"/><ellipse cx="122" cy="212" rx="25" ry="30" fill="${C}"/>
    <ellipse cx="100" cy="172" rx="45" ry="55" fill="${C}"/><ellipse cx="100" cy="182" rx="28" ry="38" fill="${CL}"/>
    ${brazos}
    <g transform="rotate(${-18 - caida} 80 70)"><ellipse cx="80" cy="38" rx="13" ry="32" fill="${C}"/><ellipse cx="80" cy="40" rx="7" ry="22" fill="${ROSA}"/></g>
    <g transform="rotate(${18 + caida} 120 70)"><ellipse cx="120" cy="38" rx="13" ry="32" fill="${C}"/><ellipse cx="120" cy="40" rx="7" ry="22" fill="${ROSA}"/></g>
    <circle cx="100" cy="94" r="42" fill="${C}"/>
    <ellipse cx="100" cy="110" rx="25" ry="18" fill="${CL}"/>
    <circle cx="72" cy="106" r="7" fill="${ROSA}" opacity=".55"/><circle cx="128" cy="106" r="7" fill="${ROSA}" opacity=".55"/>
    ${ojo(84)}${ojo(116)}
    <ellipse cx="100" cy="102" rx="7.5" ry="5.5" fill="${OSC}"/>
    ${bocas[boca]}
    <path d="M64 128 Q100 146 136 128 L100 158 Z" fill="#2F80ED" stroke="#1B5FC4" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="100" cy="137" r="5" fill="#1B5FC4"/>
    ${gotas}${zzz}
  </svg>`;
}

// ---------- Paisaje de fondo (cielo, cerros y cerco) ----------
export function paisaje(noche = false) {
  const div = document.createElement('div');
  div.className = 'paisaje' + (noche ? ' noche' : '');
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = `<svg viewBox="0 0 1200 300" preserveAspectRatio="none">
    <path d="M0 170 Q180 90 360 150 T720 130 T1080 140 L1200 130 L1200 300 L0 300Z" fill="var(--cerro-lejos)"/>
    <path d="M0 210 Q240 150 480 200 T960 190 T1200 200 L1200 300 L0 300Z" fill="var(--cerro)"/>
    <g fill="var(--cerco)" opacity=".9">${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 50 + 10}" y="196" width="10" height="44" rx="3"/>`).join('')}
      <rect x="0" y="206" width="1200" height="7" rx="3"/><rect x="0" y="224" width="1200" height="7" rx="3"/></g>
    <path d="M0 238 Q300 222 600 236 T1200 234 L1200 300 L0 300Z" fill="var(--pasto)"/>
  </svg>`;
  document.body.prepend(div);
  return div;
}

// ---------- Jugadores ----------
export const AVATARES = ['🧒', '👧', '👦', '👩', '🧑', '🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🦄'];
export const COLORES = ['j1', 'j2'];
export const COLORES_SALA = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];

// Pantalla para elegir 1 o 2 jugadores con nombre y avatar. Devuelve una promesa con la lista.
export function formJugadores(cont, { permitirDos = true, etiqueta2 = '2 jugadores' } = {}) {
  const prev = leer('jugadores', [{ nombre: 'Jugador 1', avatar: '🧒' }, { nombre: 'Jugador 2', avatar: '👧' }]);
  let n = permitirDos ? leer('n_jugadores', 2) : 1;
  const fila = (i) => `<div class="jug-form ${COLORES[i]}" data-j="${i}">
      <button type="button" class="jug-av" data-av aria-label="Cambiar avatar">${prev[i]?.avatar || AVATARES[i]}</button>
      <input class="input" data-nombre maxlength="16" value="${esc(prev[i]?.nombre || `Jugador ${i + 1}`)}" aria-label="Nombre del jugador ${i + 1}">
    </div>`;
  cont.innerHTML = `${permitirDos ? `<div class="segmento" role="group" aria-label="Número de jugadores">
      <button type="button" data-n="1">🙋 1 jugador</button><button type="button" data-n="2">👥 ${esc(etiqueta2)}</button></div>` : ''}
    <div data-filas></div>`;
  const pintar = () => {
    $$('[data-n]', cont).forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === n)));
    $('[data-filas]', cont).innerHTML = fila(0) + (n === 2 ? `<div class="vs">vs</div>${fila(1)}` : '');
    $$('[data-av]', cont).forEach(b => b.onclick = () => {
      const k = (AVATARES.indexOf(b.textContent) + 1) % AVATARES.length; b.textContent = AVATARES[k]; sonar.clic();
    });
  };
  $$('[data-n]', cont).forEach(b => b.onclick = () => { n = Number(b.dataset.n); guardar('n_jugadores', n); pintar(); });
  pintar();
  return () => {
    const lista = $$('.jug-form', cont).map((f, i) => ({
      nombre: $('[data-nombre]', f).value.trim() || `Jugador ${i + 1}`, avatar: $('[data-av]', f).textContent,
      color: COLORES[i], puntos: 0
    }));
    guardar('jugadores', lista.map(({ nombre, avatar }) => ({ nombre, avatar })));
    return lista;
  };
}

// Barra superior con los jugadores y el turno (como en el ahorcado en equipo)
export function hudJugadores(jugadores, turno, extra = (j) => `${j.puntos}`) {
  anunciarTurno(jugadores, turno);
  const tarjeta = (j, i) => `<div class="hud-j ${j.color} ${i === turno && jugadores.length > 1 ? 'activo' : ''}">
      <span class="hud-av">${j.avatar}</span><span class="hud-txt"><b>${esc(j.nombre)}</b><span>${extra(j)}</span></span></div>`;
  if (jugadores.length === 1) return `<div class="hud">${tarjeta(jugadores[0], 0)}</div>`;
  if (jugadores.length > 2) return `<div class="hud hud-varios">${jugadores.map(tarjeta).join('')}</div>`;   // sala por turnos
  return `<div class="hud">${tarjeta(jugadores[0], 0)}
    <div class="hud-turno" aria-live="polite"><span>Turno de</span><b>${esc(jugadores[turno].nombre)}</b></div>
    ${tarjeta(jugadores[1], 1)}</div>`;
}

// Aviso al terminar una partida (lo usa juegos.html para guardar el resultado de un juego asignado)
let alFinal = null;
export function alFinalizarPartida(fn) { alFinal = fn; }

// Orden del ranking: más puntos primero; con los mismos puntos, quien tardó menos
export const ordenarPorPuntos = (js, pts = (j) => Number(j.puntos) || 0) =>
  [...js].sort((a, b) => pts(b) - pts(a) || (a.tiempo || 0) - (b.tiempo || 0));

// Pantalla final común
export function pantallaFinal(cont, { jugadores, titulo = '¡Fin del juego!', detalle = '', alRepetir, alMenu }) {
  // si alFinal devuelve true, se encarga él de la pantalla final (sala por turnos: podio de la sala)
  try { if (alFinal && alFinal({ jugadores, detalle: String(detalle).replace(/<[^>]+>/g, '') }) === true) return; } catch { /* el juego sigue aunque falle el registro */ }
  const orden = ordenarPorPuntos(jugadores);
  const mismosPuntos = jugadores.length > 1 && orden[0].puntos === orden[1].puntos;
  const empate = mismosPuntos && Math.round((orden[0].tiempo || 0) / 1000) === Math.round((orden[1].tiempo || 0) / 1000);
  const t = (j) => j.tiempo ? `<small class="final-tiempo">⏱ ${fmtTiempo(j.tiempo / 1000)}</small>` : '';
  fondo.parar(); olvidarTurno();
  decir(jugadores.length > 1 ? (empate ? '¡Empate!' : `¡Ganó ${orden[0].nombre}!`) : '¡Muy bien, terminaste!', { cortar: true });
  cont.innerHTML = `<div class="final">
    <div class="trofeo" aria-hidden="true">🏆</div>
    <h2 class="rotulo-tabla">${esc(titulo)}</h2>
    ${jugadores.length > 1 ? `<p class="final-sub">${empate ? '¡Empate!' : mismosPuntos ? 'Ganador (mismos puntos: ganó por tiempo)' : 'Ganador'}</p>
      ${empate ? '' : `<div class="ganador ${orden[0].color}"><span>${orden[0].avatar}</span><b>${esc(orden[0].nombre)}</b><strong>${orden[0].puntos}</strong>${t(orden[0])}<span class="corona" aria-hidden="true">👑</span></div>`}
      <div class="final-puntos">${jugadores.map(j => `<div class="${j.color}"><span>${j.avatar}</span><b>${esc(j.nombre)}</b><strong>${j.puntos}</strong>${t(j)}</div>`).join('')}</div>`
    : `<div class="ganador ${jugadores[0].color}"><span>${jugadores[0].avatar}</span><b>${esc(jugadores[0].nombre)}</b><strong>${jugadores[0].puntos}</strong>${t(jugadores[0])}</div>`}
    ${detalle ? `<p class="final-detalle">${detalle}</p>` : ''}
    <div class="final-botones"><button class="b3 azul" data-menu>Volver a los juegos</button><button class="b3 amarillo" data-otra>Jugar de nuevo</button></div>
  </div>`;
  sonar.gana(); confeti();
  $('[data-otra]', cont).onclick = alRepetir;
  $('[data-menu]', cont).onclick = alMenu;
  $('[data-otra]', cont).focus();
}

// ---------- Partida por turnos en una sala en línea ----------
// red (lo da sala.js): { yo, puedo(i), enviar(accion), vigente() }. Sin red, el juego es local y todo sigue igual.
// Las jugadas se aplican igual en todas las pantallas; las pausas de animación (tapar cartas, pasar a la
// siguiente palabra…) se adelantan si llega otra jugada antes de que terminen, para que nadie se desfase.
export function turnos(red) {
  let pend = null, reloj = null, crono = null, ultimaJugada = Date.now();
  // Tiempo de cada jugador (para desempatar): cada jugada suma lo que tardó quien la hizo.
  // Lo mide quien juega y viaja con la jugada (dt), así todas las pantallas de una sala suman lo mismo.
  const contar = (accion) => {
    if (!crono) return;
    const j = crono.jugadores[crono.turno()];
    if (j) j.tiempo = (j.tiempo || 0) + Math.max(0, Math.min(Number(accion.dt) || 0, 3600000));
    ultimaJugada = Date.now();
  };
  const vale = () => !red || !red.vigente || red.vigente();   // la partida de la sala terminó o se volvió a armar
  const adelantar = () => { if (!pend) return; clearTimeout(pend.t); const f = pend.fn; pend = null; f(); };
  const T = {
    red,
    despues(ms, fn) {
      adelantar();
      const correr = () => { if (vale()) { fn(); reloj?.reiniciar(); } };
      pend = { fn: correr, t: setTimeout(() => { pend = null; correr(); }, ms) };
    },
    adelantar,
    pendiente: () => !!pend,
    // una acción de quien toca la pantalla: solo vale si es su turno; se aplica aquí y se envía a los demás
    hacer(turno, accion, aplicar) {
      if (pend && !red) return;          // jugando en un solo dispositivo se espera la animación, como siempre
      adelantar();
      if (red && !red.puedo(turno())) return;
      if (crono) accion = { ...accion, dt: Date.now() - ultimaJugada };
      contar(accion);
      if (red) red.enviar(accion);   // antes de aplicarla: si esta jugada termina la partida, igual tiene que llegar a los demás
      aplicar(accion);
      reloj?.reiniciar();
    },
    // una jugada que llega de otro dispositivo
    recibir(accion, aplicar) { adelantar(); contar(accion); aplicar(accion); reloj?.reiniciar(); },
    // empieza a contar el tiempo de cada jugador (jugador.tiempo, en milisegundos)
    cronometro(jugadores, turno) { crono = { jugadores, turno }; jugadores.forEach(j => { j.tiempo = 0; }); ultimaJugada = Date.now(); },
    // Tiempo por turno: cada jugada vuelve a dar el tiempo completo; al acabarse, alAcabar() (le toca al siguiente).
    // En una sala solo lo dispara la pantalla de quien tiene el turno.
    reloj(seg, turno, alAcabar) {
      if (!(Number(seg) > 0)) return;
      reloj = relojTurno(Number(seg), { pausado: () => !!pend, vigente: vale, mio: () => !red || red.puedo(turno()), alAcabar });
    }
  };
  return T;
}

// ---------- Reloj del turno (abajo de la pantalla) ----------
let relojVivo = null;   // solo hay uno a la vez
export function pararRelojTurno() { if (relojVivo) relojVivo.parar(); }
function relojTurno(seg, { pausado, vigente, mio, alAcabar }) {
  pararRelojTurno();
  const el = document.createElement('div');
  el.className = 'reloj-turno';
  el.setAttribute('role', 'timer');
  el.innerHTML = '<span>⏳ <b data-s></b></span><div class="rt-barra"><div data-b></div></div>';
  document.body.append(el);
  const juego = document.getElementById('juego');
  let hasta = Date.now() + seg * 1000, ultimo = null, disparado = false;
  const R = {
    reiniciar() { hasta = Date.now() + seg * 1000; disparado = false; ultimo = null; },
    parar() { clearInterval(id); el.remove(); if (relojVivo === R) relojVivo = null; }
  };
  const tic = () => {
    if (!vigente() || (juego && (!juego.classList.contains('jugando') || juego.querySelector('.final, .podio-sala')))) return R.parar();
    if (pausado()) hasta = Date.now() + seg * 1000;    // durante una animación no corre
    const rest = Math.max(0, (hasta - Date.now()) / 1000), s = Math.ceil(rest);
    el.querySelector('[data-s]').textContent = s;
    el.querySelector('[data-b]').style.width = `${rest / seg * 100}%`;
    el.classList.toggle('urgente', s <= 5);
    if (s !== ultimo) { ultimo = s; if (s > 0 && s <= 5) sonar.tic(); }
    if (rest <= 0 && !disparado && mio()) { disparado = true; sonar.pierde(); alAcabar(); }
  };
  const id = setInterval(tic, 200);
  relojVivo = R;
  tic();
  return R;
}
// ---------- La horca del ahorcado con el cangurito colgado de la soga ----------
export function horca({ energia = 1, estado = 'normal' } = {}) {
  const k = canguro({ energia, estado }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const SOGA = '#C8A165', SOGA_OSC = '#94723F', M = '#8B5A2B', MO = '#5E3A17';
  return `<svg viewBox="0 0 240 380" role="img" aria-label="Cangurito colgado de la horca">
    <ellipse cx="110" cy="370" rx="110" ry="10" fill="#4E9E34" opacity=".5"/>
    <rect x="6" y="350" width="156" height="18" rx="6" fill="${M}" stroke="${MO}" stroke-width="3"/>
    <rect x="28" y="16" width="22" height="340" rx="5" fill="${M}" stroke="${MO}" stroke-width="3"/>
    <rect x="18" y="8" width="206" height="20" rx="6" fill="${M}" stroke="${MO}" stroke-width="3"/>
    <path d="M40 96 L112 24" stroke="${M}" stroke-width="14" stroke-linecap="round"/><path d="M40 96 L112 24" stroke="${MO}" stroke-width="3" opacity=".5"/>
    <g fill="${MO}"><circle cx="39" cy="18" r="3"/><circle cx="214" cy="18" r="3"/><circle cx="39" cy="340" r="3"/></g>
    <g class="columpio">
      <path d="M175 26 V160" stroke="${SOGA}" stroke-width="7" stroke-linecap="round"/>
      <path d="M175 26 V160" stroke="${SOGA_OSC}" stroke-width="7" stroke-dasharray="3 6" opacity=".6"/>
      <rect x="168" y="20" width="14" height="10" rx="3" fill="${SOGA_OSC}"/>
      <svg x="100" y="80" width="150" height="195" viewBox="0 0 200 260" overflow="visible">${k}</svg>
      <ellipse cx="175" cy="187" rx="24" ry="7" fill="none" stroke="${SOGA}" stroke-width="6"/>
      <ellipse cx="175" cy="187" rx="24" ry="7" fill="none" stroke="${SOGA_OSC}" stroke-width="6" stroke-dasharray="3 6" opacity=".6"/>
      <rect x="191" y="176" width="12" height="18" rx="5" fill="${SOGA}" stroke="${SOGA_OSC}" stroke-width="2" transform="rotate(-25 197 185)"/>
    </g>
  </svg>`;
}

// ---------- Cronómetro de la partida (barra bajo la cabecera) ----------
// finMs: hora local (ms) en que se acaba el tiempo. alAcabar() se llama una vez al llegar a 0.
export function relojBarra(el, finMs, { alAcabar, total } = {}) {
  let parado = false, avisado = false;
  const totalMs = (total || Math.max(1, (finMs - Date.now()) / 1000)) * 1000;
  el.hidden = false;
  document.body.classList.add('con-reloj');
  el.innerHTML = `<div class="rt-fila"><span class="rt-reloj" aria-live="off">⏱ <b data-rt></b></span><span class="rt-extra" data-rt-extra></span></div><div class="rt-barra"><div data-rt-barra></div></div>`;
  const pintar = () => {
    if (parado) return;
    const rest = Math.max(0, (finMs - Date.now()) / 1000);
    const t = el.querySelector('[data-rt]'); if (!t) return;
    t.textContent = fmtTiempo(Math.ceil(rest));
    el.querySelector('[data-rt-barra]').style.width = `${Math.min(100, rest * 1000 / totalMs * 100)}%`;
    el.classList.toggle('urgente', rest <= 10);
    if (rest <= 0 && !avisado) { avisado = true; sonar.pierde(); alAcabar && alAcabar(); }
  };
  const id = setInterval(pintar, 250); pintar();
  return {
    detener() { parado = true; clearInterval(id); },
    ocultar() { parado = true; clearInterval(id); el.hidden = true; el.innerHTML = ''; document.body.classList.remove('con-reloj'); },
    restante() { return Math.max(0, (finMs - Date.now()) / 1000); },
    extra(html) { const x = el.querySelector('[data-rt-extra]'); if (x) x.innerHTML = html; }
  };
}

// Selector de avatar sencillo (emojis). Devuelve una función que da el elegido.
export function selectorEmoji(cont, actual) {
  let elegido = AVATARES.includes(actual) ? actual : AVATARES[Math.floor(Math.random() * AVATARES.length)];
  cont.innerHTML = `<div class="avatar-grid-juego">${AVATARES.map(a => `<button type="button" data-a="${a}" aria-pressed="${a === elegido}">${a}</button>`).join('')}</div>`;
  $$('[data-a]', cont).forEach(b => b.onclick = () => { elegido = b.dataset.a; $$('[data-a]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b))); sonar.clic(); });
  return () => elegido;
}
