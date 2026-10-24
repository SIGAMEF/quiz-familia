// ============================================================
// Proyectos en grupo: presentación (pantalla completa)
// - Simulada: "Simular participantes" genera participantes y respuestas falsas (no se guarda nada).
// - En vivo (Fase 2): `vivo` es el control de la sesión (vivo-profe.js); los celulares siguen la hoja actual.
// Se avanza con las flechas, la barra espaciadora, un clic o deslizando el dedo.
// En un celular en vertical se usa el acomodo para celular.
// ============================================================
import { abrirModal, esc, toast, mensajeError, dibujarQR, copiar } from '../comun.js';
import { pintarHoja, pintarHojaMovil, repintarElemento } from './lienzo.js';
import { esPregunta, tieneCorrecta, crearSimulacion, tiempoDe, quedan } from './preguntas.js';
import { formarLocal, resumenReparto } from './agrupar.js';
import { candidatosLocal, sortearLocal, restantes, ruletaGirando, ahoraServidor } from './ruleta.js';
import { faseJuego } from './juego-hoja.js';
import { problemas, necesitaUnirse } from './revision.js';

const esCelular = () => innerWidth < innerHeight && innerWidth < 820;
// el enlace sin "https://" para leerlo en la pantalla
const enlaceCorto = (u) => String(u || '').replace(/^https?:\/\//, '');

export function presentar(hojas, { inicio = 0, alSalir, vivo = null } = {}) {
  let i = Math.min(Math.max(0, inicio), hojas.length - 1);
  let sim = null, tSim = null, formato = null, lienzo = null, claveZona = '', arrastrando = false;
  const sorteosLocales = {};   // ruletas sin sesión en vivo: sorteos que no se guardan
  const inicioLocal = {};      // sin sesión en vivo: cuándo empezó cada pregunta (para su tiempo)
  let agotada = '';            // la pregunta cuyo tiempo ya terminó (se cierra una sola vez)
  const ov = document.createElement('div');
  ov.className = 'pres' + (vivo ? ' en-vivo' : '');
  ov.innerHTML = `<div class="escenario" data-esc><div class="marco" data-marco></div></div>
    <div class="pres-reloj" data-reloj hidden></div>
    <div class="pres-qr-esquina" data-qr-esquina hidden></div>
    <div class="pres-ctrl" data-ctrl>
      <button data-acc="ant" title="Anterior (←)" aria-label="Hoja anterior">◀</button>
      <span class="cont" data-cont></span>
      <button data-acc="sig" title="Siguiente (→)" aria-label="Hoja siguiente">▶</button>
      ${vivo ? `<button class="pres-pin" data-acc="qr" title="Mostrar el QR, el PIN y el enlace (para los que llegan tarde)">📲<span class="pres-txt"> Mostrar QR</span> <small>PIN</small> <b data-pin></b></button>
        <button data-acc="enlace" title="Copiar el enlace para entrar desde una computadora o compartirlo por chat">🔗<span class="pres-txt"> Enlace</span></button><span class="cont" data-gente></span>` : ''}
      <span class="pres-herr" data-herr></span>
      <span class="pres-aviso" data-aviso hidden tabindex="0">⚠</span>
      ${vivo ? `<button data-acc="pausa" title="Pausar o reanudar"></button><button data-acc="fin" title="Finalizar la sesión">⏹<span class="pres-txt"> Finalizar</span></button>` : ''}
      <button data-acc="pc" title="Pantalla completa (F)" aria-label="Pantalla completa">⛶</button>
      <button data-acc="salir" title="Salir (Esc)" aria-label="Salir de la presentación">✕</button>
    </div>`;
  document.body.appendChild(ov);
  // en pantalla completa solo se ve este elemento: los avisos se muestran aquí dentro
  const toasts = document.querySelector('.toasts');
  if (toasts) ov.appendChild(toasts); else ov.insertAdjacentHTML('beforeend', '<div class="toasts"></div>');

  const $ = (s) => ov.querySelector(s);
  const hoja = () => hojas[i];
  const interactiva = (h) => esPregunta(h.tipo) || ['agrupar', 'unirse', 'ruleta', 'juego'].includes(h.tipo);
  const registro = (h) => h.tipo === 'agrupar' || h.tipo === 'unirse';
  // la ruleta con nombres escritos funciona sin simular; con grupos o participantes, hay que simularlos
  const simulable = (h) => interactiva(h) && !(h.tipo === 'ruleta' && (h.config?.origen || 'nombres') === 'nombres');

  // ---------- datos de la zona (simulación o sesión real) ----------
  const resSim = (h) => {
    if (!sim) return null;
    if (registro(h)) return { participantes: sim.unidos, grupos: sim.grupos[h.id] || [], pin: null, url: null, profe: true, registro_abierto: sim.abierto };
    if (!esPregunta(h.tipo)) return null;
    const e = sim.estado(h);
    if (h.config?.modo !== 'grupo') return e;
    // "por grupo" en la simulación: se muestra el grupo de cada uno si ya hay grupos
    const grupos = Object.values(sim.grupos).flat();
    return { ...e, respuestas: e.respuestas.map(r => { const p = sim.unidos.find(u => u.alias === r.alias); const g = grupos.find(x => x.id === p?.grupo_id); return g ? { ...r, alias: g.nombre, avatar: g.emoji } : r; }) };
  };
  // ruleta sin sesión: con nombres escritos siempre; con grupos o participantes, los de la simulación
  function resRuletaLocal(h) {
    const sorteos = sorteosLocales[h.id] || [];
    if ((h.config?.origen || 'nombres') === 'nombres') return { candidatos: candidatosLocal(h), sorteos, profe: true, local: true };
    if (!sim) return { candidatos: [], sorteos, profe: true, local: true };
    // los grupos de la hoja Agrupar elegida o, si no, de la última anterior que tenga grupos
    const conGrupos = (k) => k && sim.grupos[k]?.length;
    const de = conGrupos(h.config?.hoja_grupos) ? h.config.hoja_grupos : hojas.slice(0, hojas.indexOf(h)).reverse().find(x => conGrupos(x.id))?.id;
    const participantes = sim.unidos.length ? sim.unidos : sim.participantes;   // sin hoja Agrupar, todos los simulados
    return { candidatos: candidatosLocal(h, { participantes, grupos: sim.grupos[de] || [] }), sorteos, profe: true, local: true };
  }
  // hoja de juego en la simulación: puntajes falsos que suben mientras "juegan"
  function resJuegoSim(h) {
    if (!sim) return { participantes: [], respuestas: [], inicio: null, profe: false };
    const j = sim.juegos[h.id];
    const gente = sim.unidos.length ? sim.unidos : sim.participantes;
    const conf = Object.values(sim.grupos).flat().filter(g => g.confirmado);
    const hg = conf.at(-1)?.hoja_id ?? Object.keys(sim.grupos).find(k => sim.grupos[k].some(g => g.confirmado));
    return { participantes: gente, grupos: hg ? sim.grupos[hg] : [], modoGrupo: h.config?.modo === 'grupo', profe: true,
      inicio: j ? j.inicio : null, abiertas: j ? j.abiertas : true,
      respuestas: j ? Object.entries(j.puntos).map(([pid, v]) => { const p = gente.find(x => x.id === pid); return { participante_id: pid, alias: p?.alias, avatar: p?.avatar, grupo_id: p?.grupo_id, valor: v }; }) : [] };
  }
  const res = (h = hoja()) => vivo ? vivo.res(h) : h.tipo === 'ruleta' ? resRuletaLocal(h) : h.tipo === 'juego' ? resJuegoSim(h) : resSim(h);

  const pintar = () => {
    const escn = $('[data-esc]');
    formato = esCelular() ? 'movil' : 'web';
    escn.classList.toggle('movil', formato === 'movil');
    const marco = $('[data-marco]');
    marco.classList.remove('entra'); void marco.offsetWidth; marco.classList.add('entra');
    lienzo = formato === 'movil'
      ? pintarHojaMovil(marco, hoja(), { modo: 'ver', res: res() }).lienzo
      : pintarHoja(marco, hoja(), { modo: 'ver', res: res() });
    claveZona = JSON.stringify(res());
    pintarControles();
  };
  // solo la zona (para no recargar videos ni el QR si nada cambió)
  const pintarZona = () => {
    pintarControles();
    if (arrastrando) return;
    const r = res(), clave = JSON.stringify(r);
    if (clave === claveZona) return;
    claveZona = clave;
    const z = hoja().diseno.elementos.find(e => e.tipo === 'zona');
    if (z && lienzo) repintarElemento(lienzo, z, 'ver', { hoja: hoja(), res: r });
    if (hoja().tipo === 'ruleta') pintarControles();   // al dibujarse se sabe si empezó a girar
  };

  // ---------- barra de control ----------
  const boton = (acc, txt, titulo, { activo = false, desact = false } = {}) =>
    `<button data-acc="${acc}" title="${esc(titulo)}" class="${activo ? 'activo' : ''}" ${desact ? 'disabled' : ''}>${txt}</button>`;
  const pintarControles = () => {
    const h = hoja(), s = vivo?.sesion;
    $('[data-cont]').textContent = `${i + 1} / ${hojas.length}`;
    $('[data-acc="ant"]').disabled = i === 0;
    $('[data-acc="sig"]').disabled = i === hojas.length - 1;
    if (vivo) {
      $('[data-pin]').textContent = s.pin.replace(/(\d{3})(\d{3})/, '$1 $2');
      const n = vivo.datos.participantes.length, con = vivo.datos.participantes.filter(p => p.conectado).length;
      $('[data-gente]').textContent = `👥 ${con}/${n}`;
      $('[data-gente]').title = `${con} conectados de ${n} participantes`;
      $('[data-acc="pausa"]').innerHTML = s.estado === 'pausada' ? '▶<span class="pres-txt"> Reanudar</span>' : '⏸<span class="pres-txt"> Pausar</span>';
      $('[data-acc="pausa"]').classList.toggle('activo', s.estado === 'pausada');
    }
    let herr = '';
    if (!vivo && simulable(h)) herr += boton('sim', '🎭<span class="pres-txt"> Simular</span>', 'Simular participantes (no se guarda nada)', { activo: !!sim }) +
      (sim ? `<span class="cont">👥 ${sim.participantes.length}</span>` : '');
    if (esPregunta(h.tipo)) {
      const r = res(h), cerrado = vivo ? !s.respuestas_abiertas : !!r?.cerrado, revelar = vivo ? s.revelar : !!r?.revelar;
      herr += boton('cerrar', cerrado ? '🔓' : '🔒', cerrado ? 'Abrir las respuestas' : 'Cerrar las respuestas', { activo: cerrado, desact: !vivo && !sim });
      if (tieneCorrecta(h)) herr += boton('revelar', '👁<span class="pres-txt"> Revelar</span>', 'Revelar la respuesta correcta', { activo: revelar, desact: !vivo && !sim });
    } else if (registro(h) && (vivo || sim)) {
      const r = res(h), abierto = r.registro_abierto, grupos = r.grupos || [];
      herr += boton('registro', abierto ? '🔒<span class="pres-txt"> Cerrar registro</span>' : '🔓<span class="pres-txt"> Abrir registro</span>', abierto ? 'Ya no se aceptan nuevos participantes' : 'Aceptar nuevos participantes');
      if (vivo && !abierto) herr += boton('tardios', `🕓<span class="pres-txt"> Tardíos: ${s.tardios ? 'sí' : 'no'}</span>`, 'Permitir que entren tarde aunque el registro esté cerrado', { activo: s.tardios });
      if (h.tipo === 'unirse') { /* solo registro: no se forman grupos */ }
      else if (!grupos.length) herr += boton('formar', '👥<span class="pres-txt"> Formar grupos</span>', 'Formar grupos al azar');
      else {
        const conf = grupos.every(g => g.confirmado);
        if (!conf) herr += boton('mezclar', '🔀<span class="pres-txt"> Volver a mezclar</span>', 'Rehacer el sorteo') + boton('confirmar', '✅<span class="pres-txt"> Confirmar grupos</span>', 'Guardar los grupos y mostrarlos en los celulares');
        herr += boton('nombres', '✏️<span class="pres-txt"> Nombres</span>', 'Nombre, color y emoji de cada grupo');
      }
    } else if (h.tipo === 'juego' && (vivo || sim)) {
      const r = res(h), f = faseJuego(h, r, vivo ? ahoraServidor() : Date.now());
      if (f === 'espera') herr += boton('jiniciar', '▶<span class="pres-txt"> Empezar juego</span>', 'Todos empiezan a la vez en su celular');
      if (f === 'cuenta' || f === 'jugando') herr += boton('jterminar', '⏹<span class="pres-txt"> Terminar juego</span>', 'Termina la partida para todos');
      if (f !== 'espera') herr += boton('jreiniciar', '🔄<span class="pres-txt"> Jugar otra vez</span>', 'Borra los puntajes de esta hoja y vuelve a empezar');
    } else if (h.tipo === 'ruleta') {
      const r = res(h), quedan = r.cargando ? [] : restantes(h, r.candidatos || [], r.sorteos || []);
      herr += boton('girar', '🎡<span class="pres-txt"> GIRAR</span>', quedan.length ? 'Girar la ruleta' : 'No queda nadie en la ruleta', { desact: !quedan.length || ruletaGirando(h.id) });
      if (r.sorteos?.length) herr += boton('rreiniciar', '↺<span class="pres-txt"> Reiniciar ruleta</span>', 'Todos vuelven a la ruleta y se borra el historial');
    }
    const cont = $('[data-herr]');
    if (cont.innerHTML !== herr) cont.innerHTML = herr;
    // avisos de la revisión del proyecto (en la presentación no se exige nada)
    const av = problemas(hojas, i), chip = $('[data-aviso]');
    chip.hidden = !av.length;
    chip.title = av.map(x => '⚠ ' + x.txt).join('\n');
    // en vivo: en una hoja interactiva sin nadie unido, el QR y el PIN en una esquina
    const esquina = $('[data-qr-esquina]');
    const mostrarEsquina = !!vivo && necesitaUnirse(h) && !vivo.datos.participantes.length;
    if (mostrarEsquina && esquina.hidden) {
      esquina.innerHTML = `<div data-qr-e></div><b>${esc(s.pin.replace(/(\d{3})(\d{3})/, '$1 $2'))}</b><small>Únete con el QR o el PIN</small>`;
      dibujarQR(esquina.querySelector('[data-qr-e]'), vivo.url, 130);
    }
    esquina.hidden = !mostrarEsquina;
  };

  // ---------- acciones ----------
  const intentar = async (fn) => { try { await fn(); } catch (e) { toast(mensajeError(e), 'error'); } pintarZona(); };
  const modal = (html, opts) => { const m = abrirModal(html, opts); ov.appendChild(m.el.parentElement); return m; };
  const preguntar = (titulo, texto, si = 'Sí, continuar') => new Promise(ok => {
    let r = false;
    const m = modal(`<h3>${esc(titulo)}</h3><p style="font-weight:600;">${esc(texto)}</p>
      <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary" data-si>${esc(si)}</button></div>`, { alCerrar: () => ok(r) });
    m.el.querySelector('[data-no]').onclick = () => m.cerrar();
    m.el.querySelector('[data-si]').onclick = () => { r = true; m.cerrar(); };
  });
  const mostrar = (n) => {
    if (n < 0 || n >= hojas.length) return;
    i = n;
    inicioLocal[hoja().id] = Date.now();
    pintar();
    if (vivo) intentar(() => vivo.ir(hoja().id));
  };

  // Simulación: cada 0,45 s llega alguien (agrupar) o 1–2 respuestas (preguntas)
  const latido = () => {
    clearTimeout(tSim);
    if (!sim) return;
    const h = hoja();
    let cambio = false;
    if (registro(h) && sim.abierto && sim.unidos.length < sim.participantes.length) {
      const p = sim.participantes[sim.unidos.length];
      // si ya hay grupos confirmados, el que llega tarde entra al grupo más chico
      const g = (sim.grupos[h.id] || []).filter(x => x.confirmado).sort((a, b) => sim.unidos.filter(u => u.grupo_id === a.id).length - sim.unidos.filter(u => u.grupo_id === b.id).length)[0];
      sim.unidos.push({ ...p, grupo_id: g?.id || null });
      cambio = true;
    } else if (esPregunta(h.tipo)) cambio = sim.paso(h);
    else if (h.tipo === 'juego' && sim.juegos[h.id] && faseJuego(h, resJuegoSim(h), Date.now()) === 'jugando') {
      const j = sim.juegos[h.id];
      for (const p of (sim.unidos.length ? sim.unidos : sim.participantes)) {
        const v = j.puntos[p.id] || (j.puntos[p.id] = { puntos: 0, terminado: false });
        if (!v.terminado && Math.random() < 0.35) { v.puntos += 20 + Math.floor(Math.random() * 120); cambio = true; }
        if (!v.terminado && v.puntos > 600 && Math.random() < 0.05) v.terminado = true;
      }
    }
    if (cambio) pintarZona();
    tSim = setTimeout(latido, 450);
  };

  async function formarGrupos(h, mezclar = false) {
    const r = res(h), n = r.participantes.length;
    if (mezclar && !await preguntar('¿Volver a mezclar?', 'Se rehará el sorteo y los grupos cambiarán.', 'Mezclar')) return;
    let cantidad = h.config?.cantidad || 4, por = h.config?.por === 'personas' ? 'personas' : 'grupos';
    if (!mezclar) {
      const datos = await new Promise(ok => {
        let enviado = null;
        const m = modal(`<h3>👥 Formar grupos</h3><p style="font-weight:700;">Registrados: ${n}</p>
          <label class="check" style="display:flex; margin:10px 0 6px;"><input type="radio" name="por" value="grupos" ${por === 'grupos' ? 'checked' : ''}> ¿Cuántos grupos?</label>
          <label class="check" style="display:flex; margin-bottom:10px;"><input type="radio" name="por" value="personas" ${por === 'personas' ? 'checked' : ''}> ¿Cuántas personas por grupo?</label>
          <input class="input" type="number" min="1" max="60" data-cant value="${cantidad}" style="width:120px;">
          <p class="hint" data-prev style="font-size:14px; margin-top:10px;"></p>
          <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary" data-si>Formar grupos</button></div>`,
          { alCerrar: () => ok(enviado) });
        const leer = () => ({ cantidad: Math.max(1, Math.round(Number(m.el.querySelector('[data-cant]').value) || 1)), por: m.el.querySelector('input[name=por]:checked').value });
        const prev = () => { const d = leer(); m.el.querySelector('[data-prev]').textContent = resumenReparto(n, d.cantidad, d.por); };
        m.el.querySelectorAll('input').forEach(x => x.oninput = prev);
        prev();
        m.el.querySelector('[data-no]').onclick = () => m.cerrar();
        m.el.querySelector('[data-si]').onclick = () => { enviado = leer(); m.cerrar(); };
      });
      if (!datos) return;
      ({ cantidad, por } = datos);
      h._ultimo = datos;
    } else if (h._ultimo) ({ cantidad, por } = h._ultimo);
    if (vivo) return intentar(() => vivo.formar(h.id, cantidad, por));
    if (n < 2) return toast('Se necesitan al menos 2 participantes para formar grupos.', 'error');
    sim.grupos[h.id] = formarLocal(sim.unidos, cantidad, por, h.config?.nombres || []);
    pintarZona();
  }

  function editarNombres(h) {
    const grupos = res(h).grupos;
    const m = modal(`<h3>✏️ Nombres de los grupos</h3><p class="hint">Si no escribes un nombre, queda como “Grupo 1”, “Grupo 2”…</p>
      <div class="stack" style="margin-top:10px;">${grupos.map(g => `<div class="row" data-g="${esc(g.id)}">
        <input class="input" data-emoji value="${esc(g.emoji || '')}" maxlength="4" style="width:58px; text-align:center;" aria-label="Emoji">
        <input class="input grow" data-nombre value="${esc(g.nombre)}" maxlength="40" aria-label="Nombre del grupo ${g.numero}">
        <input type="color" data-color value="${esc(g.color)}" style="width:44px; height:40px; border:none; background:none;" aria-label="Color"></div>`).join('')}</div>
      <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn btn-primary" data-si>Guardar</button></div>`);
    m.el.querySelector('[data-no]').onclick = () => m.cerrar();
    m.el.querySelector('[data-si]').onclick = async () => {
      const cambios = [...m.el.querySelectorAll('[data-g]')].map(f => ({ g: grupos.find(x => x.id === f.dataset.g), i: f.dataset.g,
        nombre: f.querySelector('[data-nombre]').value.trim(), color: f.querySelector('[data-color]').value, emoji: f.querySelector('[data-emoji]').value.trim() }))
        .map(c => ({ ...c, nombre: c.nombre || `Grupo ${c.g.numero}` }))
        .filter(c => c.nombre !== c.g.nombre || c.color.toLowerCase() !== c.g.color.toLowerCase() || c.emoji !== (c.g.emoji || ''));
      m.cerrar();
      if (vivo) return intentar(async () => { for (const c of cambios) await vivo.renombrar(c.i, c.nombre, c.color, c.emoji); });
      cambios.forEach(c => Object.assign(c.g, { nombre: c.nombre, color: c.color, emoji: c.emoji }));
      pintarZona();
    };
  }

  // ---------- hoja de juego ----------
  async function accionJuego(que) {
    const h = hoja();
    if (que === 'reiniciar' && !await preguntar('¿Jugar otra vez?', 'Se borran los puntajes de esta hoja y todos vuelven a empezar.', 'Jugar otra vez')) return;
    if (vivo) return intentar(() => vivo.juego(que));
    if (!sim) return toast('Pulsa 🎭 Simular para probar el juego con participantes falsos.', 'error');
    if (que === 'iniciar') sim.juegos[h.id] = { inicio: Date.now() + 4000, abiertas: true, puntos: {} };
    else if (que === 'terminar') { if (sim.juegos[h.id]) sim.juegos[h.id].abiertas = false; }
    else delete sim.juegos[h.id];
    claveZona = ''; pintarZona();
  }

  // ---------- ruleta ----------
  function girar(h) {
    if (ruletaGirando(h.id)) return;
    if (vivo) return intentar(() => vivo.girar(h.id));
    const r = resRuletaLocal(h);
    const x = sortearLocal(h, r.candidatos, r.sorteos);
    if (!x) return toast(r.candidatos.length ? '¡Todos han salido! Reinicia la ruleta.' : h.config?.origen === 'nombres' || !h.config?.origen ? 'La ruleta no tiene nombres.' : 'Pulsa 🎭 Simular para tener participantes.', 'error');
    sorteosLocales[h.id] = [...r.sorteos, x];
    pintarZona();
  }
  async function reiniciarRuleta(h) {
    if (!await preguntar('¿Reiniciar la ruleta?', 'Todos vuelven a la ruleta y se borra el historial de esta ruleta.', 'Reiniciar')) return;
    if (vivo) return intentar(() => vivo.reiniciarRuleta(h.id));
    sorteosLocales[h.id] = [];
    pintarZona();
  }

  function verQR() {
    const s = vivo.sesion;
    const q = document.createElement('div');
    q.className = 'qr-grande';
    q.innerHTML = `<div class="caja"><h2 style="margin-bottom:10px;">Únete desde tu celular o tu computadora</h2><div data-qr style="display:inline-block;"></div>
      <div class="codigo-grande" style="margin-top:10px;">${esc(s.pin.replace(/(\d{3})(\d{3})/, '$1 $2'))}</div>
      <p class="muted" style="font-weight:700; margin-top:6px;">Escanea el QR, o abre este enlace en el navegador:</p>
      <a class="qr-enlace" href="${esc(vivo.url)}" target="_blank" rel="noopener">${esc(enlaceCorto(vivo.url))}</a>
      <div class="row" style="justify-content:center; gap:8px; margin-top:10px;">
        <button class="btn btn-sm btn-primary" data-copiar>📋 Copiar enlace</button>
        ${navigator.share ? '<button class="btn btn-sm btn-outline" data-compartir>📤 Compartir</button>' : ''}</div></div>
      <button class="btn btn-outline" data-cerrar>Cerrar</button>`;
    ov.appendChild(q);
    dibujarQR(q.querySelector('[data-qr]'), vivo.url, Math.min(innerWidth, innerHeight) * 0.42);
    q.onclick = (e) => {
      if (e.target.closest('[data-copiar]')) return copiar(vivo.url);
      if (e.target.closest('[data-compartir]')) return navigator.share({ title: 'Únete al proyecto', text: `PIN ${s.pin}`, url: vivo.url }).catch(() => {});
      if (e.target === q || e.target.closest('[data-cerrar]')) q.remove();
    };
  }

  const ACCIONES = {
    ant: () => mostrar(i - 1),
    sig: () => mostrar(i + 1),
    pc: () => pantallaCompleta(),
    salir: () => cerrar(),
    qr: () => verQR(),
    enlace: () => copiar(vivo.url),
    sim: () => {
      if (sim) { sim = null; clearTimeout(tSim); pintar(); return; }
      sim = crearSimulacion();
      Object.assign(sim, { unidos: [], grupos: {}, abierto: true, juegos: {} });
      pintar();
      latido();
    },
    cerrar: () => {
      if (vivo) return intentar(() => vivo.respuestas(!vivo.sesion.respuestas_abiertas));
      const e = sim?.estado(hoja());
      if (e) { e.cerrado = !e.cerrado; if (!e.cerrado) inicioLocal[hoja().id] = Date.now(); pintarZona(); }   // al reabrir, el tiempo empieza de nuevo
    },
    revelar: () => {
      if (vivo) return intentar(() => vivo.respuestas(null, !vivo.sesion.revelar));
      const e = sim?.estado(hoja()); if (e) { e.revelar = !e.revelar; pintarZona(); }
    },
    registro: () => {
      if (vivo) return intentar(() => vivo.registro(!vivo.sesion.registro_abierto));
      sim.abierto = !sim.abierto; pintarZona();
    },
    tardios: () => intentar(() => vivo.registro(null, !vivo.sesion.tardios)),
    formar: () => formarGrupos(hoja()),
    mezclar: () => formarGrupos(hoja(), true),
    confirmar: () => {
      if (vivo) return intentar(() => vivo.confirmar(hoja().id));
      (sim.grupos[hoja().id] || []).forEach(g => { g.confirmado = true; }); pintarZona();
    },
    nombres: () => editarNombres(hoja()),
    girar: () => girar(hoja()),
    rreiniciar: () => reiniciarRuleta(hoja()),
    jiniciar: () => accionJuego('iniciar'),
    jterminar: () => accionJuego('terminar'),
    jreiniciar: () => accionJuego('reiniciar'),
    pausa: () => intentar(() => vivo.pausar(vivo.sesion.estado !== 'pausada')),
    fin: async () => {
      if (!await preguntar('¿Finalizar la sesión?', 'El PIN dejará de funcionar. Los resultados quedan guardados en “Resultados” del proyecto.', 'Finalizar')) return;
      try { await vivo.finalizar(); toast('Sesión finalizada'); cerrar(); } catch (e) { toast(mensajeError(e), 'error'); }
    }
  };
  $('[data-ctrl]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]');
    if (b && !b.disabled) ACCIONES[b.dataset.acc]?.();
  });

  // ---------- acciones dentro de la zona (retirar a alguien, mover entre grupos) ----------
  ov.addEventListener('click', async (e) => {
    if (e.target.closest('[data-copiar-enlace]')) return vivo && copiar(vivo.url);
    if (e.target.closest('[data-ruleta-girar]')) return girar(hoja());
    const ja = e.target.closest('[data-juego-accion]');
    if (ja) return accionJuego(ja.dataset.juegoAccion);
    if (e.target.closest('[data-ruleta-reiniciar]')) return reiniciarRuleta(hoja());
    const x = e.target.closest('[data-expulsar]');
    if (!x) return;
    const p = res().participantes.find(u => u.id === x.dataset.expulsar);
    if (!p || !await preguntar('¿Retirar participante?', `${p.alias} saldrá de la sesión.`, 'Retirar')) return;
    if (vivo) return intentar(() => vivo.expulsar(p.id));
    sim.unidos = sim.unidos.filter(u => u.id !== p.id); pintarZona();
  });
  ov.addEventListener('ruleta-cambio', () => pintarControles());
  ov.addEventListener('dragstart', (e) => {
    const c = e.target.closest?.('[data-mover]');
    if (!c) return;
    arrastrando = true;
    e.dataTransfer.setData('text/x-participante', c.dataset.mover);
    e.dataTransfer.effectAllowed = 'move';
  });
  ov.addEventListener('dragend', () => { arrastrando = false; ov.querySelectorAll('.zg-col.sobre').forEach(c => c.classList.remove('sobre')); pintarZona(); });
  ov.addEventListener('dragover', (e) => {
    const col = e.target.closest?.('[data-grupo]');
    if (!col || !e.dataTransfer.types.includes('text/x-participante')) return;
    e.preventDefault();
    ov.querySelectorAll('.zg-col.sobre').forEach(c => c !== col && c.classList.remove('sobre'));
    col.classList.add('sobre');
  });
  ov.addEventListener('drop', (e) => {
    const col = e.target.closest?.('[data-grupo]');
    const pid = e.dataTransfer.getData('text/x-participante');
    if (!col || !pid) return;
    e.preventDefault();
    arrastrando = false;
    const gid = col.dataset.grupo || null;
    if (vivo) return intentar(() => vivo.mover(pid, gid));
    const u = sim.unidos.find(x => x.id === pid); if (u) u.grupo_id = gid;
    claveZona = ''; pintarZona();
  });

  // ---------- tiempo por pregunta: cuenta regresiva y cierre automático ----------
  const reloj = () => {
    const h = hoja(), el = $('[data-reloj]');
    if (!tiempoDe(h)) { el.hidden = true; return; }
    let inicio;
    if (vivo) inicio = vivo.sesion.hoja_id === h.id ? Date.parse(vivo.sesion.hoja_inicio) : NaN;
    else inicio = inicioLocal[h.id] ??= Date.now();
    const r = quedan(h, inicio, vivo ? ahoraServidor() : Date.now());
    const seg = Math.max(0, Math.ceil(r));
    el.hidden = false;
    el.textContent = seg ? `⏱ ${seg}` : '⏱ ¡Tiempo!';
    el.classList.toggle('poco', seg <= 5);
    const cerrado = vivo ? !vivo.sesion.respuestas_abiertas : !!sim?.estado(h).cerrado;
    const clave = h.id + '|' + inicio;
    if (r <= 0 && !cerrado && agotada !== clave && !isNaN(inicio)) {
      agotada = clave;
      if (vivo) intentar(() => vivo.respuestas(false));
      else if (sim) { sim.estado(h).cerrado = true; pintarZona(); }
    }
  };
  const tReloj = setInterval(reloj, 250);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else ov.requestFullscreen?.().catch(() => {});
  };
  const alRedimensionar = () => { if ((esCelular() ? 'movil' : 'web') !== formato) pintar(); };
  function cerrar() {
    clearTimeout(tSim); sim = null;
    clearInterval(tReloj);
    if (vivo) vivo.detener();
    document.removeEventListener('keydown', tecla);
    removeEventListener('resize', alRedimensionar);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const t = ov.querySelector('.toasts');
    if (t) document.body.appendChild(t);
    ov.remove();
    alSalir && alSalir(i);
  }
  const tecla = (e) => {
    if (e.target.closest?.('input, textarea') || ov.querySelector('.modal-fondo, .qr-grande')) {
      if (e.key === 'Escape') ov.querySelector('.qr-grande')?.remove();
      return;
    }
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); mostrar(i + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); mostrar(i - 1); }
    else if (e.key === 'Home') mostrar(0);
    else if (e.key === 'End') mostrar(hojas.length - 1);
    else if (e.key === 'Escape') cerrar();
    else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
  };
  document.addEventListener('keydown', tecla);
  addEventListener('resize', alRedimensionar);

  // clic: tercio izquierdo retrocede, el resto avanza; deslizar con el dedo también
  // (no dentro de los videos ni de las zonas con botones o personas que se arrastran)
  const escn = $('[data-esc]');
  let x0 = null, y0 = null;
  escn.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  escn.addEventListener('pointerup', (e) => {
    if (x0 == null || e.target.closest('.pe-video, .movil-scroll .pe-zona, .zona-agrupar, .zona-ruleta, .zona-juego-hoja, button')) { x0 = null; return; }
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { mostrar(dx < 0 ? i + 1 : i - 1); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const r = escn.getBoundingClientRect();
      mostrar(e.clientX < r.left + r.width / 3 ? i - 1 : i + 1);
    }
  });

  // los controles se ocultan si el mouse no se mueve
  let t;
  const despertar = () => { ov.classList.remove('quieto'); clearTimeout(t); t = setTimeout(() => ov.classList.add('quieto'), 3000); };
  ov.addEventListener('pointermove', despertar);
  despertar();

  // en vivo: cada consulta actualiza la zona; si la sesión termina, se cierra
  if (vivo) {
    vivo.alCambiar = (d) => { if (d.sesion.estado === 'finalizada') { toast('La sesión terminó'); cerrar(); return; } pintarZona(); };
  }
  pantallaCompleta();
  inicioLocal[hoja().id] = Date.now();
  pintar();
  return { cerrar, ir: mostrar, actualizar: pintarZona };
}

