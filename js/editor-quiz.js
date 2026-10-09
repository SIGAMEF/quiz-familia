// ============================================================
// Editor de quizzes y preguntas (lo usan profesor y admin)
// ============================================================
import { supabase, $, $$, esc, toast, abrirModal, confirmar, pedirDatos, cargando, campoImagen, subirImagen,
  mensajeError, coincide, TIPOS } from './comun.js';
import { errorPregunta, exportarPreguntas } from './excel.js';

// ---------- Tarjeta de pregunta ----------
export function tarjetaPregunta(p, { indice = null, seleccionada = false, mostrarQuiz = false, ordenable = false, total = 0 } = {}) {
  const t = TIPOS[p.tipo] || { nombre: p.tipo, ico: '❓' };
  let detalle = '';
  if (['verdadero_falso', 'opcion_unica', 'opcion_multiple'].includes(p.tipo)) {
    detalle = `<div class="ops">${(p.opciones || []).map(o => `<span class="op ${o.es_correcta ? 'ok' : ''}">${o.es_correcta ? '✔ ' : ''}${esc(o.texto || '(imagen)')}${o.imagen_url ? ' 🖼️' : ''}</span>`).join('')}</div>`;
  } else if (p.tipo === 'completar') {
    detalle = `<div class="ops">${(p.respuestas_texto || []).map((r, i) => `<span class="op ok">${i + 1}. ${esc(r.split('|').join(' / '))}</span>`).join('')}</div>`;
  } else {
    detalle = '<div class="ops"><span class="op">Respuesta libre · se muestra en la pizarra</span></div>';
  }
  return `<div class="preg-card ${seleccionada ? 'sel' : ''}" data-id="${p.id}">
    <div class="row between">
      <label class="check"><input type="checkbox" data-sel="${p.id}" ${seleccionada ? 'checked' : ''}>
        <b class="titulo" style="font-size:15px;">${indice != null ? '#' + (indice + 1) : ''}</b></label>
      <div class="row" style="gap:4px;">
        ${ordenable ? `<button class="btn btn-sm btn-ghost btn-icon" data-acc="subir" title="Subir" ${indice === 0 ? 'disabled' : ''}>↑</button>
                       <button class="btn btn-sm btn-ghost btn-icon" data-acc="bajar" title="Bajar" ${indice === total - 1 ? 'disabled' : ''}>↓</button>` : ''}
        <button class="btn btn-sm btn-icon" data-acc="editar" title="Editar">✏️</button>
        <button class="btn btn-sm btn-icon" data-acc="duplicar" title="Duplicar">⧉</button>
        <button class="btn btn-sm btn-red btn-icon" data-acc="eliminar" title="Eliminar">🗑</button>
      </div>
    </div>
    <div class="row" style="gap:6px; margin-top:4px;">
      <span class="badge">${t.ico} ${t.nombre}</span>
      ${p.subtema ? `<span class="badge gray">${esc(p.subtema)}</span>` : ''}
      <span class="badge amber">${Number(p.puntos)} pt</span>
      ${p.calificacion === 'parcial' ? '<span class="badge blue">parcial</span>' : ''}
      ${mostrarQuiz ? `<span class="badge green">📚 ${esc(p.quiz_titulo || '')}</span>` : ''}
    </div>
    <div class="enun">${esc(p.enunciado)}</div>
    ${p.imagen_url ? `<img class="mini-img" src="${esc(p.imagen_url)}" alt="">` : ''}
    ${detalle}
    ${p.explicacion ? `<p class="hint">💡 ${esc(p.explicacion)}</p>` : ''}
  </div>`;
}

