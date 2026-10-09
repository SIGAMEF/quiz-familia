// ============================================================
// Panel del profesor
// ============================================================
import {
  supabase, $, $$, esc, toast, abrirModal, confirmar, pedirDatos, cargando, mensajeError, coincide,
  exigirRol, salir, cierreInactividad, avatarHtml, selectorAvatar, subirAvatar, AVATARES_PROFESOR,
  urlBase, dibujarQR, mostrarQRGrande, copiar, fmtFecha, TIPOS, MODOS, textoNota, claseNota
} from './comun.js';
import { descargarPlantilla, leerExcel, leerPegado, filaAPregunta, descargarErrores, descargarLibreta, descargarResultados } from './excel.js';
import { montarEditorQuiz, montarListaPreguntas } from './editor-quiz.js';

const raiz = $('#raiz');
let perfil = null;

const VISTAS = {
  inicio: { ico: '🏠', txt: 'Inicio' },
  quizzes: { ico: '📚', txt: 'Mis quizzes' },
  carga: { ico: '📥', txt: 'Carga masiva' },
  banco: { ico: '🔎', txt: 'Todas mis preguntas' },
  grupos: { ico: '👥', txt: 'Grupos y alumnos' },
  publicar: { ico: '📣', txt: 'Publicar' },
  vivo: { ico: '🏆', txt: 'En vivo' },
  libreta: { ico: '📒', txt: 'Libreta de notas' }
};

let contenido;
let periodosCache = null;

function iniciar() {
  raiz.innerHTML = `<div class="app">
    <aside class="lateral">
      <div class="marca">📘 <span class="txt">QuizApp</span></div>
      <nav class="nav">${Object.entries(VISTAS).map(([k, v]) => `<button data-ir="${k}"><span class="ico">${v.ico}</span><span class="txt">${v.txt}</span></button>`).join('')}
        <button data-ir="perfil"><span class="ico">👤</span><span class="txt">Mi perfil</span></button></nav>
      <div class="pie">
        ${perfil.rol === 'admin' ? '<a class="btn btn-sm btn-outline btn-block" href="admin.html" style="margin-bottom:8px;">🛡 Panel admin</a>' : ''}
        <button class="btn btn-sm btn-ghost btn-block" id="bSalir">🚪 Salir</button>
      </div>
    </aside>
    <main class="principal">
      <div class="cabecera">
        <h1 id="tituloVista"></h1>
        <div class="usuario-chip" id="chipPerfil" title="Mi perfil">${avatarHtml(perfil.avatar, 'sm', '👩‍🏫')}
          <span>${esc(perfil.nombre || perfil.usuario)}</span>${perfil.institucion ? `<span class="small muted">· ${esc(perfil.institucion)}</span>` : ''}</div>
      </div>
      <div id="contenido"></div>
    </main></div>`;
  contenido = $('#contenido');
  $$('[data-ir]').forEach(b => b.onclick = () => ir(b.dataset.ir));
  $('#chipPerfil').onclick = () => ir('perfil');
  $('#bSalir').onclick = salir;
  window.addEventListener('hashchange', enrutar);
  cierreInactividad(90);
  enrutar();
}

export function ir(vista, param = '') { location.hash = vista + (param ? '/' + param : ''); }

function enrutar() {
  const [vista, param] = (location.hash.slice(1) || 'inicio').split('/');
  const clave = vista === 'quiz' ? 'quizzes' : vista;
  $$('[data-ir]').forEach(b => b.classList.toggle('activo', b.dataset.ir === clave));
  const titulos = { ...Object.fromEntries(Object.entries(VISTAS).map(([k, v]) => [k, v.txt])), perfil: 'Mi perfil', quiz: 'Editar quiz' };
  $('#tituloVista').textContent = titulos[vista] || 'Inicio';
  window.scrollTo(0, 0);
  const vistas = { inicio: vInicio, quizzes: vQuizzes, quiz: vQuiz, banco: vBanco, carga: vCarga, grupos: vGrupos, publicar: vPublicar, vivo: vVivo, libreta: vLibreta, perfil: vPerfil };
  (vistas[vista] || vInicio)(param ? decodeURIComponent(param) : '');
}

