// ============================================================
// Proyectos en grupo: recursos de diseño (fondos, fuentes, formas, emojis, iconos y plantillas)
// Todo se guarda como identificadores o valores validados: nunca CSS ni HTML libre,
// porque las hojas también se mostrarán en los celulares de los participantes.
// ============================================================

// ---------- Fuentes (Google Fonts, legibles e infantiles) ----------
export const FUENTES = ['Baloo 2', 'Fredoka', 'Nunito', 'Poppins', 'Comic Neue', 'Patrick Hand', 'Pacifico', 'Bebas Neue', 'Merriweather',
  // para cultos y carteles
  'Montserrat', 'Anton', 'Archivo Black', 'Oswald', 'Josefin Sans', 'Cinzel', 'Cormorant Garamond', 'Playfair Display', 'DM Serif Display',
  'Caveat', 'Great Vibes', 'Press Start 2P'];
export const URL_FUENTES = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;800&family=Fredoka:wght@400;600;700&family=Nunito:wght@400;700;900' +
  '&family=Poppins:wght@400;600;800&family=Comic+Neue:wght@400;700&family=Patrick+Hand&family=Pacifico&family=Bebas+Neue&family=Merriweather:wght@400;700' +
  '&family=Montserrat:wght@300;500;700;800&family=Anton&family=Archivo+Black&family=Oswald:wght@400;500;700&family=Josefin+Sans:wght@300;600&family=Cinzel:wght@500;700' +
  '&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=Playfair+Display:ital,wght@0,600;1,600&family=DM+Serif+Display&family=Caveat:wght@600&family=Great+Vibes' +
  '&family=Press+Start+2P&display=swap';
// Más fuentes de Google Fonts (para resaltar palabras y letras de cartel): se cargan solo cuando se usan
export const FUENTES_EXTRA = ['Outfit', 'Lobster', 'Righteous', 'Bangers', 'Permanent Marker', 'Dancing Script', 'Satisfy', 'Raleway',
  'Lilita One', 'Sacramento', 'Kaushan Script', 'Fjalla One', 'Rubik', 'Quicksand', 'Abril Fatface', 'Shadows Into Light',
  // letras de cartel: burbuja, gruesas, contorno, 3D, pincel, grafiti, caligrafía y escolares
  'Rubik Bubbles', 'Luckiest Guy', 'Chewy', 'Titan One', 'Bungee', 'Bungee Shade', 'Bungee Outline', 'Bungee Inline', 'Londrina Solid',
  'Londrina Outline', 'Sniglet', 'Bowlby One', 'Sigmar One', 'Rubik Mono One', 'Black Ops One', 'Monoton', 'Shrikhand', 'Knewave',
  'Fascinate', 'Creepster', 'Rock Salt', 'Sedgwick Ave Display', 'Rubik Spray Paint', 'Rubik Wet Paint', 'Yellowtail', 'Alex Brush',
  'Allura', 'Tangerine', 'Parisienne', 'Cookie', 'Cabin Sketch', 'Fredericka the Great', 'Gochi Hand', 'Schoolbell', 'Andika',
  'Playpen Sans', 'Coiny', 'Modak', 'Rampart One', 'Train One', 'Zen Dots', 'Berkshire Swash', 'Mountains of Christmas',
  'Cinzel Decorative', 'Bubblegum Sans', 'Gluten', 'Rubik Doodle Shadow', 'Rubik Puddles', 'Bagel Fat One', 'Sour Gummy', 'Grandstander'];
