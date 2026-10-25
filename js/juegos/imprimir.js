// ============================================================
// Hojas para imprimir (ficha del alumno y solucionario) de cada juego
// ============================================================
import { esc, barajar, sinTildes, figura, lado } from './util.js?v=202610242316';
import { sopaDe, capsulasSVG, colorSol } from './sopa.js?v=202610242316';

const MARCA = 'Quiz Familia Marroquín';
const ESTILO = `
@media screen { #zona-impresion { display: none; } }
@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not(#zona-impresion) { display: none !important; }
  body { background: #fff !important; }
  #zona-impresion { display: block; }
}
#zona-impresion { font-family: 'Nunito', Arial, sans-serif; color: #111; font-size: 12pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#zona-impresion h1 { font-family: 'Baloo 2', Arial, sans-serif; font-size: 22pt; margin: 0; line-height: 1.1; }
#zona-impresion .imp-cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; gap: 12px; }
#zona-impresion .imp-marca { font-size: 9pt; color: #555; text-align: right; }
#zona-impresion .imp-sol { display: inline-block; border: 2px solid #111; padding: 1px 8px; font-weight: 800; font-size: 10pt; margin-top: 4px; }
#zona-impresion .imp-datos { display: flex; gap: 24px; margin: 4px 0 12px; font-size: 11pt; }
#zona-impresion .imp-datos span { flex: 1; border-bottom: 1px solid #111; padding-bottom: 2px; }
#zona-impresion .imp-instr { margin: 0 0 10px; font-weight: 700; }
#zona-impresion .sopa-imp { position: relative; display: grid; width: max-content; margin: 0 auto 12px; border: 1.5px solid #555; }
#zona-impresion .sopa-imp span { display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 .5px #bbb; font-weight: 800; font-family: 'Courier New', monospace; }
#zona-impresion .sopa-imp .capsulas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#zona-impresion .punto-sol { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: middle; }
#zona-impresion .lista-pal { list-style: none; padding: 0; columns: 3; column-gap: 18px; margin-top: 6px; }
#zona-impresion .lista-pal li { break-inside: avoid; margin-bottom: 3px; }
#zona-impresion ol.items { padding-left: 22px; }
#zona-impresion ol.items > li { break-inside: avoid; margin-bottom: 12px; }
#zona-impresion .cajas { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
#zona-impresion .cajas span { width: 9mm; height: 9mm; border: 1.5px solid #111; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13pt; }
#zona-impresion .cajas span.esp { border: none; width: 5mm; }
#zona-impresion .fichas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
#zona-impresion .fichas span { border: 1.5px solid #111; border-radius: 6px; padding: 2px 8px; font-weight: 700; }
#zona-impresion .fichas.letras span { border-radius: 50%; width: 8mm; height: 8mm; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
#zona-impresion .renglon { border-bottom: 1px solid #111; height: 9mm; }
#zona-impresion .resp { font-weight: 800; }
#zona-impresion .cartas-imp { display: grid; grid-template-columns: repeat(4, 1fr); }
#zona-impresion .cartas-imp div { border: 1.5px dashed #555; height: 34mm; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 15pt; padding: 4px; break-inside: avoid; }
#zona-impresion .cartas-imp div.grande { font-size: 30pt; }
#zona-impresion table.pares { border-collapse: collapse; width: 100%; }
#zona-impresion table.pares td { border: 1px solid #999; padding: 5px 8px; }
#zona-impresion .puzzle-imp { position: relative; width: 170mm; height: 170mm; margin: 0 auto; }
#zona-impresion .puzzle-imp img { width: 100%; height: 100%; object-fit: cover; display: block; }
#zona-impresion .puzzle-imp .cortes { position: absolute; inset: 0; display: grid; }
#zona-impresion .puzzle-imp .cortes span { border: 1px dashed #fff; outline: 1px dashed #111; font-weight: 800; font-size: 10pt; color: #111; padding: 2px 4px; text-shadow: 0 0 3px #fff, 0 0 3px #fff; }
#zona-impresion .ops { list-style: none; padding: 0; margin: 4px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; }
#zona-impresion .ops li.correcta-imp { font-weight: 800; }
#zona-impresion .preg-img { max-width: 70mm; max-height: 45mm; display: block; margin: 4px 0; }
#zona-impresion .fig { display: inline-block; vertical-align: middle; }
#zona-impresion img.fig { max-width: 24mm; max-height: 24mm; border-radius: 3mm; object-fit: cover; }
#zona-impresion .fig-emoji { font-size: 24pt; }
#zona-impresion .con-img { display: flex; gap: 10px; align-items: center; }
#zona-impresion .lista-fig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px; list-style: none; padding: 0; }
#zona-impresion .lista-fig li { display: flex; gap: 8px; align-items: center; break-inside: avoid; border: 1px solid #ccc; border-radius: 3mm; padding: 4px 6px; }
#zona-impresion .lista-fig .linea { flex: 1; border-bottom: 1px solid #111; min-height: 7mm; }
#zona-impresion .cartas-imp div img.fig { max-width: 28mm; max-height: 22mm; }
#zona-impresion .cartas-imp div { flex-direction: column; gap: 3px; }
#zona-impresion .cartas-imp small { font-size: 11pt; }
#zona-impresion .cartas-imp .fig-emoji { font-size: 40pt; }
#zona-impresion .pie-imp { margin-top: 14px; font-size: 9pt; color: #555; text-align: center; }
`;

