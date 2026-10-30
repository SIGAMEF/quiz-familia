// ============================================================
// Cultos · formulario del elemento "Versículo" (dentro de la ventana de editar un elemento)
// Se escribe la referencia ("Juan 3:16-18") o se elige libro, capítulo y versículos; el texto se trae
// de la Biblia elegida y queda guardado en el elemento (así el culto no depende de la Biblia al proyectar).
// El texto se puede corregir o reemplazar (por ejemplo, pegando otra versión).
// ============================================================
import { $, $$, esc, toast, mensajeError, debounce, abrirModal } from '../comun.js';
import { LIBROS, leerReferencia, citaDe, versiones, VERSION_DEFECTO, textoDe, versosDelCapitulo, buscarPalabra, importarVersion, borrarVersion,
  conectarYouVersion, desconectarYouVersion, youversionConectado } from './biblia.js';

// it: { cita, texto, ref: { libro, cap, versos }, version, numeros } (vcorto: la abreviatura de la versión, solo mientras se edita)
export async function formVersiculo(form, it, { previa, selPlantilla }) {
  if (it.numeros == null) it.numeros = true;
  if (!it.version) it.version = VERSION_DEFECTO;
  form.innerHTML = `
    <div class="cu-dos"><div><label class="lbl">Referencia</label><input class="input" data-refe placeholder="Juan 3:16-18 · Sal 23 · 1 Co 13:4-7" value="${esc(it.ref ? citaDe(it.ref) : '')}"></div>
      <div><label class="lbl">Versión</label><select class="input" data-version></select></div></div>
    <div class="cu-biblia-sel">
      <select class="input" data-libro aria-label="Libro"><option value="">Libro…</option>
        <optgroup label="Antiguo Testamento">${LIBROS.filter(l => !l.nuevo).map(l => `<option value="${l.i}">${esc(l.nombre)}</option>`).join('')}</optgroup>
        <optgroup label="Nuevo Testamento">${LIBROS.filter(l => l.nuevo).map(l => `<option value="${l.i}">${esc(l.nombre)}</option>`).join('')}</optgroup></select>
      <select class="input" data-cap aria-label="Capítulo"></select>
      <select class="input" data-desde aria-label="Desde el versículo"></select>
      <select class="input" data-hasta aria-label="Hasta el versículo"></select></div>
    <p class="small" data-estado-b style="min-height:18px; margin:4px 0 0;"></p>
    <label class="check"><input type="checkbox" data-numeros ${it.numeros ? 'checked' : ''}> Mostrar el número de cada versículo</label>
    <label class="lbl">Texto <span class="small muted">(puedes corregirlo o pegar el de otra versión)</span></label>
    <textarea class="input cu-el-area" data-campo="texto" placeholder="Escribe la referencia arriba o pega aquí el texto: un versículo por línea">${esc(it.texto || '')}</textarea>
    <label class="lbl">Cita <span class="small muted">(sale abajo, en cada pantalla)</span></label>
    <input class="input" data-campo="cita" maxlength="80" placeholder="Juan 3:16-18" value="${esc(it.cita || '')}">
    <p class="hint" data-sugerir-yv style="margin:4px 0 0;">¿Necesitas la <b>RVR1960</b>? Conéctala con YouVersion (bible.com) en “Más versiones” abajo.</p>
    <details class="cu-mas" data-mas><summary>🔎 Buscar por palabra · Más versiones (RVR1960)</summary>
      <div class="row" style="gap:6px; margin-top:8px; flex-wrap:nowrap;"><input class="input" data-q placeholder="Palabra o frase: “buen pastor”"><button class="btn btn-sm" data-buscar>Buscar</button></div>
      <div class="cu-biblia-res" data-res></div>
      <hr style="margin:12px 0; border:none; border-top:1px solid var(--line);">
      <p class="hint" style="margin-top:0;">Incluida: <b>Reina-Valera 1909</b> (dominio público, palabras antiguas: “me hará yacer”). La <b>RVR1960</b> tiene derechos de autor, así que se trae de forma legal desde <b>YouVersion</b> (la de bible.com):</p>
      <div class="cu-yv" data-yv></div>
      <p class="hint">O, si tu iglesia tiene el archivo de una versión con permiso, impórtalo: queda solo en este navegador.</p>
      <div class="row" style="gap:6px;"><label class="btn btn-sm">📥 Importar una versión (JSON)<input type="file" accept=".json,application/json" data-importar hidden></label>
        <button class="btn btn-sm btn-ghost" data-quitar-v hidden>🗑 Quitar esta versión</button></div>
    </details>
    ${selPlantilla()}`;

  const sel = (k) => $(`[data-${k}]`, form);
  const estado = (txt, error = false) => { const e = sel('estado-b'); e.textContent = txt; e.style.color = error ? 'var(--red)' : 'var(--muted)'; };
  const opciones = (desde, hasta, actual) => Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, k) => desde + k)
    .map(n => `<option value="${n}" ${n === actual ? 'selected' : ''}>${n}</option>`).join('');

  async function pintarVersiones() {
    const vs = await versiones();
    if (!vs.some(v => v.id === it.version)) it.version = VERSION_DEFECTO;
    sel('version').innerHTML = vs.map(v => `<option value="${esc(v.id)}" ${v.id === it.version ? 'selected' : ''}>${esc(v.nombre)}${v.importada ? ' (importada)' : v.youversion ? ' · YouVersion' : ''}</option>`).join('');
    sel('quitar-v').hidden = !vs.find(v => v.id === it.version)?.importada;
    it.vcorto = vs.find(v => v.id === it.version)?.corto || '';
  }
  // los selectores siguen a la referencia
  let nVersos = 0;
  async function pintarSelectores() {
    const r = it.ref;
    sel('libro').value = r ? String(r.libro) : '';
    sel('cap').innerHTML = r ? opciones(1, LIBROS[r.libro].capitulos, r.cap) : '<option value="">Cap.</option>';
    sel('cap').disabled = !r;
    nVersos = 0;
    if (r) { try { nVersos = (await versosDelCapitulo(it.version, r.libro, r.cap)).length; } catch { /* sin conexión: queda vacío */ } }
    const desde = r?.versos?.length ? Math.min(...r.versos) : 1, hasta = r?.versos?.length ? Math.max(...r.versos) : nVersos;
    sel('desde').innerHTML = nVersos ? opciones(1, nVersos, desde) : '<option value="">Vers.</option>';
    sel('hasta').innerHTML = nVersos ? opciones(desde, nVersos, hasta) : '<option value="">Vers.</option>';
    sel('desde').disabled = sel('hasta').disabled = !nVersos;
  }
  // trae el texto de la referencia y lo pone en el cuadro
  async function traer() {
    if (!it.ref) return;
    estado('Cargando…');
    try {
      const t = await textoDe(it.ref, it.version);
      it.texto = t.versos.map(v => (it.numeros ? v.n + ' ' : '') + v.t).join('\n');
      it.cita = it.vcorto ? `${t.cita} · ${it.vcorto}` : t.cita;
      sel('campo="texto"').value = it.texto;
      $('[data-campo="cita"]', form).value = it.cita;
      estado(`✔ ${t.versos.length} ${t.versos.length === 1 ? 'versículo' : 'versículos'} · ${it.vcorto || ''}`);
      previa();
    } catch (e) { estado(mensajeError(e), true); }
  }
  const ponerRef = async (ref) => { it.ref = ref; sel('refe').value = ref ? citaDe(ref) : ''; await pintarSelectores(); await traer(); };

  sel('refe').oninput = debounce(async (e) => {
    const t = e.target.value.trim();
    if (!t) return estado('');
    const r = leerReferencia(t);
    if (!r) return estado('No reconozco esa referencia. Prueba “Juan 3:16-18”.', true);
    it.ref = r; await pintarSelectores(); await traer();
  }, 450);
  sel('libro').onchange = () => { const i = sel('libro').value; ponerRef(i === '' ? null : { libro: Number(i), cap: 1, versos: null }); };
  sel('cap').onchange = () => ponerRef({ ...it.ref, cap: Number(sel('cap').value), versos: null });
  const rango = () => {
    const a = Number(sel('desde').value), b = Math.max(a, Number(sel('hasta').value) || a);
    const todo = a === 1 && b === nVersos;
    ponerRef({ ...it.ref, versos: todo ? null : Array.from({ length: b - a + 1 }, (_, k) => a + k) });
  };
  sel('desde').onchange = rango;
  sel('hasta').onchange = rango;
  sel('version').onchange = async () => { it.version = sel('version').value; await pintarVersiones(); await pintarSelectores(); await traer(); };
  sel('numeros').onchange = () => { it.numeros = sel('numeros').checked; if (it.ref) traer(); };

  // búsqueda por palabra
  const buscar = async () => {
    const q = sel('q').value.trim();
    const res = sel('res');
    if (q.length < 3) { res.innerHTML = '<p class="hint">Escribe al menos 3 letras.</p>'; return; }
    res.innerHTML = '<p class="hint" data-av>Buscando… la primera vez se baja toda la Biblia (unos 4 MB).</p>';
    try {
      const r = await buscarPalabra(q, it.version, { max: 100, alAvanzar: (p) => { const a = $('[data-av]', res); if (a) a.textContent = `Buscando… ${Math.round(p * 100)} %`; } });
      res.innerHTML = r.length ? r.map((x, k) => `<button class="cu-biblia-r" data-k="${k}"><b>${esc(citaDe({ libro: x.libro, cap: x.cap, versos: [x.verso] }))}</b> ${esc(x.t)}</button>`).join('')
        + (r.length >= 100 ? '<p class="hint">Se muestran los primeros 100.</p>' : '')
        : '<p class="hint">No se encontró.</p>';
      $$('[data-k]', res).forEach(b => b.onclick = () => { const x = r[b.dataset.k]; ponerRef({ libro: x.libro, cap: x.cap, versos: [x.verso] }); });
    } catch (e) { res.innerHTML = `<p class="err">${esc(mensajeError(e))}</p>`; }
  };
  sel('buscar').onclick = buscar;
  sel('q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } };

  // versiones importadas
  sel('importar').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const datos = await pedirNombreVersion();
    if (!datos) return;
    try { estado('Importando…'); it.version = await importarVersion(f, datos); await pintarVersiones(); await pintarSelectores(); await traer(); toast(`${datos.nombre} quedó en este navegador`); }
    catch (err) { estado(mensajeError(err), true); }
  };
  sel('quitar-v').onclick = async () => {
    try { await borrarVersion(it.version); it.version = VERSION_DEFECTO; await pintarVersiones(); toast('Versión quitada de este navegador'); }
    catch (err) { toast(mensajeError(err), 'error'); }
  };

  // ---------- YouVersion ----------
  function pintarYV() {
    const c = sel('yv');
    sel('sugerir-yv').hidden = youversionConectado();
    if (youversionConectado()) {
      c.innerHTML = `<p class="small" style="margin:0;">✔ Conectado a YouVersion. Elige la versión arriba, en <b>Versión</b>.</p>
        <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm" data-yv-act>🔄 Actualizar versiones</button><button class="btn btn-sm btn-ghost" data-yv-quitar>Desconectar</button></div>`;
      sel('yv-act').onclick = () => conectar(JSON.parse(localStorage.getItem('biblia.youversion') || '{}').clave);
      sel('yv-quitar').onclick = async () => { desconectarYouVersion(); if (String(it.version).startsWith('yv-')) it.version = VERSION_DEFECTO; await pintarVersiones(); pintarYV(); };
      return;
    }
    c.innerHTML = `<ol class="small" style="margin:4px 0 6px 18px; padding:0;">
        <li>Entra a <a href="https://platform.youversion.com" target="_blank" rel="noopener">platform.youversion.com</a> (gratis para iglesias y uso sin fines de lucro) y crea una app.</li>
        <li>Acepta allí la licencia de la <b>Reina-Valera 1960</b> (si te la piden).</li>
        <li>Copia la <b>App Key</b> y pégala aquí.</li></ol>
      <div class="row" style="gap:6px; flex-wrap:nowrap;"><input class="input" data-yv-clave placeholder="App Key de YouVersion" autocomplete="off"><button class="btn btn-sm btn-primary" data-yv-ok>Conectar</button></div>`;
    sel('yv-ok').onclick = () => conectar(sel('yv-clave').value);
  }
  async function conectar(clave) {
    try {
      estado('Conectando con YouVersion…');
      const vs = await conectarYouVersion(clave);
      const rv60 = vs.find(v => /1960|RVR(19)?60/i.test(v.nombre + ' ' + v.corto));
      if (rv60) it.version = rv60.id;
      await pintarVersiones(); pintarYV();
      estado(vs.length ? `✔ ${vs.length} ${vs.length === 1 ? 'versión' : 'versiones'} en español de YouVersion${rv60 ? ' · elegida ' + rv60.corto : ''}` : 'Conectado, pero YouVersion no habilita versiones en español para tu clave todavía.', !vs.length);
      if (it.ref) { await pintarSelectores(); await traer(); }
    } catch (e) { estado(mensajeError(e), true); }
  }
  pintarYV();

  await pintarVersiones();
  await pintarSelectores();
}

function pedirNombreVersion() {
  return new Promise(resolve => {
    let r = null;
    const m = abrirModal(`<h3>📥 Importar una versión</h3>
      <p class="hint">Solo importa versiones que tu iglesia pueda usar (dominio público o con permiso). Queda guardada en este navegador, no se sube a internet.</p>
      <form><label class="lbl">Nombre</label><input class="input" name="nombre" required maxlength="60" placeholder="Reina-Valera 1960">
      <label class="lbl">Abreviatura</label><input class="input" name="corto" required maxlength="12" placeholder="RVR1960">
      <div class="modal-pie"><button type="button" class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary">Importar</button></div></form>`,
    { alCerrar: () => resolve(r) });
    $('[data-no]', m.el).onclick = () => m.cerrar();
    $('form', m.el).onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); r = { nombre: String(f.get('nombre')).trim(), corto: String(f.get('corto')).trim() }; m.cerrar(); };
  });
}
