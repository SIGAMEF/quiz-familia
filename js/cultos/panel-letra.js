// ============================================================
// Cultos: panel "🎵 Letra" del editor de canciones (columna izquierda del editor de Proyectos)
// Datos de la canción, pegar/limpiar/buscar/revisar la letra, estrofas en acordeón (una línea cada una),
// un selector de tipo por estrofa, cortes a mano, aviso de coros casi iguales, orden de canto y líneas por pantalla.
// Cambia `cancion` directamente y avisa con alCambiar(tipo): 'letra' | 'orden' | 'opciones' | 'datos'.
// ============================================================
import { $, $$, esc, toast, debounce } from '../comun.js';
import {
  TIPOS_BLOQUE, CORTE, LINEAS_POR_PANTALLA, limpiarLetra, textoABloques, bloquesATexto, etiquetas, ordenSugerido,
  ordenNormal, pantallasDeBloque, corosParecidos, unirBloques, lineasDeContenido
} from './letra.js';
import { revisarOrtografia } from './ortografia.js';

export const ETIQUETAS_SUGERIDAS = ['adoración', 'alabanza', 'juvenil', 'santa cena', 'infantil', 'himno', 'oración', 'navidad', 'bautismo', 'ofrenda'];
const TONOS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm', 'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const pref = {
  leer(k, d) { try { return localStorage.getItem('cultos.' + k) ?? d; } catch { return d; } },
  poner(k, v) { try { localStorage.setItem('cultos.' + k, v); } catch { /* sin almacenamiento */ } }
};
const esCorte = (l) => l.trim() === CORTE || l.trim() === '--';