// Las fuentes agrupadas para elegir (cada una está en FUENTES o en FUENTES_EXTRA)
export const GRUPOS_FUENTES = [
  ['Para leer', ['Nunito', 'Poppins', 'Montserrat', 'Raleway', 'Rubik', 'Quicksand', 'Outfit', 'Josefin Sans', 'Merriweather', 'Andika', 'Playpen Sans']],
  ['Cartel y títulos', ['Bebas Neue', 'Anton', 'Archivo Black', 'Oswald', 'Fjalla One', 'Abril Fatface', 'Bowlby One', 'Sigmar One', 'Rubik Mono One',
    'Black Ops One', 'Bungee', 'Titan One', 'Lilita One', 'Righteous', 'Zen Dots', 'Shrikhand']],
  ['Burbuja y divertidas', ['Baloo 2', 'Fredoka', 'Rubik Bubbles', 'Luckiest Guy', 'Chewy', 'Bubblegum Sans', 'Sniglet', 'Coiny', 'Modak', 'Bagel Fat One',
    'Sour Gummy', 'Grandstander', 'Gluten', 'Bangers', 'Londrina Solid', 'Knewave', 'Comic Neue']],
  ['Contorno y 3D', ['Bungee Outline', 'Bungee Inline', 'Bungee Shade', 'Londrina Outline', 'Rampart One', 'Train One', 'Monoton', 'Rubik Doodle Shadow',
    'Rubik Puddles', 'Fascinate', 'Creepster']],
  ['Pincel y grafiti', ['Permanent Marker', 'Rock Salt', 'Sedgwick Ave Display', 'Rubik Spray Paint', 'Rubik Wet Paint', 'Kaushan Script', 'Lobster',
    'Pacifico', 'Yellowtail', 'Cookie']],
  ['Caligrafía', ['Great Vibes', 'Dancing Script', 'Satisfy', 'Sacramento', 'Alex Brush', 'Allura', 'Tangerine', 'Parisienne', 'Berkshire Swash',
    'Cinzel', 'Cinzel Decorative', 'Cormorant Garamond', 'Playfair Display', 'DM Serif Display']],
  ['A mano y escolar', ['Patrick Hand', 'Caveat', 'Shadows Into Light', 'Gochi Hand', 'Schoolbell', 'Cabin Sketch', 'Fredericka the Great',
    'Mountains of Christmas', 'Press Start 2P']]
];
export function fuenteValida(f) { return FUENTES.includes(f) || FUENTES_EXTRA.includes(f) ? f : 'Nunito'; }
// Grosores que se piden de las fuentes extra que tienen varios (las demás tienen uno solo)
const PESOS_FUENTE = { Outfit: '400;500;700', Raleway: '400;500;700', Rubik: '400;500;700', Quicksand: '400;500;700', 'Dancing Script': '400;500;700',
  Andika: '400;700', 'Playpen Sans': '400;700;800', Gluten: '400;700;900', Sniglet: '400;800', 'Londrina Solid': '400;900', 'Cabin Sketch': '400;700',
  'Cinzel Decorative': '400;700;900', 'Sour Gummy': '400;700;900', Grandstander: '400;700;900' };
const familia = (f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}${PESOS_FUENTE[f] ? ':wght@' + PESOS_FUENTE[f] : ''}`;
export const urlFuente = (f) => `https://fonts.googleapis.com/css2?${familia(f)}&display=swap`;
// Carga una fuente extra (las de FUENTES ya vienen con URL_FUENTES). Devuelve una promesa que se cumple al cargar su CSS.
const cargadas = new Map();
export function cargarFuente(f) {
  if (!FUENTES_EXTRA.includes(f) || globalThis.__CULTO_SIN_RED__) return Promise.resolve();
  if (!cargadas.has(f)) cargadas.set(f, enlaceFuentes(urlFuente(f), [f]));
  return cargadas.get(f);
}
// Varias de una vez (para las listas con vista previa): un solo pedido
export function cargarFuentes(lista) {
  const faltan = [...new Set(lista)].filter(f => FUENTES_EXTRA.includes(f) && !cargadas.has(f));
  if (!faltan.length || globalThis.__CULTO_SIN_RED__) return Promise.resolve();
  const p = enlaceFuentes(`https://fonts.googleapis.com/css2?${faltan.map(familia).join('&')}&display=swap`, faltan);
  faltan.forEach(f => cargadas.set(f, p));
  return p;
}
function enlaceFuentes(href, lista) {
  return new Promise((listo) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.dataset.fuente = lista.join('|'); l.href = href;
    l.onload = l.onerror = () => listo();
    document.head.appendChild(l);
  });
}

