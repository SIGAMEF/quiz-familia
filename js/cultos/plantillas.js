// ============================================================
// Plantillas de culto prediseñadas (en el código, no en Supabase)
// Cada plantilla es una hoja del lienzo de Proyectos: fondo + elementos editables.
// el.en = 'portada' → solo en la portada (títulos, avisos); el.en = 'letra' → solo con letra
// (la zona de la letra, vinculo 'letra', y el pie, vinculo 'pie'); sin "en" → en las dos.
// Posiciones en % del lienzo 16:9; tam = letra en cqw (% del ancho), igual que en Proyectos.
// ============================================================

// Texto
const T = (texto, x, y, w, h, tam, extra = {}) => ({ tipo: 'texto', texto, x, y, w, h, rot: 0, tam, alinear: 'center', ...extra });
const portada = (texto, x, y, w, h, tam, extra = {}) => T(texto, x, y, w, h, tam, { en: 'portada', ...extra });
// Rótulo pequeño en mayúsculas ("TIEMPO DE ADORACIÓN")
const rotulo = (texto, y, extra = {}) => portada(texto, 10, y, 80, 5, 1.5, { fuente: 'Montserrat', peso: 700, espaciado: 0.45, mayus: true, opacidad: 0.9, ...extra });
const cita = (texto, y, extra = {}) => portada(texto, 10, y, 80, 5, 1.6, { fuente: 'Josefin Sans', peso: 600, espaciado: 0.3, mayus: true, opacidad: 0.85, ...extra });
// Zona de la letra y pie "Canción · Estrofa"
const letra = (extra = {}) => ({ tipo: 'texto', vinculo: 'letra', en: 'letra', texto: '', x: 7, y: 11, w: 86, h: 72, rot: 0, tam: 5.4, alinear: 'center', interlineado: 1.28, ...extra });
const pie = (extra = {}) => ({ tipo: 'texto', vinculo: 'pie', en: 'letra', texto: '', x: 10, y: 89, w: 80, h: 5, rot: 0, tam: 1.2, alinear: 'center',
  fuente: 'Montserrat', peso: 500, espaciado: 0.35, mayus: true, opacidad: 0.55, ...extra });
const emoji = (e, x, y, tamCqw, anim, dur, extra = {}) => ({ tipo: 'emoji', emoji: e, x, y, w: tamCqw * 1.2, h: tamCqw * 1.2 * 16 / 9, rot: 0, anim, dur, ...extra });
const objeto = (obj, x, y, wCqw, anim, dur, prop = 1, extra = {}) => ({ tipo: 'objeto', obj, x, y, w: wCqw, h: wCqw / prop * 16 / 9, rot: 0, anim, dur, ...extra });
const animado = (valor, p) => ({ tipo: 'animado', valor, ...(p ? { p } : {}) });

// Una polaroid: marco blanco, foto de color con un emoji y el texto escrito a mano (todo flota junto)
const polaroid = (x, y, rot, color, e, texto, retraso) => {
  const a = { anim: 'flotar', dur: 6, retraso, en: 'portada' };
  return [
    { tipo: 'forma', forma: 'rect', relleno: '#FFFFFF', x, y, w: 17, h: 36, rot, ...a },
    { tipo: 'forma', forma: 'rect', relleno: color, x: x + 1, y: y + 1.6, w: 15, h: 26.5, rot, ...a },
    { tipo: 'emoji', emoji: e, x: x + 3.5, y: y + 6, w: 10, h: 17, rot, ...a },
    T(texto, x, y + 28.6, 17, 6, 2.2, { fuente: 'Caveat', color: '#333333', rot, ...a })
  ];
};

