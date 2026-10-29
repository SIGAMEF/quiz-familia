// ============================================================
// Objetos animados (stickers): ilustraciones SVG de diseño propio, emojis y frases.
// Todo se dibuja con código: no se descarga nada ni se guarda en Supabase.
// En las hojas se guarda solo el identificador (obj: 'cruz'); el SVG sale siempre de aquí,
// así nunca se pinta HTML que venga de los datos.
// ============================================================

const TAU = Math.PI * 2;
const rayosSVG = (n, color, r1, r2, ancho = 3) => Array.from({ length: n }, (_, i) => {
  const a = i / n * TAU;
  return `<line x1="${(50 + Math.cos(a) * r1).toFixed(1)}" y1="${(50 + Math.sin(a) * r1).toFixed(1)}" x2="${(50 + Math.cos(a) * r2).toFixed(1)}" y2="${(50 + Math.sin(a) * r2).toFixed(1)}" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round"/>`;
}).join('');
const estrellaPts = (n, r1, r2) => Array.from({ length: n * 2 }, (_, i) => {
  const a = i / (n * 2) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1;
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

// viewBox: proporción de cada dibujo (ancho/alto) para insertarlo sin deformar
export const SVG = {
  cruz: { nombre: 'Cruz radiante', prop: 1, svg: `<svg viewBox="0 0 100 100"><g class="giro-lento" opacity=".7">${rayosSVG(16, '#fde68a', 30, 48, 2.5)}</g><rect x="44" y="16" width="12" height="70" rx="2" fill="#fff"/><rect x="27" y="34" width="46" height="12" rx="2" fill="#fff"/></svg>` },
  corazon: { nombre: 'Corazón', prop: 1, svg: '<svg viewBox="0 0 100 100"><path d="M50 86C20 64 8 46 8 31 8 18 18 9 30 9c9 0 16 5 20 12 4-7 11-12 20-12 12 0 22 9 22 22 0 15-12 33-42 55z" fill="#f43f5e"/><path d="M26 24c-6 2-9 8-8 14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/></svg>' },
  estrella: { nombre: 'Estrella', prop: 1, svg: `<svg viewBox="0 0 100 100"><polygon points="${estrellaPts(5, 46, 20)}" fill="#facc15" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round"/></svg>` },
  nota: { nombre: 'Nota musical', prop: 1, svg: '<svg viewBox="0 0 100 100"><path d="M36 26l44-10v52a11 9 0 1 1-6-8V30L42 37v38a11 9 0 1 1-6-8z" fill="#a78bfa"/></svg>' },
  sol: { nombre: 'Sol', prop: 1, svg: `<svg viewBox="0 0 100 100"><g class="giro-lento">${rayosSVG(12, '#fbbf24', 32, 46, 6)}</g><circle cx="50" cy="50" r="24" fill="#fcd34d"/></svg>` },
  chispa: { nombre: 'Destello', prop: 1, svg: '<svg viewBox="0 0 100 100"><path d="M50 4c4 34 12 42 46 46-34 4-42 12-46 46-4-34-12-42-46-46 34-4 42-12 46-46z" fill="#fef9c3"/></svg>' },
  hoy: { nombre: 'Sello HOY', prop: 1, svg: `<svg viewBox="0 0 100 100"><polygon points="${estrellaPts(14, 48, 42)}" fill="#ef4444"/><circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/><text x="50" y="60" text-anchor="middle" font-size="28" fill="#fff" class="sello-txt">HOY</text></svg>` },
  nuevo: { nombre: 'Cinta NUEVO', prop: 2.4, svg: '<svg viewBox="0 0 120 50"><path d="M4 8h112l-10 17 10 17H4l10-17z" fill="#22d3ee"/><text x="60" y="33" text-anchor="middle" font-size="19" fill="#0b0420" class="sello-txt" letter-spacing="2">NUEVO</text></svg>' },
  corona: { nombre: 'Corona', prop: 1, svg: '<svg viewBox="0 0 100 100"><path d="M14 70l6-40 18 20 12-28 12 28 18-20 6 40z" fill="#fbbf24" stroke="#d97706" stroke-width="3" stroke-linejoin="round"/><rect x="14" y="70" width="72" height="12" rx="3" fill="#f59e0b"/><circle cx="50" cy="56" r="5" fill="#ef4444"/></svg>' },
  llama: { nombre: 'Llama', prop: 1, svg: '<svg viewBox="0 0 100 100"><defs><linearGradient id="gLl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#dc2626"/><stop offset=".6" stop-color="#f97316"/><stop offset="1" stop-color="#fde047"/></linearGradient></defs><path d="M50 6c12 22 30 32 28 56-2 20-16 30-28 30S24 82 22 62c-1-14 10-22 14-34 4 12 10 16 14 18 2-12 0-26 0-40z" fill="url(#gLl)"/></svg>' },
  amen: { nombre: 'Globo ¡Amén!', prop: 1.5, svg: '<svg viewBox="0 0 120 80"><path d="M10 6h100a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H40l-18 16 4-16H10a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill="#fff"/><text x="60" y="41" text-anchor="middle" font-size="22" fill="#4c1d95" class="sello-txt">¡AMÉN!</text></svg>' },
  flecha: { nombre: 'Flecha', prop: 1.67, svg: '<svg viewBox="0 0 100 60"><path d="M6 30h70M58 10l22 20-22 20" stroke="#f472b6" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  paloma: { nombre: 'Paloma', prop: 1.3, svg: '<svg viewBox="0 0 130 100"><path d="M10 58c18-4 30-14 40-30 6 14 4 26-2 34 14-2 30-10 44-26 2 22-10 40-32 48l14 10c-14 2-28-2-38-10-10 2-20-2-26-10z" fill="#fff"/><circle cx="96" cy="40" r="2.6" fill="#1e293b"/><path d="M104 42l14-4-12 9z" fill="#fbbf24"/></svg>' },
  biblia: { nombre: 'Biblia', prop: 1.25, svg: '<svg viewBox="0 0 125 100"><path d="M8 18c18-6 36-6 54 4v70c-18-10-36-10-54-4z" fill="#fef3c7" stroke="#92400e" stroke-width="3"/><path d="M117 18c-18-6-36-6-55 4v70c19-10 37-10 55-4z" fill="#fde68a" stroke="#92400e" stroke-width="3"/><rect x="84" y="34" width="6" height="26" fill="#b91c1c"/><rect x="77" y="41" width="20" height="6" fill="#b91c1c"/></svg>' }
};

// Animaciones para cualquier elemento (las de texto también sirven en objetos)
export const ANIMACIONES = {
  ninguna: 'Ninguna', flotar: 'Flotar', rebotar: 'Rebotar', girar: 'Girar', latir: 'Latir', balancear: 'Balancear',
  subir: 'Subir', brillo: 'Brillo', pop: 'Pop'
};
export const ANIMACIONES_TEXTO = { aparecer: 'Aparecer', escribir: 'Máquina de escribir', marquesina: 'Marquesina', chat: 'Burbuja de chat' };
export const VELOCIDADES = { lenta: 1.8, normal: 1, rapida: 0.55 };   // multiplica la duración base
export const DURACION = { flotar: 4, rebotar: 1.8, girar: 8, latir: 1.5, balancear: 2.4, subir: 7, brillo: 2, pop: 2.2, aparecer: 1.2, escribir: 3, marquesina: 16, chat: 9 };

// Catálogo del panel "Objetos": [id, nombre, cat, animación, segundos, palabras para buscar]
const ilus = [['cruz', 'flotar', 4, 'cruz luz jesus'], ['corazon', 'latir', 1.5, 'amor'], ['estrella', 'girar', 8, ''], ['nota', 'balancear', 2.5, 'musica cancion'],
  ['sol', 'flotar', 4, 'luz dia'], ['chispa', 'brillo', 2, 'brillo luz'], ['hoy', 'pop', 2, 'sello evento'], ['nuevo', 'flotar', 4, 'cinta'],
  ['corona', 'flotar', 4, 'rey'], ['llama', 'latir', 1.6, 'fuego espiritu'], ['amen', 'pop', 2.4, 'globo dialogo'], ['flecha', 'rebotar', 1.8, ''],
  ['paloma', 'flotar', 3, 'espiritu paz'], ['biblia', 'flotar', 4, 'palabra libro']];
const emos = [['🙌', 'Manos arriba', 'rebotar', 1.6], ['🔥', 'Fuego', 'latir', 1.4], ['🎉', 'Fiesta', 'balancear', 2], ['🙏', 'Oración', 'flotar', 4],
  ['🕊️', 'Paloma', 'flotar', 3], ['✨', 'Brillos', 'brillo', 2], ['🎶', 'Música', 'balancear', 2.2], ['❤️', 'Amor', 'latir', 1.5],
  ['😇', 'Ángel', 'flotar', 4], ['📖', 'Biblia', 'flotar', 4], ['🎸', 'Guitarra', 'balancear', 2.6], ['🎤', 'Micrófono', 'balancear', 2.6],
  ['📣', 'Anuncio', 'latir', 1.8], ['🌟', 'Estrella brillante', 'girar', 6], ['🎂', 'Cumpleaños', 'rebotar', 2], ['⛺', 'Campamento', 'flotar', 4],
  ['✝️', 'Cruz', 'flotar', 4], ['⛪', 'Iglesia', 'flotar', 4], ['🌈', 'Arcoíris', 'flotar', 5], ['😄', 'Feliz', 'balancear', 2.4],
  ['🎮', 'Juegos', 'flotar', 4], ['⭐', 'Estrella', 'girar', 6], ['💡', 'Idea', 'brillo', 2], ['🎁', 'Regalo', 'rebotar', 1.8]];
// Frases: texto con caja (se agregan como texto animado y se pueden editar)
export const FRASES = [
  { nombre: '¡Bienvenido!', el: { texto: '¡Bienvenido! 🙌', fuente: 'Montserrat', peso: 800, color: '#111111', fondoCaja: '#FACC15', redondo: true, rot: -4, anim: 'pop', dur: 2.4, w: 34, h: 12, tam: 3.6 } },
  { nombre: 'Dios te bendiga', el: { texto: 'Dios te bendiga ✨', fuente: 'Caveat', color: '#FDE68A', anim: 'flotar', w: 44, h: 14, tam: 5.4 } },
  { nombre: '¡Amén!', el: { texto: '¡AMÉN!', fuente: 'Anton', color: '#FFFFFF', fondoCaja: '#7C3AED', redondo: true, anim: 'latir', dur: 1.8, w: 22, h: 12, tam: 4.4, espaciado: 0.08 } },
  { nombre: 'Gloria a Dios', el: { texto: 'Gloria a Dios', fuente: 'Great Vibes', color: '#FFF7E6', anim: 'aparecer', w: 50, h: 16, tam: 7, efecto: { tipo: 'brillo', color: '#FFD68C' } } },
  { nombre: 'Te esperamos', el: { texto: 'TE ESPERAMOS', fuente: 'Bebas Neue', color: '#FFFFFF', fondoCaja: '#EC4899', anim: 'marquesina', w: 60, h: 9, tam: 4, espaciado: 0.1 } },
  { nombre: 'Escribiendo…', el: { texto: 'Hoy Dios tiene algo para ti', fuente: 'Montserrat', peso: 700, color: '#FFFFFF', anim: 'escribir', w: 60, h: 10, tam: 3.4 } }
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const CATALOGO = [
  ...ilus.map(([id, anim, dur, extra]) => ({ cat: 'ilustracion', nombre: SVG[id].nombre, buscar: norm(`${SVG[id].nombre} ${extra}`),
    el: { tipo: 'objeto', obj: id, anim, dur }, prop: SVG[id].prop })),
  ...emos.map(([e, nombre, anim, dur]) => ({ cat: 'emoji', nombre, buscar: norm(nombre), el: { tipo: 'emoji', emoji: e, anim, dur }, prop: 1 })),
  ...FRASES.map(f => ({ cat: 'frase', nombre: f.nombre, buscar: norm(f.nombre + ' ' + f.el.texto), el: { tipo: 'texto', alinear: 'center', ...f.el } })),
  // Barra de búsqueda (diseño propio, sin marcas): el texto se escribe solo con un cursor que parpadea
  { cat: 'ilustracion', nombre: 'Barra de búsqueda', buscar: norm('barra de busqueda buscador escribir lupa'), prop: 6,
    el: { tipo: 'busqueda', texto: 'en busca de…', dur: 3 } },
  { cat: 'ilustracion', nombre: 'Búsqueda + palabra', buscar: norm('barra de busqueda buscador dios palabra multicolor'),
    grupo: [
      { tipo: 'busqueda', texto: 'en busca de…', dur: 3, x: 22, y: 22, w: 56, h: 16.6, rot: 0 },
      { tipo: 'texto', texto: 'DIOS', x: 20, y: 44, w: 60, h: 32, rot: 0, tam: 14, fuente: 'Poppins', peso: 500, alinear: 'center', color: '#4285F4',
        efecto: { tipo: 'multicolor', paleta: 'buscador' }, anim: 'latir', dur: 1.5, retraso: 3.4 }
    ] }
];
export const buscarObjetos = (cat, q) => CATALOGO.filter(o => (!cat || o.cat === cat) && (!q || norm(q).split(/\s+/).every(k => o.buscar.includes(k))));

// Emojis sugeridos para la "lluvia"
export const EMOJIS_LLUVIA = ['🔥', '🙌', '✨', '❤️', '🎶', '🙏', '🕊️', '⭐', '🎉', '😇', '💜', '🌟'];
