// ============================================================
// Proyectos en grupo: lista de proyectos (panel del profesor y del admin)
// ============================================================
import { supabase, $, $$, esc, toast, confirmar, pedirDatos, mensajeError, fmtFecha, coincide } from '../comun.js';
import { pintarHoja } from './lienzo.js';

// panel: 'profesor' o 'admin' (para volver al panel correcto desde el editor)
export async function vistaProyectos(cont, { rpc, panel = 'profesor' }) {
  cont.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>';
  let lista;
  try { lista = await rpc('mis_proyectos'); }
  catch (e) { cont.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  const extra = panel === 'admin' ? '&volver=admin' : '';
  const abrir = (id, presentar = false) => { location.href = `proyectos.html?id=${encodeURIComponent(id)}${extra}${presentar ? '&presentar=1' : ''}`; };
  const recargar = () => vistaProyectos(cont, { rpc, panel });

  cont.innerHTML = `
    <div class="card"><div class="row between"><div><h2>🎨 Proyectos en grupo</h2>
      <p class="sub" style="margin-bottom:0;">Arma presentaciones con hojas de contenido (texto, imágenes, iconos, video) y preséntalas en pantalla completa.
        Pronto: preguntas en vivo, formar grupos y ruleta con los celulares de tus alumnos.</p></div>
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
    listaEl.innerHTML = vis.map(p => `
      <div class="card proy-card" data-proy="${p.id}">
        <button class="proy-mini" data-abrir title="Abrir en el editor"><div data-mini></div></button>
        <h3 title="${esc(p.nombre)}">${esc(p.nombre)}</h3>
        <p class="small muted" style="font-weight:700; margin:0 2px;">${p.n_hojas} ${p.n_hojas === 1 ? 'hoja' : 'hojas'} · editado ${fmtFecha(p.updated_at, true)}</p>
        <div class="acciones">
          <button class="btn btn-sm btn-primary" data-abrir>✏️ Abrir</button>
          <button class="btn btn-sm" data-presentar>▶ Presentar</button>
          <button class="btn btn-sm btn-outline" data-duplicar title="Duplicar">⧉</button>
          <button class="btn btn-sm btn-red" data-eliminar title="Eliminar">🗑</button>
        </div>
      </div>`).join('') ||
      `<div class="card empty" style="grid-column:1/-1;"><span class="big">🎨</span>${q ? 'Ningún proyecto coincide con la búsqueda.' : 'Aún no tienes proyectos. Pulsa “Crear proyecto” para empezar.'}</div>`;
    vis.forEach(p => {
      const c = $(`[data-proy="${p.id}"] [data-mini]`, listaEl);
      pintarHoja(c, { diseno: p.portada || { fondo: { tipo: 'color', valor: '#F6F4FF' }, elementos: [] } }, { modo: 'miniatura' });
    });
    $$('[data-proy]', listaEl).forEach(card => {
      const id = card.dataset.proy, p = lista.find(x => x.id === id);
      $$('[data-abrir]', card).forEach(b => b.onclick = () => abrir(id));
      $('[data-presentar]', card).onclick = () => abrir(id, true);
      $('[data-duplicar]', card).onclick = async () => {
        try { await rpc('proyecto_duplicar', { p_proyecto: id }); toast('Proyecto duplicado'); recargar(); }
        catch (e) { toast(mensajeError(e), 'error'); }
      };
      $('[data-eliminar]', card).onclick = async () => {
        if (!await confirmar(`Se borrará “${p.nombre}” con todas sus hojas. No se puede deshacer.`, { titulo: '¿Eliminar el proyecto?', boton: 'Eliminar' })) return;
        const { data, error } = await supabase.from('proyectos').delete().eq('id', id).select('id');
        if (error) return toast(mensajeError(error), 'error');
        if (!data?.length) return toast('No se pudo eliminar (¿tu cuenta está activa?)', 'error');
        toast('Proyecto eliminado');
        recargar();
      };
    });
  };
  const buscar = $('[data-buscar]', cont);
  if (buscar) buscar.oninput = pintar;
  pintar();
}