// ---------- Modal de pregunta ----------
// pregunta: objeto existente o null. Devuelve una promesa que se resuelve con true si guardó.
export function abrirEditorPregunta(quizId, pregunta, { subtemas = [], titulo } = {}) {
  return new Promise(resolve => {
    let guardoAlgo = false;
    const p = pregunta ? JSON.parse(JSON.stringify(pregunta)) : { tipo: 'opcion_unica', enunciado: '', puntos: 1, opciones: [], respuestas_texto: [], calificacion: 'todo_o_nada' };
    let tipo = p.tipo;
    // estado de opciones independiente del tipo
    let opciones = (p.opciones || []).map(o => ({ texto: o.texto || '', imagen_url: o.imagen_url || '', es_correcta: !!o.es_correcta }));
    if (tipo === 'verdadero_falso') opciones = [];
    if (opciones.length < 2) opciones = [...opciones, ...Array(Math.max(0, 4 - opciones.length)).fill(0).map(() => ({ texto: '', imagen_url: '', es_correcta: false }))];
    let vfCorrecta = p.tipo === 'verdadero_falso' ? ((p.opciones || []).find(o => o.es_correcta)?.texto === 'Falso' ? 'Falso' : 'Verdadero') : 'Verdadero';
    let respuestas = [...(p.respuestas_texto || [])];

    const m = abrirModal(`
      <h3>${pregunta ? '✏️ Editar pregunta' : '➕ Nueva pregunta'}${titulo ? ` <span class="small muted">· ${esc(titulo)}</span>` : ''}</h3>
      <label class="lbl">Tipo de pregunta</label>
      <div class="chips" data-tipos>${Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="chip ${k === tipo ? 'activo' : ''}" data-tipo="${k}">${t.ico} ${t.nombre}</button>`).join('')}</div>
      <label class="lbl">Enunciado</label>
      <textarea class="input" data-enun placeholder="Escribe la pregunta...">${esc(p.enunciado)}</textarea>
      <div data-ayuda-completar class="hint hidden">Escribe <b>___</b> (tres guiones bajos) donde va cada espacio a completar.
        <button type="button" class="btn btn-sm btn-outline" data-insertar style="margin-left:6px;">Insertar espacio ___</button></div>
      <label class="lbl">Imagen de la pregunta (opcional)</label><div data-img></div>
      <div data-cuerpo></div>
      <div class="grid grid-3" style="margin-top:4px;">
        <div><label class="lbl">Subtema</label><input class="input" data-subtema list="lista-subtemas" value="${esc(p.subtema || '')}" placeholder="Ej: Célula">
          <datalist id="lista-subtemas">${subtemas.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
        <div><label class="lbl">Puntos</label><input class="input" type="number" min="0.5" step="0.5" data-puntos value="${Number(p.puntos || 1)}"></div>
        <div data-calif-wrap><label class="lbl">Calificación</label>
          <select class="input" data-calif><option value="todo_o_nada">Todo o nada</option><option value="parcial" ${p.calificacion === 'parcial' ? 'selected' : ''}>Puntaje parcial</option></select></div>
      </div>
      <label class="lbl">Explicación (se muestra después de responder)</label>
      <input class="input" data-expl value="${esc(p.explicacion || '')}" placeholder="Opcional">
      <div class="err" data-err></div>
      <div class="modal-pie">
        <button class="btn btn-outline" data-cancelar>Cancelar</button>
        ${pregunta ? '' : '<button class="btn" data-guardar-otra>Guardar y agregar otra</button>'}
        <button class="btn btn-primary" data-guardar>💾 Guardar</button>
      </div>`, { ancho: true, alCerrar: () => resolve(guardoAlgo) });

    const el = m.el;
    const img = campoImagen($('[data-img]', el), p.imagen_url || '');
    const enun = $('[data-enun]', el);
    const cuerpo = $('[data-cuerpo]', el);

    function contarEspacios() { return (enun.value.match(/_{2,}/g) || []).length; }

    function pintarCuerpo() {
      $$('[data-tipo]', el).forEach(b => b.classList.toggle('activo', b.dataset.tipo === tipo));
      $('[data-ayuda-completar]', el).classList.toggle('hidden', tipo !== 'completar');
      $('[data-calif-wrap]', el).classList.toggle('hidden', !['opcion_multiple', 'completar'].includes(tipo));
      if (tipo === 'verdadero_falso') {
        cuerpo.innerHTML = `<label class="lbl">Respuesta correcta</label>
          <div class="chips">${['Verdadero', 'Falso'].map(v => `<button type="button" class="chip ${vfCorrecta === v ? 'activo' : ''}" data-vf="${v}" style="flex:1; padding:12px;">${v === 'Verdadero' ? '✔️' : '✖️'} ${v}</button>`).join('')}</div>`;
        $$('[data-vf]', cuerpo).forEach(b => b.onclick = () => { vfCorrecta = b.dataset.vf; pintarCuerpo(); });
      } else if (tipo === 'opcion_unica' || tipo === 'opcion_multiple') {
        const multiple = tipo === 'opcion_multiple';
        if (!multiple && opciones.filter(o => o.es_correcta).length > 1) {
          let primera = true;
          opciones.forEach(o => { if (o.es_correcta) { o.es_correcta = primera; primera = false; } });
        }
        cuerpo.innerHTML = `<label class="lbl">Opciones <span style="text-transform:none; font-weight:700;">— marca ${multiple ? 'todas las correctas' : 'la correcta'}</span></label>
          <div data-ops>${opciones.map((o, i) => `
            <div class="op-fila ${o.es_correcta ? 'correcta' : ''}">
              <input type="${multiple ? 'checkbox' : 'radio'}" name="correcta" data-ok="${i}" ${o.es_correcta ? 'checked' : ''} title="Correcta">
              <input type="text" data-txt="${i}" value="${esc(o.texto)}" placeholder="Opción ${i + 1}">
              ${o.imagen_url ? `<img src="${esc(o.imagen_url)}" alt="">` : ''}
              <label class="btn btn-sm btn-ghost btn-icon" title="Imagen para esta opción" style="cursor:pointer;">📷<input type="file" accept="image/*" hidden data-opimg="${i}"></label>
              ${o.imagen_url ? `<button type="button" class="btn btn-sm btn-ghost btn-icon" data-quitarimg="${i}" title="Quitar imagen">🚫</button>` : ''}
              <button type="button" class="btn btn-sm btn-ghost btn-icon" data-borrar="${i}" title="Eliminar opción">✕</button>
            </div>`).join('')}</div>
          <button type="button" class="btn btn-sm btn-outline btn-block" data-agregar>+ Añadir opción</button>`;
        $$('[data-txt]', cuerpo).forEach(inp => inp.oninput = () => { opciones[+inp.dataset.txt].texto = inp.value; });
        $$('[data-ok]', cuerpo).forEach(inp => inp.onchange = () => {
          const i = +inp.dataset.ok;
          if (multiple) opciones[i].es_correcta = inp.checked;
          else opciones.forEach((o, k) => { o.es_correcta = k === i; });
          pintarCuerpo();
        });
        $$('[data-borrar]', cuerpo).forEach(b => b.onclick = () => {
          if (opciones.length <= 2) { toast('Debe haber al menos 2 opciones', 'error'); return; }
          opciones.splice(+b.dataset.borrar, 1); pintarCuerpo();
        });
        $$('[data-quitarimg]', cuerpo).forEach(b => b.onclick = () => { opciones[+b.dataset.quitarimg].imagen_url = ''; pintarCuerpo(); });
        $$('[data-opimg]', cuerpo).forEach(inp => inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          const c = cargando('Subiendo imagen...');
          try { opciones[+inp.dataset.opimg].imagen_url = await subirImagen(f, { maxLado: 600 }); pintarCuerpo(); }
          catch (e) { toast(mensajeError(e), 'error'); }
          finally { c.cerrar(); }
        });
        $('[data-agregar]', cuerpo).onclick = () => {
          if (opciones.length >= 8) { toast('Máximo 8 opciones', 'error'); return; }
          opciones.push({ texto: '', imagen_url: '', es_correcta: false }); pintarCuerpo();
          const ins = $$('[data-txt]', cuerpo); ins[ins.length - 1].focus();
        };
      } else if (tipo === 'completar') {
        const n = Math.max(1, contarEspacios());
        while (respuestas.length < n) respuestas.push('');
        cuerpo.innerHTML = `<label class="lbl">Respuestas correctas <span style="text-transform:none; font-weight:700;">— una por cada espacio</span></label>
          ${Array.from({ length: n }, (_, i) => `<div class="row" style="margin-bottom:6px;"><span class="badge">Espacio ${i + 1}</span>
            <input class="input grow" data-resp="${i}" value="${esc(respuestas[i] || '')}" placeholder="Ej: célula | celula"></div>`).join('')}
          <p class="hint">Separa con <b>|</b> las respuestas alternativas válidas. No importan mayúsculas ni tildes.</p>`;
        $$('[data-resp]', cuerpo).forEach(inp => inp.oninput = () => { respuestas[+inp.dataset.resp] = inp.value; });
      } else {
        cuerpo.innerHTML = `<div class="feedback neutro" style="margin-top:12px;">💭 Los alumnos escriben su idea libremente. No se califica: en el modo en vivo las respuestas aparecen en una pizarra para comentarlas en clase.</div>`;
      }
    }

    enun.oninput = () => { if (tipo === 'completar') { const n = Math.max(1, contarEspacios()); if ($$('[data-resp]', cuerpo).length !== n) pintarCuerpo(); } };
    $('[data-insertar]', el).onclick = () => {
      const s = enun.selectionStart ?? enun.value.length;
      enun.value = enun.value.slice(0, s) + '___' + enun.value.slice(enun.selectionEnd ?? s);
      enun.focus(); enun.oninput();
    };
    $$('[data-tipo]', el).forEach(b => b.onclick = () => {
      tipo = b.dataset.tipo;
      if ((tipo === 'opcion_unica' || tipo === 'opcion_multiple') && opciones.length < 2) opciones = [0, 1, 2, 3].map(() => ({ texto: '', imagen_url: '', es_correcta: false }));
      pintarCuerpo();
    });
    $('[data-cancelar]', el).onclick = () => m.cerrar();

    function datos() {
      const d = {
        tipo, enunciado: enun.value.trim(), imagen_url: img.valor() || null,
        subtema: $('[data-subtema]', el).value.trim() || null,
        puntos: Number($('[data-puntos]', el).value || 1),
        explicacion: $('[data-expl]', el).value.trim() || null,
        calificacion: ['opcion_multiple', 'completar'].includes(tipo) ? $('[data-calif]', el).value : 'todo_o_nada',
        opciones: [], respuestas_texto: []
      };
      if (tipo === 'verdadero_falso') d.opciones = [{ texto: 'Verdadero', es_correcta: vfCorrecta === 'Verdadero' }, { texto: 'Falso', es_correcta: vfCorrecta === 'Falso' }];
      else if (tipo === 'opcion_unica' || tipo === 'opcion_multiple') d.opciones = opciones.filter(o => o.texto.trim() || o.imagen_url).map(o => ({ texto: o.texto.trim(), imagen_url: o.imagen_url || null, es_correcta: o.es_correcta }));
      else if (tipo === 'completar') d.respuestas_texto = respuestas.slice(0, Math.max(1, contarEspacios())).map(r => r.split('|').map(a => a.trim()).filter(Boolean).join('|'));
      return d;
    }

    async function guardar(otra) {
      const d = datos();
      const problema = errorPregunta(d);
      if (problema) { $('[data-err]', el).textContent = problema; return; }
      const botones = $$('.modal-pie .btn', el); botones.forEach(b => b.disabled = true);
      const { error } = await supabase.rpc('guardar_pregunta', { p_quiz: quizId, p_pregunta: pregunta ? pregunta.id : null, p_datos: d });
      botones.forEach(b => b.disabled = false);
      if (error) { $('[data-err]', el).textContent = mensajeError(error); return; }
      guardoAlgo = true;
      toast(pregunta ? 'Pregunta actualizada' : 'Pregunta agregada');
      if (otra) {
        enun.value = ''; img.poner(''); $('[data-expl]', el).value = '';
        opciones = opciones.map(() => ({ texto: '', imagen_url: '', es_correcta: false }));
        respuestas = []; $('[data-err]', el).textContent = '';
        pintarCuerpo(); enun.focus();
      } else m.cerrar();
    }
    $('[data-guardar]', el).onclick = () => guardar(false);
    const otra = $('[data-guardar-otra]', el);
    if (otra) otra.onclick = () => guardar(true);
    pintarCuerpo();
  });
}

// ---------- Elegir quiz destino ----------
async function elegirQuiz(quizzes, excluir, titulo) {
  const lista = quizzes.filter(q => q.id !== excluir);
  if (!lista.length) { toast('No tienes otro quiz. Crea uno primero.', 'error'); return null; }
  const r = await pedirDatos(titulo, [{ nombre: 'quiz', etiqueta: 'Quiz destino', tipo: 'select', opciones: lista.map(q => ({ valor: q.id, texto: q.titulo })) }], { boton: 'Continuar' });
  return r ? r.quiz : null;
}

// ---------- Acciones en lote sobre preguntas ----------
export async function accionesLote(accion, ids, { quizzes = [], quizActual = null, recargar }) {
  if (!ids.length) return;
  if (accion === 'eliminar') {
    if (!await confirmar(`Se eliminarán ${ids.length} pregunta(s). Las respuestas que los alumnos ya dieron a estas preguntas también se borrarán.`)) return;
    const { error } = await supabase.from('preguntas').delete().in('id', ids);
    if (error) return toast(mensajeError(error), 'error');
    toast(`${ids.length} pregunta(s) eliminada(s)`);
  } else if (accion === 'mover' || accion === 'copiar') {
    const destino = await elegirQuiz(quizzes, quizActual, accion === 'mover' ? 'Mover preguntas a otro quiz' : 'Copiar preguntas a otro quiz');
    if (!destino) return;
    const { data, error } = await supabase.rpc('copiar_preguntas', { p_ids: ids, p_quiz_destino: destino, p_mover: accion === 'mover' });
    if (error) return toast(mensajeError(error), 'error');
    toast(`${data} pregunta(s) ${accion === 'mover' ? 'movida(s)' : 'copiada(s)'}`);
  } else if (accion === 'subtema') {
    const r = await pedirDatos('Cambiar subtema', [{ nombre: 'subtema', etiqueta: 'Nuevo subtema (vacío = quitar)' }]);
    if (!r) return;
    const { error } = await supabase.from('preguntas').update({ subtema: r.subtema || null }).in('id', ids);
    if (error) return toast(mensajeError(error), 'error');
    toast('Subtema actualizado');
  } else if (accion === 'puntos') {
    const r = await pedirDatos('Cambiar puntos', [{ nombre: 'puntos', etiqueta: 'Puntos de cada pregunta', tipo: 'number', valor: 1, requerido: true }]);
    if (!r || !(Number(r.puntos) > 0)) return;
    const { error } = await supabase.from('preguntas').update({ puntos: Number(r.puntos) }).in('id', ids);
    if (error) return toast(mensajeError(error), 'error');
    toast('Puntos actualizados');
  }
  if (recargar) await recargar();
}

function barraLote(n) {
  return `<div class="card" style="position:sticky; top:8px; z-index:20; padding:10px 14px; background:var(--primary-soft); ${n ? '' : 'display:none;'}" data-lote>
    <div class="row between"><b><span data-nsel>${n}</span> seleccionada(s)</b>
    <div class="row" style="gap:6px;">
      <button class="btn btn-sm" data-lote-acc="mover">↪ Mover a…</button>
      <button class="btn btn-sm" data-lote-acc="copiar">⧉ Copiar a…</button>
      <button class="btn btn-sm" data-lote-acc="subtema">🏷 Subtema</button>
      <button class="btn btn-sm" data-lote-acc="puntos">⭐ Puntos</button>
      <button class="btn btn-sm btn-red" data-lote-acc="eliminar">🗑 Eliminar</button>
      <button class="btn btn-sm btn-ghost" data-lote-acc="ninguna">Quitar selección</button>
    </div></div></div>`;
}

// ---------- Lista de preguntas con filtros y selección ----------
// opciones: { quizId, ordenable, mostrarQuiz, quizzes, recargar, subtemas, titulo }
export function montarListaPreguntas(cont, preguntas, op) {
  const sel = new Set();
  const filtros = { texto: '', subtema: '', tipo: '' };
  const subtemas = [...new Set(preguntas.map(p => p.subtema).filter(Boolean))].sort();

  cont.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <input class="input grow" data-f-texto placeholder="🔍 Buscar en enunciados, opciones o subtemas..." style="min-width:200px;">
      <select class="input" data-f-subtema style="width:auto;"><option value="">Todos los subtemas</option>${subtemas.map(s => `<option>${esc(s)}</option>`).join('')}</select>
      <select class="input" data-f-tipo style="width:auto;"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t.nombre}</option>`).join('')}</select>
    </div>
    <div class="row between" style="margin-bottom:8px;"><span class="small muted" style="font-weight:800;" data-cuenta></span>
      <button class="btn btn-sm btn-ghost" data-sel-visibles>☑ Seleccionar las visibles</button></div>
    ${barraLote(0)}
    <div data-items></div>`;

  const items = $('[data-items]', cont);
  const visibles = () => preguntas.filter(p =>
    (!filtros.subtema || p.subtema === filtros.subtema) && (!filtros.tipo || p.tipo === filtros.tipo) &&
    (!filtros.texto || coincide([p.enunciado, p.subtema, p.quiz_titulo, ...(p.opciones || []).map(o => o.texto), ...(p.respuestas_texto || [])].join(' '), filtros.texto)));

  function actualizarLote() {
    const lote = $('[data-lote]', cont);
    lote.style.display = sel.size ? '' : 'none';
    $('[data-nsel]', cont).textContent = sel.size;
  }

  function pintar() {
    const lista = visibles();
    const filtrado = filtros.texto || filtros.subtema || filtros.tipo;
    $('[data-cuenta]', cont).textContent = filtrado ? `${lista.length} de ${preguntas.length} preguntas` : `${preguntas.length} preguntas`;
    if (!preguntas.length) { items.innerHTML = '<div class="empty"><span class="big">📭</span>Todavía no hay preguntas.</div>'; return; }
    if (!lista.length) { items.innerHTML = '<div class="empty"><span class="big">🔍</span>Ninguna pregunta coincide con el filtro.</div>'; return; }
    const ordenable = op.ordenable && !filtrado;
    items.innerHTML = lista.map(p => tarjetaPregunta(p, {
      indice: op.ordenable ? preguntas.indexOf(p) : null, total: preguntas.length,
      seleccionada: sel.has(p.id), mostrarQuiz: op.mostrarQuiz, ordenable
    })).join('');
    $$('[data-sel]', items).forEach(ch => ch.onchange = () => {
      ch.checked ? sel.add(ch.dataset.sel) : sel.delete(ch.dataset.sel);
      ch.closest('.preg-card').classList.toggle('sel', ch.checked);
      actualizarLote();
    });
    $$('[data-acc]', items).forEach(b => b.onclick = () => accion(b.dataset.acc, b.closest('[data-id]').dataset.id));
  }

  async function accion(acc, id) {
    const p = preguntas.find(x => x.id === id);
    const quizDe = op.quizId || p.quiz_id;
    if (acc === 'editar') {
      if (await abrirEditorPregunta(quizDe, p, { subtemas: op.subtemas || subtemas, titulo: p.quiz_titulo })) await op.recargar();
    } else if (acc === 'duplicar') {
      const { error } = await supabase.rpc('copiar_preguntas', { p_ids: [id], p_quiz_destino: quizDe, p_mover: false });
      if (error) return toast(mensajeError(error), 'error');
      toast('Pregunta duplicada (al final del quiz)'); await op.recargar();
    } else if (acc === 'eliminar') {
      if (!await confirmar(`"${p.enunciado.slice(0, 120)}"\n\nSe borrarán también las respuestas que los alumnos ya dieron a esta pregunta.`, { titulo: '¿Eliminar esta pregunta?', boton: 'Eliminar' })) return;
      const { error } = await supabase.from('preguntas').delete().eq('id', id);
      if (error) return toast(mensajeError(error), 'error');
      toast('Pregunta eliminada'); await op.recargar();
    } else if (acc === 'subir' || acc === 'bajar') {
      const i = preguntas.indexOf(p), j = acc === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= preguntas.length) return;
      [preguntas[i], preguntas[j]] = [preguntas[j], preguntas[i]];
      pintar();
      const { error } = await supabase.rpc('ordenar_preguntas', { p_quiz: op.quizId, p_ids: preguntas.map(x => x.id) });
      if (error) toast(mensajeError(error), 'error');
    }
  }

  $('[data-f-texto]', cont).oninput = (e) => { filtros.texto = e.target.value; pintar(); };
  $('[data-f-subtema]', cont).onchange = (e) => { filtros.subtema = e.target.value; pintar(); };
  $('[data-f-tipo]', cont).onchange = (e) => { filtros.tipo = e.target.value; pintar(); };
  $('[data-sel-visibles]', cont).onclick = () => { visibles().forEach(p => sel.add(p.id)); pintar(); actualizarLote(); };
  $$('[data-lote-acc]', cont).forEach(b => b.onclick = async () => {
    if (b.dataset.loteAcc === 'ninguna') { sel.clear(); pintar(); actualizarLote(); return; }
    const quizzes = op.quizzes ? await op.quizzes() : [];
    await accionesLote(b.dataset.loteAcc, [...sel], { quizzes, quizActual: op.quizId, recargar: op.recargar });
  });
  pintar();
}

// ---------- Vista completa del editor de un quiz ----------
// opciones: { volver(), quizzes() → lista para mover/copiar, onPublicar(quizId), onVivo(quizId), onCargaMasiva(quizId) }
export async function montarEditorQuiz(cont, quizId, op = {}) {
  cont.innerHTML = '<div class="center" style="padding:40px;"><div class="spinner"></div></div>';
  const { data, error } = await supabase.rpc('quiz_editor', { p_quiz: quizId });
  if (error || !data) {
    console.error('quiz_editor', error);
    cont.innerHTML = `<div class="card empty"><span class="big">🤔</span>No se pudo abrir el quiz.<br><span class="small" style="color:var(--red);">${esc(mensajeError(error || 'sin datos'))}</span>
      ${/quiz_editor|function|schema cache/i.test(error?.message || '') ? '<p class="hint">Falta ejecutar la última versión de 05_parche_paneles.sql en Supabase.</p>' : ''}
      ${op.volver ? '<br><button class="btn btn-sm" data-volver2 style="margin-top:10px;">← Volver</button>' : ''}</div>`;
    const b = $('[data-volver2]', cont); if (b) b.onclick = op.volver;
    return;
  }
  const quiz = data.quiz, preguntas = data.preguntas;

  const totalPts = preguntas.filter(p => p.tipo !== 'lluvia_ideas').reduce((a, p) => a + Number(p.puntos), 0);
  const subtemas = [...new Set(preguntas.map(p => p.subtema).filter(Boolean))].sort();
  const porTipo = Object.keys(TIPOS).map(k => [k, preguntas.filter(p => p.tipo === k).length]).filter(x => x[1]);

  cont.innerHTML = `
    ${op.volver ? '<button class="btn btn-ghost btn-sm" data-volver>← Volver</button>' : ''}
    <div class="card" style="margin-top:8px;">
      <div class="row between" style="align-items:flex-start;">
        <div class="grow"><h1>${esc(quiz.titulo)}</h1>
          <div class="row" style="gap:6px; margin-top:4px;">${quiz.tema ? `<span class="badge">${esc(quiz.tema)}</span>` : ''}
            <span class="badge gray">${preguntas.length} preguntas</span><span class="badge amber">${totalPts} pts</span>
            ${porTipo.map(([k, n]) => `<span class="badge gray">${TIPOS[k].ico} ${n}</span>`).join('')}</div>
          ${quiz.descripcion ? `<p class="muted" style="margin-top:6px; font-weight:600;">${esc(quiz.descripcion)}</p>` : ''}</div>
        <button class="btn btn-sm" data-editar-quiz>✏️ Datos del quiz</button>
      </div>
      <div class="row" style="margin-top:14px; gap:8px;">
        <button class="btn btn-primary" data-nueva>➕ Agregar pregunta</button>
        ${op.onCargaMasiva ? '<button class="btn" data-masiva>📥 Agregar desde Excel / pegado</button>' : ''}
        <button class="btn" data-exportar>⬇️ Exportar a Excel</button>
        ${op.onPublicar ? '<button class="btn btn-green" data-publicar>📣 Publicar</button>' : ''}
        ${op.onVivo ? '<button class="btn btn-amber" data-vivo>🏆 Jugar en vivo</button>' : ''}
        <button class="btn btn-red" data-vaciar ${preguntas.length ? '' : 'disabled'}>🗑 Eliminar todas</button>
      </div>
    </div>
    <div class="card" data-lista></div>`;

  const recargar = () => montarEditorQuiz(cont, quizId, op);
  if (op.volver) $('[data-volver]', cont).onclick = op.volver;
  $('[data-nueva]', cont).onclick = async () => { if (await abrirEditorPregunta(quizId, null, { subtemas })) recargar(); };
  if (op.onCargaMasiva) $('[data-masiva]', cont).onclick = () => op.onCargaMasiva(quizId);
  if (op.onPublicar) $('[data-publicar]', cont).onclick = () => op.onPublicar(quizId);
  if (op.onVivo) $('[data-vivo]', cont).onclick = () => op.onVivo(quizId);
  $('[data-exportar]', cont).onclick = async () => {
    try { await exportarPreguntas(quiz.titulo, preguntas); } catch (e) { toast(mensajeError(e), 'error'); }
  };
  $('[data-vaciar]', cont).onclick = async () => {
    if (!await confirmar(`Se eliminarán las ${preguntas.length} preguntas de "${quiz.titulo}". El quiz queda vacío (no se borra).`, { titulo: '¿Eliminar todas las preguntas?', boton: 'Eliminar todas' })) return;
    const { error } = await supabase.from('preguntas').delete().eq('quiz_id', quizId);
    if (error) return toast(mensajeError(error), 'error');
    toast('Preguntas eliminadas'); recargar();
  };
  $('[data-editar-quiz]', cont).onclick = async () => {
    const r = await pedirDatos('Datos del quiz', [
      { nombre: 'titulo', etiqueta: 'Título', valor: quiz.titulo, requerido: true },
      { nombre: 'tema', etiqueta: 'Tema / curso', valor: quiz.tema || '' },
      { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', valor: quiz.descripcion || '' }]);
    if (!r) return;
    const { error } = await supabase.from('quizzes').update({ titulo: r.titulo, tema: r.tema || null, descripcion: r.descripcion || null }).eq('id', quizId);
    if (error) return toast(mensajeError(error), 'error');
    toast('Quiz actualizado'); recargar();
  };
  montarListaPreguntas($('[data-lista]', cont), preguntas, { quizId, ordenable: true, quizzes: op.quizzes, recargar, subtemas, titulo: quiz.titulo });
}
