// ============================================================
// Proyectos en grupo: celular del participante (proyecto.html?pin=123456)
// Se une con nombre, alias y avatar o foto; luego sigue la hoja que muestra el profesor
// consultando proyecto_estado cada 1,5 s. El token queda en este navegador para volver a entrar al recargar.
// ============================================================
import { supabase, esc, mensajeError } from '../comun.js';
import { pintarCelular, pintarFondo } from './lienzo.js';
import { pintarMiGrupo } from './agrupar.js';
import { esPregunta, quedan } from './preguntas.js';
import { ajustarReloj, ahoraServidor } from './ruleta.js';

const raiz = document.getElementById('raiz');
const params = new URLSearchParams(location.search);
let pin = (params.get('pin') || '').replace(/\D/g, '');
let yo = null;          // { token, participante_id, foto_clave, sesion_id }
let hoja = null, version = null, clave = '', tSondeo = null;
let ultimo = null, agotadoVisto = false;   // último estado y si ya se dibujó "se acabó el tiempo"

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw new Error(mensajeError(error));
  return data;
}
const guardar = (sid, v) => { try { localStorage.setItem('qa_proy_' + sid, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const leer = (sid) => { try { return JSON.parse(localStorage.getItem('qa_proy_' + sid)); } catch { return null; } };
const olvidar = (sid) => { try { localStorage.removeItem('qa_proy_' + sid); } catch { /* sin almacenamiento */ } };

function pantalla(html) {
  clearTimeout(tSondeo);
  document.body.className = 'centrado participante';
  raiz.innerHTML = `<div class="hoja center">${html}</div>`;
}

// ---------- PIN ----------
function pedirPin(error = '') {
  pantalla(`<div class="hero"><div class="logo">🎨</div><h1>Proyecto en vivo</h1><p class="muted" style="font-weight:700;">Escribe el PIN que te muestra tu profesor</p></div>
    <form id="f"><input class="input pin-input" id="pin" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="off" value="${esc(pin)}"
      style="font-size:30px; text-align:center; letter-spacing:6px; font-family:'Baloo 2';">
      <button class="btn btn-primary btn-block" style="margin-top:14px; font-size:17px;">Entrar</button>
      <div class="err center">${esc(error)}</div></form>
    <p class="center small" style="margin-top:14px;"><a href="index.html">← Volver al inicio</a></p>`);
  const inp = document.getElementById('pin');
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); };
  document.getElementById('f').onsubmit = (e) => {
    e.preventDefault();
    pin = inp.value;
    if (pin.length !== 6) return pedirPin('El PIN tiene 6 números.');
    history.replaceState(null, '', `proyecto.html?pin=${pin}`);
    entrar();
  };
  setTimeout(() => inp.focus(), 50);
}

async function entrar() {
  pantalla('<div class="spinner"></div>');
  let info;
  try { info = await rpc('proyecto_por_pin', { p_pin: pin }); }
  catch (e) { return pedirPin(e.message); }
  if (!info) return pedirPin('No hay ninguna sesión abierta con ese PIN.');
  yo = leer(info.sesion_id);
  if (yo) return sondear();   // vuelve a entrar con su token
  registro(info);
}

// ---------- Registro ----------
function registro(info) {
  clearTimeout(tSondeo);
  document.body.className = 'participante';
  raiz.innerHTML = '<div class="part-pantalla" data-cel></div>';
  const cont = raiz.querySelector('[data-cel]');
  pintarCelular(cont, { tipo: 'agrupar', config: {}, diseno: { fondo: { tipo: 'degradado', valor: 'violeta' }, elementos: [] } }, info.proyecto, {
    alUnirse: async ({ nombre, alias, avatar, foto }) => {
      const r = await rpc('proyecto_unirse', { p_pin: pin, p_nombre: nombre, p_alias: alias || null, p_avatar: avatar });
      yo = { token: r.token, participante_id: r.participante_id, foto_clave: r.foto_clave, sesion_id: r.sesion_id };
      guardar(r.sesion_id, yo);
      if (foto) await subirFoto(foto).catch(() => {});   // si falla, se queda con su avatar
      sondear();
    }
  });
  if (!info.puede_unirse) {
    cont.querySelector('.part-card').innerHTML = `<div class="part-enun" style="text-align:center;">${esc(info.proyecto)}</div>
      <div class="part-hecho">🔒<b>El registro está cerrado</b><small>Pídele al profesor que lo abra y vuelve a intentarlo.</small></div>
      <button class="part-btn" data-reintentar>Reintentar</button>`;
    cont.querySelector('[data-reintentar]').onclick = entrar;
  }
}

// La foto va a la carpeta de la sesión con el nombre secreto que dio el servidor (las reglas de Storage lo exigen)
async function subirFoto(blob) {
  const ruta = `proyectos/sesiones/${yo.sesion_id}/${yo.participante_id}/${yo.foto_clave}.jpg`;
  const { error } = await supabase.storage.from('preguntas-imagenes').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const url = supabase.storage.from('preguntas-imagenes').getPublicUrl(ruta).data.publicUrl;
  await rpc('proyecto_foto', { p_pin: pin, p_token: yo.token, p_url: url });
}

// ---------- Seguir al profesor ----------
async function sondear() {
  clearTimeout(tSondeo);
  let e;
  try { e = await rpc('proyecto_estado', { p_pin: pin, p_token: yo.token, p_version: version }); }
  catch {
    // sin conexión: se reintenta sin borrar lo que se ve
    if (!raiz.querySelector('.part-pantalla')) pantalla('<div class="spinner"></div><p class="muted" style="font-weight:700;">Conectando…</p>');
    tSondeo = setTimeout(sondear, 3000);
    return;
  }
  if (e.estado === 'desconocido') { olvidar(yo.sesion_id); yo = null; version = null; return entrar(); }
  if (e.estado === 'expulsado') {
    olvidar(yo.sesion_id);
    return pantalla('<div style="font-size:54px;">🚪</div><h2>Saliste de la sesión</h2><p class="muted" style="font-weight:700;">El profesor te retiró de esta sesión.</p><p style="margin-top:14px;"><a class="btn btn-primary" href="index.html">Ir al inicio</a></p>');
  }
  if (e.estado === 'finalizada') {
    olvidar(yo.sesion_id);
    return pantalla(`<div style="font-size:54px;">🎉</div><h2>¡Terminamos!</h2><p class="muted" style="font-weight:700;">La sesión “${esc(e.proyecto || '')}” terminó. ¡Gracias por participar!</p><p style="margin-top:14px;"><a class="btn btn-primary" href="index.html">Ir al inicio</a></p>`);
  }
  ajustarReloj(e.ahora);
  if (e.hoja) hoja = e.hoja;
  if (e.version !== version) { version = e.version; if (!e.hoja) hoja = null; }
  pintar(e);
  tSondeo = setTimeout(sondear, 1500);
}

// Segundos que quedan para responder la pregunta actual (null si no tiene tiempo)
const restante = (e) => hoja && e?.sesion?.hoja_id === hoja.id ? quedan(hoja, Date.parse(e.sesion.hoja_inicio), ahoraServidor()) : null;

function pintar(e) {
  ultimo = e;
  const agotado = (restante(e) ?? 1) <= 0;
  agotadoVisto = agotado;
  // solo se vuelve a dibujar si algo cambió (así no se borra lo que el participante está escribiendo)
  const k = JSON.stringify([version, e.estado, e.sesion, e.yo, e.respuestas, e.ruleta, hoja?.id, agotado]);
  if (k === clave) return;
  const mismaHoja = clave && JSON.parse(clave)[0] === version;
  const escribiendo = mismaHoja && document.activeElement?.matches?.('.part-campo, .part-hueco') && document.activeElement.value;
  clave = k;
  if (escribiendo) return;   // se actualizará cuando envíe o deje de escribir
  document.body.className = 'participante';
  const g = e.yo.grupo;
  raiz.innerHTML = `<div class="part-barra"><span class="part-yo">${e.yo.foto_url ? `<img src="${esc(e.yo.foto_url)}" alt="">` : esc(e.yo.avatar || '🙂')}</span>
      <b>${esc(e.yo.alias)}</b>${g ? `<span class="part-grupo" style="--c:${esc(g.color)}">${esc(g.emoji || '')} ${esc(g.nombre)}</span>` : ''}
      <span class="grow"></span><span class="part-reloj" data-reloj hidden></span><small>${esc(e.proyecto)}</small></div>
    <div class="part-pantalla" data-cel></div>
    ${e.estado === 'pausada' ? '<div class="part-pausa"><div>⏸</div><b>Sesión en pausa</b><small>Espera al profesor</small></div>' : ''}`;
  const cont = raiz.querySelector('[data-cel]');
  if (!hoja) {
    cont.innerHTML = '<div class="part"><div class="part-card"><div class="part-hecho">⏳<b>Espera un momento…</b><small>El profesor está preparando la siguiente hoja.</small></div></div></div>';
    return;
  }
  if (hoja.tipo === 'agrupar') {
    const pant = document.createElement('div');
    pant.className = 'movil-pantalla';
    pant.innerHTML = '<div class="lienzo-fondo"></div><div class="movil-scroll part-scroll"></div>';
    cont.appendChild(pant);
    pintarFondo(pant.querySelector('.lienzo-fondo'), hoja.diseno?.fondo);
    pintarMiGrupo(pant.querySelector('.movil-scroll'), e.yo);
    return;
  }
  if (esPregunta(hoja.tipo)) {
    const porGrupo = hoja.config?.modo === 'grupo';
    if (porGrupo && !g) {
      cont.innerHTML = '<div class="part"><div class="part-card"><div class="part-hecho">👥<b>Esta pregunta se responde en grupo</b><small>Espera a que el profesor forme los grupos.</small></div></div></div>';
      return;
    }
    pintarCelular(cont, hoja, e.proyecto, {
      vivo: { respuestas: e.respuestas, cerrado: !e.sesion.abiertas || agotado, revelar: e.sesion.revelar, modoGrupo: porGrupo },
      alEnviar: async (valor) => {
        if (e.estado === 'pausada') throw new Error('La sesión está en pausa. Espera al profesor.');
        await rpc('proyecto_responder', { p_pin: pin, p_token: yo.token, p_hoja: hoja.id, p_valor: valor });
        clave = '';                   // que el próximo estado se dibuje
        setTimeout(sondear, 300);
      }
    });
    return;
  }
  if (hoja.tipo === 'ruleta') {
    const r = e.ruleta?.hoja_id === hoja.id ? e.ruleta : null;
    pintarCelular(cont, hoja, e.proyecto, { ruleta: r ? { candidatos: r.candidatos, sorteos: r.sorteos, yo: { id: e.yo.id, grupo: g?.id } } : { cargando: true } });
    return;
  }
  pintarCelular(cont, hoja, e.proyecto);
}

// cuenta regresiva del tiempo por pregunta; al llegar a 0 se cierra el formulario
setInterval(() => {
  const el = document.querySelector('[data-reloj]');
  const r = restante(ultimo);
  if (!el) return;
  el.hidden = r == null;
  if (r == null) return;
  const seg = Math.max(0, Math.ceil(r));
  el.textContent = seg ? `⏱ ${seg}` : '⏱ ¡Tiempo!';
  el.classList.toggle('poco', seg <= 5);
  if (r <= 0 && !agotadoVisto && document.activeElement?.matches?.('.part-campo, .part-hueco')) document.activeElement.blur();
  if (r <= 0 && !agotadoVisto) pintar(ultimo);
}, 250);

// al volver a la pestaña, actualizar enseguida
document.addEventListener('visibilitychange', () => { if (!document.hidden && yo) sondear(); });

if (pin.length === 6) entrar(); else pedirPin();