function spinner() { contenido.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>'; }
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}
async function misQuizzes() { return rpc('mis_quizzes'); }
async function misGrupos() { return rpc('mis_grupos_profesor'); }
async function periodos() {
  if (!periodosCache) { const { data } = await supabase.from('periodos').select('id, numero, nombre').order('numero'); periodosCache = data || []; }
  return periodosCache;
}
function enlaceGrupo(g) { return `${urlBase()}index.html?grupo=${g.codigo_invitacion}`; }
function falla(e) { console.error(e); contenido.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}<br><button class="btn btn-sm" style="margin-top:10px;" onclick="location.reload()">Reintentar</button></div>`; }

// ======================= INICIO =======================
async function vInicio() {
  spinner();
  try {
    const [r, quizzes, grupos] = await Promise.all([rpc('resumen_profesor'), misQuizzes(), misGrupos()]);
    const pasos = [
      { ok: r.quizzes > 0, txt: 'Crea o carga tu primer quiz', ir: 'quizzes' },
      { ok: r.grupos > 0, txt: 'Crea un grupo y comparte el enlace o QR con tus alumnos', ir: 'grupos' },
      { ok: r.publicaciones > 0, txt: 'Publica un quiz en tu grupo', ir: 'publicar' }
    ];
    contenido.innerHTML = `
      <div class="grid grid-3" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));">
        ${[['📚', r.quizzes, 'Quizzes'], ['❓', r.preguntas, 'Preguntas'], ['👥', r.grupos, 'Grupos'], ['🎒', r.alumnos, 'Alumnos'], ['📣', r.publicaciones, 'Publicados'], ['✅', r.intentos_7d, 'Intentos (7 días)']]
          .map(([i, n, t]) => `<div class="stat"><span>${i} ${t}</span><b>${n}</b></div>`).join('')}
      </div>
      ${pasos.every(p => p.ok) ? '' : `<div class="card" style="margin-top:16px;"><h2>🚀 Primeros pasos</h2><p class="sub">Sigue este orden y tus alumnos podrán empezar.</p>
        ${pasos.map((p, i) => `<div class="row" style="padding:8px 0; border-bottom:1px solid var(--line);"><span class="badge ${p.ok ? 'green' : 'gray'}">${p.ok ? '✔' : i + 1}</span>
          <span class="grow" style="font-weight:700; ${p.ok ? 'text-decoration:line-through; color:var(--muted);' : ''}">${p.txt}</span>
          ${p.ok ? '' : `<button class="btn btn-sm btn-primary" data-ir2="${p.ir}">Ir</button>`}</div>`).join('')}</div>`}
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card"><div class="row between"><h2>📚 Quizzes recientes</h2><button class="btn btn-sm" data-ir2="quizzes">Ver todos</button></div>
          ${quizzes.slice(0, 5).map(q => `<div class="row" style="padding:8px 0; border-bottom:1px solid var(--line);"><span class="grow"><b>${esc(q.titulo)}</b><br><span class="small muted">${q.n_preguntas} preguntas · ${fmtFecha(q.updated_at)}</span></span>
            <button class="btn btn-sm" data-quiz="${q.id}">Abrir</button></div>`).join('') || '<div class="empty">Aún no tienes quizzes.</div>'}
          <div class="row" style="margin-top:12px;"><button class="btn btn-primary btn-sm" data-nuevo>➕ Nuevo quiz</button><button class="btn btn-sm" data-ir2="carga">📥 Carga masiva</button></div></div>
        <div class="card"><div class="row between"><h2>👥 Mis grupos</h2><button class="btn btn-sm" data-ir2="grupos">Gestionar</button></div>
          ${grupos.slice(0, 6).map(g => `<div class="row" style="padding:8px 0; border-bottom:1px solid var(--line);"><span class="grow"><b>${esc(g.nombre)}</b><br><span class="small muted">${g.n_alumnos} alumnos · código ${esc(g.codigo_invitacion)}</span></span>
            <button class="btn btn-sm" data-copiar="${esc(enlaceGrupo(g))}">🔗 Enlace</button></div>`).join('') || '<div class="empty">Aún no tienes grupos.</div>'}</div>
      </div>`;
    $$('[data-ir2]', contenido).forEach(b => b.onclick = () => ir(b.dataset.ir2));
    $$('[data-quiz]', contenido).forEach(b => b.onclick = () => ir('quiz', b.dataset.quiz));
    $$('[data-copiar]', contenido).forEach(b => b.onclick = () => copiar(b.dataset.copiar));
    $('[data-nuevo]', contenido).onclick = nuevoQuiz;
  } catch (e) { falla(e); }
}

// ======================= QUIZZES =======================
async function nuevoQuiz() {
  const r = await pedirDatos('Nuevo quiz', [
    { nombre: 'titulo', etiqueta: 'Título *', placeholder: 'Ej: Repaso – La célula', requerido: true },
    { nombre: 'tema', etiqueta: 'Tema o curso', placeholder: 'Ej: Ciencia y Tecnología' },
    { nombre: 'descripcion', etiqueta: 'Descripción (opcional)', tipo: 'textarea' }], { boton: 'Crear y agregar preguntas' });
  if (!r) return;
  const { data, error } = await supabase.from('quizzes').insert({ profesor_id: perfil.id, titulo: r.titulo, tema: r.tema || null, descripcion: r.descripcion || null }).select('id').single();
  if (error) return toast(mensajeError(error), 'error');
  ir('quiz', data.id);
}

async function vQuizzes() {
  spinner();
  let quizzes;
  try { quizzes = await misQuizzes(); } catch (e) { return falla(e); }
  const temas = [...new Set(quizzes.map(q => q.tema).filter(Boolean))].sort();
  contenido.innerHTML = `
    <div class="row" style="margin-bottom:14px;">
      <button class="btn btn-primary" data-nuevo>➕ Nuevo quiz (manual)</button>
      <button class="btn" data-carga>📥 Carga masiva (Excel)</button>
      <span class="grow"></span>
      <input class="input" data-buscar placeholder="🔍 Buscar quiz..." style="max-width:260px;">
      <select class="input" data-tema style="width:auto;"><option value="">Todos los temas</option>${temas.map(t => `<option>${esc(t)}</option>`).join('')}</select>
    </div>
    <div class="grid grid-auto" data-lista></div>`;
  $('[data-nuevo]', contenido).onclick = nuevoQuiz;
  $('[data-carga]', contenido).onclick = () => ir('carga');
  const lista = $('[data-lista]', contenido);
  const pintar = () => {
    const txt = $('[data-buscar]', contenido).value, tema = $('[data-tema]', contenido).value;
    const vis = quizzes.filter(q => (!tema || q.tema === tema) && (!txt || coincide(`${q.titulo} ${q.tema || ''} ${(q.subtemas || []).join(' ')}`, txt)));
    lista.innerHTML = vis.map(q => `
      <div class="card" style="margin:0; display:flex; flex-direction:column;">
        <div class="row between" style="align-items:flex-start;"><h3 class="grow">${esc(q.titulo)}</h3>${q.tema ? `<span class="badge">${esc(q.tema)}</span>` : ''}</div>
        <p class="small muted" style="font-weight:700; margin:4px 0 8px;">${q.n_preguntas} preguntas · ${q.puntos} pts · ${q.n_publicaciones ? `📣 publicado ${q.n_publicaciones === 1 ? '1 vez' : q.n_publicaciones + ' veces'}` : 'sin publicar'}</p>
        ${(q.subtemas || []).length ? `<div class="chips" style="margin-bottom:8px;">${q.subtemas.slice(0, 5).map(s => `<span class="badge gray">${esc(s)}</span>`).join('')}${q.subtemas.length > 5 ? `<span class="badge gray">+${q.subtemas.length - 5}</span>` : ''}</div>` : ''}
        <p class="small muted" style="margin-top:auto;">Editado ${fmtFecha(q.updated_at, true)}</p>
        <div class="row" style="gap:6px; margin-top:10px;">
          <button class="btn btn-sm btn-primary" data-acc="editar" data-id="${q.id}">✏️ Editar</button>
          <button class="btn btn-sm btn-green" data-acc="publicar" data-id="${q.id}">📣 Publicar</button>
          <button class="btn btn-sm btn-amber" data-acc="vivo" data-id="${q.id}">🏆 En vivo</button>
          <button class="btn btn-sm" data-acc="duplicar" data-id="${q.id}" title="Duplicar">⧉</button>
          <button class="btn btn-sm btn-red" data-acc="eliminar" data-id="${q.id}" title="Eliminar">🗑</button>
        </div>
      </div>`).join('') || `<div class="empty card" style="grid-column:1/-1;"><span class="big">📚</span>${quizzes.length ? 'Ningún quiz coincide.' : 'Todavía no tienes quizzes. Crea uno a mano o súbelos desde Excel.'}</div>`;
    $$('[data-acc]', lista).forEach(b => b.onclick = () => accionQuiz(b.dataset.acc, quizzes.find(q => q.id === b.dataset.id)));
  };
  $('[data-buscar]', contenido).oninput = pintar;
  $('[data-tema]', contenido).onchange = pintar;
  pintar();
}

async function accionQuiz(acc, q) {
  if (acc === 'editar') return ir('quiz', q.id);
  if (acc === 'publicar') return ir('publicar', q.id);
  if (acc === 'vivo') return ir('vivo', q.id);
  if (acc === 'duplicar') {
    const r = await pedirDatos('Duplicar quiz', [{ nombre: 'titulo', etiqueta: 'Título de la copia', valor: q.titulo + ' (copia)', requerido: true }], { boton: 'Duplicar' });
    if (!r) return;
    try { const id = await rpc('duplicar_quiz', { p_quiz: q.id, p_titulo: r.titulo }); toast('Quiz duplicado'); ir('quiz', id); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }
  if (acc === 'eliminar') {
    const extra = q.n_publicaciones ? `\n\nEstá publicado ${q.n_publicaciones === 1 ? '1 vez' : q.n_publicaciones + ' veces'}: se borrarán esas publicaciones y TODOS los resultados de los alumnos en ellas.` : '';
    if (!await confirmar(`Se eliminará "${q.titulo}" con sus ${q.n_preguntas} preguntas.${extra}\n\nEsto no se puede deshacer.`, { titulo: '¿Eliminar quiz?', boton: 'Eliminar quiz' })) return;
    const { error } = await supabase.from('quizzes').delete().eq('id', q.id);
    if (error) return toast(mensajeError(error), 'error');
    toast('Quiz eliminado'); vQuizzes();
  }
}

function vQuiz(id) {
  montarEditorQuiz(contenido, id, {
    volver: () => ir('quizzes'),
    quizzes: misQuizzes,
    onPublicar: (qid) => ir('publicar', qid),
    onVivo: (qid) => ir('vivo', qid),
    onCargaMasiva: (qid) => ir('carga', qid)
  });
}

// ======================= BANCO =======================
async function vBanco() {
  spinner();
  let quizzes;
  try { quizzes = await misQuizzes(); } catch (e) { return falla(e); }
  const filtros = { texto: '', quiz: '', subtema: '', tipo: '' };
  contenido.innerHTML = `
    <div class="card"><p class="sub" style="margin:0 0 10px;">Busca y edita preguntas de todos tus quizzes a la vez. Puedes moverlas o copiarlas entre quizzes.</p>
      <div class="row">
        <input class="input grow" data-texto placeholder="🔍 Palabras a buscar..." style="min-width:200px;">
        <select class="input" data-quiz style="width:auto; max-width:240px;"><option value="">Todos los quizzes</option>${quizzes.map(q => `<option value="${q.id}">${esc(q.titulo)}</option>`).join('')}</select>
        <select class="input" data-subtema style="width:auto;"><option value="">Todos los subtemas</option></select>
        <select class="input" data-tipo style="width:auto;"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t.nombre}</option>`).join('')}</select>
        <button class="btn btn-primary" data-buscar>Buscar</button>
      </div><p class="hint" data-total></p></div>
    <div class="card" data-res></div>`;
  let subtemasCargados = false;
  const buscar = async () => {
    filtros.texto = $('[data-texto]', contenido).value; filtros.quiz = $('[data-quiz]', contenido).value;
    filtros.subtema = $('[data-subtema]', contenido).value; filtros.tipo = $('[data-tipo]', contenido).value;
    const res = $('[data-res]', contenido);
    res.innerHTML = '<div class="center"><div class="spinner"></div></div>';
    try {
      const r = await rpc('banco_preguntas', { p_texto: filtros.texto || null, p_quiz: filtros.quiz || null, p_subtema: filtros.subtema || null, p_tipo: filtros.tipo || null, p_limite: 300 });
      if (!subtemasCargados) {
        $('[data-subtema]', contenido).innerHTML = '<option value="">Todos los subtemas</option>' + r.subtemas.sort().map(s => `<option>${esc(s)}</option>`).join('');
        subtemasCargados = true;
      }
      $('[data-total]', contenido).textContent = r.total > r.preguntas.length ? `Se encontraron ${r.total}; se muestran las primeras ${r.preguntas.length}. Usa los filtros para acotar.` : `${r.total} pregunta(s) encontradas.`;
      montarListaPreguntas(res, r.preguntas, { mostrarQuiz: true, quizzes: misQuizzes, recargar: buscar, subtemas: r.subtemas });
    } catch (e) { res.innerHTML = `<div class="empty">${esc(mensajeError(e))}</div>`; }
  };
  $('[data-buscar]', contenido).onclick = buscar;
  $('[data-texto]', contenido).onkeydown = (e) => { if (e.key === 'Enter') buscar(); };
  ['[data-quiz]', '[data-subtema]', '[data-tipo]'].forEach(s => $(s, contenido).onchange = buscar);
  buscar();
}