export const PLANTILLAS = [
  { id: 'bienvenida', nombre: 'Bienvenida', categoria: 'Bienvenida', fondo: animado('aurora'), elementos: [
    rotulo('Domingo · 10:00 a. m.', 17, { color: '#FFFFFF' }),
    portada('Bienvenidos', 10, 23, 80, 22, 10, { fuente: 'Great Vibes', color: '#A7F3D0', sombra: true }),
    portada('A CASA', 10, 44, 80, 17, 8.5, { fuente: 'Anton', color: '#FFFFFF', espaciado: 0.14 }),
    portada('Qué bueno que estás aquí', 10, 64, 80, 6, 1.8, { fuente: 'Montserrat', peso: 500, color: '#FFFFFF', opacidad: 0.85 }),
    letra({ fuente: 'Montserrat', peso: 800, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'adoracion', nombre: 'Adoración', categoria: 'Adoración', fondo: animado('rayos'), elementos: [
    rotulo('— Tiempo de adoración —', 24, { color: '#FFF7E6' }),
    portada('Santo eres tú', 8, 32, 84, 22, 10, { fuente: 'Cormorant Garamond', cursiva: true, peso: 500, color: '#FFF7E6', efecto: { tipo: 'brillo', color: '#C9A15A' } }),
    portada('— Levantemos nuestra voz —', 10, 58, 80, 7, 2.4, { fuente: 'Cormorant Garamond', peso: 500, color: '#FFF7E6' }),
    letra({ fuente: 'Cormorant Garamond', peso: 500, tam: 6.2, color: '#FFF7E6', efecto: { tipo: 'brillo', color: '#8A6A2E' } }), pie({ color: '#FFF7E6' })] },
  { id: 'alabanza', nombre: 'Celebración', categoria: 'Alabanza', fondo: animado('confeti'), elementos: [
    portada('¡Celebremos!', 3, 28, 94, 24, 9.6, { fuente: 'Archivo Black', mayus: true, color: '#FFFFFF', interlineado: 0.95, efecto: { tipo: 'solida', color: '#7C2D92' } }),
    portada('alabanza y gratitud', 20, 55, 60, 12, 5, { fuente: 'Caveat', color: '#FFF3B0', rot: -3 }),
    letra({ fuente: 'Archivo Black', tam: 5, color: '#FFFFFF', efecto: { tipo: 'solida', color: '#7C2D92' } }), pie({ color: '#FFFFFF' })] },
  { id: 'juvenil', nombre: 'Noche de jóvenes', categoria: 'Juvenil', fondo: animado('neon'), elementos: [
    portada('Viernes · 7:30 p. m.', 9, 11, 27, 6, 1.5, { fuente: 'Montserrat', peso: 700, espaciado: 0.25, mayus: true, color: '#0B0420', fondoCaja: '#22D3EE' }),
    portada('NOCHE DE\nJÓVENES', 9, 19, 72, 46, 15, { fuente: 'Bebas Neue', alinear: 'left', interlineado: 0.82, color: '#FFFFFF', efecto: { tipo: 'degradado', color: '#22D3EE', color2: '#FB7185' } }),
    portada('Trae a un amigo', 9, 66, 60, 6, 2, { fuente: 'Montserrat', peso: 800, espaciado: 0.2, mayus: true, alinear: 'left', color: '#FFFFFF' }),
    letra({ fuente: 'Bebas Neue', tam: 7.4, espaciado: 0.03, interlineado: 1.05, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'palabra', nombre: 'Palabra', categoria: 'Versículo', fondo: animado('estrellas'), elementos: [
    portada('“', 9, 6, 14, 30, 16, { fuente: 'DM Serif Display', color: '#C4B5FD', opacidad: 0.5 }),
    portada('Jehová es mi pastor; nada me faltará.', 15, 24, 70, 36, 6.6, { fuente: 'DM Serif Display', color: '#F4F1FF', interlineado: 1.12 }),
    cita('Salmo 23:1 · RV1909', 64, { color: '#F4F1FF' }),
    letra({ fuente: 'DM Serif Display', tam: 5.6, color: '#F4F1FF' }), pie({ color: '#F4F1FF' })] },
  { id: 'oracion', nombre: 'Oración', categoria: 'Oración', fondo: animado('nubes'), elementos: [
    rotulo('Momento de oración', 30, { color: '#1E293B' }),
    portada('orad sin cesar', 8, 37, 84, 18, 8.2, { fuente: 'Josefin Sans', peso: 300, espaciado: 0.06, color: '#1E293B' }),
    cita('1 Tesalonicenses 5:17', 59, { color: '#1E293B' }),
    letra({ fuente: 'Josefin Sans', peso: 600, color: '#1E293B' }), pie({ color: '#1E293B' })] },
  { id: 'ofrenda', nombre: 'Ofrenda', categoria: 'Ofrenda', fondo: animado('bokeh', { base: ['#052e2b', '#0b1f1a'], colores: ['#fbbf24', '#fde68a', '#f59e0b', '#fef3c7'] }), elementos: [
    rotulo('Ofrenda', 24, { color: '#FFFFFF' }),
    portada('Dios ama al dador alegre', 14, 31, 72, 30, 6.4, { fuente: 'Cinzel', peso: 700, color: '#FDE68A', interlineado: 1.15, sombra: true }),
    cita('2 Corintios 9:7', 65, { color: '#FDE68A' }),
    letra({ fuente: 'Cinzel', peso: 500, tam: 4.8, color: '#FDE68A', sombra: true }), pie({ color: '#FDE68A' })] },
  { id: 'cena', nombre: 'Santa Cena', categoria: 'Santa Cena', fondo: animado('bokeh', { base: ['#2a0a14', '#12040a'], colores: ['#f59e0b', '#be123c', '#fda4af', '#fcd34d'] }), elementos: [
    rotulo('Santa Cena', 22, { color: '#FCD34D' }),
    portada('Haced esto en memoria de mí', 15, 29, 70, 34, 7.4, { fuente: 'Playfair Display', cursiva: true, peso: 600, color: '#FDF2F8', interlineado: 1.1 }),
    cita('Lucas 22:19', 67, { color: '#FDF2F8' }),
    letra({ fuente: 'Playfair Display', cursiva: true, tam: 5.6, color: '#FDF2F8' }), pie({ color: '#FDF2F8' })] },
  { id: 'anuncio', nombre: 'Anuncio', categoria: 'Anuncio', fondo: animado('malla', { base: ['#38bdf8'], colores: ['#a78bfa', '#f472b6', '#facc15', '#34d399'] }), elementos: [
    portada('14–16', 8, 30, 32, 26, 11, { fuente: 'Anton', color: '#FFFFFF', interlineado: 0.85, efecto: { tipo: 'solida', color: '#0000002E' } }),
    portada('NOVIEMBRE', 8, 55, 32, 10, 4.4, { fuente: 'Anton', color: '#FFFFFF', espaciado: 0.12 }),
    { tipo: 'forma', forma: 'redondeado', relleno: '#FFFFFF', x: 44, y: 18, w: 48, h: 64, rot: 0, en: 'portada' },
    portada('Inscripciones abiertas', 48, 24, 40, 5, 1.4, { fuente: 'Montserrat', peso: 700, espaciado: 0.3, mayus: true, alinear: 'left', color: '#DB2777' }),
    portada('Retiro de jóvenes', 48, 30, 40, 22, 4.6, { fuente: 'Montserrat', peso: 800, alinear: 'left', interlineado: 1.05, color: '#111111' }),
    portada('Tres días de campamento, alabanza y amistad. Pregunta en recepción al terminar el culto.', 48, 53, 40, 24, 1.7, { fuente: 'Montserrat', peso: 500, alinear: 'left', color: '#444444' }),
    letra({ fuente: 'Montserrat', peso: 800, color: '#FFFFFF', sombra: true }), pie({ color: '#FFFFFF' })] },
  { id: 'regresiva', nombre: 'Cuenta regresiva', categoria: 'Cuenta regresiva', fondo: animado('chispas'), elementos: [
    rotulo('El culto empieza en', 20, { color: '#FFFFFF' }),
    portada('05:00', 10, 27, 80, 40, 20, { fuente: 'Oswald', peso: 500, color: '#FFFFFF', interlineado: 1, efecto: { tipo: 'brillo', color: '#B7791F' } }),
    portada('Busca tu lugar · silencia tu celular', 10, 70, 80, 6, 1.7, { fuente: 'Montserrat', peso: 500, espaciado: 0.2, mayus: true, color: '#FFFFFF', opacidad: 0.75 }),
    letra({ fuente: 'Oswald', tam: 5.8, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'bautismo', nombre: 'Bautismo', categoria: 'Bautismo', fondo: animado('agua'), elementos: [
    rotulo('Bautismos', 26, { color: '#FFFFFF' }),
    portada('Novedad de vida', 8, 33, 84, 22, 10, { fuente: 'Cormorant Garamond', peso: 500, color: '#FFFFFF', sombra: true }),
    cita('Romanos 6:4', 59, { color: '#FFFFFF' }),
    letra({ fuente: 'Cormorant Garamond', peso: 500, tam: 6, color: '#FFFFFF', sombra: true }), pie({ color: '#FFFFFF' })] },
  { id: 'avivamiento', nombre: 'Avivamiento', categoria: 'Evento', fondo: animado('brasas'), elementos: [
    rotulo('Noche de avivamiento', 25, { color: '#FDBA74' }),
    portada('CON MI ESPÍRITU', 6, 32, 88, 24, 11, { fuente: 'Anton', espaciado: 0.03, color: '#FFFFFF', efecto: { tipo: 'degradado', color: '#FFFFFF', color2: '#FDBA74', angulo: 180 } }),
    cita('Zacarías 4:6', 60, { color: '#FFFFFF' }),
    letra({ fuente: 'Anton', tam: 6, espaciado: 0.03, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'vibes', nombre: 'Dios está aquí', categoria: 'Juvenil', fondo: animado('aurora', { base: ['#14051f', '#2a0a3d'], colores: ['#ec4899', '#8b5cf6', '#f97316', '#06b6d4'] }), elementos: [
    { tipo: 'lluvia', emojis: ['🔥', '🙌', '✨', '❤️', '🎶'], cantidad: 9, tam: 5, x: 0, y: 0, w: 100, h: 100, rot: 0 },
    portada('DIOS ESTÁ AQUÍ 🔥', 6, 32, 88, 24, 14, { fuente: 'Bebas Neue', color: '#FFFFFF', interlineado: 0.9, efecto: { tipo: 'brillo', color: '#F472B6' } }),
    portada('Jóvenes · viernes 7:30 p. m.', 10, 58, 80, 6, 2, { fuente: 'Montserrat', peso: 800, espaciado: 0.3, mayus: true, color: '#FFFFFF' }),
    letra({ fuente: 'Bebas Neue', tam: 7.2, interlineado: 1.05, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'stickers', nombre: 'Día de fiesta', categoria: 'Juvenil', fondo: animado('malla', { base: ['#fde047'], colores: ['#f472b6', '#fb923c', '#a3e635', '#fde68a'] }), elementos: [
    objeto('estrella', 5, 8, 11, 'girar', 9),
    objeto('hoy', 81, 7, 13, 'pop', 2),
    emoji('🎉', 9, 70, 8, 'rebotar', 1.8),
    emoji('😄', 81, 68, 8, 'balancear', 2.4),
    portada('¡Hoy es día de fiesta!', 17, 26, 66, 34, 7.6, { fuente: 'Archivo Black', color: '#FFFFFF', interlineado: 1, efecto: { tipo: 'contorno', color: '#1F1147', grosor: 0.35 } }),
    portada('🎉 🙌 🎶', 20, 62, 60, 12, 5),
    letra({ fuente: 'Archivo Black', tam: 5, color: '#FFFFFF', x: 18, w: 64, efecto: { tipo: 'contorno', color: '#1F1147', grosor: 0.25 } }), pie({ color: '#1F1147' })] },
  { id: 'arcade', nombre: 'Level up', categoria: 'Juvenil', fondo: animado('neon'), elementos: [
    emoji('🎮', 8, 12, 7, 'flotar', 4),
    emoji('⭐', 83, 14, 6, 'girar', 6),
    emoji('❤️', 82, 58, 5, 'latir', 1.4),
    portada('LEVEL UP', 10, 30, 80, 22, 7, { fuente: 'Press Start 2P', color: '#FEF08A', interlineado: 1.2, efecto: { tipo: 'solida', color: '#DB2777' } }),
    portada('TORNEO DE JUEGOS\nSÁBADO 4:00 P. M. 🎮', 10, 56, 80, 12, 1.5, { fuente: 'Press Start 2P', interlineado: 1.8, color: '#A5F3FC' }),
    letra({ fuente: 'Press Start 2P', tam: 3.2, interlineado: 1.7, color: '#FEF08A', x: 14, w: 72, efecto: { tipo: 'solida', color: '#DB2777' } }), pie({ color: '#A5F3FC' })] },
  { id: 'chat', nombre: 'Chat del grupo', categoria: 'Juvenil', fondo: animado('ondas', { base: ['#1e1b4b', '#312e81'], colores: ['#f472b6', '#a78bfa', '#22d3ee', '#818cf8'] }), elementos: [
    portada('Ana: ¿Vienes el viernes? 👀', 18, 12, 44, 14, 3, { fuente: 'Montserrat', peso: 700, color: '#1E1B4B', fondoCaja: '#FFFFFF', anim: 'chat', dur: 9, retraso: 0 }),
    portada('¡Claro! 🙌🔥', 58, 31, 24, 14, 3.2, { fuente: 'Montserrat', peso: 700, color: '#FFFFFF', fondoCaja: '#22C55E', anim: 'chat', dur: 9, retraso: 1.2 }),
    portada('Ana: Trae a un amigo 😎', 18, 50, 42, 14, 3, { fuente: 'Montserrat', peso: 700, color: '#1E1B4B', fondoCaja: '#FFFFFF', anim: 'chat', dur: 9, retraso: 2.4 }),
    portada('Noche de jóvenes · 7:30 p. m. 🎶', 40, 69, 42, 18, 3, { fuente: 'Montserrat', peso: 700, color: '#FFFFFF', fondoCaja: '#22C55E', anim: 'chat', dur: 9, retraso: 3.6 }),
    letra({ fuente: 'Montserrat', peso: 800, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })] },
  { id: 'marquesina', nombre: 'Marquesina', categoria: 'Juvenil', fondo: animado('bokeh', { base: ['#111827', '#1e1b4b'], colores: ['#f472b6', '#22d3ee', '#facc15', '#a78bfa'] }), elementos: [
    T('FE ✦ AMISTAD ✦ ALABANZA ✦ JÓVENES ✦ FE ✦ AMISTAD ✦ ALABANZA ✦ JÓVENES ✦', -10, 5, 120, 9, 3.4, { rot: -4, fuente: 'Anton', espaciado: 0.08, color: '#111111', fondoCaja: '#FACC15', anim: 'marquesina', dur: 16 }),
    T('FE ✦ AMISTAD ✦ ALABANZA ✦ JÓVENES ✦ FE ✦ AMISTAD ✦ ALABANZA ✦ JÓVENES ✦', -10, 85, 120, 9, 3.4, { rot: 3, fuente: 'Anton', espaciado: 0.08, color: '#FFFFFF', fondoCaja: '#EC4899', anim: 'marquesina', dur: 20 }),
    portada('JÓVENES', 6, 28, 88, 30, 15, { fuente: 'Anton', espaciado: 0.04, interlineado: 0.9, color: '#FFFFFF' }),
    portada('una generación que adora', 15, 58, 70, 12, 4.4, { fuente: 'Caveat', color: '#FDE68A' }),
    letra({ fuente: 'Anton', tam: 5.6, espaciado: 0.03, color: '#FFFFFF', y: 17, h: 64 }), pie({ color: '#FFFFFF', y: 79 })] },
  { id: 'collage', nombre: 'Recuerdos', categoria: 'Juvenil', fondo: animado('malla', { base: ['#0ea5e9'], colores: ['#22d3ee', '#a78bfa', '#34d399', '#38bdf8'] }), elementos: [
    ...polaroid(6, 8, -8, '#FDE68A', '⛺', 'la fogata', 0),
    ...polaroid(24, 40, 6, '#FBCFE8', '🎸', 'alabanza', -2),
    ...polaroid(5, 58, -3, '#BBF7D0', '🙏', 'oración', -4),
    portada('Campamento\n2026', 46, 26, 47, 36, 10, { fuente: 'Caveat', alinear: 'right', interlineado: 0.9, color: '#FFFFFF', sombra: true }),
    portada('¡Revive los mejores momentos! 📸', 40, 64, 53, 7, 2, { fuente: 'Montserrat', peso: 700, alinear: 'right', color: '#FFFFFF' }),
    letra({ fuente: 'Montserrat', peso: 800, color: '#FFFFFF', sombra: true }), pie({ color: '#FFFFFF' })] }
].map(p => ({ ...p, elementos: p.elementos.map((e, i) => ({ id: `${p.id}-${i}`, ...e })) }));

// "+ Nueva plantilla en blanco": un fondo, un título para la portada y la zona de la letra
export const PLANTILLA_BLANCO = { id: 'blanco', nombre: 'Mi plantilla', categoria: 'Mis plantillas', fondo: { tipo: 'color', valor: '#111827' }, elementos: [
  portada('Título', 10, 34, 80, 20, 8, { fuente: 'Montserrat', peso: 800, color: '#FFFFFF' }),
  letra({ fuente: 'Montserrat', peso: 800, color: '#FFFFFF' }), pie({ color: '#FFFFFF' })
].map((e, i) => ({ id: `blanco-${i}`, ...e })) };

export const CATEGORIAS = [...new Set(PLANTILLAS.map(p => p.categoria))];
export const PLANTILLA_DEFECTO = 'adoracion';
export const plantillaIncluida = (id) => PLANTILLAS.find(p => p.id === id) || null;
// Hoja del lienzo a partir de una plantilla (incluida o del profesor: { diseno: { fondo, elementos } })
export const hojaDePlantilla = (p) => ({ tipo: 'contenido', diseno: p.diseno || { fondo: p.fondo, elementos: p.elementos } });
