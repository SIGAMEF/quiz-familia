// ============================================================
// Panel del profesor: crear juegos (sopa, ahorcado, memorama, ordena, frase, rompecabezas, trivia y quiz relámpago),
// generarlos, publicarlos en grupos e imprimirlos. La lista está en "Mis actividades" (profesor.js).
// ============================================================
import {
  supabase, $, $$, esc, htmlMenuMas, toast, abrirModal, confirmar, cargando, mensajeError, fmtFecha,
  subirImagen, urlBase, copiar, mostrarQRGrande, avatarHtml
} from './comun.js';
import { JUEGOS } from './juegos/contenido.js';
import { generarSopa, claveSopa, capsulasSVG, colorSol } from './juegos/sopa.js';
import { imprimir } from './juegos/imprimir.js';
import { montarFilas } from './editor-filas.js';

export const TIPOS_JUEGO = ['sopa', 'ahorcado', 'memoria', 'ordena', 'frase', 'rompecabezas', 'trivia', 'relampago'];
const AYUDA = {
  sopa: 'Una palabra por línea. Si quieres, agrega una pista después de una barra: VOLCÁN | Expulsa lava',
  ahorcado: 'Una palabra (o dos) por línea, con su pista después de una barra: CÓNDOR | Ave andina de alas enormes',
  ordena: 'Una palabra por línea, con su pista después de una barra: MARIPOSA | Antes fue oruga',
  memoria: 'Una pareja por línea, separada con una barra: Red | Rojo   (también puedes usar emojis: 🐶 | Perro)',
  frase: 'Una frase por línea, con su pista después de una barra: Dios es amor | 1 Juan 4:8'
};
const NIVELES = ['Inicial', 'Primaria', 'Secundaria', 'Para toda la familia'];
const DIRS = [['horizontal', '➡ Horizontal'], ['vertical', '⬇ Vertical'], ['diagonal', '↘ Diagonal'], ['reves', '↩ Al revés']];

// "texto | pista" por línea (también acepta tabulaciones pegadas desde Excel)
function leerLineas(txt) {
  return txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/\s*[|\t]\s*/));
}
function aDatos(tipo, txt) {
  const filas = leerLineas(txt);
  if (tipo === 'memoria') return { parejas: filas.filter(f => f[0] && f[1]).map(f => [f[0], f[1]]) };
  if (tipo === 'frase') return { frases: filas.map(f => ({ frase: f[0].replace(/\s+/g, ' '), pista: f[1] || '' })) };
  return { palabras: filas.map(f => ({ palabra: f[0].toUpperCase().replace(/\s+/g, ' '), pista: f[1] || '' })) };
}
function aTexto(tipo, datos) {
  if (tipo === 'memoria') return (datos.parejas || []).map(p => `${p[0]} | ${p[1]}`).join('\n');
  if (tipo === 'frase') return (datos.frases || []).map(f => f.pista ? `${f.frase} | ${f.pista}` : f.frase).join('\n');
  return (datos.palabras || []).map(p => p.pista ? `${p.palabra} | ${p.pista}` : p.palabra).join('\n');
}
const enlaceJuego = (j) => `${urlBase()}juegos.html?g=${j.id}`;

// ======================= TARJETA (en "Mis actividades") =======================
const UNIDAD = { memoria: 'parejas', frase: 'frases', rompecabezas: 'piezas', trivia: 'preguntas', relampago: 'preguntas' };
// la Trivia que viene incluida es bíblica; la de los profesores es de cualquier tema
const infoTipo = (t) => ({ ...(JUEGOS[t] || { ico: '🎲', nombre: t }), ...(t === 'trivia' ? { nombre: 'Trivia' } : {}) });
const tipoImpresion = (t) => ['trivia', 'relampago'].includes(t) ? 'quiz' : t;   // se imprimen como un quiz

