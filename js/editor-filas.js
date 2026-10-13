// ============================================================
// Lista editable de elementos de un juego: cada fila con imagen (foto o emoji), texto y pista
// ============================================================
import { $, $$, esc, abrirModal, cargando, mensajeError, subirImagen, toast } from './comun.js';
import { figura, lado } from './juegos/util.js';

const ETIQ = {
  palabras: { texto: 'Palabra', pista: 'Pista o descripción (opcional)' },
  frases: { texto: 'Frase', pista: 'Pista o cita (opcional)' }
};
const EMOJIS = ['🐶', '🐱', '🦁', '🐘', '🦒', '🐢', '🦋', '🐟', '🦙', '🦅', '🍎', '🍌', '🍇', '🍓', '🥭', '🍉', '⚽', '🎨', '📖', '🎤', '✈️', '🏠', '🌳', '☀️', '🌙', '⭐', '❤️', '🚗', '🚲', '⛪', '✝️', '🕊️', '👨‍👩‍👧‍👦', '👵', '👴', '🧒'];

// "texto | pista" por línea (también tabulaciones pegadas desde Excel)
export function leerLineas(txt) {
  return txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/\s*[|\t]\s*/));
}

/**
 * clase: 'palabras' | 'frases' | 'parejas'
 * datos: los datos actuales del juego
 * alCambiar(): se llama cuando cambia algo (la sopa lo usa para pedir generar otra vez)
 */