// ======================= CARGA MASIVA =======================
async function vCarga(quizDestino) {
  spinner();
  let quizzes;
  try { quizzes = await misQuizzes(); } catch (e) { return falla(e); }
  const destino = quizzes.find(q => q.id === quizDestino);
  let filas = [];

  contenido.innerHTML = `
    ${destino ? `<button class="btn btn-ghost btn-sm" data-volver>← Volver al quiz</button>
      <div class="feedback neutro" style="margin-top:6px;">Las preguntas se agregarán al quiz <b>${esc(destino.titulo)}</b>.</div>` : ''}
    <div class="card">
      <h2>1. Descarga la plantilla</h2>
      <p class="sub">Trae ejemplos llenos de cada tipo de pregunta y una hoja de instrucciones. Borra los ejemplos y escribe tus preguntas.</p>
      <button class="btn btn-primary" data-plantilla>⬇️ Descargar plantilla Excel</button>
    </div>
    <div class="card">
      <h2>2. Sube el Excel o pega las filas</h2>
      <div class="pestanas" style="max-width:420px;"><button class="activo" data-tab="excel">📄 Subir Excel</button><button data-tab="pegar">📋 Pegar filas</button></div>
      <div data-panel="excel"><input type="file" class="input" accept=".xlsx" data-archivo>
        <p class="hint">Se lee la hoja "Preguntas" (o la primera hoja). La fila de cabecera se detecta sola.</p></div>
      <div data-panel="pegar" class="hidden">
        <textarea class="input" data-pegado style="min-height:150px; font-family:monospace; font-size:12.5px;" placeholder="Selecciona las filas en Excel (sin la cabecera), cópialas (Ctrl+C) y pégalas aquí (Ctrl+V)."></textarea>
        <p class="hint">Mismo orden de columnas que la plantilla: tema, subtema, tipo, enunciado, imagen_url, puntos, opcion_1…opcion_6, correctas, respuestas_completar, explicacion.</p>
        <button class="btn btn-primary" data-validar style="margin-top:8px;">🔍 Validar filas</button></div>
    </div>
    <div class="card hidden" data-paso3></div>
    <div class="card hidden" data-paso4></div>`;

  if (destino) $('[data-volver]', contenido).onclick = () => ir('quiz', destino.id);
  $('[data-plantilla]', contenido).onclick = async () => { try { await descargarPlantilla(); } catch (e) { toast(mensajeError(e), 'error'); } };
  $$('[data-tab]', contenido).forEach(b => b.onclick = () => {
    $$('[data-tab]', contenido).forEach(x => x.classList.toggle('activo', x === b));
    $$('[data-panel]', contenido).forEach(p => p.classList.toggle('hidden', p.dataset.panel !== b.dataset.tab));
  });
  $('[data-archivo]', contenido).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const c = cargando('Leyendo Excel...');
    try { procesar(await leerExcel(f), f.name.replace(/\.xlsx?$/i, '')); }
    catch (er) { toast('No se pudo leer el archivo: ' + mensajeError(er), 'error'); }
    finally { c.cerrar(); e.target.value = ''; }
  };
  $('[data-validar]', contenido).onclick = () => {
    const t = $('[data-pegado]', contenido).value;
    if (!t.trim()) return toast('Pega al menos una fila', 'error');
    try { procesar(leerPegado(t), ''); } catch (er) { toast(mensajeError(er), 'error'); }
  };

  function procesar(objetos, nombreArchivo) {
    filas = objetos.map(filaAPregunta);
    const validas = filas.filter(f => !f.error), malas = filas.filter(f => f.error);
    const p3 = $('[data-paso3]', contenido);
    p3.classList.remove('hidden');
    if (!filas.length) { p3.innerHTML = '<h2>3. Revisión</h2><div class="empty">No se encontraron filas con datos.</div>'; $('[data-paso4]', contenido).classList.add('hidden'); return; }
    p3.innerHTML = `
      <div class="row between"><h2>3. Revisión</h2>
        <div class="row"><span class="badge green">✅ ${validas.length} correctas</span><span class="badge ${malas.length ? 'red' : 'gray'}">❌ ${malas.length} con error</span>
        ${malas.length ? '<button class="btn btn-sm btn-red" data-errores>⬇️ Descargar las que tienen error</button>' : ''}
        <label class="check small"><input type="checkbox" data-solo-err> Ver solo errores</label></div></div>
      <p class="sub">${malas.length ? 'Las filas con error no se cargarán. Descárgalas, corrígelas en Excel y vuelve a subirlas.' : '¡Todo listo para guardar!'}</p>
      <div class="tabla-wrap scroll-y"><table class="tabla"><thead><tr><th>#</th><th></th><th>Tema</th><th>Tipo</th><th>Enunciado</th><th>Detalle</th></tr></thead><tbody data-cuerpo></tbody></table></div>`;
    const pintarTabla = () => {
      const solo = $('[data-solo-err]', p3).checked;
      $('[data-cuerpo]', p3).innerHTML = filas.map((f, i) => (solo && !f.error) ? '' : `
        <tr class="${f.error ? 'err-row' : ''}"><td>${i + 1}</td><td>${f.error ? '❌' : '✅'}</td><td>${esc(f.tema || '—')}</td>
        <td>${esc(TIPOS[f.pregunta.tipo]?.nombre || f.original.tipo || '')}</td><td>${esc(f.pregunta.enunciado.slice(0, 90))}</td>
        <td class="small" style="${f.error ? 'color:var(--red); font-weight:800;' : ''}">${f.error ? esc(f.error) : resumen(f.pregunta)}</td></tr>`).join('');
    };
    $('[data-solo-err]', p3).onchange = pintarTabla;
    pintarTabla();
    if (malas.length) $('[data-errores]', p3).onclick = () => descargarErrores(malas).catch(e => toast(mensajeError(e), 'error'));
    pintarGuardar(validas, nombreArchivo);
  }

  function resumen(p) {
    if (p.tipo === 'completar') return esc(p.respuestas_texto.join(' ; '));
    if (p.tipo === 'lluvia_ideas') return 'Respuesta libre';
    return p.opciones.map(o => (o.es_correcta ? '✔ ' : '') + esc(o.texto)).join(' · ');
  }

  function pintarGuardar(validas, nombreArchivo) {
    const p4 = $('[data-paso4]', contenido);
    if (!validas.length) { p4.classList.add('hidden'); return; }
    p4.classList.remove('hidden');
    const temas = {};
    validas.forEach(v => { const t = v.tema || 'Sin tema'; temas[t] = (temas[t] || 0) + 1; });
    const nombreSugerido = Object.keys(temas).length === 1 && Object.keys(temas)[0] !== 'Sin tema' ? Object.keys(temas)[0] : (nombreArchivo || '');
    p4.innerHTML = `<h2>4. Guardar ${validas.length} pregunta(s)</h2>
      ${destino ? `<p class="sub">Se agregarán al final de <b>${esc(destino.titulo)}</b>.</p>` : `
      <div class="stack" style="margin-top:10px;">
        <label class="check"><input type="radio" name="modo" value="uno" checked> Guardar todo como <b>un solo quiz</b></label>
        <div data-op="uno" style="padding-left:26px;"><input class="input" data-nombre placeholder="Nombre del quiz" value="${esc(nombreSugerido)}" style="max-width:420px;"></div>
        <label class="check"><input type="radio" name="modo" value="temas"> Un quiz <b>por cada tema</b> (${Object.keys(temas).length} quiz${Object.keys(temas).length === 1 ? '' : 'zes'})</label>
        <div data-op="temas" class="hidden" style="padding-left:26px;">${Object.entries(temas).map(([t, n]) => `<span class="badge" style="margin:2px;">${esc(t)} · ${n}</span>`).join('')}</div>
        <label class="check"><input type="radio" name="modo" value="existente" ${quizzes.length ? '' : 'disabled'}> Agregar a un <b>quiz que ya existe</b></label>
        <div data-op="existente" class="hidden" style="padding-left:26px;"><select class="input" data-existente style="max-width:420px;">${quizzes.map(q => `<option value="${q.id}">${esc(q.titulo)} (${q.n_preguntas})</option>`).join('')}</select></div>
      </div>`}
      <button class="btn btn-primary" data-guardar style="margin-top:16px;">💾 Guardar preguntas</button>`;
    $$('input[name=modo]', p4).forEach(r => r.onchange = () => $$('[data-op]', p4).forEach(d => d.classList.toggle('hidden', d.dataset.op !== r.value || !r.checked)));
    $('[data-guardar]', p4).onclick = () => guardar(validas);
  }

  async function guardar(validas) {
    const p4 = $('[data-paso4]', contenido);
    const modo = destino ? 'existente' : $('input[name=modo]:checked', p4).value;
    const btn = $('[data-guardar]', p4); btn.disabled = true;
    const c = cargando('Guardando preguntas...');
    try {
      let resultado, ids = [];
      if (modo === 'existente') {
        const qid = destino ? destino.id : $('[data-existente]', p4).value;
        resultado = await rpc('agregar_preguntas', { p_quiz: qid, p_preguntas: validas.map(v => v.pregunta) });
        ids = [{ id: qid, titulo: quizzes.find(q => q.id === qid)?.titulo }];
        toast(`${resultado.agregadas} pregunta(s) agregada(s)`);
      } else {
        let lista;
        if (modo === 'uno') {
          const nombre = $('[data-nombre]', p4).value.trim();
          if (!nombre) { c.cerrar(); btn.disabled = false; return toast('Escribe el nombre del quiz', 'error'); }
          const temasUnicos = [...new Set(validas.map(v => v.tema).filter(Boolean))];
          lista = [{ titulo: nombre, tema: temasUnicos.length === 1 ? temasUnicos[0] : null, preguntas: validas.map(v => v.pregunta) }];
        } else {
          const porTema = {};
          validas.forEach(v => { const t = v.tema || 'Sin tema'; (porTema[t] = porTema[t] || []).push(v.pregunta); });
          lista = Object.entries(porTema).map(([t, ps]) => ({ titulo: t === 'Sin tema' ? 'Quiz sin tema' : t, tema: t === 'Sin tema' ? null : t, preguntas: ps }));
        }
        resultado = await rpc('importar_quizzes', { p_datos: { quizzes: lista } });
        ids = resultado.ids;
        toast(`${resultado.quizzes} quiz(zes) creado(s) con ${resultado.preguntas} preguntas`);
      }
      const omit = resultado.omitidas || [];
      p4.innerHTML = `<h2>✅ ¡Listo!</h2>
        ${omit.length ? `<div class="feedback mal">${omit.length} pregunta(s) no se guardaron: ${omit.map(o => esc(o.motivo)).join('; ')}</div>` : ''}
        <div class="stack">${ids.map(q => `<div class="row"><b class="grow">📚 ${esc(q.titulo)}</b>
          <button class="btn btn-sm btn-primary" data-ver="${q.id}">✏️ Revisar y editar</button><button class="btn btn-sm btn-green" data-pub="${q.id}">📣 Publicar</button></div>`).join('')}</div>
        <button class="btn btn-ghost" data-otra style="margin-top:12px;">📥 Cargar otro archivo</button>`;
      $$('[data-ver]', p4).forEach(b => b.onclick = () => ir('quiz', b.dataset.ver));
      $$('[data-pub]', p4).forEach(b => b.onclick = () => ir('publicar', b.dataset.pub));
      $('[data-otra]', p4).onclick = () => vCarga(quizDestino);
      $('[data-paso3]', contenido).classList.add('hidden');
    } catch (e) {
      toast(mensajeError(e), 'error'); btn.disabled = false;
    } finally { c.cerrar(); }
  }
}