// La visibilidad (privado, grupos, público, destacado) la pinta "Mis actividades" en [data-visibilidad]
export function htmlTarjetaJuego(j) {
  const info = infoTipo(j.tipo);
  const pubs = j.publicaciones.filter(p => p.activo);
  return `<div class="card act-card" data-j="${j.id}">
      <div class="act-cab"><span class="act-ico" style="--c:${info.color || '#8E86AC'}" title="${esc(info.nombre)}">${info.ico}</span>
        <div class="grow"><h3 title="${esc(j.titulo)}">${esc(j.titulo)}</h3>
          <p class="act-meta">${esc(info.nombre)} · ${j.n} ${UNIDAD[j.tipo] || 'palabras'}${j.publico ? ` · ▶ ${j.jugadas} jugadas` : ''}</p></div></div>
      ${j.tema || pubs.length ? `<div class="act-chips" title="${esc(pubs.map(p => `${p.grupo}${p.jugaron ? ` (${p.jugaron} jugaron)` : ''}`).join(' · '))}">${j.tema ? `<span class="badge">${esc(j.tema)}</span>` : ''}${pubs.length ? `<span class="badge green">👥 ${pubs.length === 1 ? esc(pubs[0].grupo) : pubs.length + ' grupos'}</span>` : ''}</div>` : ''}
      <div class="vis-fila" data-visibilidad></div>
      <div class="act-pie"><span class="act-fecha">Editado ${fmtFecha(j.updated_at, true)}</span>
        <div class="act-acciones">
          <a class="btn btn-sm btn-primary" href="juegos.html?g=${j.id}" target="_blank" rel="noopener">▶ Jugar</a>
          <button class="btn btn-sm" data-acc="editar">✏️ Editar</button>
          <button class="btn btn-sm btn-green" data-acc="publicar">📣 Grupos</button>
          ${htmlMenuMas([['data-acc="resultados"', '📊', 'Quién jugó'], ['data-acc="enlace"', '📱', 'Enlace y QR'], ['data-acc="ficha"', '🖨', 'Imprimir ficha'], ['data-acc="solucion"', '✔', 'Imprimir solución'], 'sep', ['data-acc="eliminar"', '🗑', 'Eliminar', true]])}
        </div></div>
    </div>`;
}

// ctx: { rpc, grupos, recargar }
export function conectarTarjetaJuego(card, j, { rpc, grupos, recargar }) {
  $$('[data-acc]', card).forEach(b => b.onclick = () => accion(b.dataset.acc));
  async function accion(acc) {
    if (acc === 'editar') return abrirEditor(j.tipo, j, recargar);
    if (acc === 'ficha' || acc === 'solucion') return imprimir(tipoImpresion(j.tipo), { ...j.datos, titulo: j.titulo, tema: j.tema }, { solucion: acc === 'solucion' }).catch(e => toast(mensajeError(e), 'error'));
    if (acc === 'publicar') return publicarJuego(j, grupos, recargar);
    if (acc === 'resultados') return resultados(j, rpc);
    if (acc === 'enlace') {
      if (!j.publico) return toast('Este enlace funciona para todos cuando el juego es público. Tus alumnos lo ven en su panel si lo publicas en su grupo.', 'error');
      return mostrarQRGrande(j.titulo, enlaceJuego(j), '', 'Escanea para jugar');
    }
    if (acc === 'eliminar') {
      if (!await confirmar(`Se eliminará "${j.titulo}"${j.publicaciones.length ? ' y los resultados de tus alumnos' : ''}.`, { titulo: '¿Eliminar juego?', boton: 'Eliminar' })) return;
      const { error } = await supabase.from('juegos').delete().eq('id', j.id);
      if (error) return toast(mensajeError(error), 'error');
      toast('Juego eliminado'); recargar();
    }
  }
}

// ======================= CREAR / EDITAR =======================
function elegirTipo(alGuardar) {
  const m = abrirModal(`<h3>➕ ¿Qué juego quieres crear?</h3>
    <div class="grid grid-2" style="gap:10px;">${TIPOS_JUEGO.map(t => `<button class="tipo-juego" data-t="${t}" style="--c:${JUEGOS[t].color}">
      <span>${JUEGOS[t].ico}</span><b>${esc(JUEGOS[t].nombre)}</b><small>${esc(JUEGOS[t].desc)}</small></button>`).join('')}</div>`, { ancho: true });
  $$('[data-t]', m.el).forEach(b => b.onclick = () => { m.cerrar(); abrirEditor(b.dataset.t, null, alGuardar); });
}

