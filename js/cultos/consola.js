// ============================================================
// Cultos: consola del operador (#cultos/proyectar-<id>) y conexión con la pantalla de proyección
// - La pantalla (culto-pantalla.html?c=<id>) se abre en otra ventana, que se arrastra al proyector o TV.
// - Las dos ventanas están en el mismo equipo y se hablan por BroadcastChannel (sin pasar por Supabase):
//     consola → pantalla: { t: 'mostrar', hoja, inicio }   la hoja ya armada (null = negro); inicio: reloj
//     consola → pantalla: { t: 'fin' }   "Finalizar": la pantalla se pone en negro y se cierra
//     pantalla → consola: { t: 'hola' } al abrir, { t: 'adios' } al cerrar, { t: 'tecla', k } (clicker)
// - En otros equipos (Fase 3) se usan canales de Realtime con códigos secretos (js/cultos/remoto.js):
//   la pantalla remota recibe los mismos mensajes; el celular de control recibe { t: 'estado' } y manda
//   { t: 'cmd' }; los coristas reciben { t: 'vivo', id } (el elemento en pantalla) para "Seguir proyección".
// - A la izquierda los elementos, al centro las pantallas del elemento elegido (un clic la proyecta),
//   a la derecha "En pantalla" y "Siguiente". Teclado: ← → / espacio, B negro, L logo, C limpiar.
// ============================================================
import { $, $$, esc, toast, mensajeError, urlBase, confirmar, abrirModal, dibujarQR, copiar, debounce } from '../comun.js';
import { abrirCanal, urlControl, urlPantallaRemota, enlaceWhatsApp } from './remoto.js';
import { AMBIENTES, sonar, callar, volumen, sonando } from './sonido.js';
import { pintarHoja } from '../proyectos/lienzo.js';
import { prepararFuente } from './diapositivas.js';
import { TIPOS_ELEMENTO, hojasDeElemento, tituloDeElemento, plantillasDeCulto, hojaLogo, sinTexto, montarReloj } from './elementos.js';
import { datosCanciones, datosCultos } from './datos.js';

export const canalCulto = (id) => 'culto-' + id;
export const urlPantalla = (id) => `${urlBase()}culto-pantalla.html?c=${encodeURIComponent(id)}`;

// Abre (o trae al frente) la ventana de la pantalla. Debe llamarse dentro de un clic.
export function abrirPantalla(id) {
  const w = window.open(urlPantalla(id), 'culto-pantalla-' + id, 'popup=yes,width=1024,height=600');
  if (!w) toast('El navegador bloqueó la ventana de la pantalla: permite las ventanas emergentes de este sitio y toca “🖥 Abrir pantalla”.', 'error');
  else w.focus?.();
  return w;
}

