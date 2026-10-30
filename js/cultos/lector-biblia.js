// ============================================================
// Cultos · pestaña 📖 Biblia (#cultos/biblia): un lector juvenil
// - Portada: buscador ("Jn 3:16" o una palabra), versículo para hoy y los 66 libros en mosaicos de
//   colores por grupo (Pentateuco, Evangelios, Cartas…). Libro → capítulos en botones → lectura.
// - Lectura: cada versículo en su fila con el número como botón; palabras clave (Dios, Jesús, amor…)
//   como cápsulas suaves; tamaño de letra, letra con o sin serifa y tema claro / papel / oscuro.
// - Tocar versículos los elige: colorearlos, volver palabras "botón" (cápsulas de color), copiar,
//   🖥 proyectarlos con la plantilla que se elija (como una canción; las palabras botón se mueven)
//   o agregarlos a un culto. También se proyecta el capítulo completo.
// - Versiones: las de js/cultos/biblia.js (RV1909 incluida, YouVersion con la clave guardada, importadas).
// Lo que se marca (colores y palabras botón) queda en este navegador.
// ============================================================
import { $, $$, esc, toast, mensajeError, abrirModal, copiar } from '../comun.js';
import { LIBROS, GRUPOS, leerReferencia, citaDe, versiones, VERSION_DEFECTO, versosDelCapitulo, versoDe, buscarPalabra, textoDe } from './biblia.js';
import { COLORES_BOTON, MOVIMIENTOS_BOTON } from './resaltar.js';
import { nuevoIdElemento, hojasDeElemento } from './elementos.js';
import { pintarHoja } from '../proyectos/lienzo.js';
import { prepararFuente, misPlantillas, plantillaDe } from './diapositivas.js';
import { PLANTILLAS } from './plantillas.js';
import { proyectarSuelto } from './consola.js';
import { datosCultos } from './datos.js';

const FUENTES = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Bricolage+Grotesque:wght@500;700;800&display=swap';
const COLORES_MARCA = { amarillo: '#FDE68A', verde: '#BBF7D0', celeste: '#BAE6FD', rosa: '#FBCFE8', lila: '#DDD6FE' };
const CLAVES = new Set(['dios', 'jesus', 'jesucristo', 'cristo', 'senor', 'jehova', 'espiritu', 'amor', 'fe', 'gracia', 'vida', 'paz', 'gozo',
  'esperanza', 'salvacion', 'salvo', 'cielo', 'cielos', 'reino', 'verdad', 'luz', 'padre', 'hijo', 'santo', 'misericordia', 'eterna', 'gloria']);
// Versículos para hoy (se elige uno por día)
const DEL_DIA = ['Jn 3:16', 'Sal 23:1', 'Fil 4:13', 'Jer 29:11', 'Is 41:10', 'Ro 8:28', 'Pr 3:5-6', 'Mt 11:28', 'Jos 1:9', 'Sal 46:1', '2 Ti 1:7',
  'Lm 3:22-23', 'Mt 6:33', 'Ro 12:2', '1 Co 13:4', 'Gá 5:22-23', 'Sal 119:105', 'Is 40:31', 'Jn 14:6', '1 Jn 4:8', 'Sal 37:5', 'He 11:1',
  'Ef 2:8', 'Mt 5:14', 'Sal 139:14', '1 P 5:7', 'Stg 1:5', 'Col 3:23', 'Sof 3:17', 'Jn 15:5', 'Ap 21:4'];

const sinTilde = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ]/g, '');
const leer = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const poner = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };

export async function pintarLectorBiblia(cont) {
  if (!document.querySelector('link[data-fuentes-biblia]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FUENTES; l.dataset.fuentesBiblia = ''; document.head.appendChild(l);
  }
  const pref = { version: VERSION_DEFECTO, libro: null, cap: null, tam: 19, tema: 'claro', letra: 'serif', claves: true, ...leer('biblia.lector', {}) };
  const guardarPref = () => poner('biblia.lector', pref);
  const marcas = leer('biblia.marcas', {});   // { versión: { "libro.cap.verso": { c: color, b: { palabra: color } } } }
  const guardarMarcas = () => poner('biblia.marcas', marcas);
  const vs = await versiones();
  if (!vs.some(v => v.id === pref.version)) pref.version = VERSION_DEFECTO;
  const corto = () => vs.find(v => v.id === pref.version)?.corto || '';
  const est = { vista: 'libros', testamento: 'todos', sel: new Set(), modoBoton: false, colorBoton: COLORES_BOTON[0], versos: [], token: 0, buscar: null, foco: null };

  cont.innerHTML = `<div class="bb" data-tema="${esc(pref.tema)}" data-letra="${esc(pref.letra)}">
    <div class="bb-barra">
      <form class="bb-buscar" data-form><span aria-hidden="true">🔎</span><input data-q placeholder="Busca “Jn 3:16”, “Salmo 23” o una palabra" aria-label="Buscar en la Biblia"></form>
      <select class="bb-sel" data-version aria-label="Versión">${vs.map(v => `<option value="${esc(v.id)}">${esc(v.corto || v.nombre)}</option>`).join('')}</select>
      <div class="bb-ajustes">
        <button data-tam="-1" title="Letra más chica">A−</button><button data-tam="1" title="Letra más grande">A+</button>
        <button data-letra title="Cambiar el tipo de letra">Aa</button><button data-tema title="Tema claro, papel u oscuro">🌗</button>
        <button data-claves class="${pref.claves ? 'on' : ''}" title="Resaltar palabras clave">✨</button></div>
    </div>
    <nav class="bb-migas" data-migas></nav>
    <div data-vista></div>
    <div class="bb-accion" data-accion hidden></div>
  </div>`;
  const raiz = $('.bb', cont);
  const vista = $('[data-vista]', raiz);
  $('[data-version]', raiz).value = pref.version;

  // ---------- barra ----------
  $('[data-version]', raiz).onchange = (e) => { pref.version = e.target.value; guardarPref(); if (est.vista === 'lectura') abrirCapitulo(pref.libro, pref.cap); else pintar(); };
  $$('[data-tam]', raiz).forEach(b => b.onclick = () => { pref.tam = Math.max(14, Math.min(34, pref.tam + Number(b.dataset.tam) * 2)); guardarPref(); raiz.style.setProperty('--bb-tam', pref.tam + 'px'); });
  $('[data-letra]', raiz).onclick = () => { pref.letra = pref.letra === 'serif' ? 'sans' : 'serif'; raiz.dataset.letra = pref.letra; guardarPref(); };
  $('[data-tema]', raiz).onclick = () => { pref.tema = { claro: 'papel', papel: 'oscuro', oscuro: 'claro' }[pref.tema] || 'claro'; raiz.dataset.tema = pref.tema; guardarPref(); };
  $('[data-claves]', raiz).onclick = (e) => { pref.claves = !pref.claves; e.currentTarget.classList.toggle('on', pref.claves); guardarPref(); if (est.vista === 'lectura') pintarVersos(); };
  raiz.style.setProperty('--bb-tam', pref.tam + 'px');
  // al buscar, el buscador suelta el foco: así las flechas del teclado cambian de capítulo
  $('[data-form]', raiz).onsubmit = (e) => { e.preventDefault(); $('[data-q]', raiz).blur(); buscar($('[data-q]', raiz).value.trim()); };

  async function buscar(q) {
    if (!q) return;
    const r = leerReferencia(q);
    if (r) { est.foco = r.versos; return abrirCapitulo(r.libro, r.cap); }
    if (q.length < 3) return toast('Escribe una cita (Juan 3:16) o al menos 3 letras', 'error');
    est.vista = 'busqueda'; est.buscar = { q, res: null, avance: 0 };
    pintar();
    try {
      est.buscar.res = await buscarPalabra(q, pref.version, { max: 150, alAvanzar: (p) => { est.buscar.avance = p; const a = $('[data-avance]', vista); if (a) a.style.width = Math.round(p * 100) + '%'; } });
    } catch (e) { est.buscar.error = mensajeError(e); }
    if (est.vista === 'busqueda') pintar();
  }

  // ---------- migas ----------
  function pintarMigas() {
    const m = $('[data-migas]', raiz);
    const l = LIBROS[pref.libro];
    const partes = [`<button data-ir="libros">📖 Biblia</button>`];
    if (est.vista !== 'libros' && est.vista !== 'busqueda' && l) partes.push(`<button data-ir="capitulos" style="--c:${l.color}">${esc(l.nombre)}</button>`);
    if (est.vista === 'lectura') partes.push(`<span>Capítulo ${pref.cap}</span>`);
    if (est.vista === 'busqueda') partes.push(`<span>“${esc(est.buscar?.q || '')}”</span>`);
    m.innerHTML = partes.join('<i>›</i>');
    $$('[data-ir]', m).forEach(b => b.onclick = () => { est.vista = b.dataset.ir; limpiarSel(); pintar(); });
  }

  function pintar() {
    pintarMigas();
    if (est.vista === 'libros') pintarLibros();
    else if (est.vista === 'capitulos') pintarCapitulos();
    else if (est.vista === 'busqueda') pintarBusqueda();
    else pintarLectura();
    pintarAccion();
  }

  // ---------- portada: versículo para hoy + libros ----------
  function pintarLibros() {
    const hoy = new Date(); const dia = Math.floor((hoy - new Date(hoy.getFullYear(), 0, 0)) / 864e5);
    const refHoy = leerReferencia(DEL_DIA[dia % DEL_DIA.length]);
    const seguir = pref.libro != null && pref.cap ? `<button class="bb-seguir" data-seguir><span>📍 Seguir leyendo</span><b>${esc(LIBROS[pref.libro].nombre)} ${pref.cap}</b></button>` : '';
    vista.innerHTML = `
      <div class="bb-portada">
        <div class="bb-hoy" data-hoy><span class="bb-hoy-rot">✨ Versículo para hoy</span><p data-hoy-txt>…</p><b data-hoy-cita></b><button data-hoy-leer>Leer el capítulo →</button></div>
        ${seguir}
      </div>
      <div class="bb-testamentos">${[['todos', 'Toda la Biblia'], ['at', 'Antiguo Testamento'], ['nt', 'Nuevo Testamento']].map(([k, t]) =>
        `<button data-test="${k}" class="${est.testamento === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${GRUPOS.filter(g => est.testamento === 'todos' || (est.testamento === 'nt') === (g[1] >= 39)).map(g => `
        <section class="bb-grupo" style="--c:${g[3]}"><h3>${esc(g[0])}</h3>
          <div class="bb-libros">${LIBROS.slice(g[1], g[2] + 1).map(l => `<button class="bb-libro" data-libro="${l.i}"><b>${esc(l.corto)}</b><span>${esc(l.nombre)}</span></button>`).join('')}</div></section>`).join('')}`;
    $$('[data-test]', vista).forEach(b => b.onclick = () => { est.testamento = b.dataset.test; pintarLibros(); });
    $$('[data-libro]', vista).forEach(b => b.onclick = () => {
      pref.libro = Number(b.dataset.libro); guardarPref();
      if (LIBROS[pref.libro].capitulos === 1) return abrirCapitulo(pref.libro, 1);
      est.vista = 'capitulos'; pintar();
    });
    $('[data-seguir]', vista)?.addEventListener('click', () => abrirCapitulo(pref.libro, pref.cap));
    $('[data-hoy-leer]', vista).onclick = () => { est.foco = refHoy.versos; abrirCapitulo(refHoy.libro, refHoy.cap); };
    textoDe(refHoy, pref.version).then(t => {
      const p = $('[data-hoy-txt]', vista); if (!p) return;
      p.textContent = t.versos.map(v => v.t).join(' ');
      $('[data-hoy-cita]', vista).textContent = `${t.cita} · ${corto()}`;
    }).catch(() => { const p = $('[data-hoy-txt]', vista); if (p) p.textContent = 'No se pudo cargar. Revisa la conexión.'; });
  }

  function pintarCapitulos() {
    const l = LIBROS[pref.libro];
    vista.innerHTML = `<div class="bb-cab-libro" style="--c:${l.color}"><span>${esc(l.grupo)}</span><h2>${esc(l.nombre)}</h2><small>${l.capitulos} ${l.capitulos === 1 ? 'capítulo' : 'capítulos'} · elige uno</small></div>
      <div class="bb-caps" style="--c:${l.color}">${Array.from({ length: l.capitulos }, (_, k) => `<button data-cap="${k + 1}" class="${pref.cap === k + 1 && pref.libro === l.i ? 'on' : ''}">${k + 1}</button>`).join('')}</div>`;
    $$('[data-cap]', vista).forEach(b => b.onclick = () => abrirCapitulo(pref.libro, Number(b.dataset.cap)));
  }

  function pintarBusqueda() {
    const b = est.buscar;
    if (!b.res && !b.error) {
      vista.innerHTML = `<div class="bb-cargando"><p>Buscando “${esc(b.q)}”… la primera vez se baja toda la Biblia (unos 4 MB).</p><div class="bb-progreso"><i data-avance style="width:${Math.round(b.avance * 100)}%"></i></div></div>`;
      return;
    }
    if (b.error) { vista.innerHTML = `<p class="bb-vacio">⚠️ ${esc(b.error)}</p>`; return; }
    const marcar = (t) => esc(t).replace(new RegExp(`(${b.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
    vista.innerHTML = `<p class="bb-total">${b.res.length >= 150 ? 'Más de 150' : b.res.length} ${b.res.length === 1 ? 'resultado' : 'resultados'}${String(pref.version).startsWith('yv-') ? ' (se busca en la RV1909; al abrir, se lee en ' + esc(corto()) + ')' : ''}</p>
      <div class="bb-resultados">${b.res.map((x, i) => `<button data-r="${i}" style="--c:${LIBROS[x.libro].color}"><b>${esc(citaDe({ libro: x.libro, cap: x.cap, versos: [x.verso] }))}</b><span>${marcar(x.t)}</span></button>`).join('')
        || `<p class="bb-vacio">No se encontró “${esc(b.q)}”.</p>`}</div>`;
    $$('[data-r]', vista).forEach(el => el.onclick = () => { const x = b.res[el.dataset.r]; est.foco = [x.verso]; abrirCapitulo(x.libro, x.cap); });
  }

  // ---------- lectura ----------
  async function abrirCapitulo(i, cap) {
    pref.libro = i; pref.cap = cap; guardarPref();
    est.vista = 'lectura'; limpiarSel();
    const token = ++est.token;
    const total = (await versosDelCapitulo(VERSION_DEFECTO, i, cap).catch(() => [])).length || 1;
    est.versos = Array.from({ length: total }, (_, k) => ({ n: k + 1, t: null }));
    if (est.foco?.length) est.foco.forEach(n => est.sel.add(n));
    pintar();
    // se traen de a 8 (con YouVersion es un pedido por versículo) y se van mostrando
    for (let k = 0; k < total; k += 8) {
      const tanda = est.versos.slice(k, k + 8);
      await Promise.all(tanda.map(async v => { try { v.t = await versoDe(pref.version, i, cap, v.n); } catch (e) { v.t = ''; v.error = mensajeError(e); } }));
      if (token !== est.token) return;
      tanda.forEach(v => pintarVerso(v));
      if (k === 0 && tanda[0]?.error) toast(tanda[0].error, 'error');
    }
    if (est.foco?.length) { $(`[data-v="${est.foco[0]}"]`, vista)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); est.foco = null; pintarAccion(); }
  }
  function pintarLectura() {
    const l = LIBROS[pref.libro];
    const ant = anteriorCap(), sig = siguienteCap();
    vista.innerHTML = `<article class="bb-lectura" style="--c:${l.color}">
      <header class="bb-cab-cap"><span>${esc(l.grupo)} · ${esc(corto())}</span><h2>${esc(l.nombre)}</h2><div class="bb-num-cap">${pref.cap}</div>
        <div><button class="bb-proy-cap" data-proy-cap>🖥 Proyectar el capítulo</button></div></header>
      <div class="bb-versos" data-versos>${est.versos.map(v => `<div class="bb-verso" data-v="${v.n}"></div>`).join('')}</div>
      <footer class="bb-pie-cap">
        ${ant ? `<button data-mover="-1">← ${esc(LIBROS[ant.libro].corto)} ${ant.cap}</button>` : '<span></span>'}
        <button data-capitulos>☰ Capítulos</button>
        ${sig ? `<button data-mover="1">${esc(LIBROS[sig.libro].corto)} ${sig.cap} →</button>` : '<span></span>'}</footer></article>`;
    est.versos.forEach(pintarVerso);
    $$('[data-mover]', vista).forEach(b => b.onclick = () => { const p = b.dataset.mover === '1' ? siguienteCap() : anteriorCap(); abrirCapitulo(p.libro, p.cap); scrollTo({ top: 0, behavior: 'smooth' }); });
    $('[data-capitulos]', vista).onclick = () => { est.vista = 'capitulos'; limpiarSel(); pintar(); };
    $('[data-proy-cap]', vista).onclick = () => {
      const todos = est.versos.filter(v => v.t);
      if (todos.length < est.versos.length) return toast('Espera a que termine de cargar el capítulo', 'error');
      proyectar(todos, `${LIBROS[pref.libro].nombre === 'Salmos' ? 'Salmo' : LIBROS[pref.libro].nombre} ${pref.cap}`);
    };
  }
  const pintarVersos = () => est.versos.forEach(pintarVerso);
  function pintarVerso(v) {
    const el = $(`[data-v="${v.n}"]`, vista);
    if (!el) return;
    const m = marcas[pref.version]?.[`${pref.libro}.${pref.cap}.${v.n}`] || {};
    el.className = 'bb-verso' + (est.sel.has(v.n) ? ' sel' : '') + (m.c ? ' marcado' : '');
    el.style.setProperty('--marca', COLORES_MARCA[m.c] || 'transparent');
    if (v.t == null) { el.innerHTML = `<button class="bb-n">${v.n}</button><span class="bb-esqueleto"></span>`; return; }
    if (!v.t) { el.innerHTML = `<button class="bb-n">${v.n}</button><span class="bb-t bb-falta">${esc(v.error || '—')}</span>`; return; }
    const palabras = v.t.split(' ').filter(Boolean);
    el.innerHTML = `<button class="bb-n" aria-label="Elegir el versículo ${v.n}">${v.n}</button><span class="bb-t">${palabras.map((w, p) => {
      const b = m.b?.[p];
      const clave = !b && pref.claves && CLAVES.has(sinTilde(w));
      return `<span class="bb-w${b ? ' bb-boton' : clave ? ' bb-clave' : ''}" data-p="${p}"${b ? ` style="--b:${esc(b)}"` : ''}>${esc(w)}</span>`;
    }).join(' ')}</span>`;
    el.onclick = (e) => {
      const w = e.target.closest('.bb-w');
      if (est.modoBoton && est.sel.has(v.n) && w) return alternarBoton(v, Number(w.dataset.p));
      if (est.sel.has(v.n)) est.sel.delete(v.n); else est.sel.add(v.n);
      pintarVerso(v); pintarAccion();
    };
  }
  function alternarBoton(v, p) {
    const k = `${pref.libro}.${pref.cap}.${v.n}`;
    const porVersion = marcas[pref.version] = marcas[pref.version] || {};
    const m = porVersion[k] = porVersion[k] || {};
    m.b = m.b || {};
    if (m.b[p] === est.colorBoton) delete m.b[p]; else m.b[p] = est.colorBoton;
    if (!Object.keys(m.b).length) delete m.b;
    if (!m.b && !m.c) delete porVersion[k];
    guardarMarcas(); pintarVerso(v);
  }
  function siguienteCap() {
    const l = LIBROS[pref.libro];
    if (pref.cap < l.capitulos) return { libro: pref.libro, cap: pref.cap + 1 };
    return pref.libro < 65 ? { libro: pref.libro + 1, cap: 1 } : null;
  }
  function anteriorCap() {
    if (pref.cap > 1) return { libro: pref.libro, cap: pref.cap - 1 };
    return pref.libro > 0 ? { libro: pref.libro - 1, cap: LIBROS[pref.libro - 1].capitulos } : null;
  }

  // ---------- versículos elegidos ----------
  function limpiarSel() { est.sel.clear(); est.modoBoton = false; }
  const elegidos = () => [...est.sel].sort((a, b) => a - b).map(n => est.versos[n - 1]).filter(v => v?.t);
  function pintarAccion() {
    const a = $('[data-accion]', raiz);
    const lista = est.vista === 'lectura' ? elegidos() : [];
    a.hidden = !lista.length;
    raiz.classList.toggle('con-accion', !!lista.length);
    if (!lista.length) { est.modoBoton = false; return; }
    const cita = citaDe({ libro: pref.libro, cap: pref.cap, versos: lista.map(v => v.n) });
    a.innerHTML = `<div class="bb-accion-cab"><b>${esc(cita)}</b><button data-x aria-label="Quitar la selección">✕</button></div>
      <div class="bb-accion-fila">
        <div class="bb-colores">${Object.entries(COLORES_MARCA).map(([k, c]) => `<button data-color="${k}" style="--c:${c}" title="Colorear"></button>`).join('')}<button data-color="" title="Quitar el color">⌫</button></div>
        <button class="bb-btn ${est.modoBoton ? 'on' : ''}" data-modo-boton>🔘 Palabras botón</button>
        <button class="bb-btn" data-copiar>📋 Copiar</button>
        <button class="bb-btn" data-culto>➕ Al culto</button>
        <button class="bb-btn bb-prim" data-proyectar>🖥 Proyectar</button></div>
      ${est.modoBoton ? `<div class="bb-accion-fila bb-pista"><span>Toca palabras de los versículos elegidos.</span><div class="bb-colores">${COLORES_BOTON.map(c => `<button data-cb="${c}" class="${c === est.colorBoton ? 'on' : ''}" style="--c:${c}"></button>`).join('')}</div></div>` : ''}`;
    $('[data-x]', a).onclick = () => { limpiarSel(); pintarVersos(); pintarAccion(); };
    $$('[data-color]', a).forEach(b => b.onclick = () => {
      const porVersion = marcas[pref.version] = marcas[pref.version] || {};
      for (const v of lista) {
        const k = `${pref.libro}.${pref.cap}.${v.n}`;
        const m = porVersion[k] = porVersion[k] || {};
        if (b.dataset.color) m.c = b.dataset.color; else delete m.c;
        if (!m.c && !m.b) delete porVersion[k];
      }
      guardarMarcas(); limpiarSel(); pintarVersos(); pintarAccion();
    });
    $('[data-modo-boton]', a).onclick = () => { est.modoBoton = !est.modoBoton; pintarAccion(); };
    $$('[data-cb]', a).forEach(b => b.onclick = () => { est.colorBoton = b.dataset.cb; pintarAccion(); });
    $('[data-copiar]', a).onclick = async () => {
      await copiar(`${lista.map(v => (lista.length > 1 ? v.n + ' ' : '') + v.t).join('\n')}\n— ${cita} (${corto()})`);
      toast('Versículos copiados');
    };
    $('[data-culto]', a).onclick = () => alCulto(lista, cita);
    $('[data-proyectar]', a).onclick = () => proyectar(lista, cita);
  }

  // El elemento "versículo" (como en un culto) con las palabras botón marcadas
  function itemDe(lista, cita, extra = {}) {
    const porVersion = marcas[pref.version] || {};
    const resaltados = [];
    lista.forEach((v, l) => {
      const bs = porVersion[`${pref.libro}.${pref.cap}.${v.n}`]?.b || {};
      const w = v.t.split(' ').filter(Boolean);
      for (const [p, color] of Object.entries(bs)) {
        resaltados.push({ id: nuevoIdElemento(), b: 0, l, p: Number(p) + 1, n: 1, texto: w[p] || '', estilo: { modo: 'boton', fondo: color, color: '#FFFFFF' } });
      }
    });
    return { id: nuevoIdElemento(), tipo: 'versiculo', plantilla: '', numeros: true, version: pref.version,
      ref: { libro: pref.libro, cap: pref.cap, versos: lista.map(v => v.n) }, cita: `${cita} · ${corto()}`,
      texto: lista.map(v => `${v.n} ${v.t}`).join('\n'), ...(resaltados.length ? { resaltados } : {}), ...extra };
  }

  // 🖥 Proyectar: elegir la plantilla (viendo el versículo en cada una), versículos por pantalla y movimiento
  async function proyectar(lista, cita) {
    const op = { plantilla: leer('biblia.plantilla', 'palabra'), porVerso: leer('biblia.porVerso', true), mov: leer('biblia.mov', 'flotar') };
    const todas = [...misPlantillas(), ...PLANTILLAS];
    if (!todas.some(p => p.id === op.plantilla)) op.plantilla = 'palabra';
    const item = () => itemDe(lista, cita, { porVerso: op.porVerso, mov: op.mov });
    const culto = () => ({ id: 'suelto', nombre: cita, plantilla_base: op.plantilla, items: [item()] });
    const m = abrirModal(`<h3>🖥 Proyectar ${esc(cita)}</h3>
      <div class="bb-proy">
        <div><div class="bb-proy-grande" data-grande></div><p class="hint" data-n style="margin:6px 0 0;"></p>
          <label class="check" style="margin-top:8px;"><input type="checkbox" data-por-verso ${op.porVerso ? 'checked' : ''}> Un versículo por pantalla</label>
          <label class="lbl">Movimiento de las palabras botón</label>
          <select class="input" data-mov>${Object.entries(MOVIMIENTOS_BOTON).map(([k, t]) => `<option value="${k}" ${k === op.mov ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div><b class="small">Plantilla</b><div class="bb-proy-pls" data-pls></div></div>
      </div>
      <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary" data-si>▶ Proyectar</button></div>`, { ancho: true });
    const grande = async () => {
      await prepararFuente(op.plantilla);
      if (!m.el.isConnected) return;
      const hojas = hojasDeElemento(item(), culto());
      if (hojas[0]) pintarHoja($('[data-grande]', m.el), hojas[0], { modo: 'ver' });
      $('[data-n]', m.el).textContent = `${plantillaDe(op.plantilla).nombre} · saldrá en ${hojas.length} ${hojas.length === 1 ? 'pantalla' : 'pantallas'}.`;
    };
    const pls = $('[data-pls]', m.el);
    pls.innerHTML = todas.map(p => `<button class="bb-proy-pl ${p.id === op.plantilla ? 'on' : ''}" data-pl="${esc(p.id)}" title="${esc(p.nombre)}"><div data-m></div><span>${p.mia ? '⭐ ' : ''}${esc(p.nombre)}</span></button>`).join('');
    $$('[data-pl]', pls).forEach(b => b.onclick = () => { op.plantilla = b.dataset.pl; poner('biblia.plantilla', op.plantilla); $$('[data-pl]', pls).forEach(x => x.classList.toggle('on', x === b)); grande(); });
    $('[data-por-verso]', m.el).onchange = (e) => { op.porVerso = e.target.checked; poner('biblia.porVerso', op.porVerso); grande(); };
    $('[data-mov]', m.el).onchange = (e) => { op.mov = e.target.value; poner('biblia.mov', op.mov); grande(); };
    $('[data-no]', m.el).onclick = () => m.cerrar();
    $('[data-si]', m.el).onclick = () => {
      const k = culto();
      m.cerrar();
      proyectarSuelto({ nombre: k.nombre, plantilla_base: k.plantilla_base, items: k.items, volver: 'cultos/biblia' });
    };
    grande();
    // las miniaturas: la primera pantalla de estos versículos en cada plantilla (con la letra real de cada una)
    for (const p of todas) {
      await prepararFuente(p.id);
      const b = $(`[data-pl="${CSS.escape(p.id)}"] [data-m]`, pls);
      if (!b || !m.el.isConnected) return;
      const h = hojasDeElemento(item(), { ...culto(), plantilla_base: p.id })[0];
      if (h) pintarHoja(b, h, { modo: 'miniatura' });
    }
  }

  // Agrega los versículos elegidos (con sus palabras botón) al final de un culto
  async function alCulto(lista, cita) {
    const m = abrirModal('<h3>➕ Agregar al culto</h3><div data-c><div class="center" style="padding:20px;"><div class="spinner"></div></div></div>');
    let cultos;
    try { cultos = await datosCultos.listar(); } catch (e) { $('[data-c]', m.el).innerHTML = `<p class="err">${esc(mensajeError(e))}</p>`; return; }
    const c = $('[data-c]', m.el);
    if (!cultos.length) { c.innerHTML = '<p class="hint">Todavía no tienes cultos. Crea uno en la pestaña ⛪ Cultos.</p>'; return; }
    c.innerHTML = `<p class="hint">“${esc(cita)}” se agregará al final, con sus palabras botón.</p>
      <div class="bb-cultos">${cultos.map(k => `<button data-k="${k.id}"><b>${esc(k.nombre)}</b><small>${esc(k.fecha || 'Sin fecha')} · ${(k.items || []).length} elementos</small></button>`).join('')}</div>`;
    $$('[data-k]', c).forEach(b => b.onclick = async () => {
      const k = cultos.find(x => x.id === b.dataset.k);
      const it = itemDe(lista, cita);
      try {
        await datosCultos.guardar(k.id, { items: [...(k.items || []), it] });
        m.cerrar();
        toast(`Agregado a “${k.nombre}”`);
        limpiarSel(); pintarVersos(); pintarAccion();
      } catch (e) { toast(mensajeError(e), 'error'); }
    });
  }

  // flechas del teclado: capítulo anterior / siguiente
  const tecla = (e) => {
    if (!raiz.isConnected) return document.removeEventListener('keydown', tecla);
    if (est.vista !== 'lectura' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('.modal-fondo')) return;
    if (e.key === 'ArrowRight' && siguienteCap()) { const p = siguienteCap(); abrirCapitulo(p.libro, p.cap); }
    if (e.key === 'ArrowLeft' && anteriorCap()) { const p = anteriorCap(); abrirCapitulo(p.libro, p.cap); }
    if (e.key === 'Escape') { limpiarSel(); pintarVersos(); pintarAccion(); }
  };
  document.addEventListener('keydown', tecla);
  // el celular: deslizar a los lados cambia de capítulo
  let x0 = null;
  vista.addEventListener('touchstart', (e) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  vista.addEventListener('touchend', (e) => {
    if (x0 == null || est.vista !== 'lectura') return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 90) return;
    const p = dx < 0 ? siguienteCap() : anteriorCap();
    if (p) { abrirCapitulo(p.libro, p.cap); scrollTo({ top: 0 }); }
  });
  pintar();
}