// ---------- Letras de cartel: relleno (liso, degradado o un color por letra), contorno, sombra 3D y brillo ----------
// cartel: { relleno: [colores], porLetra, angulo, borde, grosor (em), sombra, prof (em), brillo }
// Pone el estilo en `nodo` (un texto) y devuelve los colores que se turnan por letra (o null).
export function aplicarCartel(nodo, c = {}) {
  const n = (v, d, min, max) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d; };
  const rel = (Array.isArray(c.relleno) && c.relleno.length ? c.relleno : ['#FFFFFF']).slice(0, 8).map(x => colorValido(x, '#FFFFFF'));
  let porLetra = null;
  if (c.porLetra && rel.length > 1) porLetra = rel;
  else if (rel.length > 1) {
    Object.assign(nodo.style, { backgroundImage: `linear-gradient(${n(c.angulo, 180, 0, 360)}deg, ${rel.join(', ')})`,
      webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  } else nodo.style.color = rel[0];
  if (c.borde) {
    nodo.style.webkitTextStroke = `${n(c.grosor, 0.06, 0.01, 0.3)}em ${colorValido(c.borde, '#000000')}`;
    nodo.style.paintOrder = 'stroke fill';
  }
  // sombras con filter (con text-shadow, la sombra tapa el degradado); la sombra difusa de la plantilla no se hereda
  nodo.style.textShadow = 'none';
  const f = [];
  if (c.sombra) {
    const s = colorValido(c.sombra, '#000000'), p = n(c.prof, 0.06, 0.01, 0.2), pasos = Math.max(1, Math.round(p / 0.02));
    for (let i = 0; i < Math.min(pasos, 6); i++) f.push(`drop-shadow(${(p / pasos).toFixed(3)}em ${(p / pasos).toFixed(3)}em 0 ${s})`);
  }
  if (c.brillo) f.push(`drop-shadow(0 0 0.12em ${colorValido(c.brillo, '#FFFFFF')})`);
  if (f.length) nodo.style.filter = f.join(' ');
  return porLetra;
}
// Modelos de letras coloreadas: [id, nombre, { fuente, peso?, fondo? (solo para la muestra), cartel }]
export const MODELOS_LETRA = [
  ['creativo', 'Creativo', { fuente: 'Kaushan Script', cartel: { relleno: ['#67E8F9', '#0EA5E9'], borde: '#0B1E3F', grosor: 0.05, sombra: '#0B1E3F', prof: 0.08 } }],
  ['deseos', 'Deseos', { fuente: 'Yellowtail', cartel: { relleno: ['#FFFFFF'], borde: '#1F2937', grosor: 0.05, sombra: '#A3E635', prof: 0.08 } }],
  ['colorido', 'Colorido', { fuente: 'Pacifico', cartel: { relleno: ['#F472B6', '#FB923C', '#FACC15', '#38BDF8'], angulo: 90, brillo: '#F0ABFC' } }],
  ['burbuja', 'Burbuja', { fuente: 'Rubik Bubbles', cartel: { relleno: ['#FFFFFF'], borde: '#111827', grosor: 0.05, sombra: '#111827', prof: 0.06 } }],
  ['molde', 'Molde', { fuente: 'Bebas Neue', cartel: { relleno: ['#111827'] } }],
  ['contorno', 'Contorno', { fuente: 'Londrina Outline', peso: 400, cartel: { relleno: ['#111827'] } }],
  ['pastel', 'Tarjeta pastel', { fuente: 'Fredoka', peso: 700, cartel: { relleno: ['#F9A8D4'], borde: '#DB2777', grosor: 0.04 } }],
  ['pincel', 'Pincel', { fuente: 'Rock Salt', cartel: { relleno: ['#111827'] } }],
  ['tiza', 'Tiza', { fuente: 'Fredericka the Great', fondo: '#1F3A2E', cartel: { relleno: ['#F8FAFC'], brillo: '#CBD5E1' } }],
  ['boceto', 'Lápiz', { fuente: 'Cabin Sketch', peso: 700, cartel: { relleno: ['#334155'] } }],
  ['caligrafia', 'Caligrafía', { fuente: 'Alex Brush', cartel: { relleno: ['#111827'] } }],
  ['escolar', 'Escolar', { fuente: 'Andika', peso: 700, cartel: { relleno: ['#1E293B'] } }],
  ['abecedario', 'Abecedario', { fuente: 'Fredoka', peso: 700, cartel: { relleno: ['#60A5FA', '#F87171', '#FBBF24', '#34D399', '#A78BFA', '#FB923C'], porLetra: true } }],
  ['chocolate', 'Chocolate', { fuente: 'Lilita One', cartel: { relleno: ['#B45309', '#5B2A0E'], borde: '#FDE68A', grosor: 0.04, sombra: '#3B1A08', prof: 0.06 } }],
  ['comic', 'Cómic', { fuente: 'Bangers', cartel: { relleno: ['#FDE047', '#84CC16'], borde: '#111827', grosor: 0.06, sombra: '#111827', prof: 0.08 } }],
  ['fuego', 'Fuego', { fuente: 'Luckiest Guy', cartel: { relleno: ['#FDE047', '#F97316', '#DC2626'], borde: '#111827', grosor: 0.05, sombra: '#111827', prof: 0.06 } }],
  ['neon', 'Neón', { fuente: 'Monoton', fondo: '#140F2A', cartel: { relleno: ['#F0ABFC'], brillo: '#E879F9' } }],
  ['retro', 'Retro 3D', { fuente: 'Bungee', cartel: { relleno: ['#FDE047'], sombra: '#EF4444', prof: 0.12 } }],
  ['oro', 'Oro', { fuente: 'Cinzel Decorative', peso: 700, cartel: { relleno: ['#FEF3C7', '#F59E0B', '#92400E'], sombra: '#1C1917', prof: 0.04 } }],
  ['grafiti', 'Grafiti', { fuente: 'Sedgwick Ave Display', cartel: { relleno: ['#A855F7', '#EC4899'], angulo: 90, borde: '#111827', grosor: 0.05, sombra: '#111827', prof: 0.06 } }],
  ['hielo', 'Hielo', { fuente: 'Titan One', cartel: { relleno: ['#F0F9FF', '#38BDF8'], borde: '#0C4A6E', grosor: 0.04, brillo: '#BAE6FD' } }],
  ['dulce', 'Dulce', { fuente: 'Chewy', cartel: { relleno: ['#FB7185'], borde: '#FFFFFF', grosor: 0.06, sombra: '#BE185D', prof: 0.06 } }],
  ['sello', 'Sello', { fuente: 'Bowlby One', cartel: { relleno: ['#FFFFFF'], borde: '#111827', grosor: 0.08, sombra: '#111827', prof: 0.04 } }],
  ['fiesta', 'Fiesta', { fuente: 'Sniglet', peso: 800, cartel: { relleno: ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7'], porLetra: true, borde: '#FFFFFF', grosor: 0.05, sombra: '#1F2937', prof: 0.05 } }]
];
export const modeloLetra = (id) => MODELOS_LETRA.find(m => m[0] === id)?.[2] || null;

// ---------- Colores ----------
export const COLORES = ['#FFFFFF', '#F8F7FC', '#2D2A45', '#000000', '#7C6FF0', '#6C5CE7', '#A855F7', '#EC4899', '#E14D72', '#FF6F91',
  '#FF9F43', '#FFC857', '#FDE68A', '#4CD98A', '#2FAE6C', '#14B8A6', '#38BDF8', '#2563EB', '#1E3A8A', '#8B5E3C'];
export function colorValido(c, defecto = '#FFFFFF') { return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c || '') ? c : defecto; }

// ---------- Degradados (id → ángulo y colores) ----------
export const DEGRADADOS = {
  violeta: [135, '#8B7EF7', '#6C5CE7'], atardecer: [135, '#FF9F43', '#FF6F91'], mar: [135, '#38BDF8', '#2563EB'],
  menta: [135, '#4CD98A', '#14B8A6'], chicle: [135, '#F9A8D4', '#A855F7'], sol: [135, '#FDE68A', '#FF9F43'],
  noche: [160, '#1E3A8A', '#2D2A45'], aurora: [120, '#14B8A6', '#A855F7'], fuego: [135, '#FFC857', '#E14D72'],
  cielo: [180, '#BAE6FD', '#FFFFFF'], lavanda: [135, '#EDE9FE', '#FDECF5'], bosque: [160, '#2FAE6C', '#14532D'],
  durazno: [135, '#FFE4E9', '#FFF7ED'], uva: [135, '#6C5CE7', '#EC4899'], limon: [135, '#FDE68A', '#4CD98A'],
  hielo: [135, '#F0F9FF', '#C7D2FE'], cereza: [135, '#E14D72', '#7F1D1D'], oceano: [200, '#0EA5E9', '#14B8A6'],
  arcoiris: [90, '#FF6F91', '#FFC857', '#4CD98A', '#38BDF8', '#A855F7'], pizarra: [160, '#3F4A3F', '#1F2A1F']
};
export function cssDegradado(id) {
  const d = DEGRADADOS[id] || DEGRADADOS.violeta;
  return `linear-gradient(${d[0]}deg, ${d.slice(1).join(', ')})`;
}

// ---------- Patrones (SVG/CSS generados aquí con colores validados) ----------
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
export const PATRONES = {
  puntos: { nombre: 'Puntos', base: '#EDE9FE', tinta: '#7C6FF0',
    css: (b, t) => ({ backgroundColor: b, backgroundImage: `radial-gradient(${t} 12%, transparent 13%)`, backgroundSize: '4% 7.1%' }) },
  cuadricula: { nombre: 'Cuadrícula', base: '#FFFFFF', tinta: '#BFDBFE',
    css: (b, t) => ({ backgroundColor: b, backgroundImage: `linear-gradient(${t} 1px, transparent 1px), linear-gradient(90deg, ${t} 1px, transparent 1px)`, backgroundSize: '3% 5.33%' }) },
  cuaderno: { nombre: 'Cuaderno', base: '#FFFDF5', tinta: '#93C5FD',
    css: (b, t) => ({ backgroundColor: b, backgroundImage: `linear-gradient(90deg, transparent 8%, #FCA5A5 8%, #FCA5A5 8.25%, transparent 8.25%), linear-gradient(${t} 1.5px, transparent 1.5px)`, backgroundSize: '100% 100%, 100% 7.1%' }) },
  rayas: { nombre: 'Rayas', base: '#FFF7ED', tinta: '#FFC857',
    css: (b, t) => ({ backgroundColor: b, backgroundImage: `repeating-linear-gradient(45deg, ${t} 0 2%, transparent 2% 4%)` }) },
  ondas: { nombre: 'Ondas', base: '#E0F2FE', tinta: '#38BDF8',
    css: (b, t) => ({ backgroundColor: b, backgroundSize: '12% 10%',
      backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><path d="M0 30 Q30 5 60 30 T120 30" fill="none" stroke="${t}" stroke-width="5" stroke-linecap="round"/></svg>`) }) },
  confeti: { nombre: 'Confeti', base: '#FFFFFF', tinta: '#FF6F91',
    css: (b, t) => ({ backgroundColor: b, backgroundSize: '18% 24%',
      backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><g stroke-width="4" stroke-linecap="round"><path d="M10 10l6 6" stroke="${t}"/><path d="M60 20l-5 7" stroke="#FFC857"/><path d="M30 50l7 -3" stroke="#38BDF8"/><path d="M80 60l5 6" stroke="#4CD98A"/><path d="M85 12l-6 4" stroke="#A855F7"/></g><circle cx="45" cy="70" r="3" fill="#FFC857"/><circle cx="20" cy="32" r="2.5" fill="#A855F7"/><circle cx="72" cy="40" r="3" fill="${t}"/></svg>`) }) },
  pizarra: { nombre: 'Pizarra', base: '#2F3B2F', tinta: '#3E4D3E',
    css: (b, t) => ({ backgroundColor: b, backgroundImage: `radial-gradient(ellipse at 30% 20%, ${t} 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, ${t} 0%, transparent 50%)`, boxShadow: 'inset 0 0 0 1.6cqw #8B5E3C' }) },
  espacio: { nombre: 'Espacio', base: '#0F172A', tinta: '#FFFFFF',
    css: (b, t) => ({ backgroundColor: b, backgroundSize: '22% 30%',
      backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><g fill="${t}"><circle cx="8" cy="10" r="1"/><circle cx="40" cy="25" r="1.6"/><circle cx="75" cy="8" r="0.8"/><circle cx="62" cy="50" r="1.2"/><circle cx="20" cy="58" r="0.9"/><circle cx="90" cy="40" r="1.4"/></g></svg>`) + ', radial-gradient(circle at 75% 30%, #312E81 0%, transparent 55%)' }) },
  zigzag: { nombre: 'Zigzag', base: '#FDF2F8', tinta: '#F9A8D4',
    css: (b, t) => ({ backgroundColor: b, backgroundSize: '6% 10.6%',
      backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M0 25 L10 15 L20 25 L30 15 L40 25" fill="none" stroke="${t}" stroke-width="4"/></svg>`) }) },
  corazones: { nombre: 'Corazones', base: '#FFE4E9', tinta: '#FF6F91',
    css: (b, t) => ({ backgroundColor: b, backgroundSize: '8% 14.2%',
      backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 30 C10 22 6 17 9 12 C12 8 17 9 20 13 C23 9 28 8 31 12 C34 17 30 22 20 30 Z" fill="${t}" opacity=".55"/></svg>`) }) }
};

// Fondo de una hoja → estilos CSS. f = { tipo: 'color'|'degradado'|'patron'|'imagen', valor, color, tinta }
export function estiloFondo(f = {}) {
  if (f.tipo === 'degradado') return { backgroundImage: cssDegradado(f.valor) };
  if (f.tipo === 'patron' && PATRONES[f.valor]) {
    const p = PATRONES[f.valor];
    return p.css(colorValido(f.color, p.base), colorValido(f.tinta, p.tinta));
  }
  if (f.tipo === 'imagen' && urlSegura(f.valor)) {
    return { backgroundColor: colorValido(f.color, '#2D2A45'), backgroundImage: `url("${f.valor}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundColor: colorValido(f.valor, '#FFFFFF') };
}

// Solo https sin caracteres que puedan romper un atributo o un url() de CSS.
// En un culto descargado (js/cultos/sin-red.js) las imágenes y videos van dentro del archivo y se abren como blob:
export function urlSegura(u) {
  if (typeof u !== 'string' || u.length >= 2000) return false;
  return /^https:\/\/[^\s"'()<>\\]+$/.test(u) || (!!globalThis.__CULTO_SIN_RED__ && /^blob:[^\s"'()<>\\]+$/.test(u));
}

// ---------- Formas (viewBox 0 0 100 100, se estiran al tamaño del elemento) ----------
export const FORMAS = {
  rect: { nombre: 'Rectángulo', svg: '<rect x="2" y="2" width="96" height="96"/>' },
  redondeado: { nombre: 'Redondeado', svg: '<rect x="2" y="2" width="96" height="96" rx="16" ry="16"/>' },
  circulo: { nombre: 'Círculo', svg: '<ellipse cx="50" cy="50" rx="48" ry="48"/>' },
  triangulo: { nombre: 'Triángulo', svg: '<polygon points="50,3 97,97 3,97"/>' },
  estrella: { nombre: 'Estrella', svg: '<polygon points="50,3 61,37 97,37 68,59 79,95 50,73 21,95 32,59 3,37 39,37"/>' },
  flecha: { nombre: 'Flecha', svg: '<polygon points="2,32 62,32 62,6 98,50 62,94 62,68 2,68"/>' },
  globo: { nombre: 'Globo de diálogo', svg: '<path d="M10 4 H90 Q97 4 97 11 V62 Q97 69 90 69 H40 L20 95 L24 69 H10 Q3 69 3 62 V11 Q3 4 10 4 Z"/>' },
  corazon: { nombre: 'Corazón', svg: '<path d="M50 92 C20 70 3 52 3 30 C3 13 16 4 29 4 C39 4 46 10 50 18 C54 10 61 4 71 4 C84 4 97 13 97 30 C97 52 80 70 50 92 Z"/>' }
};

// ---------- Emojis por categoría ----------
export const EMOJIS = {
  'Caras': '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🤓 🧐 🤔 🤗 🤭 😮 😲 🥳 😴 😢 😭 😤 😡 🤯 😱 🥺 🙄'.split(' '),
  'Gestos': '👍 👎 👏 🙌 👐 🤝 🙏 ✌️ 🤞 🤟 👌 👋 ✋ 💪 👀 🧠 ❤️ 🧡 💛 💚 💙 💜 🤍 💯 ✨ ⭐ 🌟 💡 🔥 ⚡'.split(' '),
  'Escuela': '📚 📖 📝 ✏️ 🖍️ 🖊️ 📏 📐 🎒 🏫 🎓 🧮 🔬 🔭 🧪 🧫 🌍 🗺️ 💻 🖥️ 📱 🎨 🎭 🎵 🎤 🎧 🏆 🥇 🎯 🧩'.split(' '),
  'Animales': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦉 🦋 🐢 🐍 🐙 🐬 🐳 🦈 🦒 🐘 🦓 🦄'.split(' '),
  'Naturaleza': '🌳 🌲 🌴 🌵 🌷 🌹 🌻 🌼 🍀 🍁 🍄 🌈 ☀️ 🌤️ ⛅ 🌧️ ❄️ 🌙 ⭐ 🌊 🔥 🌋 ⛰️ 🏝️ 🌎 🪐 ☄️ 🌸 🌺 🍃'.split(' '),
  'Comida': '🍎 🍌 🍇 🍓 🍉 🍊 🍍 🥭 🥑 🥕 🌽 🍞 🧀 🍕 🍔 🌭 🍟 🍿 🍩 🍪 🎂 🍰 🍫 🍬 🍭 🥛 🧃 ☕ 🍯 🥗'.split(' '),
  'Objetos': '🎉 🎊 🎈 🎁 🏅 ⚽ 🏀 🏐 🎲 🎮 🚀 ✈️ 🚗 🚲 🏠 ⛪ ✝️ 🕊️ ⏰ ⌛ 🔔 📣 💬 💭 ❓ ❗ ✅ ❌ ➡️ ⬅️'.split(' '),
  'Personas': '👶 🧒 👧 👦 👩 👨 🧑 👵 👴 👩‍🏫 👨‍🏫 🧑‍🎓 👩‍🔬 👨‍🔬 👩‍⚕️ 👮 🧑‍🚀 🦸 🧙 👪 👨‍👩‍👧‍👦 🤸 🏃 💃 🕺 🙋 🙆 🤷 🧘 👫'.split(' ')
};

// ---------- Iconos (Lucide, licencia ISC/MIT, se carga solo al abrir el panel) ----------
const URL_LUCIDE = 'https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js';
let promesaLucide = null;
export function cargarIconos() {
  if (window.lucide?.icons) return Promise.resolve(window.lucide.icons);
  if (!promesaLucide) promesaLucide = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = URL_LUCIDE; s.async = true;
    s.onload = () => window.lucide?.icons ? ok(window.lucide.icons) : mal(new Error('No se pudieron cargar los iconos'));
    s.onerror = () => { promesaLucide = null; mal(new Error('No se pudieron cargar los iconos. Revisa tu conexión.')); };
    document.head.appendChild(s);
  });
  return promesaLucide;
}
// Solo las etiquetas y atributos geométricos que usan los iconos
const TAGS_ICONO = ['path', 'circle', 'rect', 'polyline', 'line', 'polygon', 'ellipse'];
const ATTRS_ICONO = ['d', 'cx', 'cy', 'r', 'width', 'height', 'x', 'y', 'rx', 'ry', 'points', 'x1', 'x2', 'y1', 'y2', 'fill'];
export function nodosIcono(icono) {
  const hijos = Array.isArray(icono) && icono[0] === 'svg' ? icono[2] : icono;
  return limpiarNodos(hijos);
}
export function limpiarNodos(nodos) {
  if (!Array.isArray(nodos)) return [];
  return nodos.filter(n => Array.isArray(n) && TAGS_ICONO.includes(n[0]) && n[1] && typeof n[1] === 'object').slice(0, 40)
    .map(([t, a]) => [t, Object.fromEntries(Object.entries(a).filter(([k, v]) => ATTRS_ICONO.includes(k) && /^[\w\s.,#%-]*$/.test(String(v)) && String(v).length < 4000)
      .map(([k, v]) => [k, k === 'fill' && v !== 'none' ? 'currentColor' : String(v)]))]);
}
// Búsqueda en español: palabras comunes → nombres de Lucide
export const ICONOS_ES = {
  estrella: 'Star', corazon: 'Heart', casa: 'House', libro: 'BookOpen', lapiz: 'Pencil', escuela: 'School', graduacion: 'GraduationCap',
  persona: 'User', personas: 'Users', grupo: 'Users', reloj: 'Clock', calendario: 'Calendar', camara: 'Camera', musica: 'Music',
  sol: 'Sun', luna: 'Moon', nube: 'Cloud', lluvia: 'CloudRain', arbol: 'TreePine', flor: 'Flower2', hoja: 'Leaf', fuego: 'Flame',
  rayo: 'Zap', idea: 'Lightbulb', foco: 'Lightbulb', cohete: 'Rocket', mundo: 'Globe', mapa: 'Map', ubicacion: 'MapPin',
  trofeo: 'Trophy', medalla: 'Medal', premio: 'Award', regalo: 'Gift', fiesta: 'PartyPopper', check: 'Check', correcto: 'CircleCheck',
  error: 'CircleX', pregunta: 'CircleHelp', alerta: 'TriangleAlert', info: 'Info', flecha: 'ArrowRight', derecha: 'ArrowRight',
  izquierda: 'ArrowLeft', arriba: 'ArrowUp', abajo: 'ArrowDown', mano: 'Hand', pulgar: 'ThumbsUp', mensaje: 'MessageCircle',
  chat: 'MessagesSquare', correo: 'Mail', telefono: 'Phone', celular: 'Smartphone', computadora: 'Monitor', laptop: 'Laptop',
  video: 'Video', imagen: 'Image', microfono: 'Mic', altavoz: 'Volume2', candado: 'Lock', llave: 'Key', buscar: 'Search',
  lupa: 'Search', configuracion: 'Settings', herramienta: 'Wrench', ciencia: 'FlaskConical', matematica: 'Calculator',
  calculadora: 'Calculator', atomo: 'Atom', planeta: 'Orbit', animal: 'PawPrint', perro: 'Dog', gato: 'Cat', pez: 'Fish',
  pajaro: 'Bird', manzana: 'Apple', cafe: 'Coffee', pelota: 'Volleyball', juego: 'Gamepad2', dado: 'Dices', rompecabezas: 'Puzzle',
  bandera: 'Flag', diana: 'Target', objetivo: 'Target', grafico: 'ChartColumn', lista: 'List', cruz: 'Cross', iglesia: 'Church',
  biblia: 'BookHeart', paz: 'Bird', sonrisa: 'Smile', feliz: 'Smile', triste: 'Frown', brillo: 'Sparkles', magia: 'WandSparkles'
};
export const ICONOS_POPULARES = ['Star', 'Heart', 'Lightbulb', 'BookOpen', 'GraduationCap', 'Users', 'Trophy', 'Rocket', 'Globe', 'Sun',
  'Moon', 'Cloud', 'Flame', 'Zap', 'Smile', 'ThumbsUp', 'CircleCheck', 'CircleX', 'CircleHelp', 'MessageCircle', 'Music', 'Camera',
  'Puzzle', 'Target', 'Flag', 'Gift', 'PartyPopper', 'Sparkles', 'ArrowRight', 'Clock', 'Calculator', 'FlaskConical', 'Atom',
  'PawPrint', 'TreePine', 'Apple', 'Pencil', 'Search', 'MapPin', 'Church'];

// ---------- Plantillas (aplican fondo, colores y fuentes; si la hoja está vacía, también sus textos) ----------
// Posiciones en % del lienzo 16:9; tam = tamaño de letra en % del ancho del lienzo.
const T = (texto, y, h, tam, extra = {}) => ({ tipo: 'texto', texto, x: 8, y, w: 84, h, rot: 0, tam, alinear: 'center', ...extra });
export const PLANTILLAS = {
  portada: { nombre: 'Portada', fondo: { tipo: 'degradado', valor: 'violeta' }, fuente: 'Baloo 2', color: '#FFFFFF',
    elementos: [T('Título del proyecto', 30, 22, 7, { negrita: true }), T('Subtítulo o nombre del curso', 54, 12, 3)] },
  pregunta: { nombre: 'Pregunta colorida', fondo: { tipo: 'degradado', valor: 'atardecer' }, fuente: 'Fredoka', color: '#FFFFFF',
    elementos: [T('¿Qué sabes sobre…?', 32, 30, 6.5, { negrita: true }), { tipo: 'emoji', emoji: '🤔', x: 44, y: 66, w: 12, h: 22, rot: 0 }] },
  bienvenida: { nombre: 'Bienvenida', fondo: { tipo: 'patron', valor: 'confeti' }, fuente: 'Baloo 2', color: '#6C5CE7',
    elementos: [T('¡Bienvenidos!', 28, 24, 8, { negrita: true }), T('Hoy vamos a aprender juntos', 54, 12, 3.2, { color: '#2D2A45' })] },
  cierre: { nombre: 'Cierre / Gracias', fondo: { tipo: 'degradado', valor: 'noche' }, fuente: 'Pacifico', color: '#FDE68A',
    elementos: [T('¡Gracias!', 30, 28, 9), T('Nos vemos en la próxima clase', 60, 10, 2.8, { fuente: 'Nunito', color: '#FFFFFF' })] },
  equipos: { nombre: 'Equipos', fondo: { tipo: 'degradado', valor: 'menta' }, fuente: 'Fredoka', color: '#FFFFFF',
    elementos: [T('Formemos equipos', 12, 16, 5.5, { negrita: true }), { tipo: 'emoji', emoji: '🤝', x: 41, y: 40, w: 18, h: 32, rot: 0 }] },
  pizarra: { nombre: 'Pizarra', fondo: { tipo: 'patron', valor: 'pizarra' }, fuente: 'Patrick Hand', color: '#FFFFFF',
    elementos: [T('Tema del día', 14, 16, 6), T('Escribe aquí las ideas principales', 40, 40, 3.4, { alinear: 'left' })] },
  cuaderno: { nombre: 'Cuaderno', fondo: { tipo: 'patron', valor: 'cuaderno' }, fuente: 'Comic Neue', color: '#1E3A8A',
    elementos: [T('Apuntes', 8, 14, 5, { negrita: true, alinear: 'left', x: 12, w: 80 }), T('• Idea 1\n• Idea 2\n• Idea 3', 26, 50, 3.4, { alinear: 'left', x: 12, w: 80 })] },
  espacio: { nombre: 'Espacio', fondo: { tipo: 'patron', valor: 'espacio' }, fuente: 'Bebas Neue', color: '#FFFFFF',
    elementos: [T('MISIÓN DEL DÍA', 30, 22, 8), { tipo: 'emoji', emoji: '🚀', x: 78, y: 60, w: 14, h: 26, rot: 20 }] },
  biblia: { nombre: 'Versículo', fondo: { tipo: 'degradado', valor: 'cielo' }, fuente: 'Merriweather', color: '#1E3A8A',
    elementos: [T('“Texto del versículo”', 28, 30, 4.4, { cursiva: true }), T('Libro 1:1', 62, 10, 2.6, { negrita: true })] }
};