export async function pintarConsola(cuerpo, id, { datos = datosCultos, canciones: datosCanc = datosCanciones } = {}) {
  cuerpo.innerHTML = '<div class="center" style="padding:40px;"><div class="spinner"></div></div>';
  let culto, canciones;
  try {
    const [c, lista] = await Promise.all([datos.obtener(id), datosCanc.listar()]);
    culto = c; canciones = new Map(lista.map(x => [x.id, x]));
  } catch (e) { cuerpo.innerHTML = `<div class="card empty"><span class="big">⚠️</span>${esc(mensajeError(e))}</div>`; return; }
  if (!culto) { cuerpo.innerHTML = '<div class="card empty"><span class="big">🔎</span>Este culto ya no existe.<br><a href="#cultos">← Volver a los cultos</a></div>'; return; }
  await Promise.all(plantillasDeCulto(culto, canciones).map(prepararFuente));
  if (!cuerpo.isConnected) return;

  const elementos = (culto.items || []).map(it => ({ it, titulo: tituloDeElemento(it, canciones), hojas: hojasDeElemento(it, culto, canciones) }))
    .filter(e => e.hojas.length);
  const logo = hojaLogo(culto);
  // pos: lo que está en pantalla; ver: el elemento que se mira en el centro
  // al abrir se ve el logo; con "Siguiente" (o un clic en una pantalla) empieza el culto
  const est = { i: 0, j: 0, modo: 'logo', inicio: null, ver: 0, conectada: false, enAire: false };

  cuerpo.innerHTML = `<div class="cu-consola">
    <div class="row cu-con-cab">
      <a class="btn btn-sm btn-ghost" href="#cultos/culto-${esc(culto.id)}">← Editar</a>
      <h2 class="grow" title="${esc(culto.nombre)}">${esc(culto.nombre)}</h2>
      <span class="badge gray" data-conexion>🖥 Pantalla sin abrir</span>
      <span class="badge green" data-remota hidden></span>
      <button class="btn btn-sm" data-remoto>📱 Control remoto</button>
      <button class="btn btn-sm btn-primary" data-abrir>🖥 Abrir pantalla</button></div>
    <div class="cu-con">
      <aside class="cu-con-lista" data-lista aria-label="Elementos del culto"></aside>
      <section class="cu-con-centro"><div class="row between" style="gap:8px; margin-bottom:8px;"><h3 data-titulo style="margin:0;"></h3><span class="small muted" data-cuantas></span></div>
        <div class="cu-con-pant" data-pant></div></section>
      <aside class="cu-con-vivo">
        <div class="cu-con-rot"><span class="cu-punto"></span> En pantalla <span class="small muted" data-que></span></div>
        <div class="cu-con-grande" data-vivo></div>
        <div class="cu-con-rot cu-rot-sig" style="margin-top:12px;">Siguiente <span class="small muted" data-que-sig></span></div>
        <div class="cu-con-sig" data-sig></div></aside>
    </div>
    <div class="cu-con-botones">
      <button class="btn" data-ant>◀ Anterior</button>
      <button class="btn btn-primary" data-sigte>Siguiente ▶</button>
      <button class="btn" data-modo="negro">⬛ Negro</button>
      <button class="btn" data-modo="logo">🖼 Logo</button>
      <button class="btn" data-modo="limpio">🧹 Limpiar texto</button>
      <button class="btn" data-sonido>🔇 Sonido</button>
      <button class="btn btn-red" data-fin>⏹ Finalizar</button></div>
    <div class="cu-sonido" data-panel-sonido hidden>
      <label class="small"><b>Ambiente</b> <select class="input" data-ambiente>${Object.entries(AMBIENTES).map(([k, a]) => `<option value="${k}">${esc(a.nombre)}</option>`).join('')}</select></label>
      <label class="small grow"><b>Volumen</b> <input type="range" min="0" max="100" value="50" data-vol></label>
      <span class="small muted">Suena en este equipo. Empieza siempre apagado.</span></div>
    <p class="hint cu-solo-ancho" style="text-align:center;">Teclado: ← → o espacio para avanzar · B negro · L logo · C limpiar texto. La pantalla se pone en pantalla completa con F11 o con su botón.</p>
  </div>`;

  // ---------- conexión con la pantalla ----------
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(canalCulto(culto.id)) : null;
  if (!bc) toast('Este navegador no puede conectar la consola con la pantalla. Usa Chrome, Edge o Firefox actualizados.', 'error');
  const hojaActual = () => {
    if (est.modo === 'negro') return null;
    if (est.modo === 'logo' || !elementos.length) return logo;
    const h = elementos[est.i]?.hojas[est.j];
    return est.modo === 'limpio' ? sinTexto(h) : h;
  };
  // ---------- equipos remotos (Realtime) ----------
  const rem = { cc: null, cp: null, cv: null, vivo: undefined, pantalla: false, control: false };
  const etiquetaSig = () => { const s = siguiente(est.i, est.j); return s ? `${elementos[s.i].titulo} · ${elementos[s.i].hojas[s.j].etiqueta || ''}` : ''; };
  const enviarEstado = () => rem.cc?.enviar({ t: 'estado', nombre: culto.nombre, i: est.i, j: est.j, modo: est.modo, sig: est.modo === 'normal' ? etiquetaSig() : '',
    els: elementos.map(e => ({ t: e.titulo, ico: TIPOS_ELEMENTO[e.it.tipo]?.ico || '', p: e.hojas.map(h => h.etiqueta || '') })) });
  const enviarVivo = (forzar = false) => {
    const id = est.modo !== 'logo' && est.enAire ? elementos[est.i]?.it.id || null : null;
    if (!forzar && id === rem.vivo) return;
    rem.vivo = id;
    rem.cv?.enviar({ t: 'vivo', id });
  };
  const mensajeHoja = () => ({ t: 'mostrar', hoja: hojaActual(), inicio: est.inicio, ahora: Date.now() });
  function pintarRemota() {
    const b = $('[data-remota]', cuerpo);
    if (!b) return;
    const partes = [rem.pantalla ? '🖥 Pantalla remota' : '', rem.control ? '📱 Control' : ''].filter(Boolean);
    b.hidden = !partes.length;
    b.textContent = partes.join(' · ') + (partes.length > 1 ? ' conectados' : ' conectado');
  }
  function conectarRemotos() {
    ['cc', 'cp', 'cv'].forEach(k => { rem[k]?.cerrar(); rem[k] = null; });
    if (culto.codigo_control) rem.cc = abrirCanal('cc-' + culto.codigo_control, {
      alMensaje: (m) => {
        rem.control = true; pintarRemota();
        if (m.t === 'hola') enviarEstado();
        else if (m.t === 'cmd') comando(m);
      }
    });
    if (culto.codigo_pantalla) rem.cp = abrirCanal('cp-' + culto.codigo_pantalla, {
      alMensaje: (m) => {
        if (m.t === 'hola') { rem.pantalla = true; rem.cp.enviar(mensajeHoja()); }
        else if (m.t === 'adios') rem.pantalla = false;
        else if (m.t === 'tecla') tecla({ key: m.k, preventDefault() {} });
        pintarRemota();
      }
    });
    if (culto.codigo_coristas && culto.publicado_en) rem.cv = abrirCanal('cv-' + culto.codigo_coristas, {
      alMensaje: (m) => { if (m.t === 'hola') enviarVivo(true); }
    });
  }
  function comando(m) {
    if (m.a === 'sig') avanzar(1);
    else if (m.a === 'ant') avanzar(-1);
    else if (['negro', 'logo', 'limpio'].includes(m.a)) modo(m.a);
    else if (m.a === 'ir' && elementos[m.i]?.hojas[m.j]) ir(m.i, m.j);
  }
  // respaldo por sondeo (si en otro equipo Realtime no conecta): se guarda lo que está en pantalla,
  // solo si hay pantalla remota o coristas
  const guardarVivo = debounce((msg) => {
    if (!culto.codigo_pantalla && !(culto.codigo_coristas && culto.publicado_en)) return;
    datos.vivoPoner?.(culto.id, msg).catch(() => { /* sin conexión: Realtime sigue funcionando */ });
  }, 600);
  const enviar = () => {
    const msg = mensajeHoja();
    try { bc?.postMessage(msg); } catch (e) { console.warn('No se pudo enviar a la pantalla', e); }
    rem.cp?.enviar(msg);
    enviarEstado();
    enviarVivo();
    guardarVivo({ ...msg, id: est.modo !== 'logo' && est.enAire ? elementos[est.i]?.it.id || null : null });
  };
  const pintarConexion = () => {
    const b = $('[data-conexion]', cuerpo);
    if (!b) return;
    b.className = 'badge ' + (est.conectada ? 'green' : 'gray');
    b.textContent = est.conectada ? '🖥 Pantalla conectada' : '🖥 Pantalla sin abrir';
  };
  if (bc) bc.onmessage = (e) => {
    const m = e.data || {};
    if (m.t === 'hola') { est.conectada = true; pintarConexion(); enviar(); }
    else if (m.t === 'adios') { est.conectada = false; pintarConexion(); }
    else if (m.t === 'tecla') tecla({ key: m.k, preventDefault() {} });
  };
  bc?.postMessage({ t: 'quien' });   // si la pantalla ya estaba abierta, responde "hola"

  // ---------- dibujo ----------
  function pintarLista() {
    $('[data-lista]', cuerpo).innerHTML = elementos.length ? elementos.map((e, k) => {
      const t = TIPOS_ELEMENTO[e.it.tipo];
      return `<button class="cu-con-el ${k === est.ver ? 'sel' : ''} ${k === est.i && est.modo !== 'logo' ? 'aire' : ''}" data-el="${k}">
        <span class="cu-con-ico">${t?.ico || '❔'}</span><span class="grow"><b>${esc(e.titulo)}</b><small>${esc(t?.nombre || '')} · ${e.hojas.length}</small></span></button>`;
    }).join('') : '<p class="hint" style="padding:10px;">Este culto no tiene elementos. <a href="#cultos/culto-' + esc(culto.id) + '">Agrégalos aquí</a>.</p>';
    $$('[data-el]', cuerpo).forEach(b => b.onclick = () => { est.ver = Number(b.dataset.el); pintarTodo(); });
  }
  function pintarCentro() {
    const e = elementos[est.ver];
    $('[data-titulo]', cuerpo).textContent = e ? `${TIPOS_ELEMENTO[e.it.tipo]?.ico || ''} ${e.titulo}` : '';
    $('[data-cuantas]', cuerpo).textContent = e ? `${e.hojas.length} ${e.hojas.length === 1 ? 'pantalla' : 'pantallas'}` : '';
    const cont = $('[data-pant]', cuerpo);
    if (!e) { cont.innerHTML = ''; return; }
    cont.innerHTML = e.hojas.map((h, j) => `<button class="cu-con-mini ${est.ver === est.i && j === est.j && est.modo !== 'logo' ? 'aire' : ''}" data-j="${j}">
      <div data-m></div><span>${j + 1} · ${esc(h.etiqueta || '')}</span></button>`).join('');
    e.hojas.forEach((h, j) => {
      const b = $(`[data-j="${j}"]`, cont);
      const l = pintarHoja($('[data-m]', b), h, { modo: 'miniatura' });
      montarReloj(l, h);
      b.onclick = () => ir(est.ver, j);
    });
  }
  function pintarVivo() {
    const h = hojaActual();
    const v = $('[data-vivo]', cuerpo);
    if (h) { const l = pintarHoja(v, h, { modo: 'miniatura' }); montarReloj(l, h, est.inicio); }
    else v.innerHTML = '<div class="cu-negro">⬛ Negro</div>';
    const e = elementos[est.i];
    $('[data-que]', cuerpo).textContent = est.modo === 'negro' ? '· negro' : est.modo === 'logo' || !e ? '· logo' : `· ${e.titulo} · ${e.hojas[est.j]?.etiqueta || ''}${est.modo === 'limpio' ? ' (sin texto)' : ''}`;
    const s = siguiente(est.i, est.j);
    const sc = $('[data-sig]', cuerpo);
    if (s) { pintarHoja(sc, elementos[s.i].hojas[s.j], { modo: 'miniatura' }); $('[data-que-sig]', cuerpo).textContent = `· ${elementos[s.i].titulo} · ${elementos[s.i].hojas[s.j].etiqueta || ''}`; }
    else { sc.innerHTML = '<div class="cu-negro">Fin del culto</div>'; $('[data-que-sig]', cuerpo).textContent = ''; }
    $$('[data-modo]', cuerpo).forEach(b => b.classList.toggle('activo', b.dataset.modo === est.modo));
  }
  const pintarTodo = () => { if (!cuerpo.isConnected) return; pintarLista(); pintarCentro(); pintarVivo(); };

  // ---------- navegación ----------
  function siguiente(i, j) {
    if (!elementos.length) return null;
    if (j + 1 < elementos[i].hojas.length) return { i, j: j + 1 };
    return i + 1 < elementos.length ? { i: i + 1, j: 0 } : null;
  }
  function anterior(i, j) {
    if (!elementos.length) return null;
    if (j > 0) return { i, j: j - 1 };
    return i > 0 ? { i: i - 1, j: elementos[i - 1].hojas.length - 1 } : null;
  }
  function ir(i, j) {
    // el reloj de una cuenta regresiva empieza al ponerla; si se vuelve a ella desde negro, logo o limpiar, sigue igual
    const h = elementos[i]?.hojas[j];
    if (i !== est.i || j !== est.j || est.modo === 'normal' || !est.enAire) est.inicio = h?.regresiva ? Date.now() : null;
    est.i = i; est.j = j; est.ver = i; est.modo = 'normal'; est.enAire = true;
    enviar(); pintarTodo();
  }
  function avanzar(d) {
    if (est.modo !== 'normal') return ir(est.i, est.j);   // desde negro / logo / limpio, vuelve a la pantalla actual
    const p = d > 0 ? siguiente(est.i, est.j) : anterior(est.i, est.j);
    if (p) ir(p.i, p.j);
  }
  function modo(m) {
    est.modo = est.modo === m ? 'normal' : m;
    if (!elementos.length && est.modo === 'normal') est.modo = 'logo';
    enviar(); pintarTodo();
  }
  $('[data-ant]', cuerpo).onclick = () => avanzar(-1);
  $('[data-sigte]', cuerpo).onclick = () => avanzar(1);
  $$('[data-modo]', cuerpo).forEach(b => b.onclick = () => modo(b.dataset.modo));
  $('[data-abrir]', cuerpo).onclick = () => abrirPantalla(culto.id);
  $('[data-fin]', cuerpo).onclick = async () => {
    if (!await confirmar('La pantalla se pondrá en negro y se cerrará.', { titulo: '¿Finalizar la proyección?', boton: '⏹ Finalizar', peligro: false })) return;
    try { bc?.postMessage({ t: 'fin' }); } catch { /* la pantalla ya estaba cerrada */ }
    rem.cp?.enviar({ t: 'fin' }); rem.cc?.enviar({ t: 'fin' }); rem.cv?.enviar({ t: 'vivo', id: null });
    guardarVivo({ t: 'fin', id: null });
    callar();
    toast('Proyección finalizada');
    location.hash = 'cultos';
  };

  function tecla(e) {
    if (!cuerpo.isConnected) return limpiar();
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-fondo')) return;
    const k = String(e.key || '');
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); avanzar(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); avanzar(-1); }
    else if (/^[b.]$/i.test(k)) modo('negro');
    else if (/^l$/i.test(k)) modo('logo');
    else if (/^c$/i.test(k)) modo('limpio');
  }
  function limpiar() {
    document.removeEventListener('keydown', tecla);
    removeEventListener('hashchange', limpiar);
    if (bc) { bc.onmessage = null; bc.close(); }
    // los canales se cierran un momento después, para que alcancen a salir los últimos mensajes ("fin")
    setTimeout(() => ['cc', 'cp', 'cv'].forEach(k => rem[k]?.cerrar()), 800);
    callar();
  }

  // ---------- 📱 Control remoto y pantalla en otro equipo ----------
  $('[data-remoto]', cuerpo).onclick = async () => {
    let acc;
    try { acc = await datos.accesos(culto.id, 'ver'); }
    catch (e) { return toast(mensajeError(e), 'error'); }
    const nuevos = acc.control !== culto.codigo_control || acc.pantalla !== culto.codigo_pantalla;
    culto.codigo_control = acc.control; culto.codigo_pantalla = acc.pantalla;
    if (nuevos) conectarRemotos();
    const m = abrirModal(`<h3>📱 Control remoto y pantalla en otro equipo</h3>
      <div class="cu-remoto" data-cajas></div>
      <p class="hint">Los enlaces son secretos y sirven mientras no los cambies: compártelos solo con tu equipo de alabanza. Necesitan internet.</p>
      <div class="modal-pie" style="flex-wrap:wrap;"><button class="btn btn-outline" data-regenerar>🔄 Cambiar los enlaces</button>
        <button class="btn btn-red" data-cerrar-acc>🔒 Cerrar accesos remotos</button><button class="btn btn-primary" data-ok>Listo</button></div>`, { ancho: true });
    const pintarCajas = () => {
      const cajas = [
        { k: 'control', t: '📱 Control desde el celular', d: 'Anterior, siguiente, negro, logo y la lista de elementos.', url: urlControl(culto.codigo_control), wa: 'Control del culto' },
        { k: 'pantalla', t: '🖥 Pantalla en otro equipo', d: 'Ábrelo en el TV o la PC de cabina y ponlo en pantalla completa.', url: urlPantallaRemota(culto.codigo_pantalla), wa: 'Pantalla del culto' }
      ];
      $('[data-cajas]', m.el).innerHTML = cajas.map(c => `<div class="cu-remoto-caja"><b>${c.t}</b><span class="small muted">${c.d}</span><div data-qr="${c.k}" class="cu-qr"></div>
        <div class="row" style="gap:6px; justify-content:center;"><button class="btn btn-sm" data-copiar="${c.k}">📋 Copiar</button><button class="btn btn-sm" data-wa="${c.k}">🟢 WhatsApp</button></div></div>`).join('');
      for (const c of cajas) {
        dibujarQR($(`[data-qr="${c.k}"]`, m.el), c.url, 170);
        $(`[data-copiar="${c.k}"]`, m.el).onclick = async () => { await copiar(c.url); toast('Enlace copiado'); };
        $(`[data-wa="${c.k}"]`, m.el).onclick = () => window.open(enlaceWhatsApp(`${c.wa} “${culto.nombre}”: ${c.url}`), '_blank');
      }
    };
    const cambiar = async (accion) => {
      rem.cp?.enviar({ t: 'fin' }); rem.cc?.enviar({ t: 'fin' });
      try {
        const r = await datos.accesos(culto.id, accion);
        culto.codigo_control = r.control; culto.codigo_pantalla = r.pantalla;
        rem.pantalla = rem.control = false; pintarRemota();
        setTimeout(conectarRemotos, 500);
        if (accion === 'cerrar') { m.cerrar(); toast('Accesos remotos cerrados: los enlaces anteriores ya no funcionan'); }
        else { pintarCajas(); toast('Enlaces nuevos: los anteriores ya no funcionan'); }
      } catch (e) { toast(mensajeError(e), 'error'); }
    };
    $('[data-regenerar]', m.el).onclick = () => cambiar('regenerar');
    $('[data-cerrar-acc]', m.el).onclick = () => cambiar('cerrar');
    $('[data-ok]', m.el).onclick = () => m.cerrar();
    pintarCajas();
  };

  // ---------- 🔊 Sonido (pad suave, en este equipo) ----------
  const panelSonido = $('[data-panel-sonido]', cuerpo);
  $('[data-sonido]', cuerpo).onclick = async (e) => {
    const b = e.currentTarget;
    try {
      if (sonando()) callar(); else await sonar($('[data-ambiente]', cuerpo).value);
    } catch (err) { toast(mensajeError(err), 'error'); }
    b.textContent = sonando() ? '🔊 Sonido' : '🔇 Sonido';
    b.classList.toggle('activo', sonando());
    panelSonido.hidden = !sonando();
  };
  $('[data-ambiente]', cuerpo).onchange = (e) => { if (sonando()) sonar(e.target.value); };
  $('[data-vol]', cuerpo).oninput = (e) => volumen(e.target.value / 100);
  document.addEventListener('keydown', tecla);
  addEventListener('hashchange', limpiar, { once: true });

  conectarRemotos();
  pintarTodo();
  enviar();
}
