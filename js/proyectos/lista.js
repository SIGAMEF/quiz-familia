// ============================================================
// Proyectos en grupo: lista de proyectos (panel del profesor y del admin) y sus resultados
// ============================================================
import { $, $$, esc, htmlMenuMas, toast, confirmar, pedirDatos, mensajeError, fmtFecha, coincide, abrirModal, urlBase, copiar, mostrarQRGrande } from '../comun.js';
import { pintarHoja } from './lienzo.js';
import { esPregunta, TIPOS_PREGUNTA, textoEnunciado, textoRespuesta } from './preguntas.js';
import { borrarFotos } from './vivo-profe.js';

// panel: 'profesor' o 'admin' (para volver al panel correcto desde el editor)
const abrirProyecto = (id, panel, modo = '') => {
  location.href = `proyectos.html?id=${encodeURIComponent(id)}${panel === 'admin' ? '&volver=admin' : ''}${modo ? `&${modo}=1` : ''}`;
};

// Pide el nombre y abre el editor del proyecto nuevo
export async function crearProyecto({ rpc, panel = 'profesor' }) {
  const r = await pedirDatos('Crear proyecto', [
    { nombre: 'nombre', etiqueta: 'Nombre del proyecto *', placeholder: 'Ej: Repaso de Ciencias – 3.° B', requerido: true }], { boton: 'Crear' });
  if (!r) return;
  try { abrirProyecto(await rpc('proyecto_crear', { p_nombre: r.nombre }), panel); }
  catch (e) { toast(mensajeError(e), 'error'); }
}

// Mis proyectos, cerrando antes las sesiones abandonadas (12 horas sin actividad) y borrando sus fotos
export async function misProyectos(rpc) {
  try { const r = await rpc('proyectos_cerrar_inactivas'); if (r?.fotos?.length) await borrarFotos(r.fotos); }
  catch (e) { console.warn('No se pudieron revisar las sesiones inactivas', e); }
  return rpc('mis_proyectos');
}