function zona() {
  if (!document.getElementById('estilo-impresion')) {
    const st = document.createElement('style'); st.id = 'estilo-impresion'; st.textContent = ESTILO; document.head.appendChild(st);
  }
  let z = document.getElementById('zona-impresion');
  if (!z) { z = document.createElement('div'); z.id = 'zona-impresion'; document.body.appendChild(z); }
  return z;
}
function cabecera(titulo, tema, solucion, instr) {
  return `<div class="imp-cab"><div><h1>${esc(titulo)}</h1>${tema ? `<div>${esc(tema)}</div>` : ''}${solucion ? '<div class="imp-sol">SOLUCIONARIO</div>' : ''}</div>
      <div class="imp-marca">${MARCA}</div></div>
    ${solucion ? '' : '<div class="imp-datos"><span>Nombre:</span><span style="flex:.5">Fecha:</span></div>'}
    ${instr ? `<p class="imp-instr">${esc(instr)}</p>` : ''}`;
}
const cajas = (palabra, llenas) => `<div class="cajas">${[...palabra.toUpperCase()].map(l => l === ' ' ? '<span class="esp"></span>' : `<span>${llenas ? esc(l) : ''}</span>`).join('')}</div>`;

const HOJAS = {
  sopa(set, sol, o) {
    const s = o.sopa || sopaDe(set, o.nivel);
    const filas = s.grilla.length, cols = s.grilla[0].length;
    const modo = o.pistas || set.pistas || 'palabras', modoFig = modo !== 'palabras' && s.ubicaciones.some(u => u.imagen);
    const tam = Math.min(11, Math.floor(180 / cols));
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? '' : 'Encuentra las palabras escondidas. Pueden estar en horizontal, vertical, en diagonal o al revés.') +
      `<div class="sopa-imp" style="grid-template-columns:repeat(${cols}, ${tam}mm); grid-auto-rows:${tam}mm; font-size:${Math.round(tam * 1.5)}pt">
        ${s.grilla.map(f => f.map(l => `<span>${esc(l)}</span>`).join('')).join('')}
        ${sol ? capsulasSVG(s.ubicaciones, filas, cols, { grosor: 0.075, relleno: 0.14 }) : ''}</div>
      ${modoFig && !sol ? `<ul class="lista-fig">${s.ubicaciones.map(u => `<li>${u.imagen ? figura(u.imagen) : `<b>${esc(u.palabra)}</b>`}<span class="linea">${modo === 'imagenes_desc' && u.pista ? `<small>${esc(u.pista)}</small>` : ''}</span></li>`).join('')}</ul>`
      : `<ul class="lista-pal">${s.ubicaciones.map((u, i) => sol
        ? `<li><span class="punto-sol" style="background:${colorSol(i)}"></span> ${u.imagen && modoFig ? figura(u.imagen) : ''} <b style="color:${colorSol(i)}">${esc(u.palabra)}</b></li>`
        : `<li>☐ <b>${esc(u.palabra)}</b>${u.pista ? ` <small>(${esc(u.pista)})</small>` : ''}</li>`).join('')}</ul>`}`;
  },
  ahorcado(set, sol) {
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? '' : 'Lee la pista y escribe la palabra, una letra en cada casilla.') +
      `<ol class="items">${set.palabras.map(p => `<li><div class="con-img">${figura(p.imagen)}<span>${esc(p.pista || '')}</span></div>${cajas(p.palabra, sol)}</li>`).join('')}</ol>`;
  },
  ordena(set, sol) {
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? '' : 'Ordena las letras para formar la palabra. Usa la pista.') +
      `<ol class="items">${set.palabras.filter(p => !p.palabra.includes(' ')).map(p => `<li><div class="con-img">${figura(p.imagen)}<span>${esc(p.pista || '')}</span></div>
        ${sol ? `<div class="resp">${esc(p.palabra.toUpperCase())}</div>` : `<div class="fichas letras">${barajar([...p.palabra.toUpperCase()]).map(l => `<span>${esc(l)}</span>`).join('')}</div>${cajas(p.palabra, false)}`}</li>`).join('')}</ol>`;
  },
  frase(set, sol) {
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? '' : 'Ordena las palabras y escribe la frase correcta.') +
      `<ol class="items">${set.frases.map(f => `<li><div class="con-img">${figura(f.imagen)}${f.pista ? `<small>${esc(f.pista)}</small>` : ''}</div>
        ${sol ? `<div class="resp">${esc(f.frase)}</div>` : `<div class="fichas">${barajar(f.frase.split(/\s+/)).map(w => `<span>${esc(w)}</span>`).join('')}</div><div class="renglon"></div>`}</li>`).join('')}</ol>`;
  },
  memoria(set, sol) {
    if (sol) return cabecera(set.titulo, set.tema || set.categoria, true, '') +
      `<table class="pares">${set.parejas.map(([a, b], i) => `<tr><td>${i + 1}</td>${[a, b].map(x => { const l = lado(x); return `<td><div class="con-img">${figura(l.imagen)}<b>${esc(l.texto)}</b></div></td>`; }).join('')}</tr>`).join('')}</table>`;

    return cabecera(set.titulo, set.tema || set.categoria, false, '✂ Recorta las tarjetas, ponlas boca abajo y juega a encontrar las parejas.') +
      `<div class="cartas-imp">${barajar(set.parejas.flat()).map(x => { const l = lado(x); return l.imagen ? `<div>${figura(l.imagen)}${l.texto ? `<small>${esc(l.texto)}</small>` : ''}</div>` : `<div>${esc(l.texto)}</div>`; }).join('')}</div>`;
  },
  rompecabezas(set, sol, o) {
    const n = Number(o.piezas) || Number(set.piezas) || 3;
    const img = o.imagen || set.imagen_url;
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? 'Así queda la imagen armada. Los números indican el lugar de cada pieza.' : '✂ Recorta por las líneas, mezcla las piezas y arma la imagen.') +
      `<div class="puzzle-imp"><img src="${esc(img)}" alt="">
        <div class="cortes" style="grid-template-columns:repeat(${n},1fr)">${Array.from({ length: n * n }, (_, i) => `<span>${sol || o.numerar ? i + 1 : ''}</span>`).join('')}</div></div>`;
  },
  quiz(set, sol) {
    const preguntas = (set.preguntas || []).map(p => p.opciones && typeof p.opciones[0] === 'string'
      ? { enunciado: p.enunciado, tipo: 'opcion_unica', opciones: p.opciones.map((t, k) => ({ texto: t, ok: k === 0 })) }
      : { ...p, opciones: (p.opciones || []).map(op => ({ texto: op.texto, imagen_url: op.imagen_url, ok: !!op.es_correcta })) });
    const letras = 'ABCDEFGH';
    return cabecera(set.titulo, set.tema || set.categoria, sol, sol ? '' : 'Marca la respuesta correcta.') +
      `<ol class="items">${preguntas.map(p => {
        const opciones = p.tipo === 'completar' || p.tipo === 'lluvia_ideas' ? [] : (sol ? p.opciones : (p.tipo === 'verdadero_falso' ? p.opciones : barajar(p.opciones)));
        let cuerpo = '';
        if (p.tipo === 'completar') {
          cuerpo = sol ? `<div class="resp">Respuesta: ${esc((p.respuestas_texto || []).map(r => r.split('|')[0]).join(' / '))}</div>` : '';
        } else if (p.tipo === 'lluvia_ideas') {
          cuerpo = sol ? '<div><i>Respuesta libre.</i></div>' : '<div class="renglon"></div><div class="renglon"></div>';
        } else {
          cuerpo = `<ul class="ops">${opciones.map((op, k) => `<li class="${sol && op.ok ? 'correcta-imp' : ''}">${sol && op.ok ? '●' : '○'} ${letras[k]}) ${esc(op.texto || '(imagen)')}</li>`).join('')}</ul>`;
          if (p.tipo === 'opcion_multiple' && !sol) cuerpo = '<small>(puede haber varias correctas)</small>' + cuerpo;
        }
        const enun = p.tipo === 'completar' && !sol ? esc(p.enunciado).replace(/_{2,}/g, '________________') : esc(p.enunciado);
        return `<li>${enun}${p.imagen_url ? `<img class="preg-img" src="${esc(p.imagen_url)}" alt="">` : ''}${cuerpo}</li>`;
      }).join('')}</ol>`;
  }
};
HOJAS.trivia = HOJAS.quiz;

/**
 * Imprime la ficha o el solucionario.
 * tipo: sopa | ahorcado | ordena | frase | memoria | rompecabezas | quiz | trivia
 * set: los datos del juego ({ titulo, tema, palabras | parejas | frases | preguntas | imagen_url ... })
 * o: { solucion, sopa (la misma sopa para ficha y solución), nivel, piezas, imagen }
 */
export async function imprimir(tipo, set, o = {}) {
  const hoja = HOJAS[tipo];
  if (!hoja) throw new Error('Este juego no se puede imprimir');
  const z = zona();
  z.innerHTML = hoja(set, !!o.solucion, o) + `<div class="pie-imp">${MARCA} · ${new Date().toLocaleDateString('es-PE')}</div>`;
  // esperar a que carguen las imágenes antes de abrir el diálogo de impresión
  const imgs = [...z.querySelectorAll('img')];
  imgs.forEach(im => { im.loading = 'eager'; });
  await Promise.race([
    Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; }))),
    new Promise(r => setTimeout(r, 5000))   // si una imagen tarda demasiado, igual se imprime
  ]);
  window.print();
}
export const puedeImprimir = (tipo) => !!HOJAS[tipo];
export { sinTildes };
