// ============================================================
// Catálogo de actividades: los tipos que se pueden crear, con tarjetas como las de la portada.
// Lo usan "+ Nuevo" en Mis actividades y "+ Más" en el editor de proyectos.
// ============================================================
import { $$, esc, abrirModal } from './comun.js';

// grupo: 'quiz' | 'juego' | 'proyecto' (para los filtros de la lista)
export const ACTIVIDADES = {
  quiz: { nombre: 'Quiz tradicional', ico: '📝', c: '#8E5BE8', c2: '#6A3BC4', grupo: 'quiz', desc: 'Preguntas de V/F, opción única o múltiple, completar y lluvia de ideas. Se publica, se califica y se juega en vivo.' },
  sopa: { nombre: 'Sopa de letras', ico: '🔎', c: '#14A3B8', c2: '#0E7C8C', grupo: 'juego', desc: 'Busca las palabras ocultas en la cuadrícula.' },
  ahorcado: { nombre: 'Ahorcado', ico: '🦘', c: '#F28C0F', c2: '#C46A00', grupo: 'juego', desc: 'Adivina la palabra letra por letra con su pista.' },
  memoria: { nombre: 'Memorama', ico: '🃏', c: '#4CAF2E', c2: '#357D1F', grupo: 'juego', desc: 'Encuentra las parejas: texto, imagen o ambos.' },
  rompecabezas: { nombre: 'Rompecabezas', ico: '🧩', c: '#EC4C93', c2: '#C2306F', grupo: 'juego', desc: 'Arma una imagen pieza por pieza.' },
  frase: { nombre: 'Ordena la frase', ico: '🔤', c: '#2F80ED', c2: '#1B5FC4', grupo: 'juego', desc: 'Forma la frase correcta con las palabras revueltas.' },
  ordena: { nombre: 'Ordena la palabra', ico: '🔀', c: '#27AE60', c2: '#1E8449', grupo: 'juego', desc: 'Las letras están revueltas: ordénalas con la pista.' },
  trivia: { nombre: 'Trivia', ico: '📖', c: '#7B4FD6', c2: '#5A33A8', grupo: 'juego', desc: 'Preguntas con 2 a 4 respuestas sobre el tema que quieras.' },
  relampago: { nombre: 'Quiz relámpago', ico: '⚡', c: '#E8A400', c2: '#B97F00', grupo: 'juego', desc: '15 segundos por pregunta: más rápido, más puntos.' },
  proyecto: { nombre: 'Proyecto en grupo', ico: '🎨', c: '#E5484D', c2: '#B42E33', grupo: 'proyecto', desc: 'Presentación con hojas, preguntas, grupos, ruleta y juegos, en vivo con los celulares.' }
};
export const TIPOS_JUEGO_CATALOGO = Object.keys(ACTIVIDADES).filter(k => ACTIVIDADES[k].grupo === 'juego');

// Tarjetas para elegir un tipo. Devuelve el tipo elegido (o null si se cierra).
export function elegirActividad({ titulo = '➕ ¿Qué quieres crear?', subtitulo = '', tipos = Object.keys(ACTIVIDADES), extra = '' } = {}) {
  return new Promise(ok => {
    let elegido = null;
    const m = abrirModal(`<h3>${esc(titulo)}</h3>${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ''}
      <div class="cat-grid">${tipos.map(k => { const a = ACTIVIDADES[k]; return `<button type="button" class="cat-tarjeta" data-t="${k}" style="--c:${a.c}; --c2:${a.c2}">
        <span class="cat-arte" aria-hidden="true">${a.ico}</span><b class="cat-cinta">${esc(a.nombre)}</b><small>${esc(a.desc)}</small></button>`; }).join('')}</div>${extra}`,
      { ancho: true, alCerrar: () => ok(elegido) });
    $$('[data-t]', m.el).forEach(b => b.onclick = () => { elegido = b.dataset.t; m.cerrar(); });
  });
}
