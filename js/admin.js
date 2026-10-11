// ============================================================
// Panel del administrador
// ============================================================
import {
  supabase, $, $$, esc, toast, abrirModal, confirmar, pedirDatos, mensajeError, coincide,
  exigirRol, salir, menuUsuario, cierreInactividad, avatarHtml, fmtFecha
} from './comun.js';
import { montarEditorQuiz } from './editor-quiz.js';

const raiz = $('#raiz');
let perfil = null;
let contenido;

const VISTAS = {
  inicio: { ico: '📊', txt: 'Resumen' },
  profesores: { ico: '👩‍🏫', txt: 'Profesores' },
  instituciones: { ico: '🏫', txt: 'Instituciones' },
  alumnos: { ico: '🎒', txt: 'Alumnos' },
  quizzes: { ico: '📚', txt: 'Quizzes' },
  periodos: { ico: '📅', txt: 'Periodos' }
};
const MENSAJE_DEFECTO = 'Tu cuenta fue restringida. Comunícate con el administrador de QuizApp.';

async function rpc(n, a) { const { data, error } = await supabase.rpc(n, a); if (error) throw error; return data; }
function spinner() { contenido.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>'; }
function falla(e) { contenido.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; }
function ir(v, p = '') { location.hash = v + (p ? '/' + p : ''); }

function iniciar() {
  raiz.innerHTML = `<div class="app">
    <aside class="lateral">
      <div class="marca">🛡 <span class="txt">Admin</span></div>
      <nav class="nav">${Object.entries(VISTAS).map(([k, v]) => `<button data-ir="${k}"><span class="ico">${v.ico}</span><span class="txt">${v.txt}</span></button>`).join('')}</nav>
    </aside>
    <main class="principal">
      <div class="cabecera"><h1 id="tituloVista"></h1>
        <button type="button" class="usuario-chip" id="chipPerfil" title="Mi cuenta">${avatarHtml(perfil.avatar, 'sm', '🛡')}<span class="nombre">${esc(perfil.nombre || perfil.usuario)}</span><span class="badge red extra">Admin</span><span class="flecha">▼</span></button></div>
      <div id="contenido"></div>
    </main></div>`;
  contenido = $('#contenido');
  $$('[data-ir]').forEach(b => b.onclick = () => ir(b.dataset.ir));
  menuUsuario($('#chipPerfil'), [
    { ico: '📚', txt: 'Mis quizzes (panel profesor)', id: 'profesor', accion: () => { location.href = 'profesor.html'; } },
    'sep',
    { ico: '🚪', txt: 'Cerrar sesión', id: 'salir', peligro: true, accion: salir }
  ]);
  window.addEventListener('hashchange', enrutar);
  cierreInactividad(60);
  enrutar();
}

function enrutar() {
  const [vista, param] = (location.hash.slice(1) || 'inicio').split('/');
  const clave = vista === 'quiz' ? 'quizzes' : vista;
  $$('[data-ir]').forEach(b => b.classList.toggle('activo', b.dataset.ir === clave));
  $('#tituloVista').textContent = vista === 'quiz' ? 'Editar quiz' : (VISTAS[vista]?.txt || 'Resumen');
  window.scrollTo(0, 0);
  const v = { inicio: vInicio, profesores: vProfesores, instituciones: vInstituciones, alumnos: vAlumnos, quizzes: vQuizzes, quiz: vQuiz, periodos: vPeriodos };
  (v[vista] || vInicio)(param ? decodeURIComponent(param) : '');
}

// ======================= RESUMEN =======================
async function vInicio() {
  spinner();
  try {
    const [r, profes, quizzes] = await Promise.all([rpc('admin_resumen'), rpc('admin_usuarios', { p_rol: 'profesor' }), rpc('admin_quizzes')]);
    const recientes = [...profes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
    const propios = quizzes.filter(q => q.profesor_id === perfil.id);
    contenido.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));">
        ${[['👩‍🏫', r.profesores, 'Profesores'], ['🔒', r.profesores_restringidos, 'Restringidos'], ['🏫', r.instituciones, 'Instituciones'], ['🎒', r.alumnos, 'Alumnos'],
           ['👥', r.grupos, 'Grupos'], ['📚', r.quizzes, 'Quizzes'], ['❓', r.preguntas, 'Preguntas'], ['📣', r.publicaciones, 'Publicaciones'],
           ['✅', r.intentos_7d, 'Intentos (7 días)'], ['🏆', r.sesiones_vivo_7d, 'Sesiones en vivo (7 días)']]
          .map(([i, n, t]) => `<div class="stat"><span>${i} ${t}</span><b>${n}</b></div>`).join('')}
      </div>
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card"><div class="row between"><h2>🆕 Profesores recientes</h2><button class="btn btn-sm" data-ir2="profesores">Ver todos</button></div>
          ${recientes.map(p => `<div class="row" style="padding:8px 0; border-bottom:1px solid var(--line);">${avatarHtml(p.avatar, 'sm', '👩‍🏫')}
            <span class="grow"><b>${esc(p.nombre || p.usuario)}</b><br><span class="small muted">${esc(p.institucion || '')} · ${fmtFecha(p.created_at)}</span></span>
            ${p.estado === 'restringido' ? '<span class="badge red">restringido</span>' : ''}</div>`).join('') || '<div class="empty">Aún no hay profesores.</div>'}</div>
        <div class="card"><h2>📦 Quizzes a tu nombre</h2>
          <p class="sub">Incluye los migrados del sistema anterior. Cópialos o transfiérelos a cada profesor desde "Quizzes".</p>
          ${propios.slice(0, 8).map(q => `<div class="row" style="padding:6px 0; border-bottom:1px solid var(--line);"><span class="grow"><b>${esc(q.titulo)}</b> <span class="small muted">· ${q.preguntas} preg.</span></span></div>`).join('') || '<div class="empty">No tienes quizzes propios.</div>'}
          ${propios.length ? `<button class="btn btn-sm" data-ir2="quizzes" style="margin-top:10px;">Gestionar (${propios.length})</button>` : ''}</div>
      </div>`;
    $$('[data-ir2]', contenido).forEach(b => b.onclick = () => ir(b.dataset.ir2));
  } catch (e) { falla(e); }
}

// ======================= USUARIOS (comunes) =======================
async function restringir(u, recargar) {
  if (u.estado === 'restringido') {
    if (!await confirmar(`${u.nombre || u.usuario} podrá volver a entrar y usar la app normalmente.`, { titulo: '¿Reactivar cuenta?', boton: 'Reactivar', peligro: false })) return;
    try { await rpc('admin_cambiar_estado', { p_usuario: u.id, p_estado: 'activo' }); toast('Cuenta reactivada'); recargar(); } catch (e) { toast(mensajeError(e), 'error'); }
    return;
  }
  const r = await pedirDatos(`Restringir a ${u.nombre || u.usuario}`, [{ nombre: 'mensaje', etiqueta: 'Mensaje que verá al entrar', tipo: 'textarea', valor: MENSAJE_DEFECTO, requerido: true }],
    { boton: 'Restringir', nota: u.rol === 'profesor' ? 'No podrá entrar a su panel ni crear o editar contenido. Sus alumnos siguen viendo los quizzes ya publicados.' : 'No podrá entrar a la app.' });
  if (!r) return;
  try { await rpc('admin_cambiar_estado', { p_usuario: u.id, p_estado: 'restringido', p_mensaje: r.mensaje }); toast('Cuenta restringida'); recargar(); } catch (e) { toast(mensajeError(e), 'error'); }
}
async function cambiarClave(u) {
  const r = await pedirDatos(`Nueva contraseña para ${u.nombre || u.usuario}`, [{ nombre: 'clave', etiqueta: 'Nueva contraseña (mínimo 6)', requerido: true }], { boton: 'Cambiar', nota: `Usuario: ${u.usuario}` });
  if (!r) return;
  try { await rpc('resetear_clave', { p_usuario: u.id, p_clave: r.clave }); toast('Contraseña cambiada'); } catch (e) { toast(mensajeError(e), 'error'); }
}
async function eliminar(u, recargar) {
  const detalle = u.rol === 'profesor'
    ? `Se eliminará su cuenta junto con sus ${u.grupos} grupo(s), ${u.quizzes} quiz(zes), publicaciones y resultados.\nSus alumnos NO se borran (quedan sin ese grupo).\n\nSi quieres conservar sus quizzes, primero cópialos a tu nombre desde "Quizzes".`
    : 'Se eliminará su cuenta con todos sus intentos y resultados.';
  if (!await confirmar(`${u.nombre || u.usuario} (${u.usuario})\n\n${detalle}\n\nEsto no se puede deshacer.`, { titulo: '¿Eliminar cuenta?', boton: 'Eliminar' })) return;
  try { await rpc('admin_eliminar_usuario', { p_usuario: u.id }); toast('Cuenta eliminada'); recargar(); } catch (e) { toast(mensajeError(e), 'error'); }
}
async function editar(u, recargar) {
  const campos = [{ nombre: 'nombre', etiqueta: 'Nombre', valor: u.nombre || '' }];
  if (u.rol === 'profesor') campos.push({ nombre: 'institucion', etiqueta: 'Institución', valor: u.institucion || '', requerido: true }, { nombre: 'curso', etiqueta: 'Curso', valor: u.curso || '' });
  const r = await pedirDatos(`Editar ${u.usuario}`, campos);
  if (!r) return;
  try { await rpc('admin_editar_usuario', { p_usuario: u.id, p_datos: r }); toast('Datos actualizados'); recargar(); } catch (e) { toast(mensajeError(e), 'error'); }
}
function botonesUsuario(u) {
  return `<div class="row" style="gap:4px; flex-wrap:nowrap;">
    ${u.rol === 'profesor' ? '<button class="btn btn-sm" data-acc="ver" title="Ver grupos y quizzes">👁</button>' : ''}
    <button class="btn btn-sm" data-acc="editar" title="Editar">✏️</button>
    <button class="btn btn-sm" data-acc="clave" title="Cambiar contraseña">🔑</button>
    <button class="btn btn-sm ${u.estado === 'restringido' ? 'btn-green' : 'btn-amber'}" data-acc="estado">${u.estado === 'restringido' ? '✅ Activar' : '🔒 Restringir'}</button>
    <button class="btn btn-sm btn-red" data-acc="eliminar" title="Eliminar">🗑</button></div>`;
}
function conectarUsuarios(lista, usuarios, recargar) {
  $$('[data-u]', lista).forEach(tr => {
    const u = usuarios.find(x => x.id === tr.dataset.u);
    $$('[data-acc]', tr).forEach(b => b.onclick = () => ({
      ver: () => verProfesor(u), editar: () => editar(u, recargar), clave: () => cambiarClave(u),
      estado: () => restringir(u, recargar), eliminar: () => eliminar(u, recargar)
    })[b.dataset.acc]());
  });
}

// ======================= PROFESORES =======================
async function vProfesores(filtroInst = '') {
  spinner();
  let profes;
  try { profes = await rpc('admin_usuarios', { p_rol: 'profesor' }); } catch (e) { return falla(e); }
  const insts = [...new Set(profes.map(p => p.institucion).filter(Boolean))].sort();
  contenido.innerHTML = `<div class="card">
    <div class="row" style="margin-bottom:12px;"><input class="input grow" data-buscar placeholder="🔍 Buscar por nombre, usuario o curso..." style="min-width:200px;">
      <select class="input" data-inst style="width:auto; max-width:260px;"><option value="">Todas las instituciones</option>${insts.map(i => `<option ${i === filtroInst ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select>
      <select class="input" data-estado style="width:auto;"><option value="">Todos</option><option value="activo">Activos</option><option value="restringido">Restringidos</option></select></div>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th></th><th>Profesor</th><th>Institución</th><th>Curso</th><th>Grupos</th><th>Quizzes</th><th>Alumnos</th><th>Registro</th><th></th></tr></thead><tbody data-lista></tbody></table></div></div>`;
  const lista = $('[data-lista]', contenido);
  const pintar = () => {
    const t = $('[data-buscar]', contenido).value, inst = $('[data-inst]', contenido).value, est = $('[data-estado]', contenido).value;
    const vis = profes.filter(p => (!inst || p.institucion === inst) && (!est || p.estado === est) && (!t || coincide(`${p.nombre || ''} ${p.usuario} ${p.curso || ''}`, t)));
    lista.innerHTML = vis.map(p => `<tr data-u="${p.id}" ${p.estado === 'restringido' ? 'style="background:var(--red-bg);"' : ''}>
      <td>${avatarHtml(p.avatar, 'sm', '👩‍🏫')}</td><td><b>${esc(p.nombre || '—')}</b><br><span class="small muted">${esc(p.usuario)}</span>${p.estado === 'restringido' ? '<br><span class="badge red">restringido</span>' : ''}</td>
      <td>${esc(p.institucion || '')}</td><td>${esc(p.curso || '')}</td><td>${p.grupos}</td><td>${p.quizzes}</td><td>${p.alumnos}</td><td class="small">${fmtFecha(p.created_at)}</td>
      <td>${botonesUsuario(p)}</td></tr>`).join('') || '<tr><td colspan="9" class="center muted">No hay profesores que coincidan.</td></tr>';
    conectarUsuarios(lista, profes, () => vProfesores($('[data-inst]', contenido).value));
  };
  ['[data-buscar]', '[data-inst]', '[data-estado]'].forEach(s => { $(s, contenido).oninput = pintar; $(s, contenido).onchange = pintar; });
  pintar();
}

async function verProfesor(u) {
  const m = abrirModal(`<h3>👩‍🏫 ${esc(u.nombre || u.usuario)} · ${esc(u.institucion || '')}</h3><div data-c><div class="center"><div class="spinner"></div></div></div>`, { ancho: true });
  try {
    const [{ data: grupos }, quizzes] = await Promise.all([
      supabase.from('grupos').select('id,nombre,nivel,codigo_invitacion,acepta_registros').eq('profesor_id', u.id).order('nombre'),
      rpc('admin_quizzes')]);
    const suyos = quizzes.filter(q => q.profesor_id === u.id);
    $('[data-c]', m.el).innerHTML = `
      <h3 style="color:var(--ink); margin-top:6px;">👥 Grupos (${(grupos || []).length})</h3>
      ${(grupos || []).map(g => `<div class="row" style="padding:6px 0; border-bottom:1px solid var(--line);"><b class="grow">${esc(g.nombre)}</b><span class="small muted">${esc(g.nivel || '')}</span><span class="badge gray">${esc(g.codigo_invitacion)}</span></div>`).join('') || '<p class="muted">Sin grupos.</p>'}
      <h3 style="color:var(--ink); margin-top:14px;">📚 Quizzes (${suyos.length})</h3>
      ${suyos.map(q => `<div class="row" style="padding:6px 0; border-bottom:1px solid var(--line);"><b class="grow">${esc(q.titulo)}</b><span class="small muted">${q.preguntas} preg. · ${q.publicaciones} publ.</span>
        <a class="btn btn-sm" href="#quiz/${q.id}" data-cerrar>Abrir</a></div>`).join('') || '<p class="muted">Sin quizzes.</p>'}`;
    $$('[data-cerrar]', m.el).forEach(a => a.addEventListener('click', () => m.cerrar()));
  } catch (e) { $('[data-c]', m.el).textContent = mensajeError(e); }
}

// ======================= INSTITUCIONES =======================
async function vInstituciones() {
  spinner();
  let profes;
  try { profes = await rpc('admin_usuarios', { p_rol: 'profesor' }); } catch (e) { return falla(e); }
  const mapa = {};
  profes.forEach(p => {
    const k = (p.institucion || 'Sin institución').trim();
    const clave = k.toLowerCase();
    const x = mapa[clave] = mapa[clave] || { nombre: k, profesores: 0, restringidos: 0, grupos: 0, quizzes: 0, alumnos: 0 };
    x.profesores++; if (p.estado === 'restringido') x.restringidos++;
    x.grupos += p.grupos; x.quizzes += p.quizzes; x.alumnos += p.alumnos;
  });
  const lista = Object.values(mapa).sort((a, b) => b.profesores - a.profesores);
  contenido.innerHTML = `<div class="card"><p class="sub">Las instituciones las escribe cada profesor al registrarse. Si ves la misma escrita de dos formas, corrígela editando al profesor.</p>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Institución</th><th>Profesores</th><th>Grupos</th><th>Quizzes</th><th>Alumnos</th><th></th></tr></thead><tbody>
    ${lista.map(i => `<tr><td><b>🏫 ${esc(i.nombre)}</b>${i.restringidos ? ` <span class="badge red">${i.restringidos} restringido(s)</span>` : ''}</td><td>${i.profesores}</td><td>${i.grupos}</td><td>${i.quizzes}</td><td>${i.alumnos}</td>
      <td><button class="btn btn-sm" data-inst="${esc(i.nombre)}">Ver profesores</button></td></tr>`).join('') || '<tr><td colspan="6" class="center muted">Sin datos.</td></tr>'}
    </tbody></table></div></div>`;
  $$('[data-inst]', contenido).forEach(b => b.onclick = () => { history.replaceState(null, '', '#profesores'); $$('[data-ir]').forEach(x => x.classList.toggle('activo', x.dataset.ir === 'profesores')); $('#tituloVista').textContent = 'Profesores'; vProfesores(b.dataset.inst); });
}

// ======================= ALUMNOS =======================
async function vAlumnos() {
  spinner();
  let alumnos;
  try { alumnos = await rpc('admin_usuarios', { p_rol: 'alumno' }); } catch (e) { return falla(e); }
  contenido.innerHTML = `<div class="card">
    <div class="row" style="margin-bottom:12px;"><input class="input grow" data-buscar placeholder="🔍 Buscar alumno, grupo o profesor..." style="min-width:200px;">
      <span class="badge gray">${alumnos.length} alumnos</span></div>
    <div class="tabla-wrap scroll-y" style="max-height:70vh;"><table class="tabla"><thead><tr><th></th><th>Alumno</th><th>Grupos (profesor)</th><th>Registro</th><th></th></tr></thead><tbody data-lista></tbody></table></div></div>`;
  const lista = $('[data-lista]', contenido);
  const pintar = () => {
    const t = $('[data-buscar]', contenido).value;
    const vis = alumnos.filter(a => !t || coincide(`${a.nombre || ''} ${a.usuario} ${(a.grupos_detalle || []).map(g => g.grupo + ' ' + g.profesor).join(' ')}`, t));
    lista.innerHTML = vis.slice(0, 500).map(a => `<tr data-u="${a.id}" ${a.estado === 'restringido' ? 'style="background:var(--red-bg);"' : ''}>
      <td>${avatarHtml(a.avatar, 'sm')}</td><td><b>${esc(a.nombre || '—')}</b><br><span class="small muted">${esc(a.usuario)}</span></td>
      <td class="small">${(a.grupos_detalle || []).map(g => `${esc(g.grupo)} <span class="muted">(${esc(g.profesor)})</span>`).join('<br>') || '<span class="muted">Sin grupo</span>'}</td>
      <td class="small">${fmtFecha(a.created_at)}</td><td>${botonesUsuario(a)}</td></tr>`).join('') || '<tr><td colspan="5" class="center muted">No hay alumnos que coincidan.</td></tr>';
    conectarUsuarios(lista, alumnos, vAlumnos);
  };
  $('[data-buscar]', contenido).oninput = pintar;
  pintar();
}

// ======================= QUIZZES =======================
async function vQuizzes() {
  spinner();
  let quizzes, profes;
  try { [quizzes, profes] = await Promise.all([rpc('admin_quizzes'), rpc('admin_usuarios', { p_rol: 'profesor' })]); } catch (e) { return falla(e); }
  const autores = [...new Map(quizzes.map(q => [q.profesor_id, q.profesor])).entries()];
  contenido.innerHTML = `<div class="card">
    <div class="row" style="margin-bottom:12px;"><input class="input grow" data-buscar placeholder="🔍 Buscar quiz o tema..." style="min-width:200px;">
      <select class="input" data-autor style="width:auto; max-width:260px;"><option value="">Todos los autores</option>${autores.map(([id, n]) => `<option value="${id}">${esc(n)}${id === perfil.id ? ' (tú)' : ''}</option>`).join('')}</select></div>
    <div class="row" style="margin-bottom:10px;" data-lote hidden><b data-n></b><button class="btn btn-sm" data-lote-acc="copiar">⧉ Copiar a un profesor</button><button class="btn btn-sm" data-lote-acc="transferir">↪ Transferir a un profesor</button><button class="btn btn-sm btn-red" data-lote-acc="eliminar">🗑 Eliminar</button></div>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th><input type="checkbox" data-todos></th><th>Quiz</th><th>Autor</th><th>Preguntas</th><th>Publicado</th><th>Editado</th><th></th></tr></thead><tbody data-lista></tbody></table></div></div>`;
  const sel = new Set();
  const lista = $('[data-lista]', contenido);
  const visibles = () => {
    const t = $('[data-buscar]', contenido).value, a = $('[data-autor]', contenido).value;
    return quizzes.filter(q => (!a || q.profesor_id === a) && (!t || coincide(`${q.titulo} ${q.tema || ''}`, t)));
  };
  const lote = () => { $('[data-lote]', contenido).hidden = !sel.size; $('[data-n]', contenido).textContent = `${sel.size} seleccionado(s)`; };
  const pintar = () => {
    lista.innerHTML = visibles().map(q => `<tr data-q="${q.id}"><td><input type="checkbox" data-sel ${sel.has(q.id) ? 'checked' : ''}></td>
      <td><b>${esc(q.titulo)}</b>${q.tema ? ` <span class="badge">${esc(q.tema)}</span>` : ''}</td>
      <td>${esc(q.profesor)}<br><span class="small muted">${esc(q.institucion || '')}</span></td><td>${q.preguntas}</td><td>${q.publicaciones ? (q.publicaciones === 1 ? '1 vez' : q.publicaciones + ' veces') : '—'}</td>
      <td class="small">${fmtFecha(q.updated_at)}</td>
      <td><div class="row" style="gap:4px; flex-wrap:nowrap;"><button class="btn btn-sm btn-primary" data-acc="abrir">✏️ Ver/editar</button>
        <button class="btn btn-sm" data-acc="copiar" title="Copiar a un profesor">⧉</button><button class="btn btn-sm" data-acc="transferir" title="Transferir a un profesor">↪</button>
        <button class="btn btn-sm btn-red" data-acc="eliminar">🗑</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="center muted">No hay quizzes.</td></tr>';
    $$('[data-q]', lista).forEach(tr => {
      const q = quizzes.find(x => x.id === tr.dataset.q);
      $('[data-sel]', tr).onchange = (e) => { e.target.checked ? sel.add(q.id) : sel.delete(q.id); lote(); };
      $$('[data-acc]', tr).forEach(b => b.onclick = () => accion(b.dataset.acc, [q]));
    });
    lote();
  };
  const elegirProfesor = async (titulo) => {
    const destinos = [{ valor: perfil.id, texto: `${perfil.nombre || perfil.usuario} (tú, admin)` }, ...profes.filter(p => p.estado === 'activo').map(p => ({ valor: p.id, texto: `${p.nombre || p.usuario} · ${p.institucion || ''}` }))];
    const r = await pedirDatos(titulo, [{ nombre: 'p', etiqueta: 'Profesor', tipo: 'select', opciones: destinos }], { boton: 'Continuar' });
    return r ? r.p : null;
  };
  const accion = async (acc, qs) => {
    if (acc === 'abrir') return ir('quiz', qs[0].id);
    if (acc === 'copiar' || acc === 'transferir') {
      const dest = await elegirProfesor(acc === 'copiar' ? `Copiar ${qs.length} quiz(zes)` : `Transferir ${qs.length} quiz(zes)`);
      if (!dest) return;
      if (acc === 'transferir' && qs.some(q => q.publicaciones) && !await confirmar('Algunos quizzes están publicados en grupos de su autor actual. Las publicaciones seguirán funcionando, pero el nuevo dueño no las verá en su panel.\n\nSi solo quieres compartirlos, usa "Copiar".', { titulo: '¿Transferir de todas formas?', boton: 'Transferir', peligro: false })) return;
      try {
        for (const q of qs) await rpc(acc === 'copiar' ? 'admin_copiar_quiz' : 'admin_transferir_quiz', { p_quiz: q.id, p_profesor: dest });
        toast(`${qs.length} quiz(zes) ${acc === 'copiar' ? 'copiado(s)' : 'transferido(s)'}`); sel.clear(); vQuizzes();
      } catch (e) { toast(mensajeError(e), 'error'); }
    }
    if (acc === 'eliminar') {
      const pub = qs.reduce((a, q) => a + q.publicaciones, 0);
      if (!await confirmar(`Se eliminarán ${qs.length} quiz(zes) con sus preguntas${pub ? `, ${pub} publicación(es) y los resultados de los alumnos` : ''}.\n\nEsto no se puede deshacer.`, { titulo: '¿Eliminar?', boton: 'Eliminar' })) return;
      const { error } = await supabase.from('quizzes').delete().in('id', qs.map(q => q.id));
      if (error) return toast(mensajeError(error), 'error');
      toast('Eliminado(s)'); sel.clear(); vQuizzes();
    }
  };
  $('[data-todos]', contenido).onchange = (e) => { visibles().forEach(q => e.target.checked ? sel.add(q.id) : sel.delete(q.id)); pintar(); };
  $$('[data-lote-acc]', contenido).forEach(b => b.onclick = () => accion(b.dataset.loteAcc, quizzes.filter(q => sel.has(q.id))));
  $('[data-buscar]', contenido).oninput = pintar;
  $('[data-autor]', contenido).onchange = pintar;
  pintar();
}

function vQuiz(id) {
  montarEditorQuiz(contenido, id, {
    volver: () => ir('quizzes'),
    quizzes: async () => (await rpc('admin_quizzes')).map(q => ({ id: q.id, titulo: `${q.titulo} — ${q.profesor}` }))
  });
}

// ======================= PERIODOS =======================
async function vPeriodos() {
  spinner();
  const { data: periodos, error } = await supabase.from('periodos').select('id,numero,nombre').order('numero');
  if (error) return falla(error);
  contenido.innerHTML = `<div class="card"><p class="sub">Los periodos (bimestres, trimestres…) son los mismos para todas las instituciones. El profesor elige uno al publicar y filtra la libreta por periodo.</p>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th>N°</th><th>Nombre</th><th></th></tr></thead><tbody>
    ${periodos.map(p => `<tr data-p="${p.id}"><td>${p.numero}</td><td><b>${esc(p.nombre)}</b></td>
      <td><div class="row" style="gap:4px;"><button class="btn btn-sm" data-editar>✏️</button><button class="btn btn-sm btn-red" data-borrar>🗑</button></div></td></tr>`).join('')}
    </tbody></table></div><button class="btn btn-primary" data-nuevo style="margin-top:12px;">➕ Agregar periodo</button></div>`;
  const guardar = async (p) => {
    const r = await pedirDatos(p ? 'Editar periodo' : 'Nuevo periodo', [
      { nombre: 'numero', etiqueta: 'Número (orden)', tipo: 'number', valor: p?.numero ?? (periodos.length + 1), requerido: true },
      { nombre: 'nombre', etiqueta: 'Nombre', valor: p?.nombre ?? '', placeholder: 'Ej: I Bimestre', requerido: true }]);
    if (!r) return;
    const datos = { numero: Number(r.numero), nombre: r.nombre };
    const { error: e } = p ? await supabase.from('periodos').update(datos).eq('id', p.id) : await supabase.from('periodos').insert(datos);
    if (e) return toast(/duplicate|unique/i.test(e.message) ? 'Ya existe un periodo con ese número' : mensajeError(e), 'error');
    toast('Guardado'); vPeriodos();
  };
  $('[data-nuevo]', contenido).onclick = () => guardar(null);
  $$('[data-p]', contenido).forEach(tr => {
    const p = periodos.find(x => x.id === tr.dataset.p);
    $('[data-editar]', tr).onclick = () => guardar(p);
    $('[data-borrar]', tr).onclick = async () => {
      if (!await confirmar(`Las publicaciones con "${p.nombre}" quedarán sin periodo (no se borran).`, { titulo: '¿Eliminar periodo?', boton: 'Eliminar' })) return;
      const { error: e } = await supabase.from('periodos').delete().eq('id', p.id);
      if (e) return toast(mensajeError(e), 'error');
      toast('Periodo eliminado'); vPeriodos();
    };
  });
}

// ======================= ARRANQUE =======================
perfil = await exigirRol(['admin']);
if (perfil) iniciar();