// Tarjeta de un proyecto (la usan esta lista y "Mis actividades"). La visibilidad se pinta en [data-visibilidad].
export function htmlTarjetaProyecto(p) {
  const s = p.sesion;
  return `<div class="card act-card proy-card" data-proy="${p.id}">
      <button class="proy-mini" data-abrir title="Abrir en el editor"><div data-mini></div></button>
      <div class="act-cab"><span class="act-ico" style="--c:#E5484D" title="Proyecto en grupo">🎨</span>
        <div class="grow"><h3 title="${esc(p.nombre)}">${esc(p.nombre)}</h3>
          <p class="act-meta">Proyecto · ${p.n_hojas} ${p.n_hojas === 1 ? 'hoja' : 'hojas'}</p></div></div>
      <div class="vis-fila" data-visibilidad></div>
      ${s ? `<div class="proy-vivo">📡 <b>Sesión en curso</b> · hoja ${s.hoja_indice} de ${s.total_hojas} · ${s.participantes} ${s.participantes === 1 ? 'participante' : 'participantes'} · PIN ${esc(s.pin)}${s.estado === 'pausada' ? ' · en pausa' : ''}
        <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm btn-primary" data-continuar>Continuar sesión</button><button class="btn btn-sm btn-outline" data-reiniciar>Reiniciar</button><button class="btn btn-sm btn-ghost" data-finalizar title="Cerrar la sesión: el PIN deja de funcionar y los resultados quedan guardados">⏹ Finalizar</button></div></div>` : ''}
      <div class="act-pie"><span class="act-fecha">Editado ${fmtFecha(p.updated_at, true)}</span>
        <div class="act-acciones">
          <button class="btn btn-sm btn-primary" data-abrir>✏️ Abrir</button>
          ${s ? '' : '<button class="btn btn-sm btn-green" data-envivo title="Presentar en vivo con PIN y QR">📡 En vivo</button>'}
          <button class="btn btn-sm" data-presentar title="Presentar sin participantes">▶ Presentar</button>
          ${htmlMenuMas([...(p.n_sesiones || p.n_intentos ? [['data-resultados', '📊', 'Resultados']] : []), ['data-duplicar', '⧉', 'Duplicar'], 'sep', ['data-eliminar', '🗑', 'Eliminar', true]])}
        </div></div>
    </div>`;
}

// Miniatura y botones de la tarjeta. ctx: { rpc, panel, recargar }
export function conectarTarjetaProyecto(card, p, { rpc, panel = 'profesor', recargar }) {
  pintarHoja($('[data-mini]', card), { diseno: p.portada || { fondo: { tipo: 'color', valor: '#F6F4FF' }, elementos: [] } }, { modo: 'miniatura' });
  const id = p.id;
  const abrir = (modo) => abrirProyecto(id, panel, modo);
  const en = (sel, fn) => { const b = $(sel, card); if (b) b.onclick = fn; };
  $$('[data-abrir]', card).forEach(b => b.onclick = () => abrir());
  en('[data-presentar]', () => abrir('presentar'));
  en('[data-envivo]', () => abrir('vivo'));
  en('[data-continuar]', () => abrir('vivo'));
  en('[data-resultados]', async () => {
    if (!p.n_intentos) return verResultados(p, rpc, recargar);
    if (!p.n_sesiones) return verResultadosRitmo(p, rpc);
    const m = abrirModal(`<h3>📊 Resultados · ${esc(p.nombre)}</h3><div class="stack">
      <button class="btn btn-block" data-r="vivo">📡 De las sesiones en vivo (${p.n_sesiones})</button>
      <button class="btn btn-block" data-r="ritmo">🚶 A su ritmo, por alumno (${p.n_intentos})</button></div>`);
    $$('[data-r]', m.el).forEach(b => b.onclick = () => { m.cerrar(); b.dataset.r === 'vivo' ? verResultados(p, rpc, recargar) : verResultadosRitmo(p, rpc); });
  });
  en('[data-reiniciar]', async () => {
    if (!await confirmar('Se borrarán los participantes, sus respuestas y los grupos de esta sesión, y habrá un PIN nuevo. El diseño del proyecto no cambia.', { titulo: '¿Reiniciar la sesión?', boton: 'Reiniciar' })) return;
    try { const r = await rpc('proyecto_reiniciar_sesion', { p_sesion: p.sesion.id }); await borrarFotos(r.fotos); toast('Sesión reiniciada · PIN nuevo: ' + r.sesion.pin); recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  });
  en('[data-finalizar]', async () => {
    if (!await confirmar('El PIN dejará de funcionar y las pantallas abiertas dejarán de consultar. Los resultados quedan guardados en “Resultados”.',
      { titulo: '¿Finalizar la sesión?', boton: '⏹ Finalizar', peligro: false })) return;
    try { const r = await rpc('proyecto_finalizar', { p_sesion: p.sesion.id }); await borrarFotos(r.fotos); toast('Sesión finalizada'); recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  });
  en('[data-duplicar]', async () => {
    try { await rpc('proyecto_duplicar', { p_proyecto: id }); toast('Proyecto duplicado'); recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  });
  en('[data-eliminar]', async () => {
    if (!await confirmar(`Se borrará “${p.nombre}” con todas sus hojas${p.n_sesiones ? ' y los resultados de sus sesiones' : ''}. No se puede deshacer.`, { titulo: '¿Eliminar el proyecto?', boton: 'Eliminar' })) return;
    try { const r = await rpc('proyecto_eliminar', { p_proyecto: id }); await borrarFotos(r.fotos); toast('Proyecto eliminado'); recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  });
}

// Lista de proyectos sola (panel del admin)
export async function vistaProyectos(cont, { rpc, panel = 'profesor' }) {
  cont.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>';
  let lista;
  try { lista = await misProyectos(rpc); }
  catch (e) { cont.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  const recargar = () => vistaProyectos(cont, { rpc, panel });

  cont.innerHTML = `
    <div class="card"><div class="row between"><div><h2>🎨 Proyectos en grupo</h2>
      <p class="sub" style="margin-bottom:0;">Arma presentaciones con hojas de contenido, preguntas, grupos, ruleta y juegos. Preséntalas en vivo: tus alumnos entran con un PIN o un QR desde el celular.</p></div>
      <button class="btn btn-primary" data-crear>➕ Crear proyecto</button></div>
      ${lista.length > 6 ? '<input class="input" data-buscar placeholder="🔍 Buscar proyecto..." style="max-width:300px; margin-top:12px;">' : ''}</div>
    <div class="grid grid-auto" data-lista style="margin-top:16px;"></div>`;
  $('[data-crear]', cont).onclick = () => crearProyecto({ rpc, panel });

  const listaEl = $('[data-lista]', cont);
  const pintar = () => {
    const q = $('[data-buscar]', cont)?.value || '';
    const vis = lista.filter(p => !q || coincide(p.nombre, q));
    listaEl.innerHTML = vis.map(htmlTarjetaProyecto).join('') ||
      `<div class="card empty" style="grid-column:1/-1;"><span class="big">🎨</span>${q ? 'Ningún proyecto coincide con la búsqueda.' : 'Aún no tienes proyectos. Pulsa “Crear proyecto” para empezar.'}</div>`;
    vis.forEach(p => conectarTarjetaProyecto($(`[data-proy="${p.id}"]`, listaEl), p, { rpc, panel, recargar }));
  };
  const buscar = $('[data-buscar]', cont);
  if (buscar) buscar.oninput = pintar;
  pintar();
}

// ======================= PUBLICAR A GRUPOS (a su ritmo) =======================
export const enlaceRitmo = (pubId) => `${urlBase()}proyecto.html?pub=${pubId}`;

// Cada alumno del grupo lo abre desde su panel y avanza solo; opcional: enlace o QR para invitados sin cuenta
export async function publicarProyecto(p, { rpc, grupos, recargar }) {
  let pubs;
  try { pubs = await rpc('publicaciones_proyecto', { p_proyecto: p.id }); } catch (e) { return toast(mensajeError(e), 'error'); }
  const pubDe = (g) => pubs.find(x => x.grupo_id === g.id);
  const m = abrirModal(`<h3>📣 ${esc(p.nombre)} en tus grupos</h3>
    <p class="sub">Modo <b>a su ritmo</b>: cada alumno lo abre desde su panel y avanza las hojas solo. Sus respuestas y los puntajes de los juegos quedan guardados y los ves por alumno en 📊.</p>
    ${grupos.length ? `<div class="stack">${grupos.map(g => { const x = pubDe(g); return `<div class="pub-proy" data-fila="${g.id}">
      <label class="check" style="justify-content:space-between;"><span><input type="checkbox" data-g="${g.id}" ${x?.activo ? 'checked' : ''}> <b>${esc(g.nombre)}</b></span>
        ${x ? `<span class="small muted">${x.intentos} empezaron · ${x.completados} terminaron</span>` : ''}</label>
      ${x?.activo ? `<div class="row" style="gap:6px; margin:4px 0 0 26px;">
        <label class="check small"><input type="checkbox" data-inv="${x.id}" ${x.permite_invitados ? 'checked' : ''}> 🔗 También invitados sin cuenta (con el enlace o QR)</label>
        ${x.permite_invitados ? `<button class="btn btn-sm" data-enlace="${x.id}">📋 Enlace</button><button class="btn btn-sm" data-qr="${x.id}">📱 QR</button>` : ''}</div>` : ''}
    </div>`; }).join('')}</div>` : '<div class="feedback mal">Primero crea un grupo en “Grupos y alumnos”.</div>'}
    <div class="err" data-err></div>
    <div class="modal-pie"><button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-ok ${grupos.length ? '' : 'disabled'}>Guardar</button></div>`, { ancho: true });
  $$('[data-inv]', m.el).forEach(c => c.onchange = async () => {
    try { await rpc('proyecto_publicacion_invitados', { p_pub: c.dataset.inv, p_permite: c.checked }); toast(c.checked ? 'Ahora también lo pueden abrir invitados con el enlace' : 'Solo los alumnos del grupo'); m.cerrar(); publicarProyecto(p, { rpc, grupos, recargar }); }
    catch (e) { c.checked = !c.checked; toast(mensajeError(e), 'error'); }
  });
  $$('[data-enlace]', m.el).forEach(b => b.onclick = () => copiar(enlaceRitmo(b.dataset.enlace)));
  $$('[data-qr]', m.el).forEach(b => b.onclick = () => mostrarQRGrande(p.nombre, enlaceRitmo(b.dataset.qr), '', 'Escanea para abrir el proyecto'));
  $('[data-ok]', m.el).onclick = async () => {
    const marcados = $$('[data-g]:checked', m.el).map(x => x.dataset.g);
    try {
      await rpc('publicar_proyecto', { p_proyecto: p.id, p_grupos: marcados });
      toast(marcados.length ? `Publicado en ${marcados.length} ${marcados.length === 1 ? 'grupo' : 'grupos'}` : 'Ya no está publicado en tus grupos');
      m.cerrar(); recargar && recargar();
    } catch (e) { $('[data-err]', m.el).textContent = mensajeError(e); }
  };
}

// Resultados a su ritmo: por alumno (avance, aciertos y puntos de juegos) y el detalle de sus respuestas
async function verResultadosRitmo(p, rpc) {
  let filas, hojas;
  try { [filas, { hojas }] = await Promise.all([rpc('proyecto_ritmo_resultados', { p_proyecto: p.id }), rpc('proyecto_editor', { p_proyecto: p.id })]); }
  catch (e) { return toast(mensajeError(e), 'error'); }
  const recorrido = hojas.filter(h => !['agrupar', 'ruleta', 'unirse'].includes(h.tipo));
  const preguntas = recorrido.filter(h => esPregunta(h.tipo));
  const juegos = recorrido.filter(h => h.tipo === 'juego');
  const resumen = (f) => {
    const rs = Object.values(f.respuestas || {}).filter(r => r.correcta != null);
    return { bien: rs.filter(r => r.correcta).length, calif: rs.length, respondidas: preguntas.filter(h => f.respuestas?.[h.id]).length,
      puntos: Object.values(f.juegos || {}).reduce((t, j) => t + Number(j.puntos || 0), 0) };
  };
  const grupos = [...new Set(filas.map(f => f.grupo))];
  const m = abrirModal(`<h3>🚶 A su ritmo · ${esc(p.nombre)}</h3>
    ${filas.length ? grupos.map(g => `<h4 style="margin:12px 0 6px;">${esc(g)}</h4>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Alumno</th><th>Avance</th>${preguntas.length ? '<th>Preguntas</th><th>Aciertos</th>' : ''}${juegos.length ? '<th>Puntos en juegos</th>' : ''}<th>Última vez</th><th></th></tr></thead><tbody>
      ${filas.filter(f => f.grupo === g).map(f => { const r = resumen(f); return `<tr data-f="${f.id}"><td>${esc(f.avatar || '')} <b>${esc(f.alias || '—')}</b>${f.alumno ? '' : ' <span class="badge gray">invitado</span>'}</td>
        <td>${f.completado ? '<span class="badge green">✔ Terminó</span>' : `Hoja ${Math.min(f.hoja_actual + 1, recorrido.length)} de ${recorrido.length}`}</td>
        ${preguntas.length ? `<td>${r.respondidas} / ${preguntas.length}</td><td>${r.calif ? `${r.bien} / ${r.calif}` : '—'}</td>` : ''}
        ${juegos.length ? `<td>${r.puntos}</td>` : ''}<td class="small">${fmtFecha(f.updated_at, true)}</td>
        <td><button class="btn btn-sm" data-detalle title="Ver sus respuestas">👁</button></td></tr>`; }).join('')}</tbody></table></div>`).join('')
      : '<div class="empty">Todavía nadie lo abrió.</div>'}`, { ancho: true });
  $$('[data-detalle]', m.el).forEach(b => b.onclick = () => {
    const f = filas.find(x => x.id === b.closest('[data-f]').dataset.f);
    abrirModal(`<h3>${esc(f.avatar || '')} ${esc(f.alias || '')}</h3><div class="stack">${recorrido.filter(h => esPregunta(h.tipo) || h.tipo === 'juego').map(h => {
      if (h.tipo === 'juego') { const j = f.juegos?.[h.id]; return `<div class="res-linea">🎮 <b>${esc(h.config?.juego?.titulo || 'Juego')}</b><span>${j ? `⭐ ${j.puntos} (jugó ${j.veces} ${j.veces === 1 ? 'vez' : 'veces'})` : 'No jugó'}</span></div>`; }
      const r = f.respuestas?.[h.id];
      const txt = !r ? 'Sin responder' : h.tipo === 'lluvia' ? (r.valores || []).map(v => v.texto).join(' · ') : textoRespuesta(h, r.valor);
      return `<div class="res-linea">${TIPOS_PREGUNTA[h.tipo].ico} <b>${esc(textoEnunciado(h) || TIPOS_PREGUNTA[h.tipo].nombre)}</b><span>${r?.correcta === true ? '✅ ' : r?.correcta === false ? '❌ ' : ''}${esc(txt)}</span></div>`;
    }).join('')}</div>`, { ancho: true });
  });
}

// ======================= RESULTADOS =======================
async function verResultados(p, rpc, alCambiar) {
  let sesiones, hojas;
  try { [sesiones, { hojas }] = await Promise.all([rpc('proyecto_resultados', { p_proyecto: p.id }), rpc('proyecto_editor', { p_proyecto: p.id })]); }
  catch (e) { return toast(mensajeError(e), 'error'); }
  if (!sesiones.length) return toast('Este proyecto todavía no tiene sesiones', 'error');
  const m = abrirModal(`<h3>📊 Resultados · ${esc(p.nombre)}</h3>
    <div class="row" style="margin-bottom:12px;"><select class="input" data-sesion style="width:auto; max-width:100%;">${sesiones.map((s, i) =>
      `<option value="${i}">${fmtFecha(s.created_at, true)} · ${s.estado === 'finalizada' ? 'finalizada' : '📡 en curso'} · ${s.participantes} participantes</option>`).join('')}</select></div>
    <div data-cuerpo></div>`, { ancho: true });
  const cuerpo = $('[data-cuerpo]', m.el);
  const pintar = () => {
    const s = sesiones[+$('[data-sesion]', m.el).value];
    const parts = s.participantes_lista.filter(x => !x.expulsado);
    const grupo = (gid) => s.grupos.find(g => g.id === gid);
    const interactivas = hojas.filter(h => esPregunta(h.tipo) || ['agrupar', 'ruleta', 'juego'].includes(h.tipo));
    const hojaGrupos = s.grupos.length ? s.grupos[s.grupos.length - 1].hoja_id : null;   // los grupos más recientes
    cuerpo.innerHTML = `<div class="grid grid-3" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); margin-bottom:14px;">
        ${[['👥', parts.length, 'Participantes'], ['🧩', s.grupos.filter(g => g.hoja_id === hojaGrupos).length, 'Grupos'], ['💬', s.respuestas.length, 'Respuestas']]
          .map(([ico, n, t]) => `<div class="stat"><span>${ico} ${t}</span><b>${n}</b></div>`).join('')}</div>
      ${interactivas.map(h => `<div class="res-hoja"><h4>${h.tipo === 'agrupar' ? '👥 Agrupar' : h.tipo === 'ruleta' ? '🎡 Ruleta' : h.tipo === 'juego' ? `🎮 ${esc(h.config?.juego?.titulo || 'Juego')}` : `${TIPOS_PREGUNTA[h.tipo].ico} ${esc(textoEnunciado(h) || TIPOS_PREGUNTA[h.tipo].nombre)}`}</h4><div data-res="${h.id}"></div></div>`).join('') || '<p class="hint">Este proyecto no tiene hojas con preguntas ni grupos.</p>'}
      ${parts.length ? `<h4 style="margin-top:14px;">Participantes</h4><div class="tabla-wrap scroll-y"><table class="tabla"><thead><tr><th>Alias</th><th>Nombre</th><th>Grupo</th><th>Respuestas</th></tr></thead><tbody>
        ${parts.map(x => { const g = grupo(x.grupo_id); return `<tr><td>${esc(x.avatar || '')} ${esc(x.alias)}</td><td>${esc(x.nombre)}</td>
          <td>${g ? `<span class="badge" style="background:${esc(g.color)}22; color:${esc(g.color)};">${esc(g.emoji || '')} ${esc(g.nombre)}</span>` : '—'}</td>
          <td>${s.respuestas.filter(r => r.participante_id === x.id).length}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      <div class="modal-pie">
        ${s.estado !== 'finalizada' ? '<button class="btn btn-outline" data-finalizar>⏹ Finalizar la sesión</button>' : ''}
        <button class="btn btn-red" data-borrar>🗑 Borrar estos resultados</button></div>`;
    for (const h of interactivas) {
      if (h.tipo === 'ruleta') {
        const sorteos = (s.sorteos || []).filter(x => x.hoja_id === h.id);
        $(`[data-res="${h.id}"]`, cuerpo).innerHTML = sorteos.length
          ? `<ol class="res-sorteos">${sorteos.map(x => `<li><b>${x.ronda}°</b> ${esc(x.texto)}</li>`).join('')}</ol>`
          : '<p class="hint">No se giró en esta sesión.</p>';
        continue;
      }
      const porGrupo = h.config?.modo === 'grupo';
      const res = h.tipo === 'juego'
        ? { participantes: parts, respuestas: s.respuestas.filter(r => r.hoja_id === h.id), grupos: s.grupos.filter(g => g.hoja_id === (s.grupos.some(x => x.hoja_id === h.config?.hoja_grupos) ? h.config.hoja_grupos : hojaGrupos)), modoGrupo: h.config?.modo === 'grupo', inicio: 0, abiertas: false }
        : h.tipo === 'agrupar'
        ? { participantes: parts, grupos: s.grupos.filter(g => g.hoja_id === h.id), profe: false }
        : { revelar: true, respuestas: s.respuestas.filter(r => r.hoja_id === h.id).map(r => { const g = porGrupo ? grupo(r.grupo_id) : null; return { alias: g ? g.nombre : r.alias, avatar: g ? g.emoji : r.avatar, valor: r.valor }; }) };
      pintarHoja($(`[data-res="${h.id}"]`, cuerpo), h, { modo: 'miniatura', res });
    }
    const fin = $('[data-finalizar]', cuerpo);
    if (fin) fin.onclick = async () => {
      try { const r = await rpc('proyecto_finalizar', { p_sesion: s.id }); await borrarFotos(r.fotos); s.estado = 'finalizada'; toast('Sesión finalizada'); pintar(); alCambiar(); }
      catch (e) { toast(mensajeError(e), 'error'); }
    };
    $('[data-borrar]', cuerpo).onclick = async () => {
      if (!await confirmar('Se borrarán los participantes, las respuestas y los grupos de esta sesión. No se puede deshacer.', { titulo: '¿Borrar los resultados?', boton: 'Borrar' })) return;
      try {
        const r = await rpc('proyecto_borrar_sesion', { p_sesion: s.id });
        await borrarFotos(r.fotos);
        toast('Resultados borrados');
        m.cerrar(); alCambiar();
      } catch (e) { toast(mensajeError(e), 'error'); }
    };
  };
  $('[data-sesion]', m.el).onchange = pintar;
  pintar();
}
