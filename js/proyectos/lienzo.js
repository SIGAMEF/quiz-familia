// ============================================================
// Proyectos en grupo: dibujo de una hoja (editor, miniaturas, presentación y celular)
// Web: lienzo 16:9. Posiciones y tamaños en % del lienzo; el texto en % del ancho (unidad cqw),
// así la hoja se ve igual en un proyector o en una miniatura.
// Celular: el fondo ocupa toda la pantalla y los elementos se acomodan solos en una columna
// (o en las posiciones que el profesor ajustó a mano, guardadas en diseno.movil sin tocar las de Web).
// ============================================================
import { estiloFondo, fuenteValida, colorValido, urlSegura, FORMAS, limpiarNodos, URL_FUENTES } from './recursos.js';
import { esPregunta, pintarZona, textoEnunciado, pintarParticipante } from './preguntas.js';
import { pintarZonaAgrupar, pintarRegistro } from './agrupar.js';
import { pintarZonaRuleta, pintarRuletaCelular } from './ruleta.js';

export const ASPECTO = 16 / 9;
const SVG_NS = 'http://www.w3.org/2000/svg';
const num = (v, d, min = -1000, max = 1000) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

export function asegurarFuentes() {
  if (document.querySelector('link[data-fuentes-proyectos]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = URL_FUENTES; l.dataset.fuentesProyectos = '';
  document.head.appendChild(l);
}

// ---------- Video: YouTube, Vimeo o mp4 ----------
export function leerVideo(url) {
  const u = String(url || '').trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { fuente: 'youtube', vid: m[1] };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
  if (m) return { fuente: 'vimeo', vid: m[1] };
  if (urlSegura(u) && /\.(mp4|webm)(\?|$)/i.test(u)) return { fuente: 'mp4', url: u };
  return null;
}
function urlEmbed(el) {
  if (el.fuente === 'youtube' && /^[\w-]{11}$/.test(el.vid || '')) return `https://www.youtube-nocookie.com/embed/${el.vid}?rel=0`;
  if (el.fuente === 'vimeo' && /^\d{5,12}$/.test(el.vid || '')) return `https://player.vimeo.com/video/${el.vid}`;
  return null;
}
export function miniaturaVideo(el) {
  return el.fuente === 'youtube' && /^[\w-]{11}$/.test(el.vid || '') ? `https://i.ytimg.com/vi/${el.vid}/hqdefault.jpg` : null;
}

// ---------- Fondo (color, degradado, patrón o imagen ajustable) ----------
// Imagen: { tipo:'imagen', valor:url, color, modo:'cubrir'|'ajustar'|'estirar'|'mosaico'|'original',
//           zoom:50–300, px/py: punto de enfoque en %, opacidad, oscurecer:0–0.7, desenfoque:0–20, nat:[ancho,alto] }
export const MODOS_FONDO = { cubrir: 'Cubrir', ajustar: 'Ajustar', estirar: 'Estirar', mosaico: 'Mosaico', original: 'Tamaño original' };
export function pintarFondo(capa, f = {}) {
  capa.replaceChildren();
  capa.removeAttribute('style');
  if (f.tipo !== 'imagen' || !urlSegura(f.valor)) { Object.assign(capa.style, estiloFondo(f)); return; }
  capa.style.backgroundColor = colorValido(f.color, '#2D2A45');
  const img = document.createElement('div');
  img.className = 'fondo-img';
  const z = num(f.zoom, 100, 50, 300) / 100, px = num(f.px, 50, 0, 100), py = num(f.py, 50, 0, 100);
  const modo = MODOS_FONDO[f.modo] ? f.modo : 'cubrir';
  Object.assign(img.style, { backgroundImage: `url("${f.valor}")`, backgroundPosition: `${px}% ${py}%`, backgroundRepeat: 'no-repeat',
    opacity: num(f.opacidad, 1, 0, 1), transformOrigin: `${px}% ${py}%` });
  if (modo === 'mosaico') Object.assign(img.style, { backgroundRepeat: 'repeat', backgroundSize: `${(25 * z).toFixed(2)}% auto` });
  else if (modo === 'original') {
    const nat = Array.isArray(f.nat) ? num(f.nat[0], 0, 0, 20000) : 0;   // tamaño real medido sobre un lienzo de 1600 px
    img.style.backgroundSize = nat ? `${(nat / 16 * z).toFixed(2)}% auto` : 'auto';
  } else {
    img.style.backgroundSize = modo === 'ajustar' ? 'contain' : modo === 'estirar' ? '100% 100%' : 'cover';
    if (z !== 1) img.style.transform = `scale(${z})`;
  }
  const blur = num(f.desenfoque, 0, 0, 20);
  if (blur) { img.style.filter = `blur(${(blur * 0.08).toFixed(2)}cqw)`; img.style.inset = '-3%'; }
  capa.appendChild(img);
  const velo = num(f.oscurecer, 0, 0, 0.7);
  if (velo) {
    const v = document.createElement('div');
    v.className = 'fondo-velo';
    v.style.background = `rgba(0,0,0,${velo})`;
    capa.appendChild(v);
  }
}

// ---------- Geometría ----------
// fmt 'web': x, y, w, h en % del lienzo 16:9.  fmt 'manual' (celular): x, w en % del ancho; y, h en "% del ancho" (cqw).
export function colocar(d, g, fmt = 'web') {
  Object.assign(d.style, {
    left: num(g.x, 0) + '%', width: num(g.w, 20, 0.5, 400) + '%',
    top: fmt === 'manual' ? num(g.y, 0, -50, 5000) + 'cqw' : num(g.y, 0) + '%',
    height: fmt === 'manual' ? num(g.h, 20, 0.5, 2000) + 'cqw' : num(g.h, 20, 0.5, 400) + '%',
    transform: g.rot ? `rotate(${num(g.rot, 0, -360, 360)}deg)` : ''
  });
}
// Proporción ancho/alto del elemento tal como se ve en Web
const proporcion = (el) => Math.max(0.05, Math.min(20, (num(el.w, 20, 0.5) * 16) / (num(el.h, 20, 0.5) * 9)));
// Letra legible en el celular a partir del tamaño en Web
export const tamMovil = (tam) => Math.max(5, Math.min(12, num(tam, 4, 0.5, 40) * 1.6));
// Posición en el celular de un elemento ajustado a mano (si falta, va debajo de todo)
export function posMovil(hoja, el) {
  const pos = hoja.diseno.movil?.pos || {};
  if (pos[el.id]) return pos[el.id];
  const fondo = Object.values(pos).reduce((m, p) => Math.max(m, num(p.y, 0) + num(p.h, 0)), 4);
  const w = el.tipo === 'texto' || el.tipo === 'zona' || el.tipo === 'video' ? 88 : Math.max(16, Math.min(70, num(el.w, 20) * 1.6));
  return { x: (100 - w) / 2, y: fondo + 4, w, h: el.tipo === 'texto' ? 22 : w / (el.tipo === 'zona' ? 0.85 : proporcion(el)), rot: 0 };
}

// ---------- Un elemento ----------
// modo: 'editor' (sin iframes, sin clics en el contenido), 'miniatura' (igual, más liviano) o 'ver' (presentación)
// ctx: { hoja, res (respuestas para la zona), fmt: 'web' | 'auto' | 'manual' }
function crearElemento(el, modo, ctx) {
  const fmt = ctx.fmt || 'web';
  const d = document.createElement('div');
  d.className = 'pe pe-' + el.tipo;
  d.dataset.id = el.id;
  let altoCqw;   // alto del elemento en cqw (para el tamaño de los emojis)
  if (fmt === 'web') { colocar(d, el); altoCqw = num(el.h, 20, 1, 300) * 0.5625; }
  else if (fmt === 'manual') { const p = posMovil(ctx.hoja, el); colocar(d, p, 'manual'); altoCqw = num(p.h, 20, 1, 2000); }
  else {
    // acomodo automático: columna a todo el ancho (88cqw útiles), con la proporción que tenía en Web
    // (la zona de respuestas pasa a ser casi vertical para que se lea en el celular)
    const a = el.tipo === 'zona' ? 0.85 : proporcion(el);
    const ancho = { texto: 88, video: 88, zona: 88 }[el.tipo] ?? (el.tipo === 'imagen' ? Math.max(45, Math.min(88, num(el.w, 40) * 1.7)) : Math.max(16, Math.min(60, num(el.w, 20) * 1.6)));
    d.style.width = ancho + 'cqw';
    if (el.tipo !== 'texto') d.style.aspectRatio = String(a);
    if (['emoji', 'icono', 'forma'].includes(el.tipo) && el.rot) d.style.transform = `rotate(${num(el.rot, 0, -360, 360)}deg)`;
    altoCqw = ancho / a;
  }
  if (el.opacidad != null) d.style.opacity = num(el.opacidad, 1, 0, 1);

  if (el.tipo === 'texto') {
    const t = document.createElement('div');
    t.className = 'pe-txt';
    t.textContent = el.vinculo === 'enunciado' && ctx.hoja ? textoEnunciado(ctx.hoja) : (el.texto ?? '');
    Object.assign(t.style, {
      fontFamily: `'${fuenteValida(el.fuente)}', 'Nunito', sans-serif`, fontSize: (fmt === 'web' ? num(el.tam, 4, 0.5, 40) : tamMovil(el.tam)) + 'cqw',
      color: colorValido(el.color, '#2D2A45'), textAlign: ['left', 'center', 'right'].includes(el.alinear) ? el.alinear : 'center',
      fontWeight: el.negrita ? '800' : '400', fontStyle: el.cursiva ? 'italic' : 'normal'
    });
    if (el.fondoCaja) { d.style.background = colorValido(el.fondoCaja, 'transparent'); d.style.borderRadius = '1.2cqw'; if (fmt === 'auto') t.style.padding = '2cqw 3cqw'; }
    if (el.sombra) t.style.textShadow = '0 0.25cqw 0.6cqw rgba(0,0,0,.35)';
    d.appendChild(t);
  } else if (el.tipo === 'imagen') {
    if (urlSegura(el.url)) {
      const img = document.createElement('img');
      img.src = el.url; img.alt = ''; img.draggable = false; img.loading = modo === 'miniatura' ? 'lazy' : 'eager';
      const px = num(el.px, 50, 0, 100), py = num(el.py, 50, 0, 100), z = num(el.zoom, 100, 100, 300) / 100;
      Object.assign(img.style, { objectFit: el.ajuste === 'contain' ? 'contain' : el.ajuste === 'fill' ? 'fill' : 'cover', objectPosition: `${px}% ${py}%` });
      if (z !== 1) Object.assign(img.style, { transform: `scale(${z})`, transformOrigin: `${px}% ${py}%` });   // recorte
      const marco = document.createElement('div');
      marco.className = 'pe-recorte';
      marco.style.borderRadius = num(el.radio, 0, 0, 50) + '%';
      marco.appendChild(img);
      d.appendChild(marco);
    } else d.innerHTML = '<div class="pe-vacio">🖼</div>';
  } else if (el.tipo === 'emoji') {
    const e = document.createElement('div');
    e.className = 'pe-emoji';
    e.textContent = String(el.emoji || '⭐').slice(0, 16);
    e.style.fontSize = (altoCqw * 0.82).toFixed(2) + 'cqw';
    d.appendChild(e);
  } else if (el.tipo === 'icono') {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', String(num(el.grosor, 2, 0.5, 4))); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    for (const [tag, attrs] of limpiarNodos(el.nodos)) {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      s.appendChild(n);
    }
    d.style.color = colorValido(el.color, '#6C5CE7');
    d.appendChild(s);
  } else if (el.tipo === 'forma') {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('preserveAspectRatio', 'none');
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('fill', colorValido(el.relleno, '#7C6FF0'));
    const grosor = num(el.grosorBorde, 0, 0, 20);
    if (grosor > 0) { g.setAttribute('stroke', colorValido(el.borde, '#2D2A45')); g.setAttribute('stroke-width', String(grosor)); }
    g.innerHTML = (FORMAS[el.forma] || FORMAS.rect).svg;   // plantillas fijas de recursos.js, no datos del usuario
    if (grosor > 0) g.querySelectorAll('*').forEach(n => n.setAttribute('vector-effect', 'non-scaling-stroke'));
    s.appendChild(g);
    d.appendChild(s);
  } else if (el.tipo === 'video') {
    const emb = urlEmbed(el);
    if (modo === 'ver' && emb) {
      const f = document.createElement('iframe');
      f.src = emb; f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin'; f.title = 'Video';
      d.appendChild(f);
    } else if (modo === 'ver' && el.fuente === 'mp4' && urlSegura(el.url)) {
      const v = document.createElement('video');
      v.src = el.url; v.controls = true; v.preload = 'metadata'; v.playsInline = true;
      d.appendChild(v);
    } else {
      const mini = miniaturaVideo(el);
      d.innerHTML = `<div class="pe-video-prev">${mini ? `<img src="${mini}" alt="" draggable="false">` : ''}<span>▶</span></div>`;
    }
  } else if (el.tipo === 'zona') {
    if (ctx.hoja?.tipo === 'agrupar') pintarZonaAgrupar(d, ctx.hoja, ctx.res || null);
    else if (ctx.hoja?.tipo === 'ruleta') pintarZonaRuleta(d, ctx.hoja, ctx.res || null, { animar: modo === 'ver' });
    else if (ctx.hoja && esPregunta(ctx.hoja.tipo)) pintarZona(d, ctx.hoja, ctx.res || null);
    else return null;
  } else {
    return null;
  }
  return d;
}

// Orden del acomodo automático: de arriba hacia abajo y, en una misma franja, de izquierda a derecha
export function ordenAuto(elementos) {
  const porY = [...elementos].sort((a, b) => num(a.y, 0) - num(b.y, 0));
  const filas = [];
  for (const el of porY) {
    const f = filas[filas.length - 1];
    if (f && num(el.y, 0) - f.y0 < 8) f.els.push(el); else filas.push({ y0: num(el.y, 0), els: [el] });
  }
  return filas.flatMap(f => f.els.sort((a, b) => num(a.x, 0) - num(b.x, 0)));
}

// Dibuja la hoja (Web, 16:9) dentro de `cont`. Devuelve el nodo .lienzo
export function pintarHoja(cont, hoja, { modo = 'ver', res = null } = {}) {
  asegurarFuentes();
  const lienzo = document.createElement('div');
  lienzo.className = 'lienzo' + (modo !== 'ver' ? ' estatico' : '');
  const fondo = document.createElement('div');
  fondo.className = 'lienzo-fondo';
  pintarFondo(fondo, hoja?.diseno?.fondo);
  lienzo.appendChild(fondo);
  const ctx = { hoja, res, fmt: 'web' };
  for (const el of (hoja?.diseno?.elementos || [])) {
    const n = crearElemento(el, modo, ctx);
    if (n) lienzo.appendChild(n);
  }
  cont.replaceChildren(lienzo);
  return lienzo;
}

// Dibuja la hoja para una pantalla de celular (vertical). Devuelve { pantalla, lienzo, manual }
export function pintarHojaMovil(cont, hoja, { modo = 'ver', res = null } = {}) {
  asegurarFuentes();
  const manual = !!hoja?.diseno?.movil?.manual;
  const pantalla = document.createElement('div');
  pantalla.className = 'movil-pantalla';
  const fondo = document.createElement('div');
  fondo.className = 'lienzo-fondo';
  pintarFondo(fondo, hoja?.diseno?.fondo);
  const scroll = document.createElement('div');
  scroll.className = 'movil-scroll';
  const lienzo = document.createElement('div');
  lienzo.className = `lienzo movil ${manual ? 'manual' : 'auto'}${modo !== 'ver' ? ' estatico' : ''}`;
  const ctx = { hoja, res, fmt: manual ? 'manual' : 'auto' };
  const els = hoja?.diseno?.elementos || [];
  let fondoY = 0;
  for (const el of manual ? els : ordenAuto(els)) {
    const n = crearElemento(el, modo, ctx);
    if (!n) continue;
    lienzo.appendChild(n);
    if (manual) { const p = posMovil(hoja, el); fondoY = Math.max(fondoY, num(p.y, 0) + num(p.h, 0)); }
  }
  if (manual) lienzo.style.height = `${(fondoY + 8).toFixed(1)}cqw`;
  scroll.appendChild(lienzo);
  pantalla.append(fondo, scroll);
  cont.replaceChildren(pantalla);
  return { pantalla, lienzo, manual };
}

// Vuelve a dibujar solo un elemento (más rápido mientras se edita)
export function repintarElemento(lienzo, el, modo = 'editor', ctx = {}) {
  const viejo = lienzo.querySelector(`.pe[data-id="${CSS.escape(el.id)}"]`);
  const nuevo = crearElemento(el, modo, { fmt: lienzo.classList.contains('movil') ? (lienzo.classList.contains('manual') ? 'manual' : 'auto') : 'web', ...ctx });
  if (viejo && nuevo) viejo.replaceWith(nuevo);
  return nuevo;
}

// Lo que ve el participante en su celular para una hoja
// (preguntas: el formulario para responder; agrupar: el registro; ruleta: la ruleta girando;
//  contenido: "Mira la pantalla" o la hoja acomodada)
// vivo: { respuestas, cerrado, revelar, modoGrupo } cuando hay una sesión real; ruleta: { candidatos, sorteos, yo }
export function pintarCelular(cont, hoja, nombreProyecto = '', { modo = 'ver', alEnviar, nota, vivo = null, alUnirse, ruleta = null } = {}) {
  asegurarFuentes();
  const conRuleta = hoja?.tipo === 'ruleta' && (hoja.config?.celular || 'ruleta') === 'ruleta';
  if (esPregunta(hoja?.tipo) || hoja?.tipo === 'agrupar' || conRuleta) {
    const pantalla = document.createElement('div');
    pantalla.className = 'movil-pantalla';
    const fondo = document.createElement('div');
    fondo.className = 'lienzo-fondo';
    pintarFondo(fondo, hoja.diseno?.fondo);
    const scroll = document.createElement('div');
    scroll.className = 'movil-scroll part-scroll';
    if (hoja.tipo === 'agrupar') pintarRegistro(scroll, { titulo: nombreProyecto, subtitulo: 'Únete con tu nombre', alUnirse });
    else if (conRuleta) pintarRuletaCelular(scroll, hoja, ruleta, nombreProyecto);
    else pintarParticipante(scroll, hoja, { alEnviar, nota, ...(vivo || {}) });
    pantalla.append(fondo, scroll);
    cont.replaceChildren(pantalla);
    return { pantalla, lienzo: null, manual: false };
  }
  if ((hoja?.config?.celular || 'mirar') === 'hoja') return pintarHojaMovil(cont, hoja, { modo });
  cont.replaceChildren();
  const pant = document.createElement('div');
  pant.className = 'cel-pantalla';
  pant.innerHTML = `<div class="cel-mirar"><div class="cel-ojos">👀</div><b>Mira la pantalla</b><small></small></div>`;
  pant.querySelector('small').textContent = nombreProyecto;
  cont.appendChild(pant);
  return { pantalla: pant, lienzo: null, manual: false };
}
