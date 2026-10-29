// ============================================================
// Cultos: "✓ Revisar ortografía" con la API gratuita de LanguageTool (api.languagetool.org, español)
// Muestra las sugerencias subrayadas para aceptarlas una por una o todas. Nada cambia en la letra
// hasta pulsar "Aplicar cambios". Si la API no responde, se usa el corrector del navegador.
// ============================================================
import { $, $$, esc, toast, abrirModal } from '../comun.js';

const API = 'https://api.languagetool.org/v2/check';
const MAX_TEXTO = 18000;   // la API gratuita acepta ~20 KB por consulta

async function consultar(texto) {
  const cuerpo = new URLSearchParams({ text: texto, language: 'es', disabledRules: 'WHITESPACE_RULE,UPPERCASE_SENTENCE_START,PUNCTUATION_PARAGRAPH_END' });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(API, { method: 'POST', body: cuerpo, signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('LanguageTool respondió ' + r.status);
    const d = await r.json();
    return (d.matches || []).filter(m => m.replacements?.length && m.length > 0)
      .map((m, i) => ({ id: i, offset: m.offset, length: m.length, mensaje: m.shortMessage || m.message || '', sugerencias: m.replacements.slice(0, 4).map(x => x.value) }));
  } finally { clearTimeout(t); }
}

// Corrector del navegador: subraya en rojo dentro del cuadro de la letra (clic derecho para corregir)
function usarNavegador(area) {
  area.setAttribute('lang', 'es');
  area.spellcheck = false;
  requestAnimationFrame(() => { area.spellcheck = true; area.focus(); area.setSelectionRange(0, 0); });
  toast('El corrector en línea no respondió. Usa el del navegador: las palabras con error se subrayan en rojo (clic derecho para corregir).', 'error');
}

// area: el <textarea> de la letra; alCambiar(): se llama si se aplicaron cambios
export async function revisarOrtografia(area, alCambiar) {
  let texto = area.value;
  if (!texto.trim()) return toast('Primero pega la letra', 'error');
  if (texto.length > MAX_TEXTO) return toast('La letra es demasiado larga para revisarla de una vez', 'error');
  const m = abrirModal(`<h3>✓ Revisar ortografía</h3><div data-c><div class="center" style="padding:24px;"><div class="spinner"></div><p class="muted">Revisando con LanguageTool…</p></div></div>`, { ancho: true });
  let matches;
  try { matches = await consultar(texto); }
  catch { m.cerrar(); usarNavegador(area); return; }
  if (!m.el.isConnected) return;
  const c = $('[data-c]', m.el);
  if (!matches.length) {
    c.innerHTML = '<div class="empty"><span class="big">✨</span>No se encontraron errores.</div><div class="modal-pie"><button class="btn btn-primary" data-ok>Cerrar</button></div>';
    $('[data-ok]', c).onclick = () => m.cerrar();
    return;
  }
  let cambios = 0;
  const pendientes = () => matches.filter(x => !x.hecho);

  // Reemplaza un tramo y corre los que vienen después
  const aplicar = (x, valor) => {
    // las sugerencias que se cruzan con este tramo ya no sirven
    matches.forEach(o => { if (o !== x && !o.hecho && o.offset < x.offset + x.length && o.offset + o.length > x.offset) o.hecho = true; });
    texto = texto.slice(0, x.offset) + valor + texto.slice(x.offset + x.length);
    const d = valor.length - x.length;
    matches.forEach(o => { if (o !== x && !o.hecho && o.offset > x.offset) o.offset += d; });
    x.hecho = true; cambios++;
  };

  const pintar = () => {
    const pend = pendientes();
    let html = '', i = 0;
    for (const x of [...pend].sort((a, b) => a.offset - b.offset)) {
      if (x.offset < i) continue;
      html += esc(texto.slice(i, x.offset)) + `<mark class="orto-marca" data-ir="${x.id}" title="${esc(x.mensaje)}">${esc(texto.slice(x.offset, x.offset + x.length))}</mark>`;
      i = x.offset + x.length;
    }
    html += esc(texto.slice(i));
    c.innerHTML = `<p class="hint" style="margin-bottom:8px;">${pend.length ? `${pend.length} ${pend.length === 1 ? 'sugerencia' : 'sugerencias'}. Elige la corrección o ignórala.` : 'Ya revisaste todas las sugerencias.'}</p>
      <div class="orto">
        <div class="orto-texto">${html}</div>
        <div class="orto-lista">${pend.map(x => `<div class="orto-item" data-item="${x.id}">
          <div><b class="orto-mala">${esc(texto.slice(x.offset, x.offset + x.length))}</b> <span class="small muted">${esc(x.mensaje)}</span></div>
          <div class="row" style="gap:6px; margin-top:6px;">${x.sugerencias.map((s, k) => `<button class="btn btn-sm btn-green" data-acepta="${x.id}" data-k="${k}">${esc(s) || '(quitar)'}</button>`).join('')}
            <button class="btn btn-sm btn-ghost" data-ignora="${x.id}">Ignorar</button></div></div>`).join('') || '<div class="empty"><span class="big">✅</span>¡Listo!</div>'}</div>
      </div>
      <div class="modal-pie">
        ${pend.length ? '<button class="btn btn-outline" data-todas>Aceptar todas (1.ª sugerencia)</button>' : ''}
        <button class="btn btn-outline" data-cancelar>Cancelar</button>
        <button class="btn btn-primary" data-aplicar ${cambios ? '' : 'disabled'}>Aplicar ${cambios || ''} ${cambios === 1 ? 'cambio' : 'cambios'}</button></div>`;
    const buscar = (id) => matches.find(x => x.id === Number(id));
    $$('[data-acepta]', c).forEach(b => b.onclick = () => { const x = buscar(b.dataset.acepta); aplicar(x, x.sugerencias[Number(b.dataset.k)]); pintar(); });
    $$('[data-ignora]', c).forEach(b => b.onclick = () => { buscar(b.dataset.ignora).hecho = true; pintar(); });
    $$('[data-ir]', c).forEach(mk => mk.onclick = () => {
      const it = $(`[data-item="${mk.dataset.ir}"]`, c);
      it?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      it?.classList.add('foco'); setTimeout(() => it?.classList.remove('foco'), 900);
    });
    const todas = $('[data-todas]', c);
    if (todas) todas.onclick = () => {
      // de atrás hacia adelante para no mover los tramos que faltan
      [...pendientes()].sort((a, b) => b.offset - a.offset).forEach(x => aplicar(x, x.sugerencias[0]));
      pintar();
    };
    $('[data-cancelar]', c).onclick = () => m.cerrar();
    $('[data-aplicar]', c).onclick = () => {
      area.value = texto;
      m.cerrar();
      toast(`${cambios} ${cambios === 1 ? 'corrección aplicada' : 'correcciones aplicadas'}`);
      alCambiar?.();
    };
  };
  pintar();
}
