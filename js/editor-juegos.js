// ============================================================
// Panel del profesor: crear juegos (sopa, ahorcado, memorama, ordena, frase, rompecabezas),
// generarlos, publicarlos en grupos, hacerlos públicos e imprimirlos
// ============================================================
import {
  supabase, $, $$, esc, toast, abrirModal, confirmar, cargando, mensajeError, fmtFecha,
  subirImagen, urlBase, copiar, mostrarQRGrande, avatarHtml
} from './comun.js';
import { JUEGOS } from './juegos/contenido.js';
import { generarSopa, claveSopa, capsulasSVG, colorSol } from './juegos/sopa.js';
import { imprimir } from './juegos/imprimir.js';
import { montarFilas } from './editor-filas.js';

export const TIPOS_JUEGO = ['sopa', 'ahorcado', 'memoria', 'ordena', 'frase', 'rompecabezas'];
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

// ======================= LISTA =======================
export async function vistaJuegos(cont, { rpc, misGrupos }) {
  cont.innerHTML = '<div class="center" style="padding:50px;"><div class="spinner"></div></div>';
  let juegos, grupos;
  try { [juegos, grupos] = await Promise.all([rpc('mis_juegos_profesor'), misGrupos()]); }
  catch (e) { cont.innerHTML = `<div class="card empty">⚠️ ${esc(mensajeError(e))}</div>`; return; }
  let filtro = '';
  cont.innerHTML = `
    <div class="card"><div class="row between"><div><h2>🎲 Mis juegos</h2>
      <p class="sub">Crea sopas de letras, ahorcados, memoramas y más con tus palabras. Publícalos en tus grupos, hazlos públicos para la página principal o imprímelos.</p></div>
      <button class="btn btn-primary" data-nuevo>➕ Crear juego</button></div>
      <div class="chips" data-filtro style="margin-top:10px;"></div></div>
    <div class="grid grid-auto" data-lista></div>`;
  const recargar = () => vistaJuegos(cont, { rpc, misGrupos });
  $('[data-nuevo]', cont).onclick = () => elegirTipo(recargar);
  const pintarFiltro = () => {
    $('[data-filtro]', cont).innerHTML = [['', 'Todos'], ...TIPOS_JUEGO.map(t => [t, `${JUEGOS[t].ico} ${JUEGOS[t].nombre}`])]
      .map(([k, t]) => `<button class="chip ${k === filtro ? 'activo' : ''}" data-f="${k}">${esc(t)} ${k ? `(${juegos.filter(j => j.tipo === k).length})` : `(${juegos.length})`}</button>`).join('');
    $$('[data-f]', cont).forEach(b => b.onclick = () => { filtro = b.dataset.f; pintarFiltro(); pintar(); });
  };
  const pintar = () => {
    const vis = juegos.filter(j => !filtro || j.tipo === filtro);
    $('[data-lista]', cont).innerHTML = vis.map(j => `
      <div class="card juego-card" data-j="${j.id}" style="margin:0; display:flex; flex-direction:column;">
        <div class="row" style="align-items:flex-start; flex-wrap:nowrap;"><span style="font-size:30px;">${JUEGOS[j.tipo].ico}</span>
          <div class="grow"><h3>${esc(j.titulo)}</h3><p class="small muted" style="font-weight:700;">${esc(JUEGOS[j.tipo].nombre)}${j.tema ? ' · ' + esc(j.tema) : ''} · ${j.n} ${j.tipo === 'memoria' ? 'parejas' : j.tipo === 'frase' ? 'frases' : j.tipo === 'rompecabezas' ? 'piezas' : 'palabras'}</p></div></div>
        <div class="row" style="gap:6px; margin:8px 0;">
          <label class="chip check" title="Aparece en la página principal para que cualquiera lo juegue"><input type="checkbox" data-publico ${j.publico ? 'checked' : ''}> 🌐 Público</label>
          ${j.publico ? `<span class="badge gray">▶ ${j.jugadas} jugadas</span>` : ''}
          ${j.publicaciones.map(p => `<span class="badge ${p.activo ? 'green' : 'gray'}">👥 ${esc(p.grupo)}${p.jugaron ? ` · ${p.jugaron} jugaron` : ''}</span>`).join('')}
        </div>
        <p class="small muted" style="margin-top:auto;">Editado ${fmtFecha(j.updated_at, true)}</p>
        <div class="row" style="gap:6px; margin-top:10px;">
          <a class="btn btn-sm btn-primary" href="juegos.html?g=${j.id}" target="_blank" rel="noopener">▶ Jugar</a>
          <button class="btn btn-sm" data-acc="editar">✏️ Editar</button>
          <button class="btn btn-sm btn-green" data-acc="publicar">📣 Grupos</button>
          <button class="btn btn-sm" data-acc="resultados" title="Quién jugó">📊</button>
          <button class="btn btn-sm" data-acc="enlace" title="Enlace y QR">📱</button>
          <button class="btn btn-sm" data-acc="ficha" title="Imprimir ficha">🖨</button>
          <button class="btn btn-sm" data-acc="solucion" title="Imprimir solución">🖨✔</button>
          <button class="btn btn-sm btn-red" data-acc="eliminar" title="Eliminar">🗑</button>
        </div>
      </div>`).join('') || `<div class="empty card" style="grid-column:1/-1;"><span class="big">🎲</span>${juegos.length ? 'No hay juegos de este tipo.' : 'Todavía no creaste juegos. Toca “Crear juego” y elige uno.'}</div>`;
    $$('[data-j]', cont).forEach(card => {
      const j = juegos.find(x => x.id === card.dataset.j);
      $('[data-publico]', card).onchange = async (e) => {
        const { error } = await supabase.from('juegos').update({ publico: e.target.checked }).eq('id', j.id);
        if (error) { e.target.checked = !e.target.checked; return toast(mensajeError(error), 'error'); }
        j.publico = e.target.checked; toast(j.publico ? 'Ahora aparece en la página principal' : 'Ya no es público'); pintar();
      };
      $$('[data-acc]', card).forEach(b => b.onclick = () => accion(b.dataset.acc, j));
    });
  };
  async function accion(acc, j) {
    if (acc === 'editar') return abrirEditor(j.tipo, j, recargar);
    if (acc === 'ficha' || acc === 'solucion') return imprimir(j.tipo, { ...j.datos, titulo: j.titulo, tema: j.tema }, { solucion: acc === 'solucion' }).catch(e => toast(mensajeError(e), 'error'));
    if (acc === 'publicar') return publicar(j, grupos, recargar);
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
  pintarFiltro(); pintar();
}

// ======================= CREAR / EDITAR =======================
function elegirTipo(alGuardar) {
  const m = abrirModal(`<h3>➕ ¿Qué juego quieres crear?</h3>
    <div class="grid grid-2" style="gap:10px;">${TIPOS_JUEGO.map(t => `<button class="tipo-juego" data-t="${t}" style="--c:${JUEGOS[t].color}">
      <span>${JUEGOS[t].ico}</span><b>${esc(JUEGOS[t].nombre)}</b><small>${esc(JUEGOS[t].desc)}</small></button>`).join('')}</div>`, { ancho: true });
  $$('[data-t]', m.el).forEach(b => b.onclick = () => { m.cerrar(); abrirEditor(b.dataset.t, null, alGuardar); });
}

export function abrirEditor(tipo, juego, alGuardar) {
  const d = juego?.datos || {};
  const info = JUEGOS[tipo];
  const esSopa = tipo === 'sopa', esPuzzle = tipo === 'rompecabezas';
  let sopa = esSopa && d.grilla ? { grilla: d.grilla, ubicaciones: d.ubicaciones, faltaron: [] } : null;
  let imagen = d.imagen_url || '';
  const m = abrirModal(`<h3>${info.ico} ${juego ? 'Editar' : 'Nuevo'}: ${esc(info.nombre)}</h3>
    <div class="grid grid-2">
      <div><label class="lbl">Título *</label><input class="input" data-c="titulo" maxlength="120" value="${esc(juego?.titulo || '')}" placeholder="Ej: Animales de la sierra"></div>
      <div><label class="lbl">Tema</label><input class="input" data-c="tema" maxlength="60" value="${esc(juego?.tema || '')}" placeholder="Ej: Ciencia, Biblia, Inglés"></div>
    </div>
    <div class="grid grid-2">
      <div><label class="lbl">Nivel</label><select class="input" data-c="nivel"><option value="">—</option>${NIVELES.map(n => `<option ${juego?.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="lbl">⏱ Tiempo para jugar</label><select class="input" data-c="segundos">${[[0, 'Sin límite'], [60, '1 minuto'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos']].map(([v, t]) => `<option value="${v}" ${Number(juego?.segundos || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    <p class="hint">El tiempo viene puesto al jugarlo solo o en línea (quien lo comparte puede cambiarlo).</p>
    ${esSopa ? `<div class="grid grid-2" style="margin-top:4px;">
        <div><label class="lbl">Filas</label><input class="input" type="number" min="6" max="25" data-c="filas" value="${d.filas || 12}"></div>
        <div><label class="lbl">Columnas</label><input class="input" type="number" min="6" max="25" data-c="columnas" value="${d.columnas || 12}"></div></div>
      <label class="lbl">Las palabras pueden ir</label>
      <div class="chips">${DIRS.map(([k, t]) => `<label class="chip check"><input type="checkbox" data-dir="${k}" ${(d.direcciones || ['horizontal', 'vertical']).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div>` : ''}
    ${esPuzzle ? `<label class="lbl">Imagen *</label>
      <div class="row"><label class="btn" for="imgPuzzle">📷 Elegir imagen</label><input type="file" id="imgPuzzle" accept="image/*" class="hidden"><span class="small muted" data-estado-img>${imagen ? 'Imagen lista' : 'Usa una foto o dibujo cuadrado si puedes.'}</span></div>
      <img data-prev-img src="${esc(imagen)}" alt="" style="max-width:220px; border-radius:12px; margin-top:8px; ${imagen ? '' : 'display:none;'}">
      <label class="lbl">Piezas</label><select class="input" data-c="piezas" style="max-width:160px;">${[3, 4, 5].map(n => `<option value="${n}" ${Number(d.piezas || 3) === n ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select>`
    : `<label class="lbl">${tipo === 'memoria' ? 'Parejas (cada carta puede ser texto, imagen o ambas)' : tipo === 'frase' ? 'Frases' : 'Palabras'} *</label>
      <div data-filas></div>`}
    ${esSopa ? `<label class="lbl">¿Qué ven los alumnos para buscar?</label>
      <div class="chips">${[['palabras', '🔤 Las palabras'], ['imagenes', '🖼 Solo las imágenes'], ['imagenes_desc', '🖼 Imágenes con su descripción']].map(([k, t]) => `<label class="chip check"><input type="radio" name="pistasSopa" data-pistas="${k}" ${(d.pistas || 'palabras') === k ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <p class="hint" data-aviso-pistas></p>` : ''}
    ${esSopa ? `<div class="row" style="margin-top:10px;"><button class="btn btn-amber" data-generar>⚙️ Generar sopa</button>
        <label class="check small"><input type="checkbox" data-versol> Ver solución</label><span class="grow"></span><span class="small" data-estado-sopa></span></div>
      <div data-prev-sopa style="margin-top:10px;"></div>` : ''}
    <label class="check" style="margin-top:14px;"><input type="checkbox" data-c="publico" ${juego?.publico ? 'checked' : ''}> 🌐 Público: aparece en la página principal para que cualquiera lo juegue</label>
    <div class="err" data-err></div>
    <div class="modal-pie" style="flex-wrap:wrap;">
      <button class="btn btn-sm" data-imp="0">🖨 Ficha</button><button class="btn btn-sm" data-imp="1">🖨 Solución</button>
      <span class="grow"></span>
      <button class="btn btn-outline" data-cerrar>Cancelar</button><button class="btn btn-primary" data-guardar>💾 Guardar</button></div>`, { ancho: true });
  const el = m.el;
  const v = (c) => $(`[data-c=${c}]`, el);
  const err = (t) => { $('[data-err]', el).textContent = t || ''; };
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
  const CLASE = tipo === 'memoria' ? 'parejas' : tipo === 'frase' ? 'frases' : 'palabras';
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
    if (esPuzzle && !imagen) throw new Error('Sube la imagen del rompecabezas.');
    return datos;
  };
  $$('[data-imp]', el).forEach(b => b.onclick = async () => {
    try { err(''); await imprimir(tipo, { ...armar(), titulo: v('titulo').value.trim() || info.nombre, tema: v('tema').value.trim() }, { solucion: b.dataset.imp === '1' }); }
    catch (e) { err(e.message); }
  });
  $('[data-guardar]', el).onclick = async () => {
    err('');
    const titulo = v('titulo').value.trim();
    if (!titulo) return err('Escribe el título.');
    let datos; try { datos = armar(); } catch (e) { return err(e.message); }
    const fila = { tipo, titulo, tema: v('tema').value.trim() || null, nivel: v('nivel').value || null, segundos: Number(v('segundos').value) || null, datos, publico: v('publico').checked };
    const b = $('[data-guardar]', el); b.disabled = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const q = juego ? supabase.from('juegos').update(fila).eq('id', juego.id) : supabase.from('juegos').insert({ ...fila, profesor_id: user.id });
      const { error } = await q;
      if (error) throw error;
      toast(juego ? 'Juego guardado' : 'Juego creado'); m.cerrar(); alGuardar && alGuardar();
    } catch (e) { err(mensajeError(e)); b.disabled = false; }
  };
}

// ======================= PUBLICAR EN GRUPOS =======================
function publicar(j, grupos, alCambiar) {
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