export function montarFilas(cont, clase, datos, { alCambiar = () => {} } = {}) {
  let filas;
  if (clase === 'parejas') filas = (datos.parejas || []).map(p => ({ a: lado(p[0]), b: lado(p[1]) }));
  else if (clase === 'frases') filas = (datos.frases || []).map(f => ({ texto: f.frase, pista: f.pista || '', imagen: f.imagen || '' }));
  else filas = (datos.palabras || []).map(p => ({ texto: p.palabra, pista: p.pista || '', imagen: p.imagen || '' }));
  if (!filas.length) filas = Array.from({ length: 3 }, () => clase === 'parejas' ? { a: { texto: '', imagen: '' }, b: { texto: '', imagen: '' } } : { texto: '', pista: '', imagen: '' });

  const botonImg = (img, ref) => `<button type="button" class="img-btn ${img ? 'con' : ''}" data-img="${ref}" title="Imagen: subir foto o elegir emoji">${img ? figura(img) : '📷'}</button>`;
  const pintar = () => {
    cont.innerHTML = `<div class="filas-ed">${filas.map((f, i) => clase === 'parejas' ? `
        <div class="fila-ed par" data-i="${i}">
          <span class="num">${i + 1}</span>
          <div class="lado-ed">${botonImg(f.a.imagen, `${i}.a`)}<input class="input" data-t="${i}.a" value="${esc(f.a.texto)}" placeholder="Carta A (texto o solo imagen)" maxlength="60"></div>
          <span class="flecha-par" aria-hidden="true">⇄</span>
          <div class="lado-ed">${botonImg(f.b.imagen, `${i}.b`)}<input class="input" data-t="${i}.b" value="${esc(f.b.texto)}" placeholder="Carta B (texto o solo imagen)" maxlength="60"></div>
          <button type="button" class="btn btn-sm btn-ghost" data-quitar="${i}" title="Quitar">✕</button>
        </div>` : `
        <div class="fila-ed" data-i="${i}">
          <span class="num">${i + 1}</span>
          ${botonImg(f.imagen, String(i))}
          <input class="input" data-t="${i}" value="${esc(f.texto)}" placeholder="${ETIQ[clase].texto}" maxlength="${clase === 'frases' ? 120 : 40}">
          <input class="input pista-ed" data-p="${i}" value="${esc(f.pista)}" placeholder="${ETIQ[clase].pista}" maxlength="120">
          <button type="button" class="btn btn-sm btn-ghost" data-quitar="${i}" title="Quitar">✕</button>
        </div>`).join('')}</div>
      <div class="row" style="margin-top:8px; gap:6px;">
        <button type="button" class="btn btn-sm" data-agregar>➕ Agregar ${clase === 'parejas' ? 'pareja' : clase === 'frases' ? 'frase' : 'palabra'}</button>
        <button type="button" class="btn btn-sm" data-pegar>📋 Pegar una lista</button>
        <span class="small muted">${filas.filter(f => clase === 'parejas' ? (f.a.texto || f.a.imagen) && (f.b.texto || f.b.imagen) : f.texto.trim()).length} completas · toca 📷 para poner una foto o un emoji</span>
      </div>`;
    $$('[data-t]', cont).forEach(inp => inp.oninput = () => {
      const [i, l] = inp.dataset.t.split('.');
      if (l) filas[i][l].texto = inp.value; else filas[i].texto = inp.value;
      alCambiar();
    });
    $$('[data-p]', cont).forEach(inp => inp.oninput = () => { filas[inp.dataset.p].pista = inp.value; alCambiar(); });
    $$('[data-quitar]', cont).forEach(b => b.onclick = () => { filas.splice(Number(b.dataset.quitar), 1); pintar(); alCambiar(); });
    $('[data-agregar]', cont).onclick = () => {
      filas.push(clase === 'parejas' ? { a: { texto: '', imagen: '' }, b: { texto: '', imagen: '' } } : { texto: '', pista: '', imagen: '' });
      pintar(); $$('[data-t]', cont).at(clase === 'parejas' ? -2 : -1)?.focus();
    };
    $('[data-pegar]', cont).onclick = pegar;
    $$('[data-img]', cont).forEach(b => b.onclick = () => elegirImagen(b.dataset.img));
  };

  function pegar() {
    const ayuda = clase === 'parejas' ? 'Una pareja por línea: Dog | Perro' : clase === 'frases' ? 'Una frase por línea: Dios es amor | 1 Juan 4:8' : 'Una palabra por línea: CÓNDOR | Ave andina';
    const m = abrirModal(`<h3>📋 Pegar una lista</h3><p class="hint">${ayuda}. También puedes pegar dos columnas copiadas de Excel.</p>
      <textarea class="input" rows="10" data-txt placeholder="${esc(ayuda)}"></textarea>
      <div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok>Agregar a la lista</button></div>`);
    $('[data-ok]', m.el).onclick = () => {
      const nuevas = leerLineas($('[data-txt]', m.el).value);
      // quitar filas vacías antes de agregar
      filas = filas.filter(f => clase === 'parejas' ? (f.a.texto || f.a.imagen || f.b.texto || f.b.imagen) : (f.texto.trim() || f.imagen));
      nuevas.forEach(c => filas.push(clase === 'parejas' ? { a: lado(c[0]), b: lado(c[1] || '') } : { texto: c[0], pista: c[1] || '', imagen: '' }));
      m.cerrar(); pintar(); alCambiar();
    };
  }

  function elegirImagen(ref) {
    const [i, l] = ref.split('.');
    const obj = l ? filas[i][l] : filas[i];
    const m = abrirModal(`<h3>🖼 Imagen</h3>
      ${obj.imagen ? `<div class="center" style="margin-bottom:10px;"><div class="img-prev">${figura(obj.imagen)}</div></div>` : ''}
      <label class="btn btn-primary" for="fImgFila">📷 Subir foto o dibujo</label><input type="file" id="fImgFila" accept="image/*" class="hidden">
      <label class="lbl">O elige un emoji</label>
      <div class="emojis-ed">${EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
      <label class="lbl">O escribe / pega otro emoji</label><input class="input" data-emoji maxlength="8" style="max-width:120px; font-size:24px;" placeholder="🐶">
      <div class="modal-pie">${obj.imagen ? '<button class="btn btn-red" data-quitar-img>Quitar imagen</button>' : ''}<span class="grow"></span>
        <button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok>Usar emoji</button></div>`);
    const poner = (img) => { obj.imagen = img; m.cerrar(); pintar(); alCambiar(); };
    $$('[data-e]', m.el).forEach(b => b.onclick = () => poner(b.dataset.e));
    $('[data-ok]', m.el).onclick = () => {
      const e = $('[data-emoji]', m.el).value.trim();
      if (!e) return toast('Escribe un emoji o sube una foto', 'error');
      poner(e);
    };
    const q = $('[data-quitar-img]', m.el); if (q) q.onclick = () => poner('');
    $('#fImgFila', m.el).onchange = async (e) => {
      const a = e.target.files[0]; if (!a) return;
      const c = cargando('Subiendo imagen...');
      try { poner(await subirImagen(a, { carpeta: 'juegos', maxLado: 600 })); }
      catch (er) { toast(mensajeError(er), 'error'); }
      finally { c.cerrar(); }
    };
  }

  pintar();
  return {
    leer() {
      if (clase === 'parejas') return { parejas: filas.filter(f => (f.a.texto || f.a.imagen) && (f.b.texto || f.b.imagen))
        .map(f => [f.a, f.b].map(x => x.imagen ? { texto: x.texto.trim(), imagen: x.imagen } : x.texto.trim())) };
      const llenas = filas.filter(f => f.texto.trim());
      if (clase === 'frases') return { frases: llenas.map(f => ({ frase: f.texto.trim().replace(/\s+/g, ' '), pista: f.pista.trim(), ...(f.imagen ? { imagen: f.imagen } : {}) })) };
      return { palabras: llenas.map(f => ({ palabra: f.texto.trim().toUpperCase().replace(/\s+/g, ' '), pista: f.pista.trim(), ...(f.imagen ? { imagen: f.imagen } : {}) })) };
    },
    sinImagen() { return clase === 'parejas' ? 0 : filas.filter(f => f.texto.trim() && !f.imagen).length; }
  };
}