// ======================= GRUPOS =======================
async function vGrupos() {
  spinner();
  let grupos;
  try { grupos = await misGrupos(); } catch (e) { return falla(e); }
  contenido.innerHTML = `
    <div class="row" style="margin-bottom:14px;"><button class="btn btn-primary" data-nuevo>➕ Nuevo grupo</button>
      <span class="hint grow">Cada grupo tiene su enlace y QR. Los alumnos que se registren con él quedan en ese grupo.</span></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr));" data-lista></div>`;
  $('[data-nuevo]', contenido).onclick = () => editarGrupo(null);
  const lista = $('[data-lista]', contenido);
  if (!grupos.length) { lista.innerHTML = '<div class="card empty" style="grid-column:1/-1;"><span class="big">👥</span>Crea tu primer grupo (por ejemplo, "3ro A – Ciencia").</div>'; return; }
  lista.innerHTML = grupos.map(g => `
    <div class="card" style="margin:0;" data-g="${g.id}">
      <div class="row between" style="align-items:flex-start;">
        <div class="grow"><h2>${esc(g.nombre)}</h2><p class="small muted" style="font-weight:700;">${esc(g.nivel || '')}</p></div>
        <button class="btn btn-sm btn-icon" data-acc="editar" title="Editar">✏️</button>
        <button class="btn btn-sm btn-red btn-icon" data-acc="eliminar" title="Eliminar">🗑</button>
      </div>
      <div class="row" style="align-items:flex-start; margin-top:10px;">
        <div class="qr-caja" data-qr></div>
        <div class="grow stack" style="min-width:150px;">
          <div><span class="small muted" style="font-weight:800;">CÓDIGO</span><div class="titulo" style="font-size:22px; letter-spacing:2px; color:var(--primary-dark);">${esc(g.codigo_invitacion)}</div></div>
          <div class="row" style="gap:6px;"><button class="btn btn-sm" data-acc="copiar">🔗 Copiar enlace</button><button class="btn btn-sm" data-acc="qr">📱 QR grande</button></div>
          <button class="btn btn-sm btn-ghost" data-acc="codigo" style="justify-content:flex-start;">🔄 Generar código nuevo</button>
        </div>
      </div>
      <div class="stack" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--line);">
        <label class="check"><input type="checkbox" data-campo="acepta_registros" ${g.acepta_registros ? 'checked' : ''}> Acepta nuevos registros</label>
        <label class="check"><input type="checkbox" data-campo="permite_cambio" ${g.permite_cambio ? 'checked' : ''}> Los alumnos pueden cambiarse a otro de mis grupos</label>
        <div class="row"><span class="small" style="font-weight:800;">Escala de notas:</span>
          <select class="input" data-campo="escala" style="width:auto; padding:6px 10px;">
            <option value="vigesimal" ${g.escala === 'vigesimal' ? 'selected' : ''}>Vigesimal (0–20)</option>
            <option value="literal" ${g.escala === 'literal' ? 'selected' : ''}>Literal (AD, A, B, C)</option>
            <option value="ambas" ${g.escala === 'ambas' ? 'selected' : ''}>Ambas</option></select></div>
      </div>
      <div class="row" style="margin-top:12px;"><button class="btn btn-primary btn-sm" data-acc="alumnos">🎒 Alumnos (${g.n_alumnos})</button>
        <span class="small muted">📣 ${g.n_publicaciones} publicaciones</span></div>
    </div>`).join('');

  $$('[data-g]', lista).forEach(card => {
    const g = grupos.find(x => x.id === card.dataset.g);
    dibujarQR($('[data-qr]', card), enlaceGrupo(g), 110);
    $$('[data-campo]', card).forEach(inp => inp.onchange = async () => {
      const valor = inp.type === 'checkbox' ? inp.checked : inp.value;
      const { error } = await supabase.from('grupos').update({ [inp.dataset.campo]: valor }).eq('id', g.id);
      if (error) { toast(mensajeError(error), 'error'); return; }
      g[inp.dataset.campo] = valor; toast('Guardado');
    });
    $$('[data-acc]', card).forEach(b => b.onclick = async () => {
      const acc = b.dataset.acc;
      if (acc === 'editar') return editarGrupo(g);
      if (acc === 'copiar') return copiar(enlaceGrupo(g));
      if (acc === 'qr') return mostrarQRGrande(g.nombre, enlaceGrupo(g), g.codigo_invitacion, 'Escanea para crear tu cuenta en este grupo');
      if (acc === 'alumnos') return verAlumnos(g, grupos);
      if (acc === 'codigo') {
        if (!await confirmar('El enlace y el QR anteriores dejarán de funcionar. Los alumnos que ya se registraron no se ven afectados.', { titulo: '¿Generar un código nuevo?', boton: 'Generar', peligro: false })) return;
        try { await rpc('regenerar_codigo_grupo', { p_grupo: g.id }); toast('Código nuevo generado'); vGrupos(); } catch (e) { toast(mensajeError(e), 'error'); }
      }
      if (acc === 'eliminar') {
        if (!await confirmar(`Se eliminará "${g.nombre}", sus ${g.n_publicaciones} publicaciones y todos los resultados. Los ${g.n_alumnos} alumnos NO se borran, solo quedan fuera del grupo.`, { titulo: '¿Eliminar grupo?', boton: 'Eliminar grupo' })) return;
        const { error } = await supabase.from('grupos').delete().eq('id', g.id);
        if (error) return toast(mensajeError(error), 'error');
        toast('Grupo eliminado'); vGrupos();
      }
    });
  });
}

async function editarGrupo(g) {
  const r = await pedirDatos(g ? 'Editar grupo' : 'Nuevo grupo', [
    { nombre: 'nombre', etiqueta: 'Nombre del grupo *', valor: g?.nombre, placeholder: 'Ej: 3ro A – Ciencia', requerido: true },
    { nombre: 'nivel', etiqueta: 'Nivel / sección', valor: g?.nivel, placeholder: 'Ej: Secundaria' },
    { nombre: 'escala', etiqueta: 'Escala de notas', tipo: 'select', valor: g?.escala || 'vigesimal', opciones: [{ valor: 'vigesimal', texto: 'Vigesimal (0–20)' }, { valor: 'literal', texto: 'Literal (AD, A, B, C)' }, { valor: 'ambas', texto: 'Ambas' }] },
    { nombre: 'acepta_registros', etiqueta: 'Acepta nuevos registros', tipo: 'checkbox', valor: g ? g.acepta_registros : true },
    { nombre: 'permite_cambio', etiqueta: 'Los alumnos pueden cambiarse a otro de mis grupos', tipo: 'checkbox', valor: g ? g.permite_cambio : false }]);
  if (!r) return;
  const datos = { nombre: r.nombre, nivel: r.nivel || null, escala: r.escala, acepta_registros: r.acepta_registros, permite_cambio: r.permite_cambio };
  const q = g ? supabase.from('grupos').update(datos).eq('id', g.id) : supabase.from('grupos').insert({ ...datos, profesor_id: perfil.id });
  const { error } = await q;
  if (error) return toast(mensajeError(error), 'error');
  toast(g ? 'Grupo actualizado' : 'Grupo creado'); vGrupos();
}