export function montarPanelLetra(cont, { cancion: c, perfil, alCambiar, alElegirBloque }) {
  const abiertos = new Set();      // estrofas desplegadas
  let elegido = -1, sinAviso = false;
  const usarOrden = () => Array.isArray(c.orden_canto) && c.orden_canto.length > 0;

  cont.innerHTML = `
    <label class="lbl" style="margin-top:0;" for="plTitulo">Título *</label>
    <input class="input" id="plTitulo" data-campo="titulo" maxlength="150" placeholder="Ej: Cuán grande es Él" value="${esc(c.titulo)}">
    <details class="pl-datos" style="margin-top:6px;"><summary class="small" style="cursor:pointer; font-weight:800; color:var(--muted);">Autor, tono, etiquetas y compartir</summary>
      <label class="lbl" for="plAutor">Autor</label><input class="input" id="plAutor" data-campo="autor" maxlength="150" value="${esc(c.autor)}">
      <label class="lbl" for="plTono">Tono</label><input class="input" id="plTono" data-campo="tono" maxlength="20" list="plTonos" value="${esc(c.tono)}" placeholder="G, Re…">
      <datalist id="plTonos">${TONOS.map(t => `<option value="${t}">`).join('')}</datalist>
      <label class="lbl">Etiquetas</label><div class="cu-chips" data-etiquetas></div>
      <label class="check small" style="margin-top:10px;"><input type="checkbox" data-compartir ${c.compartida ? 'checked' : ''}> ⛪ Compartir con mi iglesia</label>
      <p class="hint">${perfil?.institucion ? `Los profesores de “${esc(perfil.institucion)}” podrán verla y copiarla.` : 'Para compartir, escribe tu institución en “Mi perfil”.'}</p>
    </details>
    <div class="row" style="gap:6px; margin-top:10px;">
      <button class="btn btn-sm btn-outline" data-google title="Abre Google en otra pestaña: copia la letra y pégala aquí">🔎 Buscar letra</button>
      <button class="btn btn-sm btn-outline" data-limpiar title="Quita publicidad, espacios y líneas vacías repetidas">🧹 Limpiar</button>
      <button class="btn btn-sm btn-outline" data-orto>✓ Ortografía</button>
    </div>
    <details class="pl-texto" data-det-texto ${c.bloques.length ? '' : 'open'} style="margin-top:10px;">
      <summary class="small" style="cursor:pointer; font-weight:800; color:var(--primary-dark);">✏️ Letra completa (pegar y escribir)</summary>
      <textarea class="input pl-area" data-letra spellcheck="true" lang="es" placeholder="Pega aquí la letra.&#10;&#10;Deja una línea en blanco entre estrofas.&#10;[Coro] arriba del coro."></textarea>
      <label class="check small" style="margin-top:6px;"><input type="checkbox" data-auto ${pref.leer('limpiarAlPegar', '1') === '1' ? 'checked' : ''}> Limpiar al pegar</label>
      <p class="hint">Una línea con <b>${CORTE}</b> corta la pantalla. <code>//…//</code> y <code>(x2)</code> repiten.</p>
    </details>
    <div data-aviso></div>
    <div class="row between" style="margin-top:12px;"><h4 style="margin:0;">Estrofas</h4>
      <span class="row" style="gap:2px;"><button class="btn btn-sm btn-ghost" data-plegar title="Plegar todo">⊟</button><button class="btn btn-sm btn-ghost" data-desplegar title="Desplegar todo">⊞</button></span></div>
    <div class="pl-acordeon" data-bloques style="margin-top:6px;"></div>
    <div class="row between" style="margin-top:12px;"><h4 style="margin:0;">Orden de canto</h4>
      <label class="check small"><input type="checkbox" data-usar-orden> Usar</label></div>
    <div data-orden style="margin-top:6px;"></div>
    <h4>Pantallas</h4>
    <div class="prop-fila"><label>Líneas</label><select class="input" data-lineas>${LINEAS_POR_PANTALLA.map(n => `<option value="${n}">${n} por pantalla</option>`).join('')}</select></div>
    <div class="prop-fila"><label>Repetir</label><select class="input" data-rep><option value="expandir">escribir las repetidas</option><option value="marcar">mostrar “×2”</option></select></div>`;

  const area = $('[data-letra]', cont);
  area.value = bloquesATexto(c.bloques);
  $('[data-lineas]', cont).value = String(LINEAS_POR_PANTALLA.includes(Number(c.opciones.lineas)) ? c.opciones.lineas : 4);
  $('[data-rep]', cont).value = c.opciones.repeticiones === 'marcar' ? 'marcar' : 'expandir';

  // ---------- Datos ----------
  $$('[data-campo]', cont).forEach(inp => inp.oninput = () => { c[inp.dataset.campo] = inp.value; alCambiar('datos', { campo: inp.dataset.campo }); });
  $('[data-compartir]', cont).onchange = (e) => { c.compartida = e.target.checked; alCambiar('datos'); };
  const pintarEtiquetas = () => {
    const el = $('[data-etiquetas]', cont);
    const todas = [...new Set([...ETIQUETAS_SUGERIDAS, ...c.etiquetas])];
    el.innerHTML = todas.map(t => `<button type="button" class="chip ${c.etiquetas.includes(t) ? 'activo' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')
      + '<input class="input cu-tag-nueva" data-tag-nueva maxlength="30" placeholder="+ otra" aria-label="Agregar etiqueta">';
    $$('[data-tag]', el).forEach(b => b.onclick = () => {
      const t = b.dataset.tag;
      c.etiquetas = c.etiquetas.includes(t) ? c.etiquetas.filter(x => x !== t) : [...c.etiquetas, t].slice(0, 15);
      pintarEtiquetas(); alCambiar('datos');
    });
    $('[data-tag-nueva]', el).onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const t = e.target.value.trim().toLowerCase().slice(0, 30);
      if (t && !c.etiquetas.includes(t)) { c.etiquetas = [...c.etiquetas, t].slice(0, 15); alCambiar('datos'); }
      pintarEtiquetas();
      $('[data-tag-nueva]', el).focus();
    };
  };
  pintarEtiquetas();

  // ---------- Letra ----------
  const escribir = (texto, todo = false) => {
    area.focus();
    if (todo) area.select();
    if (!document.execCommand?.('insertText', false, texto)) {
      area.setRangeText(texto, todo ? 0 : area.selectionStart, todo ? area.value.length : area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input'));
    }
  };
  const completarDatos = (r) => {
    if (r.autor && !c.autor) { c.autor = r.autor; $('[data-campo="autor"]', cont).value = r.autor; }
    if (r.tono && !c.tono) { c.tono = r.tono; $('[data-campo="tono"]', cont).value = r.tono; }
  };
  const alTexto = () => { c.bloques = textoABloques(area.value); pintarBloques(); pintarOrden(); pintarAviso(); alCambiar('letra'); };
  area.addEventListener('input', debounce(alTexto, 450));
  area.addEventListener('paste', (e) => {
    const t = e.clipboardData?.getData('text/plain') || '';
    if (!$('[data-auto]', cont).checked || !t.includes('\n')) return;   // una sola línea se pega tal cual
    e.preventDefault();
    const r = limpiarLetra(t);
    completarDatos(r);
    const antes = area.value.slice(0, area.selectionStart), despues = area.value.slice(area.selectionEnd);
    const sep1 = antes.trim() && !/\n\s*\n\s*$/.test(antes) ? (antes.endsWith('\n') ? '\n' : '\n\n') : '';
    const sep2 = despues.trim() && !/^\s*\n\s*\n/.test(despues) ? '\n\n' : '';
    abiertos.clear();   // al pegar, todas las estrofas quedan plegadas
    escribir(sep1 + r.texto + sep2);
    toast('Letra pegada y limpiada');
  });
  $('[data-auto]', cont).onchange = (e) => pref.poner('limpiarAlPegar', e.target.checked ? '1' : '0');
  $('[data-limpiar]', cont).onclick = () => {
    if (!area.value.trim()) return toast('Primero pega la letra', 'error');
    const r = limpiarLetra(area.value);
    completarDatos(r);
    if (r.texto === area.value) return toast('La letra ya está limpia');
    $('[data-det-texto]', cont).open = true;
    escribir(r.texto, true);
    toast('Letra limpiada (Ctrl+Z para deshacer)');
  };
  $('[data-google]', cont).onclick = () => {
    if (!c.titulo.trim()) { toast('Escribe primero el título', 'error'); $('[data-campo="titulo"]', cont).focus(); return; }
    window.open('https://www.google.com/search?q=' + encodeURIComponent(`letra ${c.titulo} ${c.autor || ''}`.trim()), '_blank', 'noopener');
  };
  $('[data-orto]', cont).onclick = () => { $('[data-det-texto]', cont).open = true; revisarOrtografia(area, alTexto); };
  $('[data-lineas]', cont).onchange = (e) => { c.opciones.lineas = Number(e.target.value); pintarBloques(); alCambiar('opciones'); };
  $('[data-rep]', cont).onchange = (e) => { c.opciones.repeticiones = e.target.value; pintarBloques(); alCambiar('opciones'); };

  // Cambia los bloques desde el acordeón: reescribe el cuadro y conserva el orden de canto por bloque
  const cambiarBloques = (nuevos) => {
    if (usarOrden() && nuevos.length === c.bloques.length) {
      const viejos = etiquetas(c.bloques).map(e => e.codigo), nuevosCod = etiquetas(nuevos).map(e => e.codigo);
      c.orden_canto = ordenNormal(c.orden_canto).map(cod => { const i = viejos.indexOf(cod); return i >= 0 ? nuevosCod[i] : cod; });
    }
    c.bloques = nuevos;
    area.value = bloquesATexto(nuevos);
    pintarBloques(); pintarOrden(); pintarAviso();
    alCambiar('letra');
  };

  // ---------- Coros casi iguales ----------
  const pintarAviso = () => {
    const el = $('[data-aviso]', cont);
    const par = sinAviso ? null : corosParecidos(c.bloques)[0];
    if (!par) { el.innerHTML = ''; return; }
    const et = etiquetas(c.bloques);
    el.innerHTML = `<div class="pl-aviso">${esc(et[par[0]].codigo)} y ${esc(et[par[1]].codigo)} son casi iguales. ¿Unirlos en uno y usar Orden de canto?
      <div class="row" style="gap:6px; margin-top:6px;"><button class="btn btn-sm btn-amber" data-unir>Unir</button><button class="btn btn-sm btn-ghost" data-no-unir>No, déjalos así</button></div></div>`;
    $('[data-unir]', el).onclick = () => {
      const u = unirBloques(c, par[0], par[1]);
      c.resaltados = u.resaltados;
      c.orden_canto = u.orden_canto;
      cambiarBloques(u.bloques);
      toast(`Se unieron: ahora ${u.codigoQueda} se canta donde estaba ${u.codigoQuitado}`);
    };
    $('[data-no-unir]', el).onclick = () => { sinAviso = true; pintarAviso(); };
  };

  // ---------- Estrofas en acordeón ----------
  const pintarBloques = () => {
    const el = $('[data-bloques]', cont);
    if (!c.bloques.length) { el.innerHTML = '<div class="empty small" style="padding:10px;">Pega la letra arriba y aquí aparecerán sus estrofas.</div>'; return; }
    const et = etiquetas(c.bloques);
    el.innerHTML = c.bloques.map((b, i) => {
      const n = pantallasDeBloque(c, i), primera = lineasDeContenido(b.texto)[0] || '';
      let lineas = '', j = 0, corte = false;
      for (const l of String(b.texto).split('\n')) {
        if (esCorte(l)) { corte = true; continue; }
        if (j > 0) lineas += `<button type="button" class="cu-hueco ${corte ? 'corte' : ''}" data-corte="${i}:${j}" title="${corte ? 'Quitar el corte' : 'Cortar la pantalla aquí'}">${corte ? '✂ corte · quitar' : '✂'}</button>`;
        lineas += `<div class="cu-linea">${esc(l)}</div>`;
        j++; corte = false;
      }
      return `<details class="t-${b.tipo} ${i === elegido ? 'elegido' : ''}" data-i="${i}" ${abiertos.has(i) ? 'open' : ''}>
        <summary><b>${esc(et[i].codigo)}</b>
          <select class="input cu-sel" data-tipo="${i}" aria-label="Tipo de ${esc(et[i].nombre)}" style="width:auto; padding:2px 4px; font-size:11.5px;">${Object.entries(TIPOS_BLOQUE).map(([k, t]) => `<option value="${k}" ${b.tipo === k ? 'selected' : ''}>${t.nombre}</option>`).join('')}</select>
          <span class="pl-resumen" title="${esc(primera)}">${esc(primera.slice(0, 40))}${primera.length > 40 ? '…' : ''}</span>
          <span class="pl-n">${n} ${n === 1 ? 'pant.' : 'pant.'}</span></summary>
        <div class="pl-cuerpo">${lineas}</div></details>`;
    }).join('');
    $$('details', el).forEach(d => {
      const i = Number(d.dataset.i);
      d.ontoggle = () => { if (d.open) abiertos.add(i); else abiertos.delete(i); };
      $('summary', d).onclick = (e) => { if (e.target.closest('select')) { e.preventDefault(); return; } elegir(i); };
    });
    $$('[data-tipo]', el).forEach(s => {
      s.onclick = (e) => e.stopPropagation();
      s.onchange = () => { const i = Number(s.dataset.tipo); cambiarBloques(c.bloques.map((b, k) => k === i ? { ...b, tipo: s.value } : b)); };
    });
    $$('[data-corte]', el).forEach(btn => btn.onclick = () => {
      const [i, j] = btn.dataset.corte.split(':').map(Number);
      const lineas = String(c.bloques[i].texto).split('\n'), out = [];
      let k = 0;
      for (let p = 0; p < lineas.length; p++) {
        const l = lineas[p];
        if (esCorte(l)) { if (k !== j) out.push(l); continue; }   // se quita el corte que está justo antes de la línea j
        if (k === j && !(p > 0 && esCorte(lineas[p - 1]))) out.push(CORTE);
        out.push(l); k++;
      }
      abiertos.add(i);
      cambiarBloques(c.bloques.map((b, x) => x === i ? { ...b, texto: out.join('\n') } : b));
    });
  };
  const elegir = (i) => { elegido = i; $$('[data-bloques] details', cont).forEach(d => d.classList.toggle('elegido', Number(d.dataset.i) === i)); alElegirBloque?.(i); };
  $('[data-plegar]', cont).onclick = () => { abiertos.clear(); pintarBloques(); };
  $('[data-desplegar]', cont).onclick = () => { c.bloques.forEach((_, i) => abiertos.add(i)); pintarBloques(); };

  // ---------- Orden de canto ----------
  const pintarOrden = () => {
    const el = $('[data-orden]', cont);
    $('[data-usar-orden]', cont).checked = usarOrden();
    if (!usarOrden()) { el.innerHTML = '<p class="hint" style="margin:0;">Se canta en el orden de la letra. Úsalo para no escribir el coro dos veces.</p>'; return; }
    const et = etiquetas(c.bloques), codigos = et.map(e => e.codigo);
    c.orden_canto = ordenNormal(c.orden_canto);
    el.innerHTML = `<div class="cu-orden">${c.orden_canto.map((cod, k) => `<span class="chip activo cu-paso ${codigos.includes(cod) ? '' : 'malo'}" draggable="true" data-paso="${k}"
          title="${codigos.includes(cod) ? esc(et[codigos.indexOf(cod)].nombre) + ' · arrastra para mover' : 'Ese bloque ya no existe'}">${esc(cod)}<button type="button" data-quitar="${k}" aria-label="Quitar ${esc(cod)}">✕</button></span>`).join('')}</div>
      <div class="cu-chips" style="margin-top:6px;">${et.map(e => `<button type="button" class="chip" data-agregar="${esc(e.codigo)}" title="${esc(e.nombre)}">+ ${esc(e.codigo)}</button>`).join('')}</div>
      <button type="button" class="btn btn-sm btn-outline" data-sugerir style="margin-top:6px;">✨ Coro después de cada estrofa</button>`;
    $$('[data-quitar]', el).forEach(b => b.onclick = () => { c.orden_canto.splice(Number(b.dataset.quitar), 1); if (!c.orden_canto.length) c.orden_canto = null; pintarOrden(); alCambiar('orden'); });
    $$('[data-agregar]', el).forEach(b => b.onclick = () => { c.orden_canto.push(b.dataset.agregar); pintarOrden(); alCambiar('orden'); });
    $('[data-sugerir]', el).onclick = () => { c.orden_canto = ordenSugerido(c.bloques); pintarOrden(); alCambiar('orden'); };
    let desde = null;
    $$('[data-paso]', el).forEach(p => {
      p.ondragstart = (e) => { desde = Number(p.dataset.paso); e.dataTransfer.effectAllowed = 'move'; };
      p.ondragover = (e) => e.preventDefault();
      p.ondrop = (e) => {
        e.preventDefault();
        const a = Number(p.dataset.paso);
        if (desde == null || desde === a) return;
        const [x] = c.orden_canto.splice(desde, 1);
        c.orden_canto.splice(a, 0, x);
        desde = null; pintarOrden(); alCambiar('orden');
      };
    });
  };
  $('[data-usar-orden]', cont).onchange = (e) => {
    c.orden_canto = e.target.checked ? ordenSugerido(c.bloques) : null;
    if (e.target.checked && !c.orden_canto.length) { toast('Primero pega la letra', 'error'); c.orden_canto = null; }
    pintarOrden(); alCambiar('orden');
  };

  pintarBloques(); pintarOrden(); pintarAviso();
  return {
    // después de deshacer/rehacer o de cambios hechos desde afuera
    refrescar() {
      area.value = bloquesATexto(c.bloques);
      $$('[data-campo]', cont).forEach(inp => { if (document.activeElement !== inp) inp.value = c[inp.dataset.campo] || ''; });
      $('[data-compartir]', cont).checked = !!c.compartida;
      $('[data-lineas]', cont).value = String(c.opciones.lineas || 4);
      $('[data-rep]', cont).value = c.opciones.repeticiones === 'marcar' ? 'marcar' : 'expandir';
      pintarEtiquetas(); pintarBloques(); pintarOrden(); pintarAviso();
    },
    elegirBloque(i) { elegido = i; pintarBloques(); },
    ponerTitulo(t) { const i = $('[data-campo="titulo"]', cont); if (i && document.activeElement !== i) i.value = t; }
  };
}
