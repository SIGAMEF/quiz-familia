// ============================================================
// Portal "Quiz Familia Marroquín": juegos libres de acceso rápido
// ============================================================
import { $, $$, esc, canguro, horca } from './juegos/util.js';
import { JUEGOS, SETS, SETS_MEMORIA, SETS_QUIZ, SETS_FRASES, SETS_TRIVIA } from './juegos/contenido.js';
import { imagenPuzzle } from './juegos/imagenes.js';

const PREVIA = !!window.__VISTA_PREVIA__;   // vista previa publicada: sin cuentas ni servidor
// En la vista previa el juego va en el #ancla (j.set); en el sitio, en la dirección (?j=&s=)
const enlaceJuego = (j, s) => PREVIA ? `juegos.html#${j}${s ? '.' + s : ''}` : `juegos.html?j=${j}${s ? `&s=${s}` : ''}`;

$('#logoCara').innerHTML = canguro({ estado: 'gana', tam: 64 });
$('#mascota').innerHTML = canguro({ estado: 'saluda', tam: 220 });
$('#escena').innerHTML = `<svg viewBox="0 0 1200 300" preserveAspectRatio="none">
  <path d="M0 150 Q200 70 420 130 T820 110 T1200 120 V300 H0Z" fill="#A6D98A"/>
  <path d="M0 200 Q260 140 520 190 T1000 180 T1200 190 V300 H0Z" fill="#7CC456"/>
  <g fill="#3E9B3A">${[60, 130, 1080, 1150].map(x => `<circle cx="${x}" cy="150" r="46"/>`).join('')}</g>
  <g fill="#E7C089" opacity=".9">${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 50 + 8}" y="200" width="9" height="38" rx="3"/>`).join('')}<rect y="208" width="1200" height="6" rx="3"/><rect y="224" width="1200" height="6" rx="3"/></g>
  <path d="M0 240 Q300 226 600 238 T1200 236 V300 H0Z" fill="#5FAE3E"/></svg>`;

// ---------- Tarjetas de juegos (ilustración + cinta + botón) ----------
const ARTE = {
  sopa: () => `<div class="sopa-mini">${'AMORIFAMILJUEGOPAZLU'.split('').map((l, i) => `<span class="${'FAMIL'.includes(l) && i >= 5 && i <= 9 ? 'marca' : ''}">${l}</span>`).join('')}</div><span class="arte-lupa">🔍</span><span class="arte-lapiz">✏️</span>`,
  quiz: () => `<span class="arte-foco">💡</span><span class="arte-preg">❓</span><div class="arte-abcd">${['A', 'B', 'C', 'D'].map((l, i) => `<span style="--k:${i}">${l}</span>`).join('')}</div>`,
  ahorcado: () => `<div class="arte-horca">${horca({ energia: .8 })}</div><div class="arte-palabra"><span>P</span><span></span><span></span><span></span><span>O</span></div>`,
  memoria: () => `<div class="arte-cartas"><span>🦁</span><span>🐘</span></div>`,
  rompecabezas: () => { const img = imagenPuzzle('p-andes'); return `<div class="arte-puzzle">${Array.from({ length: 9 }, (_, i) => `<span style="background-image:url('${img}'); background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%"></span>`).join('')}</div>`; },
  frase: () => `<div class="frase-mini"><span style="--c:#14A3B8">La</span><span style="--c:#F5B700">casa</span><span style="--c:#8E5BE8">es</span><span style="--c:#F28C0F">grande</span></div>`,
  trivia: () => `<span class="arte-cruz">✝️</span><span class="arte-libro">📖</span>`,
  mas: () => `<span class="arte-mando">🎮</span><span class="estrella e1">⭐</span><span class="estrella e2">⭐</span><span class="estrella e3">✨</span>`
};
const TARJETAS = [
  ['sopa', '#14A3B8', '#0E7C8C'], ['quiz', '#8E5BE8', '#6A3BC4'], ['ahorcado', '#F28C0F', '#C46A00'], ['memoria', '#4CAF2E', '#357D1F'],
  ['rompecabezas', '#EC4C93', '#C2306F'], ['frase', '#2F80ED', '#1B5FC4'], ['trivia', '#7B4FD6', '#5A33A8'], ['mas', '#14A3B8', '#0E7C8C']
];
$('#tarjetas').innerHTML = TARJETAS.map(([k, c, c2]) => {
  const j = k === 'mas' ? { nombre: 'Más juegos', desc: 'Ordena la palabra, quiz en vivo y todos los temas.' } : JUEGOS[k];
  const href = k === 'mas' ? '#mas' : enlaceJuego(k);
  return `<li class="fam-tarjeta" style="--c:${c}; --c2:${c2}">
    <a href="${href}" class="fam-tarjeta-link" aria-label="${esc(j.nombre)}: ${esc(j.desc)}">
      <div class="fam-arte arte-${k}" aria-hidden="true">${ARTE[k]()}</div>
      <h2 class="fam-cinta">${esc(j.nombre)}</h2>
      <p>${esc(j.desc)}</p>
      <span class="fam-jugar" aria-hidden="true">${k === 'mas' ? 'Ver más' : 'Jugar'} <b>›</b></span>
    </a></li>`;
}).join('');
$('#lnkOrdena').href = enlaceJuego('ordena');

// ---------- Quiz en vivo con PIN ----------
$('#fPin').onsubmit = (e) => {
  e.preventDefault();
  const pin = $('#pin').value.replace(/\D/g, '');
  if (pin.length !== 6) { $('#errPin').textContent = 'El PIN tiene 6 números.'; $('#pin').focus(); return; }
  if (PREVIA) { avisar('Vista previa: el quiz en vivo funciona en tu sitio, con el PIN de la pantalla.'); return; }
  location.href = `vivo.html?pin=${pin}`;
};

// ---------- Temas (biblioteca libre) ----------
const temas = [
  ...SETS.map(s => ({ ...s, juegos: ['ahorcado', 'sopa', 'ordena'], n: `${s.palabras.length} palabras` })),
  ...SETS_MEMORIA.map(s => ({ ...s, juegos: ['memoria'], n: `${s.parejas.length} parejas` })),
  ...SETS_FRASES.map(s => ({ ...s, juegos: ['frase'], n: `${s.frases.length} frases` })),
  ...SETS_TRIVIA.map(s => ({ ...s, juegos: ['trivia'], n: `${s.preguntas.length} preguntas` })),
  ...SETS_QUIZ.map(s => ({ ...s, juegos: ['quiz'], n: `${s.preguntas.length} preguntas` }))
];
let filtro = '';
const corto = (k) => ({ ahorcado: 'Ahorcado', sopa: 'Sopa', ordena: 'Ordena', memoria: 'Memorama', frase: 'Frase', trivia: 'Trivia', quiz: 'Quiz', rompecabezas: 'Rompecabezas', relampago: 'Relámpago', proyecto: 'Proyecto' }[k]);
// los proyectos de los profesores no son un juego de la lista: se abren en proyecto.html
const INFO = (k) => JUEGOS[k] || { proyecto: { nombre: 'Proyecto en grupo', ico: '🎨', color: '#E5484D' } }[k] || { nombre: k, ico: '🎲', color: '#8E86AC' };
const enlaceProfe = (t) => t.tipo === 'quiz' ? `juegos.html?q=${t.id}` : t.tipo === 'proyecto' ? `proyecto.html?p=${t.id}` : `juegos.html?g=${t.id}`;
const pintarFiltro = () => {
  $('#filtro').innerHTML = [['', 'Todos'], ...['ahorcado', 'sopa', 'memoria', 'frase', 'trivia', 'quiz', 'relampago', 'ordena', 'rompecabezas', 'proyecto'].map(k => [k, `${INFO(k).ico} ${corto(k)}`])]
    .map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${k === filtro}">${esc(t)}</button>`).join('');
  $$('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; pintarFiltro(); pintarBiblioteca(); });
};
const pintarBiblioteca = () => {
  $('#biblioteca').innerHTML = temas.filter(t => !filtro || t.juegos.includes(filtro)).map(t => `<li>
      <span class="bib-ico" aria-hidden="true">${t.ico}</span>
      <span class="bib-txt"><b>${esc(t.titulo)}</b><small>${esc(t.categoria || '')}${t.categoria ? ' · ' : ''}${esc(t.n)}${t.autor && t.autor !== 'QuizApp' ? ` · por ${esc(t.autor)}` : ''}</small></span>
      <span class="bib-jugar">${t.juegos.filter(j => !filtro || j === filtro).map(j => `<a class="b3 chico" style="--b:${INFO(j).color}" href="${t.href || enlaceJuego(j, t.id)}" aria-label="${j === 'proyecto' ? 'Abrir' : 'Jugar'} ${esc(INFO(j).nombre)}: ${esc(t.titulo)}">${INFO(j).ico} ${esc(corto(j))}</a>`).join('')}</span>
    </li>`).join('');
};
pintarFiltro(); pintarBiblioteca();