async function verAlumnos(g, grupos) {
  const m = abrirModal(`<h3>🎒 Alumnos de ${esc(g.nombre)}</h3><div data-c><div class="center"><div class="spinner"></div></div></div>`, { ancho: true });
  const cargar = async () => {
    let alumnos;
    try { alumnos = await rpc('alumnos_de_grupo', { p_grupo: g.id }); } catch (e) { $('[data-c]', m.el).innerHTML = esc(mensajeError(e)); return; }
    const otros = grupos.filter(x => x.id !== g.id);
    $('[data-c]', m.el).innerHTML = alumnos.length ? `
      <input class="input" data-buscar placeholder="🔍 Buscar alumno..." style="margin-bottom:10px;">
      <div class="tabla-wrap scroll-y"><table class="tabla"><thead><tr><th></th><th>Alumno</th><th>Usuario</th><th>Se unió</th><th>Intentos</th><th></th></tr></thead><tbody>
      ${alumnos.map(a => `<tr data-a="${a.id}" data-txt="${esc((a.nombre || '') + ' ' + a.usuario)}"><td>${avatarHtml(a.avatar, 'sm')}</td><td><b>${esc(a.nombre || '—')}</b></td><td>${esc(a.usuario)}</td>
        <td class="small">${fmtFecha(a.unido_en)}</td><td>${a.intentos}</td>
        <td><div class="row" style="gap:4px; flex-wrap:nowrap;">
          ${otros.length ? `<select class="input" data-mover style="width:auto; padding:5px 8px; font-size:12.5px;"><option value="">Mover a…</option>${otros.map(o => `<option value="${o.id}">${esc(o.nombre)}</option>`).join('')}</select>` : ''}
          <button class="btn btn-sm" data-clave title="Restablecer contraseña">🔑</button>
          <button class="btn btn-sm btn-red" data-quitar title="Quitar del grupo">✕</button></div></td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">"Quitar" saca al alumno del grupo sin borrar su cuenta. Puede volver a unirse con el enlace si el grupo acepta registros.</p>`
      : `<div class="empty"><span class="big">🎒</span>Aún no hay alumnos. Comparte el enlace o QR del grupo.</div>`;
    const b = $('[data-buscar]', m.el);
    if (b) b.oninput = () => $$('[data-a]', m.el).forEach(tr => { tr.style.display = coincide(tr.dataset.txt, b.value) ? '' : 'none'; });
    $$('[data-a]', m.el).forEach(tr => {
      const a = alumnos.find(x => x.id === tr.dataset.a);
      const sel = $('[data-mover]', tr);
      if (sel) sel.onchange = async () => {
        if (!sel.value) return;
        try { await rpc('mover_alumno', { p_alumno: a.id, p_grupo_destino: sel.value }); toast('Alumno movido'); cargar(); }
        catch (e) { toast(mensajeError(e), 'error'); sel.value = ''; }
      };
      $('[data-clave]', tr).onclick = async () => {
        const r = await pedirDatos(`Nueva contraseña para ${a.nombre || a.usuario}`, [{ nombre: 'clave', etiqueta: 'Nueva contraseña (mínimo 6)', requerido: true }], { boton: 'Cambiar', nota: `Usuario: ${a.usuario}. Comunícale la nueva clave al alumno.` });
        if (!r) return;
        try { await rpc('resetear_clave', { p_usuario: a.id, p_clave: r.clave }); toast('Contraseña cambiada'); } catch (e) { toast(mensajeError(e), 'error'); }
      };
      $('[data-quitar]', tr).onclick = async () => {
        if (!await confirmar(`${a.nombre || a.usuario} saldrá del grupo. Sus resultados anteriores se conservan.`, { titulo: '¿Quitar alumno?', boton: 'Quitar' })) return;
        const { error } = await supabase.from('alumno_grupos').delete().eq('alumno_id', a.id).eq('grupo_id', g.id);
        if (error) return toast(mensajeError(error), 'error');
        toast('Alumno quitado'); cargar();
      };
    });
  };
  cargar();
}

