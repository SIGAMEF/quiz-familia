// ============================================================
// Proyectos en grupo: lista de proyectos (panel del profesor y del admin) y sus resultados
// ============================================================
import { $, $$, esc, toast, confirmar, pedirDatos, mensajeError, fmtFecha, coincide, abrirModal } from '../comun.js';
import { pintarHoja } from './lienzo.js';
import { esPregunta, TIPOS_PREGUNTA, textoEnunciado } from './preguntas.js';
import { borrarFotos } from './vivo-profe.js';

// panel: 'profesor' o 'admin' (para volver al panel correcto desde el editor)
export async function vistaProyectos(cont, { rpc, panel = 'profesor' }) {
  cont.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>';
  let lista;
  try { lista = await rpc('mis_proyectos'); }
  catch (e) { cont.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  const extra = panel === 'admin' ? '&volver=admin' : '';
  const abrir = (id, modo = '') => { location.href = `proyectos.html?id=${encodeURIComponent(id)}${extra}${modo ? `&${modo}=1` : ''}`; };
  const recargar = () => vistaProyectos(cont, { rpc, panel });

  cont.innerHTML = `
    <div class="card"><div class="row between"><div><h2>🎨 Proyectos en grupo</h2>
      <p class="sub" style="margin-bottom:0;">Arma presentaciones con hojas de contenido, preguntas, grupos y ruleta. Preséntalas en vivo: tus alumnos entran con un PIN o un QR desde el celular.</p></div>
      <button class="btn btn-primary" data-crear>➕ Crear proyecto</button></div>
      ${lista.length > 6 ? '<input class="input" data-buscar placeholder="🔍 Buscar proyecto..." style="max-width:300px; margin-top:12px;">' : ''}</div>
    <div class="grid grid-auto" data-lista style="margin-top:16px;"></div>`;
  $('[data-crear]', cont).onclick = async () => {
    const r = await pedirDatos('Crear proyecto', [
      { nombre: 'nombre', etiqueta: 'Nombre del proyecto *', placeholder: 'Ej: Repaso de Ciencias – 3.° B', requerido: true }], { boton: 'Crear' });
    if (!r) return;
    try { abrir(await rpc('proyecto_crear', { p_nombre: r.nombre })); }
    catch (e) { toast(mensajeError(e), 'error'); }
  };

  const listaEl = $('[data-lista]', cont);
  const pintar = () => {
    const q = $('[data-buscar]', cont)?.value || '';
    const vis = lista.filter(p => !q || coincide(p.nombre, q));
    listaEl.innerHTML = vis.map(p => {
      const s = p.sesion;
      return `<div class="card proy-card" data-proy="${p.id}">
        <button class="proy-mini" data-abrir title="Abrir en el editor"><div data-mini></div></button>
        <h3 title="${esc(p.nombre)}">${esc(p.nombre)}</h3>
        <p class="small muted" style="font-weight:700; margin:0 2px;">${p.n_hojas} ${p.n_hojas === 1 ? 'hoja' : 'hojas'} · editado ${fmtFecha(p.updated_at, true)}</p>
        ${s ? `<div class="proy-vivo">📡 <b>Sesión en curso</b> · hoja ${s.hoja_indice} de ${s.total_hojas} · ${s.participantes} ${s.participantes === 1 ? 'participante' : 'participantes'} · PIN ${esc(s.pin)}${s.estado === 'pausada' ? ' · en pausa' : ''}
          <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm btn-primary" data-continuar>Continuar sesión</button><button class="btn btn-sm btn-outline" data-reiniciar>Reiniciar</button></div></div>` : ''}
        <div class="acciones">
          <button class="btn btn-sm btn-primary" data-abrir>✏️ Abrir</button>
          ${s ? '' : '<button class="btn btn-sm btn-green" data-envivo title="Presentar en vivo con PIN y QR">📡 En vivo</button>'}
          <button class="btn btn-sm" data-presentar title="Presentar sin participantes">▶</button>
          ${p.n_sesiones ? '<button class="btn btn-sm" data-resultados title="Resultados de las sesiones">📊</button>' : ''}
          <button class="btn btn-sm btn-outline" data-duplicar title="Duplicar">⧉</button>
          <button class="btn btn-sm btn-red" data-eliminar title="Eliminar">🗑</button>
        </div>
      </div>`;
    }).join('') ||
      `<div class="card empty" style="grid-column:1/-1;"><span class="big">🎨</span>${q ? 'Ningún proyecto coincide con la búsqueda.' : 'Aún no tienes proyectos. Pulsa “Crear proyecto” para empezar.'}</div>`;
    vis.forEach(p => {
      const c = $(`[data-proy="${p.id}"] [data-mini]`, listaEl);
      pintarHoja(c, { diseno: p.portada || { fondo: { tipo: 'color', valor: '#F6F4FF' }, elementos: [] } }, { modo: 'miniatura' });
    });
    $$('[data-proy]', listaEl).forEach(card => {
      const id = card.dataset.proy, p = lista.find(x => x.id === id);
      const en = (sel, fn) => { const b = $(sel, card); if (b) b.onclick = fn; };
      $$('[data-abrir]', card).forEach(b => b.onclick = () => abrir(id));
      en('[data-presentar]', () => abrir(id, 'presentar'));
      en('[data-envivo]', () => abrir(id, 'vivo'));
      en('[data-continuar]', () => abrir(id, 'vivo'));
      en('[data-resultados]', () => verResultados(p, rpc, recargar));
      en('[data-reiniciar]', async () => {
        if (!await confirmar('Se borrarán los participantes, sus respuestas y los grupos de esta sesión, y habrá un PIN nuevo. El diseño del proyecto no cambia.', { titulo: '¿Reiniciar la sesión?', boton: 'Reiniciar' })) return;
        try { const r = await rpc('proyecto_reiniciar_sesion', { p_sesion: p.sesion.id }); await borrarFotos(r.fotos); toast('Sesión reiniciada · PIN nuevo: ' + r.sesion.pin); recargar(); }
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
    });
  };
  const buscar = $('[data-buscar]', cont);
  if (buscar) buscar.oninput = pintar;
  pintar();
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
    const interactivas = hojas.filter(h => esPregunta(h.tipo) || h.tipo === 'agrupar' || h.tipo === 'ruleta');
    const hojaGrupos = s.grupos.length ? s.grupos[s.grupos.length - 1].hoja_id : null;   // los grupos más recientes
    cuerpo.innerHTML = `<div class="grid grid-3" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); margin-bottom:14px;">
        ${[['👥', parts.length, 'Participantes'], ['🧩', s.grupos.filter(g => g.hoja_id === hojaGrupos).length, 'Grupos'], ['💬', s.respuestas.length, 'Respuestas']]
          .map(([ico, n, t]) => `<div class="stat"><span>${ico} ${t}</span><b>${n}</b></div>`).join('')}</div>
      ${interactivas.map(h => `<div class="res-hoja"><h4>${h.tipo === 'agrupar' ? '👥 Agrupar' : h.tipo === 'ruleta' ? '🎡 Ruleta' : `${TIPOS_PREGUNTA[h.tipo].ico} ${esc(textoEnunciado(h) || TIPOS_PREGUNTA[h.tipo].nombre)}`}</h4><div data-res="${h.id}"></div></div>`).join('') || '<p class="hint">Este proyecto no tiene hojas con preguntas ni grupos.</p>'}
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
      const res = h.tipo === 'agrupar'
        ? { participantes: parts, grupos: s.grupos.filter(g => g.hoja_id === h.id), profe: false }
        : { revelar: true, respuestas: s.respuestas.filter(r => r.hoja_id === h.id).map(r => { const g = porGrupo ? grupo(r.grupo_id) : null; return { alias: g ? g.nombre : r.alias, avatar: g ? g.emoji : r.avatar, valor: r.valor }; }) };
      pintarHoja($(`[data-res="${h.id}"]`, cuerpo), h, { modo: 'miniatura', res });
    }
    const fin = $('[data-finalizar]', cuerpo);
    if (fin) fin.onclick = async () => {
      try { await rpc('proyecto_finalizar', { p_sesion: s.id }); s.estado = 'finalizada'; toast('Sesión finalizada'); pintar(); alCambiar(); }
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