// Tiempos para elegir; "✏️ Personalizado" muestra un número (minutos o segundos)
const TIEMPOS_JUEGO = [[0, 'Sin límite'], [60, '1 minuto'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos']];
const TIEMPOS_TURNO = [[0, 'Sin límite'], [10, '10 segundos'], [15, '15 segundos'], [20, '20 segundos'], [30, '30 segundos'], [60, '1 minuto']];
function selectTiempo(clave, lista, valor, unidad, min, max) {
  const propio = !lista.some(([x]) => x === valor);
  const factor = unidad === 'min' ? 60 : 1;
  return `<select class="input" data-c="${clave}" data-tiempo-sel>${lista.map(([x, t]) => `<option value="${x}" ${!propio && x === valor ? 'selected' : ''}>${t}</option>`).join('')}
      <option value="propio" ${propio ? 'selected' : ''}>✏️ Personalizado…</option></select>
    <div class="row" data-propio="${clave}" style="margin-top:6px; gap:6px; ${propio ? '' : 'display:none;'}"><input class="input" type="number" min="${min}" max="${max}" step="1"
      data-factor="${factor}" data-min="${min}" data-max="${max}" value="${propio ? Math.round(valor / factor * 10) / 10 : (unidad === 'min' ? 4 : 25)}" style="max-width:110px;">
      <span class="small muted">${unidad === 'min' ? 'minutos' : 'segundos'} (de ${min} a ${max})</span></div>`;
}

// alGuardar(juego): se llama con el juego ya guardado
export function abrirEditor(tipo, juego, alGuardar) {
  const d = juego?.datos || {};
  const info = infoTipo(tipo);
  const esSopa = tipo === 'sopa', esPuzzle = tipo === 'rompecabezas', esPreguntas = tipo === 'trivia' || tipo === 'relampago';
  let sopa = esSopa && d.grilla ? { grilla: d.grilla, ubicaciones: d.ubicaciones, faltaron: [] } : null;
  let imagen = d.imagen_url || '';
  const m = abrirModal(`<h3>${info.ico} ${juego ? 'Editar' : 'Nuevo'}: ${esc(info.nombre)}</h3>
    <div class="grid grid-2">
      <div><label class="lbl">Título *</label><input class="input" data-c="titulo" maxlength="120" value="${esc(juego?.titulo || '')}" placeholder="Ej: Animales de la sierra"></div>
      <div><label class="lbl">Tema</label><input class="input" data-c="tema" maxlength="60" value="${esc(juego?.tema || '')}" placeholder="Ej: Ciencia, Biblia, Inglés"></div>
    </div>
    <div class="grid grid-2">
      <div><label class="lbl">Nivel</label><select class="input" data-c="nivel"><option value="">—</option>${NIVELES.map(n => `<option ${juego?.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="lbl">⏱ Tiempo para jugar</label>${selectTiempo('segundos', TIEMPOS_JUEGO, Number(juego?.segundos || 0), 'min', 1, 60)}</div>
    </div>
    <div class="grid grid-2">
      <div><label class="lbl">⏳ Tiempo por ${esPreguntas ? 'pregunta' : 'turno'}</label>${selectTiempo('seg_turno', esPreguntas ? TIEMPOS_TURNO.slice(1) : TIEMPOS_TURNO, Number(d.seg_turno || (esPreguntas ? 15 : 0)), 's', 5, 300)}</div>
      ${tipo === 'ahorcado' ? `<div><label class="lbl">Dificultad</label><select class="input" data-c="dificultad">
        <option value="facil" ${d.dificultad !== 'dificil' ? 'selected' : ''}>🟢 Fácil: se marcan las letras que ya salieron</option>
        <option value="dificil" ${d.dificultad === 'dificil' ? 'selected' : ''}>🔴 Difícil: no se marcan (repetir una es error)</option></select></div>` : ''}
    </div>
    <p class="hint">Los tiempos vienen puestos al jugarlo solo o en línea (quien lo comparte puede cambiarlos). Con tiempo por ${esPreguntas ? 'pregunta' : 'turno'}, faltando 5 segundos suena un aviso y al acabarse le toca al siguiente jugador.</p>
    ${esSopa ? `<div class="grid grid-2" style="margin-top:4px;">
        <div><label class="lbl">Filas</label><input class="input" type="number" min="6" max="25" data-c="filas" value="${d.filas || 12}"></div>
        <div><label class="lbl">Columnas</label><input class="input" type="number" min="6" max="25" data-c="columnas" value="${d.columnas || 12}"></div></div>
      <label class="lbl">Las palabras pueden ir</label>
      <div class="chips">${DIRS.map(([k, t]) => `<label class="chip check"><input type="checkbox" data-dir="${k}" ${(d.direcciones || ['horizontal', 'vertical']).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div>` : ''}
    ${esPuzzle ? `<label class="lbl">Imagen *</label>
      <div class="row"><label class="btn" for="imgPuzzle">📷 Elegir imagen</label><input type="file" id="imgPuzzle" accept="image/*" class="hidden"><span class="small muted" data-estado-img>${imagen ? 'Imagen lista' : 'Usa una foto o dibujo cuadrado si puedes.'}</span></div>
      <img data-prev-img src="${esc(imagen)}" alt="" style="max-width:220px; border-radius:12px; margin-top:8px; ${imagen ? '' : 'display:none;'}">
      <label class="lbl">Piezas</label><select class="input" data-c="piezas" style="max-width:160px;">${[3, 4, 5].map(n => `<option value="${n}" ${Number(d.piezas || 3) === n ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select>`
    : `<label class="lbl">${tipo === 'memoria' ? 'Parejas (cada carta puede ser texto, imagen o ambas)' : tipo === 'frase' ? 'Frases' : esPreguntas ? 'Preguntas' : 'Palabras'} *</label>
      <div data-filas></div>`}
    ${esSopa ? `<label class="lbl">¿Qué ven los alumnos para buscar?</label>
      <div class="chips">${[['palabras', '🔤 Las palabras'], ['imagenes', '🖼 Solo las imágenes'], ['imagenes_desc', '🖼 Imágenes con su descripción']].map(([k, t]) => `<label class="chip check"><input type="radio" name="pistasSopa" data-pistas="${k}" ${(d.pistas || 'palabras') === k ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <p class="hint" data-aviso-pistas></p>` : ''}
    ${esSopa ? `<div class="row" style="margin-top:10px;"><button class="btn btn-amber" data-generar>⚙️ Generar sopa</button>
        <label class="check small"><input type="checkbox" data-versol> Ver solución</label><span class="grow"></span><span class="small" data-estado-sopa></span></div>
      <div data-prev-sopa style="margin-top:10px;"></div>` : ''}
    <p class="hint" style="margin-top:14px;">Quién lo ve (privado, tus grupos, público o destacado en la portada) se elige en la tarjeta del juego, en Mis actividades.</p>
    <div class="err" data-err></div>
    <div class="modal-pie" style="flex-wrap:wrap;">
      <button class="btn btn-sm" data-imp="0">🖨 Ficha</button><button class="btn btn-sm" data-imp="1">🖨 Solución</button>
      <span class="grow"></span>
      <button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-guardar>💾 Guardar</button></div>`, { ancho: true });
  const el = m.el;
  const v = (c) => $(`[data-c=${c}]`, el);
  const err = (t) => { $('[data-err]', el).textContent = t || ''; };
  // tiempos con "Personalizado": el número aparece solo al elegirlo
  $$('[data-tiempo-sel]', el).forEach(s => s.onchange = () => { $(`[data-propio="${s.dataset.c}"]`, el).style.display = s.value === 'propio' ? '' : 'none'; });
  const leerTiempo = (c) => {
    if (v(c).value !== 'propio') return Number(v(c).value) || 0;
    const inp = $(`[data-propio="${c}"] input`, el);
    const n = Math.min(Number(inp.dataset.max), Math.max(Number(inp.dataset.min), Number(inp.value) || Number(inp.dataset.min)));
    return Math.round(n * Number(inp.dataset.factor));
  };
  const pistasSopa = () => $('[data-pistas]:checked', el)?.dataset.pistas || 'palabras';
  const avisoPistas = () => {
    const a = $('[data-aviso-pistas]', el); if (!a) return;
    const faltan = filasEd.sinImagen();
    a.textContent = pistasSopa() !== 'palabras' && faltan ? `${faltan} palabra(s) no tienen imagen: para esas se mostrará la palabra.` : '';
  };
  const invalidarSopa = () => {
    if (esSopa && sopa) { sopa = null; pintarSopa(); $('[data-estado-sopa]', el).innerHTML = '<span style="color:var(--amber); font-weight:800;">Cambiaste algo: vuelve a generar</span>'; }
    avisoPistas();
  };
  const CLASE = tipo === 'memoria' ? 'parejas' : tipo === 'frase' ? 'frases' : esPreguntas ? 'preguntas' : 'palabras';
  const filasEd = esPuzzle ? null : montarFilas($('[data-filas]', el), CLASE, d, { alCambiar: invalidarSopa });

  // ---------- Sopa: generar y vista previa ----------
  const leerSopa = () => ({
    filas: Math.max(6, Math.min(25, Number(v('filas').value) || 12)),
    columnas: Math.max(6, Math.min(25, Number(v('columnas').value) || 12)),
    direcciones: $$('[data-dir]:checked', el).map(x => x.dataset.dir)
  });
  const pintarSopa = () => {
    const caja = $('[data-prev-sopa]', el); if (!caja) return;
    if (!sopa) { caja.innerHTML = '<p class="hint">Escribe las palabras, elige el tamaño y toca “Generar sopa”.</p>'; return; }
    const sol = $('[data-versol]', el).checked;
    const filas = sopa.grilla.length, cols = sopa.grilla[0].length;
    caja.innerHTML = `<div class="sopa-prev" style="--cols:${cols}">${sopa.grilla.map(f => f.map(l => `<span>${esc(l)}</span>`).join('')).join('')}
        ${sol ? capsulasSVG(sopa.ubicaciones, filas, cols) : ''}</div>
      ${sol ? `<div class="chips" style="margin-top:8px;">${sopa.ubicaciones.map((u, i) => `<span class="badge" style="background:${colorSol(i)}; color:#fff;">${esc(u.palabra)}</span>`).join('')}</div>` : ''}`;
    $('[data-estado-sopa]', el).innerHTML = sopa.faltaron.length
      ? `<span style="color:var(--red); font-weight:800;">No cupieron: ${esc(sopa.faltaron.join(', '))}. Agranda la sopa o quita palabras.</span>`
      : `<span style="color:var(--green); font-weight:800;">✔ ${sopa.ubicaciones.length} palabras ubicadas</span>`;
  };
  if (esSopa) {
    $('[data-generar]', el).onclick = () => {
      err('');
      const { palabras } = filasEd.leer();
      const t = leerSopa();
      if (!palabras.length) return err('Escribe al menos una palabra.');
      if (!t.direcciones.length) return err('Marca al menos una dirección.');
      const largas = palabras.filter(p => claveSopa(p.palabra).length > Math.max(t.filas, t.columnas));
      if (largas.length) return err(`Estas palabras son más largas que la sopa: ${largas.map(p => p.palabra).join(', ')}`);
      sopa = generarSopa({ palabras, ...t });
      $('[data-generar]', el).textContent = '🔄 Generar otra';
      pintarSopa();
    };
    $('[data-versol]', el).onchange = pintarSopa;
    // si cambian las palabras o el tamaño, hay que volver a generar
    [v('filas'), v('columnas'), ...$$('[data-dir]', el)].forEach(x => x.addEventListener('input', invalidarSopa));
    $$('[data-pistas]', el).forEach(x => x.addEventListener('change', avisoPistas));
    pintarSopa(); avisoPistas();
  }
  // ---------- Rompecabezas: imagen ----------
  if (esPuzzle) {
    $('#imgPuzzle', el).onchange = async (e) => {
      const a = e.target.files[0]; if (!a) return;
      const c = cargando('Subiendo imagen...');
      try { imagen = await subirImagen(a, { carpeta: 'juegos', maxLado: 1000 }); const im = $('[data-prev-img]', el); im.src = imagen; im.style.display = ''; $('[data-estado-img]', el).textContent = 'Imagen lista'; }
      catch (er) { err(mensajeError(er)); }
      finally { c.cerrar(); }
    };
  }

  const armar = () => {
    let datos;
    if (esPuzzle) datos = { imagen_url: imagen, piezas: Number(v('piezas').value) };
    else datos = filasEd.leer();
    if (esSopa) {
      if (!sopa) throw new Error('Toca “Generar sopa” antes de guardar o imprimir.');
      datos = { ...datos, ...leerSopa(), pistas: pistasSopa(), grilla: sopa.grilla, ubicaciones: sopa.ubicaciones };
    }
    if (tipo === 'memoria' && datos.parejas.length < 3) throw new Error('Completa al menos 3 parejas (cada carta con texto o imagen).');
    if (['ahorcado', 'ordena', 'sopa'].includes(tipo) && !datos.palabras.length) throw new Error('Escribe al menos una palabra.');
    if (tipo === 'frase' && !datos.frases.length) throw new Error('Escribe al menos una frase.');
    if (esPreguntas && !datos.preguntas.length) throw new Error('Completa al menos una pregunta con su respuesta correcta y una incorrecta.');
    if (esPuzzle && !imagen) throw new Error('Sube la imagen del rompecabezas.');
    return datos;
  };
  $$('[data-imp]', el).forEach(b => b.onclick = async () => {
    try { err(''); await imprimir(tipoImpresion(tipo), { ...armar(), titulo: v('titulo').value.trim() || info.nombre, tema: v('tema').value.trim() }, { solucion: b.dataset.imp === '1' }); }
    catch (e) { err(e.message); }
  });
  $('[data-guardar]', el).onclick = async () => {
    err('');
    const titulo = v('titulo').value.trim();
    if (!titulo) return err('Escribe el título.');
    let datos; try { datos = armar(); } catch (e) { return err(e.message); }
    const segTurno = leerTiempo('seg_turno');
    datos = { ...datos, ...(segTurno ? { seg_turno: segTurno } : {}), ...(tipo === 'ahorcado' && v('dificultad').value === 'dificil' ? { dificultad: 'dificil' } : {}) };
    const fila = { tipo, titulo, tema: v('tema').value.trim() || null, nivel: v('nivel').value || null, segundos: leerTiempo('segundos') || null, datos };
    const b = $('[data-guardar]', el); b.disabled = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const q = juego ? supabase.from('juegos').update(fila).eq('id', juego.id) : supabase.from('juegos').insert({ ...fila, profesor_id: user.id });
      const { data: guardado, error } = await q.select().single();
      if (error) throw error;
      toast(juego ? 'Juego guardado' : 'Juego creado'); m.cerrar(); alGuardar && alGuardar(guardado);
    } catch (e) { err(mensajeError(e)); b.disabled = false; }
  };
}

// ======================= PUBLICAR EN GRUPOS =======================
export function publicarJuego(j, grupos, alCambiar) {
  const pubDe = (g) => j.publicaciones.find(p => p.grupo_id === g.id);
  const m = abrirModal(`<h3>📣 ${esc(j.titulo)} en tus grupos</h3>
    <p class="sub">Los alumnos del grupo lo ven en su panel, lo juegan con su cuenta y tú ves quién jugó y su puntaje.</p>
    ${grupos.length ? `<div class="stack">${grupos.map(g => { const p = pubDe(g); return `<label class="check" style="justify-content:space-between;">
      <span><input type="checkbox" data-g="${g.id}" ${p && p.activo ? 'checked' : ''}> <b>${esc(g.nombre)}</b></span>
      ${p ? `<span class="small muted">${p.jugaron} jugaron</span>` : ''}</label>`; }).join('')}</div>` : '<div class="feedback mal">Primero crea un grupo.</div>'}
    <div class="err" data-err></div>
    <div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok ${grupos.length ? '' : 'disabled'}>Guardar</button></div>`);
  $('[data-ok]', m.el).onclick = async () => {
    const marcados = $$('[data-g]:checked', m.el).map(x => x.dataset.g);
    try {
      if (marcados.length) { const { error } = await supabase.rpc('publicar_juego', { p_juego: j.id, p_grupos: marcados }); if (error) throw error; }
      const apagar = j.publicaciones.filter(p => p.activo && !marcados.includes(p.grupo_id)).map(p => p.id);
      if (apagar.length) { const { error } = await supabase.from('juego_publicaciones').update({ activo: false }).in('id', apagar); if (error) throw error; }
      toast('Listo'); m.cerrar(); alCambiar();
    } catch (e) { $('[data-err]', m.el).textContent = mensajeError(e); }
  };
}

// ======================= RESULTADOS =======================
async function resultados(j, rpc) {
  let r;
  try { r = await rpc('resultados_juego', { p_juego: j.id }); } catch (e) { return toast(mensajeError(e), 'error'); }
  abrirModal(`<h3>📊 ${esc(j.titulo)}</h3>
    ${r.length ? r.map(g => `<h4 style="margin:12px 0 6px;">👥 ${esc(g.grupo)}</h4>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Alumno</th><th>Veces</th><th>Mejor puntaje</th><th>Última vez</th></tr></thead><tbody>
      ${g.filas.map(f => `<tr><td><div class="row" style="gap:6px; flex-wrap:nowrap;">${avatarHtml(f.avatar, 'sm')}<b>${esc(f.nombre)}</b></div></td><td>${f.veces}</td>
        <td>${f.mejor == null ? '—' : Number(f.mejor)}</td><td class="small">${f.ultimo ? fmtFecha(f.ultimo, true) : 'Aún no juega'}</td></tr>`).join('')}</tbody></table></div>`).join('')
      : '<div class="empty">Publícalo en un grupo para ver quién juega.</div>'}`, { ancho: true });
}