// ======================= PUBLICAR =======================
function aLocal(iso) { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function aIso(local) { return local ? new Date(local).toISOString() : null; }

function camposPublicacion(p = {}, pers = []) {
  return `
    <label class="lbl">Modo</label>
    <div class="chips" data-modos>${Object.entries(MODOS).map(([k, m]) => `<button type="button" class="chip ${k === (p.modo || 'practica') ? 'activo' : ''}" data-modo="${k}">${m.ico} ${m.nombre}</button>`).join('')}</div>
    <p class="hint" data-modo-desc></p>
    <div class="grid grid-3">
      <div><label class="lbl">Periodo</label><select class="input" data-c="periodo_id"><option value="">— Sin periodo —</option>${pers.map(x => `<option value="${x.id}" ${x.id === p.periodo_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
      <div><label class="lbl">Disponible desde</label><input class="input" type="datetime-local" data-c="inicio" value="${aLocal(p.inicio)}"></div>
      <div><label class="lbl">Disponible hasta</label><input class="input" type="datetime-local" data-c="fin" value="${aLocal(p.fin)}"></div>
      <div><label class="lbl">Segundos por pregunta</label><input class="input" type="number" min="5" data-c="seg_por_pregunta" value="${p.seg_por_pregunta ?? ''}" placeholder="Sin límite"></div>
      <div><label class="lbl">Cantidad de preguntas</label><input class="input" type="number" min="1" data-c="cantidad_preguntas" value="${p.cantidad_preguntas ?? ''}" placeholder="Todas"></div>
      <div><label class="lbl">Intentos permitidos</label><input class="input" type="number" min="1" data-c="intentos_max" value="${p.intentos_max ?? ''}" placeholder="Ilimitados"></div>
      <div><label class="lbl">Peso en la libreta</label><input class="input" type="number" min="0.5" step="0.5" data-c="peso" value="${p.peso ?? 1}"></div>
    </div>
    <div class="stack" style="margin-top:12px;">
      <label class="check"><input type="checkbox" data-c="mostrar_respuestas" ${p.mostrar_respuestas !== false ? 'checked' : ''}> Al terminar, mostrar al alumno sus respuestas y las correctas</label>
      <label class="check"><input type="checkbox" data-c="barajar_preguntas" ${p.barajar_preguntas ? 'checked' : ''}> Cambiar el orden de las preguntas para cada alumno</label>
      <label class="check"><input type="checkbox" data-c="barajar_opciones" ${p.barajar_opciones !== false ? 'checked' : ''}> Cambiar el orden de las opciones</label>
    </div>`;
}
const DESC_MODO = {
  practica: 'El alumno ve si acertó después de cada pregunta. Ideal para repasar.',
  examen: 'No se muestra si acertó hasta el final (y solo si lo permites). Úsalo con intentos limitados y fechas.',
  estudio: 'Preguntas al azar del quiz, primero las que el alumno aún no vio. "Cantidad" es la sugerida y el alumno puede cambiarla; con cronómetro.'
};
function activarCamposPublicacion(cont) {
  let modo = $('[data-modo].activo', cont).dataset.modo;
  const desc = () => { $('[data-modo-desc]', cont).textContent = DESC_MODO[modo]; };
  $$('[data-modo]', cont).forEach(b => b.onclick = () => {
    modo = b.dataset.modo; $$('[data-modo]', cont).forEach(x => x.classList.toggle('activo', x === b)); desc();
    const seg = $('[data-c=seg_por_pregunta]', cont), cant = $('[data-c=cantidad_preguntas]', cont);
    if (modo === 'estudio') { if (!seg.value) seg.value = 20; if (!cant.value) cant.value = 10; }
    if (modo === 'examen') { const im = $('[data-c=intentos_max]', cont); if (!im.value) im.value = 1; }
  });
  desc();
  return () => {
    const v = (c) => $(`[data-c=${c}]`, cont);
    const num = (c) => v(c).value === '' ? null : Number(v(c).value);
    return {
      modo, periodo_id: v('periodo_id').value || null, inicio: aIso(v('inicio').value), fin: aIso(v('fin').value),
      seg_por_pregunta: num('seg_por_pregunta'), cantidad_preguntas: num('cantidad_preguntas'), intentos_max: num('intentos_max'),
      peso: num('peso') || 1, mostrar_respuestas: v('mostrar_respuestas').checked,
      barajar_preguntas: v('barajar_preguntas').checked, barajar_opciones: v('barajar_opciones').checked
    };
  };
}
function validarPublicacion(c) {
  if (c.inicio && c.fin && new Date(c.fin) <= new Date(c.inicio)) return 'La fecha final debe ser posterior a la inicial.';
  if (c.seg_por_pregunta != null && c.seg_por_pregunta < 5) return 'Mínimo 5 segundos por pregunta.';
  return null;
}

async function vPublicar(quizPre) {
  spinner();
  let quizzes, grupos, pubs, pers;
  try { [quizzes, grupos, pubs, pers] = await Promise.all([misQuizzes(), misGrupos(), rpc('mis_publicaciones_profesor'), periodos()]); }
  catch (e) { return falla(e); }
  const conPreguntas = quizzes.filter(q => q.n_preguntas > 0);
  contenido.innerHTML = `
    <div class="card"><h2>📣 Nueva publicación</h2><p class="sub">Asigna un quiz a uno o varios grupos. Puedes publicar el mismo quiz varias veces con distinta configuración.</p>
      ${!grupos.length ? '<div class="feedback mal">Primero crea un grupo en "Grupos y alumnos".</div>' : ''}
      ${!conPreguntas.length ? '<div class="feedback mal">Primero crea un quiz con preguntas.</div>' : ''}
      <div class="grid grid-2">
        <div><label class="lbl">Quiz</label><select class="input" data-quiz>${conPreguntas.map(q => `<option value="${q.id}" ${q.id === quizPre ? 'selected' : ''}>${esc(q.titulo)} (${q.n_preguntas} preg.)</option>`).join('')}</select></div>
        <div><label class="lbl">Grupos <button type="button" class="btn btn-sm btn-ghost" data-todos style="padding:0 6px;">marcar todos</button></label>
          <div class="chips" data-grupos>${grupos.map(g => `<label class="chip check" style="padding:6px 10px;"><input type="checkbox" value="${g.id}"> ${esc(g.nombre)}</label>`).join('')}</div></div>
      </div>
      <div data-config>${camposPublicacion({}, pers)}</div>
      <div class="err" data-err></div>
      <button class="btn btn-primary" data-publicar ${grupos.length && conPreguntas.length ? '' : 'disabled'}>📣 Publicar</button>
    </div>
    <div class="card"><div class="row between"><h2>Publicaciones</h2>
      <select class="input" data-filtro style="width:auto;"><option value="">Todos los grupos</option>${grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('')}</select></div>
      <div data-lista style="margin-top:10px;"></div></div>`;
  const leerConfig = activarCamposPublicacion($('[data-config]', contenido));
  $('[data-todos]', contenido).onclick = () => $$('[data-grupos] input', contenido).forEach(i => { i.checked = true; });
  $('[data-publicar]', contenido).onclick = async () => {
    const err = $('[data-err]', contenido); err.textContent = '';
    const quiz = $('[data-quiz]', contenido).value;
    const gs = $$('[data-grupos] input:checked', contenido).map(i => i.value);
    const cfg = leerConfig();
    if (!gs.length) { err.textContent = 'Marca al menos un grupo.'; return; }
    const prob = validarPublicacion(cfg); if (prob) { err.textContent = prob; return; }
    try { const n = await rpc('publicar_quiz', { p_quiz: quiz, p_grupos: gs, p_config: cfg }); toast(`Publicado en ${n} grupo(s)`); vPublicar(); }
    catch (e) { err.textContent = mensajeError(e); }
  };
  const pintar = () => {
    const f = $('[data-filtro]', contenido).value;
    const vis = pubs.filter(p => !f || p.grupo_id === f);
    $('[data-lista]', contenido).innerHTML = vis.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr>
      <th>Quiz</th><th>Grupo</th><th>Modo</th><th>Periodo</th><th>Disponible</th><th>Rindieron</th><th>Promedio</th><th>Activo</th><th></th></tr></thead><tbody>
      ${vis.map(p => `<tr data-p="${p.id}"><td><b>${esc(p.quiz_titulo)}</b><br><span class="small muted">${p.n_preguntas} preg.${p.cantidad_preguntas ? ` · usa ${p.cantidad_preguntas}` : ''}${p.intentos_max ? ` · ${p.intentos_max} intento(s)` : ''}</span></td>
        <td>${esc(p.grupo_nombre)}</td><td><span class="badge ${MODOS[p.modo].clase}">${MODOS[p.modo].ico} ${MODOS[p.modo].nombre}</span></td>
        <td class="small">${esc(p.periodo_nombre || '—')}</td>
        <td class="small">${p.inicio || p.fin ? `${p.inicio ? fmtFecha(p.inicio, true) : '…'}<br>→ ${p.fin ? fmtFecha(p.fin, true) : '…'}` : 'Siempre'}</td>
        <td>${p.rindieron}/${p.n_alumnos}</td><td class="nota ${claseNota(p.promedio)}">${textoNota(p.promedio, p.escala)}</td>
        <td><input type="checkbox" data-activo ${p.activo ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary);"></td>
        <td><div class="row" style="gap:4px; flex-wrap:nowrap;"><button class="btn btn-sm" data-res>📊</button><button class="btn btn-sm" data-edit>✏️</button><button class="btn btn-sm btn-red" data-del>🗑</button></div></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><span class="big">📣</span>Aún no hay publicaciones.</div>';
    $$('[data-p]', contenido).forEach(tr => {
      const p = pubs.find(x => x.id === tr.dataset.p);
      $('[data-activo]', tr).onchange = async (e) => {
        const { error } = await supabase.from('publicaciones').update({ activo: e.target.checked }).eq('id', p.id);
        if (error) { toast(mensajeError(error), 'error'); e.target.checked = !e.target.checked; return; }
        p.activo = e.target.checked; toast(p.activo ? 'Visible para los alumnos' : 'Oculto para los alumnos');
      };
      $('[data-res]', tr).onclick = () => verResultados(p);
      $('[data-edit]', tr).onclick = () => editarPublicacion(p, pers);
      $('[data-del]', tr).onclick = async () => {
        if (!await confirmar(`Se quitará "${p.quiz_titulo}" de ${p.grupo_nombre} y se borrarán los resultados de ${p.rindieron} alumno(s).\nSi solo quieres ocultarlo, desmarca "Activo".`, { titulo: '¿Eliminar publicación?', boton: 'Eliminar' })) return;
        const { error } = await supabase.from('publicaciones').delete().eq('id', p.id);
        if (error) return toast(mensajeError(error), 'error');
        toast('Publicación eliminada'); vPublicar();
      };
    });
  };
  $('[data-filtro]', contenido).onchange = pintar;
  pintar();
}

function editarPublicacion(p, pers) {
  const m = abrirModal(`<h3>✏️ ${esc(p.quiz_titulo)} · ${esc(p.grupo_nombre)}</h3><div data-config>${camposPublicacion(p, pers)}</div>
    <div class="err" data-err></div><div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok>Guardar</button></div>`, { ancho: true });
  const leer = activarCamposPublicacion($('[data-config]', m.el));
  $('[data-ok]', m.el).onclick = async () => {
    const cfg = leer();
    const prob = validarPublicacion(cfg); if (prob) { $('[data-err]', m.el).textContent = prob; return; }
    const { error } = await supabase.from('publicaciones').update(cfg).eq('id', p.id);
    if (error) { $('[data-err]', m.el).textContent = mensajeError(error); return; }
    toast('Publicación actualizada'); m.cerrar(); vPublicar();
  };
}

async function verResultados(p) {
  const m = abrirModal(`<h3>📊 ${esc(p.quiz_titulo)} · ${esc(p.grupo_nombre)}</h3><div data-c><div class="center"><div class="spinner"></div></div></div>`, { ancho: true });
  const cargar = async () => {
    let r;
    try { r = await rpc('resultados_publicacion', { p_pub: p.id }); } catch (e) { $('[data-c]', m.el).textContent = mensajeError(e); return; }
    const fin = r.intentos.filter(i => i.estado === 'finalizado');
    $('[data-c]', m.el).innerHTML = `
      <div class="row" style="margin-bottom:10px;"><span class="badge green">✅ ${new Set(fin.map(i => i.alumno_id)).size} rindieron</span>
        <span class="badge gray">⏳ ${r.sin_rendir.length} sin rendir</span>
        <span class="grow"></span><button class="btn btn-sm btn-primary" data-xls ${fin.length ? '' : 'disabled'}>⬇️ Excel</button></div>
      ${r.intentos.length ? `<div class="tabla-wrap scroll-y"><table class="tabla"><thead><tr><th>Alumno</th><th>Intento</th><th>Fecha</th><th>Aciertos</th><th>Puntaje</th><th>Nota</th><th></th></tr></thead><tbody>
        ${r.intentos.map(i => `<tr data-i="${i.id}"><td><div class="row" style="gap:6px; flex-wrap:nowrap;">${avatarHtml(i.avatar, 'sm')}<b>${esc(i.nombre)}</b></div></td>
          <td>${i.intento}${i.estado === 'en_curso' ? ' <span class="badge amber">en curso</span>' : ''}</td><td class="small">${fmtFecha(i.finalizado_en || i.iniciado_en, true)}</td>
          <td>${i.aciertos}/${i.total}</td><td>${Number(i.puntaje)}/${Number(i.puntaje_max)}</td>
          <td class="nota ${i.estado === 'finalizado' ? claseNota(i.nota) : ''}">${i.estado === 'finalizado' ? textoNota(i.nota, p.escala) : '—'}</td>
          <td><div class="row" style="gap:4px; flex-wrap:nowrap;"><button class="btn btn-sm" data-det title="Ver respuestas">👁</button><button class="btn btn-sm btn-red" data-borrar title="Borrar intento (podrá rendirlo otra vez)">↺</button></div></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">Nadie ha rendido este quiz todavía.</div>'}
      ${r.sin_rendir.length ? `<p class="small" style="margin-top:10px;"><b>Sin rendir:</b> ${r.sin_rendir.map(a => esc(a.nombre)).join(', ')}</p>` : ''}`;
    const xls = $('[data-xls]', m.el);
    if (xls) xls.onclick = () => descargarResultados(`${p.quiz_titulo}_${p.grupo_nombre}`, fin.map(i => ({ ...i, fecha: i.finalizado_en })), p.escala).catch(e => toast(mensajeError(e), 'error'));
    $$('[data-i]', m.el).forEach(tr => {
      const i = r.intentos.find(x => x.id === tr.dataset.i);
      $('[data-det]', tr).onclick = () => detalleIntento(i);
      $('[data-borrar]', tr).onclick = async () => {
        if (!await confirmar(`Se borrará el intento ${i.intento} de ${i.nombre}. Podrá volver a rendirlo.`, { titulo: '¿Borrar intento?', boton: 'Borrar' })) return;
        const { error } = await supabase.from('intentos').delete().eq('id', i.id);
        if (error) return toast(mensajeError(error), 'error');
        toast('Intento borrado'); cargar();
      };
    });
  };
  cargar();
}

async function detalleIntento(i) {
  let det;
  try { det = await rpc('detalle_intento', { p_intento: i.id }); } catch (e) { return toast(mensajeError(e), 'error'); }
  abrirModal(`<h3>👁 Respuestas de ${esc(i.nombre)} · intento ${i.intento}</h3>
    <div class="stack">${det.map((d, k) => `<div class="preg-card"><div class="row between"><b>${k + 1}. ${esc(d.enunciado)}</b>
      <span class="badge ${d.es_correcta === true ? 'green' : d.es_correcta === false ? 'red' : 'gray'}">${d.es_correcta === true ? '✔ Correcta' : d.es_correcta === false ? '✖ Incorrecta' : d.respondida ? 'Abierta' : 'Sin responder'} · ${Number(d.puntos || 0)}/${Number(d.puntos_max)}</span></div>
      <p class="small" style="margin-top:4px;"><b>Respondió:</b> ${esc(d.tu_respuesta || '—')}</p>
      ${d.correcta_texto ? `<p class="small"><b>Correcta:</b> ${esc(d.correcta_texto)}</p>` : ''}</div>`).join('')}</div>`, { ancho: true });
}

// ======================= EN VIVO =======================
async function vVivo(quizPre) {
  spinner();
  let quizzes, grupos, sesiones;
  try { [quizzes, grupos, sesiones] = await Promise.all([misQuizzes(), misGrupos(), rpc('mis_sesiones_vivo')]); } catch (e) { return falla(e); }
  const conPreguntas = quizzes.filter(q => q.n_preguntas > 0);
  const estados = { armado: ['Borrador', 'gray'], esperando: ['Sala abierta', 'amber'], en_curso: ['En curso', 'green'], finalizado: ['Finalizado', 'gray'] };
  contenido.innerHTML = `
    <div class="card"><h2>🏆 Nueva sesión en vivo</h2>
      <p class="sub">Tus alumnos entran con su cuenta, y cualquiera sin cuenta entra solo con su nombre y un avatar, usando el PIN, el enlace o el QR.</p>
      ${!conPreguntas.length ? '<div class="feedback mal">Primero crea un quiz con preguntas.</div>' : ''}
      <div class="grid grid-2">
        <div><label class="lbl">Quiz</label><select class="input" data-quiz>${conPreguntas.map(q => `<option value="${q.id}" ${q.id === quizPre ? 'selected' : ''}>${esc(q.titulo)} (${q.n_preguntas})</option>`).join('')}</select></div>
        <div><label class="lbl">Título de la sesión</label><input class="input" data-titulo placeholder="Igual que el quiz"></div>
      </div>
      <label class="lbl">Modo</label>
      <div class="chips"><button type="button" class="chip activo" data-modo="vivo">🎤 En vivo — tú pasas cada pregunta</button><button type="button" class="chip" data-modo="plazo">⏱ Por plazo — cada uno a su ritmo</button></div>
      <div class="grid grid-3">
        <div data-solo="vivo"><label class="lbl">Segundos por pregunta</label><input class="input" type="number" min="5" data-seg value="20" placeholder="Sin límite"></div>
        <div data-solo="plazo" class="hidden"><label class="lbl">Tiempo total (minutos)</label><input class="input" type="number" min="1" data-total placeholder="Sin límite"></div>
        <div><label class="lbl">¿Cuántas preguntas?</label><input class="input" type="number" min="1" data-cant placeholder="Todas"></div>
        <div><label class="lbl">Grupo (opcional)</label><select class="input" data-grupo><option value="">— Ninguno —</option>${grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('')}</select></div>
      </div>
      <div class="stack" style="margin-top:12px;">
        <label class="check"><input type="checkbox" data-aleatorio checked> Elegir preguntas al azar (si no, en el orden del quiz)</label>
        <label class="check" data-solo="vivo"><input type="checkbox" data-velocidad checked> Más puntos a quien responde más rápido</label>
        <label class="check"><input type="checkbox" data-invitados checked> Permitir invitados sin cuenta</label>
      </div>
      <details style="margin-top:12px;"><summary style="cursor:pointer; font-weight:800; color:var(--primary-dark);">⚙️ Elegir preguntas fijas y cambiar puntos</summary>
        <p class="hint">Las marcadas aparecen sí o sí; el resto se completa según "¿Cuántas preguntas?".</p><div data-fijas style="margin-top:8px;"></div></details>
      <div class="err" data-err></div>
      <button class="btn btn-amber" data-crear ${conPreguntas.length ? '' : 'disabled'}>🚀 Crear sesión y abrir la sala</button>
    </div>
    <div class="card"><h2>Mis sesiones</h2>
      ${sesiones.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Sesión</th><th>Modo</th><th>Estado</th><th>PIN</th><th>Participantes</th><th>Fecha</th><th></th></tr></thead><tbody>
        ${sesiones.map(s => `<tr data-s="${s.id}"><td><b>${esc(s.titulo)}</b><br><span class="small muted">${esc(s.quiz_titulo)} · ${s.n_preguntas} preg.${s.grupo_nombre ? ' · ' + esc(s.grupo_nombre) : ''}</span></td>
          <td>${s.modo === 'vivo' ? '🎤 En vivo' : '⏱ Por plazo'}</td><td><span class="badge ${estados[s.estado][1]}">${estados[s.estado][0]}</span></td>
          <td class="titulo" style="letter-spacing:2px;">${s.estado === 'finalizado' ? '—' : esc(s.codigo)}</td><td>${s.n_participantes}</td><td class="small">${fmtFecha(s.created_at, true)}</td>
          <td><div class="row" style="gap:4px; flex-wrap:nowrap;"><a class="btn btn-sm btn-primary" href="vivo.html?control=${s.id}">${s.estado === 'finalizado' ? '📊 Resultados' : '▶ Abrir'}</a>
            <button class="btn btn-sm btn-red" data-del>🗑</button></div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><span class="big">🏆</span>Aún no has creado sesiones en vivo.</div>'}</div>`;

  let modo = 'vivo';
  $$('[data-modo]', contenido).forEach(b => b.onclick = () => {
    modo = b.dataset.modo;
    $$('[data-modo]', contenido).forEach(x => x.classList.toggle('activo', x === b));
    $$('[data-solo]', contenido).forEach(x => x.classList.toggle('hidden', x.dataset.solo !== modo));
  });
  const fijasCont = $('[data-fijas]', contenido);
  let preguntasQuiz = [];
  const cargarFijas = async () => {
    const qid = $('[data-quiz]', contenido).value; if (!qid) return;
    fijasCont.innerHTML = '<div class="spinner"></div>';
    try { preguntasQuiz = await rpc('preguntas_de_quiz', { p_quiz: qid }); } catch (e) { fijasCont.textContent = mensajeError(e); return; }
    fijasCont.innerHTML = `<div class="tabla-wrap scroll-y" style="max-height:300px;"><table class="tabla"><thead><tr><th>Fija</th><th>Pregunta</th><th>Puntos</th></tr></thead><tbody>
      ${preguntasQuiz.map(p => `<tr><td><input type="checkbox" data-fija="${p.id}" style="width:18px; height:18px;"></td><td>${TIPOS[p.tipo].ico} ${esc(p.enunciado.slice(0, 100))}</td>
        <td><input class="input" type="number" min="0.5" step="0.5" data-pts="${p.id}" value="${Number(p.puntos)}" style="width:80px; padding:5px 8px;"></td></tr>`).join('')}</tbody></table></div>`;
  };
  $('[data-quiz]', contenido).onchange = cargarFijas;
  $('details', contenido).ontoggle = (e) => { if (e.target.open && !preguntasQuiz.length) cargarFijas(); };

  $('[data-crear]', contenido).onclick = async () => {
    const err = $('[data-err]', contenido); err.textContent = '';
    const puntos = {};
    $$('[data-pts]', contenido).forEach(i => { const p = preguntasQuiz.find(x => x.id === i.dataset.pts); if (p && Number(i.value) > 0 && Number(i.value) !== Number(p.puntos)) puntos[p.id] = Number(i.value); });
    const cfg = {
      titulo: $('[data-titulo]', contenido).value.trim(), modo,
      seg_por_pregunta: modo === 'vivo' ? ($('[data-seg]', contenido).value || null) : null,
      seg_total: modo === 'plazo' && $('[data-total]', contenido).value ? Number($('[data-total]', contenido).value) * 60 : null,
      cantidad: $('[data-cant]', contenido).value || null, grupo_id: $('[data-grupo]', contenido).value || null,
      aleatorio: $('[data-aleatorio]', contenido).checked, puntos_velocidad: $('[data-velocidad]', contenido).checked,
      permite_invitados: $('[data-invitados]', contenido).checked,
      fijas: $$('[data-fija]:checked', contenido).map(i => i.dataset.fija), puntos
    };
    if (cfg.seg_por_pregunta && Number(cfg.seg_por_pregunta) < 5) { err.textContent = 'Mínimo 5 segundos por pregunta.'; return; }
    try {
      const id = await rpc('vivo_crear', { p_quiz: $('[data-quiz]', contenido).value, p_config: cfg });
      const { error } = await supabase.from('sesiones_vivo').update({ estado: 'esperando' }).eq('id', id);
      if (error) throw error;
      location.href = `vivo.html?control=${id}`;
    } catch (e) { err.textContent = mensajeError(e); }
  };
  $$('[data-s]', contenido).forEach(tr => {
    $('[data-del]', tr).onclick = async () => {
      if (!await confirmar('Se borrará la sesión con sus participantes y resultados.', { titulo: '¿Eliminar sesión?', boton: 'Eliminar' })) return;
      const { error } = await supabase.from('sesiones_vivo').delete().eq('id', tr.dataset.s);
      if (error) return toast(mensajeError(error), 'error');
      toast('Sesión eliminada'); vVivo();
    };
  });
  if (quizPre) cargarFijas();
}

// ======================= LIBRETA =======================
async function vLibreta() {
  spinner();
  let grupos, pers;
  try { [grupos, pers] = await Promise.all([misGrupos(), periodos()]); } catch (e) { return falla(e); }
  if (!grupos.length) { contenido.innerHTML = '<div class="card empty"><span class="big">📒</span>Crea un grupo y publica quizzes para ver la libreta.</div>'; return; }
  contenido.innerHTML = `
    <div class="card"><div class="row">
      <div><label class="lbl" style="margin-top:0;">Grupo</label><select class="input" data-g>${grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('')}</select></div>
      <div><label class="lbl" style="margin-top:0;">Periodo</label><select class="input" data-p><option value="">Todos</option>${pers.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
      <div><label class="lbl" style="margin-top:0;">Nota que cuenta</label><select class="input" data-c><option value="mejor">Mejor intento</option><option value="ultimo">Último intento</option><option value="promedio">Promedio de intentos</option></select></div>
      <div><label class="lbl" style="margin-top:0;">Mostrar como</label><select class="input" data-e><option value="">Escala del grupo</option><option value="vigesimal">Vigesimal</option><option value="literal">Literal</option><option value="ambas">Ambas</option></select></div>
    </div>
    <label class="check" style="margin-top:12px;"><input type="checkbox" data-cero checked> Contar como 0 los quizzes no rendidos en el promedio</label>
    <div class="row" style="margin-top:12px;"><button class="btn btn-primary" data-xls>⬇️ Descargar Excel</button><span class="hint">El Excel sale con formato listo para imprimir.</span></div></div>
    <div class="card" data-tabla></div>`;
  let lib = null;
  const escala = () => $('[data-e]', contenido).value || grupos.find(g => g.id === $('[data-g]', contenido).value).escala;
  const cargar = async () => {
    const t = $('[data-tabla]', contenido);
    t.innerHTML = '<div class="center"><div class="spinner"></div></div>';
    try {
      lib = await rpc('libreta', { p_grupo: $('[data-g]', contenido).value, p_periodo: $('[data-p]', contenido).value || null, p_criterio: $('[data-c]', contenido).value, p_faltantes_cero: $('[data-cero]', contenido).checked });
    } catch (e) { t.innerHTML = esc(mensajeError(e)); return; }
    const esc_ = escala();
    if (!lib.alumnos.length) { t.innerHTML = '<div class="empty"><span class="big">🎒</span>Este grupo aún no tiene alumnos.</div>'; return; }
    if (!lib.publicaciones.length) { t.innerHTML = '<div class="empty"><span class="big">📣</span>No hay quizzes publicados en este grupo' + ($('[data-p]', contenido).value ? ' para el periodo elegido' : '') + '.</div>'; return; }
    t.innerHTML = `<div class="tabla-wrap" style="max-height:70vh;"><table class="tabla"><thead><tr><th>N°</th><th>Alumno</th>
      ${lib.publicaciones.map(p => `<th style="white-space:normal; min-width:90px; text-align:center;" title="${esc(p.titulo)}">${MODOS[p.modo].ico} ${esc(p.titulo.length > 28 ? p.titulo.slice(0, 26) + '…' : p.titulo)}${Number(p.peso) !== 1 ? `<br><span style="font-weight:600;">peso ${p.peso}</span>` : ''}</th>`).join('')}
      <th style="text-align:center;">Promedio</th></tr></thead><tbody>
      ${lib.alumnos.map((a, i) => `<tr><td>${i + 1}</td><td style="white-space:nowrap;"><b>${esc(a.nombre)}</b><br><span class="small muted">${esc(a.usuario)}</span></td>
        ${lib.publicaciones.map(p => { const n = a.notas[p.id]; return `<td class="nota ${n?.nota != null ? claseNota(n.nota) : ''}" title="${n?.intentos || 0} intento(s)">${n?.nota != null ? textoNota(n.nota, esc_) : '—'}</td>`; }).join('')}
        <td class="nota ${claseNota(a.promedio)}" style="font-size:15px;">${textoNota(a.promedio, esc_)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint" style="margin-top:8px;">AD 18–20 · A 14–17 · B 11–13 · C 0–10. Pasa el mouse por una nota para ver cuántos intentos hubo.</p>`;
  };
  ['[data-g]', '[data-p]', '[data-c]', '[data-cero]'].forEach(s => $(s, contenido).onchange = cargar);
  $('[data-e]', contenido).onchange = cargar;
  $('[data-xls]', contenido).onclick = async () => {
    if (!lib || !lib.publicaciones.length) return toast('No hay notas para exportar', 'error');
    try { await descargarLibreta(lib, escala()); } catch (e) { toast(mensajeError(e), 'error'); }
  };
  cargar();
}

// ======================= PERFIL =======================
async function vPerfil() {
  contenido.innerHTML = `<div class="grid grid-2">
    <div class="card"><h2>👤 Mis datos</h2>
      <label class="lbl">Nombre</label><input class="input" data-nombre value="${esc(perfil.nombre || '')}">
      <label class="lbl">Institución *</label><input class="input" data-inst value="${esc(perfil.institucion || '')}">
      <label class="lbl">Curso</label><input class="input" data-curso value="${esc(perfil.curso || '')}">
      <label class="lbl">Avatar o foto</label><div data-av></div>
      <p class="hint">Usuario: <b>${esc(perfil.usuario)}</b> (no se puede cambiar)</p>
      <button class="btn btn-primary" data-guardar style="margin-top:12px;">💾 Guardar</button></div>
    <div class="card"><h2>🔑 Cambiar contraseña</h2>
      <label class="lbl">Nueva contraseña</label><input class="input" type="password" data-c1 autocomplete="new-password">
      <label class="lbl">Repite la contraseña</label><input class="input" type="password" data-c2 autocomplete="new-password">
      <div class="err" data-err></div><button class="btn btn-primary" data-clave>Cambiar contraseña</button></div></div>`;
  const av = selectorAvatar($('[data-av]', contenido), { emojis: AVATARES_PROFESOR, actual: perfil.avatar && !perfil.avatar.startsWith('http') ? perfil.avatar : '' });
  $('[data-guardar]', contenido).onclick = async () => {
    const inst = $('[data-inst]', contenido).value.trim();
    if (perfil.rol === 'profesor' && !inst) return toast('La institución es obligatoria', 'error');
    const c = cargando('Guardando...');
    try {
      let avatar = av.valor();
      if (av.archivo()) avatar = await subirAvatar(av.archivo(), perfil.id);
      const nombre = $('[data-nombre]', contenido).value.trim() || null;
      let r = await supabase.from('perfiles').update({ nombre, avatar }).eq('id', perfil.id);
      if (r.error) throw r.error;
      if (perfil.rol === 'profesor') {
        r = await supabase.from('profesores').update({ institucion: inst, curso: $('[data-curso]', contenido).value.trim() || null }).eq('perfil_id', perfil.id);
        if (r.error) throw r.error;
      }
      Object.assign(perfil, { nombre, avatar, institucion: inst });
      toast('Datos guardados');
      $('#chipPerfil').innerHTML = `${avatarHtml(avatar, 'sm', '👩‍🏫')}<span>${esc(nombre || perfil.usuario)}</span><span class="small muted">· ${esc(inst)}</span>`;
    } catch (e) { toast(mensajeError(e), 'error'); }
    finally { c.cerrar(); }
  };
  $('[data-clave]', contenido).onclick = async () => {
    const c1 = $('[data-c1]', contenido).value, c2 = $('[data-c2]', contenido).value, err = $('[data-err]', contenido);
    err.textContent = '';
    if (c1.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
    if (c1 !== c2) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    const { error } = await supabase.auth.updateUser({ password: c1 });
    if (error) { err.textContent = mensajeError(error); return; }
    toast('Contraseña cambiada'); $('[data-c1]', contenido).value = ''; $('[data-c2]', contenido).value = '';
  };
}

// ======================= ARRANQUE =======================
perfil = await exigirRol(['profesor', 'admin']);
if (perfil) iniciar();