// ---------- Juegos y quizzes que los profesores hicieron públicos ----------
if (!PREVIA) (async () => {
  try {
    const { supabase } = await import('./comun.js');
    const { data, error } = await supabase.rpc('biblioteca_libre');
    if (error || !data?.length) return;
    temas.unshift(...data.map(t => ({
      id: t.id, titulo: t.titulo, ico: t.tipo === 'quiz' ? '📝' : INFO(t.tipo).ico, categoria: t.tema || '', autor: t.autor,
      n: `${t.n} ${UNIDAD[t.tipo] || 'palabras'}`, juegos: [t.tipo], href: enlaceProfe(t)
    })));
    pintarBiblioteca();
  } catch { /* sin conexión: quedan los temas incluidos */ }
})();
const UNIDAD = { memoria: 'parejas', frase: 'frases', rompecabezas: 'piezas', quiz: 'preguntas', trivia: 'preguntas', relampago: 'preguntas', proyecto: 'hojas' };

// ---------- Fila "Creado por nuestros profesores" (lo que destacaron en la portada) ----------
if (!PREVIA) (async () => {
  try {
    const { supabase } = await import('./comun.js');
    const { data, error } = await supabase.rpc('portada_destacados');
    if (error || !data?.length) return;
    $('#filaDestacados').innerHTML = data.map(t => {
      const i = t.tipo === 'quiz' ? { nombre: 'Quiz', ico: '📝', color: '#8E5BE8' } : INFO(t.tipo);
      return `<li class="dest-tarjeta" style="--c:${i.color}">
        <a href="${enlaceProfe(t)}" aria-label="${esc(i.nombre)}: ${esc(t.titulo)}, por ${esc(t.autor)}">
          <span class="dest-ico" aria-hidden="true">${i.ico}</span>
          <b>${esc(t.titulo)}</b>
          <small>${esc(t.tipo === 'trivia' ? 'Trivia' : i.nombre)} · ${t.n} ${UNIDAD[t.tipo] || 'palabras'}</small>
          <small class="dest-autor">por ${esc(t.autor)}</small>
          <span class="fam-jugar" aria-hidden="true">${t.tipo === 'proyecto' ? 'Abrir' : 'Jugar'} <b>›</b></span></a></li>`;
    }).join('');
    $('#destacados').hidden = false;
  } catch { /* sin conexión: la portada funciona igual */ }
})();

// ---------- Avisos de la vista previa ----------
let avisoEl = null, avisoT = null;
function avisar(txt) {
  if (!avisoEl) { avisoEl = document.createElement('div'); avisoEl.className = 'aviso-previa'; avisoEl.setAttribute('role', 'status'); document.body.appendChild(avisoEl); }
  avisoEl.textContent = txt; avisoEl.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { avisoEl.hidden = true; }, 3500);
}
if (PREVIA) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="entrar.html"]');
    if (!a) return;
    e.preventDefault();
    avisar('Vista previa: iniciar sesión y crear cuentas funciona en tu sitio.');
  });
}

// ---------- Si ya inició sesión, "Ir a mi panel" ----------
if (!PREVIA) (async () => {
  try {
    const { miPerfil, paginaDeRol, avatarHtml } = await import('./comun.js');
    const perfil = await miPerfil();
    if (!perfil) return;
    $('#acciones').innerHTML = `<a class="fam-sesion" href="${paginaDeRol(perfil.rol)}">${avatarHtml(perfil.avatar, 'sm')}<span>Ir a mi panel</span><b aria-hidden="true">›</b></a>`;
  } catch { /* sin conexión: el portal y los juegos funcionan igual */ }
})();
