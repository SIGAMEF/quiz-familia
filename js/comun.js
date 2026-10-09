// ============================================================
// QuizApp v2 — utilidades compartidas
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://qiawcxkmszgwvxlbbcdw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpYXdjeGttc3pnd3Z4bGJiY2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDU2NjgsImV4cCI6MjEwNDgyMTY2OH0.Yw57xGupEs2f7s1lYIw9Gx1UUP2gg18FbgKj8LVzMfY';
export const DOMINIO = 'quizapp.com';

export const supabase = createClient(window.__SUPABASE_URL__ || SUPABASE_URL, window.__SUPABASE_KEY__ || SUPABASE_ANON_KEY);

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function sanitizarUsuario(u) { return (u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, ''); }
export function normalizar(t) { return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
export function coincide(texto, busqueda) {
  const t = normalizar(texto);
  return normalizar(busqueda).split(/\s+/).filter(Boolean).every(k => t.includes(k));
}
export function barajar(arr) { const c = [...arr]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; }
export function fmtFecha(f, conHora = false) {
  if (!f) return '—';
  const d = new Date(f);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) + (conHora ? ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '');
}
export function fmtSeg(s) { if (s == null || isNaN(s)) return '—'; s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function mensajeError(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Error desconocido');
  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/Database error saving new user/i.test(m)) return 'No se pudo crear la cuenta. Revisa los datos (¿el enlace del grupo sigue activo?).';
  if (/User already registered/i.test(m)) return 'Ese usuario ya existe.';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/row-level security/i.test(m)) return 'No tienes permiso para hacer esto.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo otra vez.';
  return m;
}

// ---------- Toast ----------
export function toast(msg, tipo = 'ok') {
  let cont = $('.toasts');
  if (!cont) { cont = document.createElement('div'); cont.className = 'toasts'; document.body.appendChild(cont); }
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'error' ? ' error' : '');
  t.textContent = (tipo === 'error' ? '⚠️ ' : '✅ ') + msg;
  cont.appendChild(t);
  while (cont.children.length > 3) cont.firstChild.remove();
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, tipo === 'error' ? 5000 : 3000);
}

// ---------- Modal ----------
export function abrirModal(html, { ancho = false, alCerrar } = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ${ancho ? 'ancho' : ''}"><button class="btn btn-ghost btn-sm cerrar" data-cerrar title="Cerrar">✕</button>${html}</div>`;
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', esc_); if (alCerrar) alCerrar(); };
  const esc_ = (e) => { if (e.key === 'Escape') cerrar(); };
  fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
  fondo.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = cerrar);
  document.addEventListener('keydown', esc_);
  document.body.appendChild(fondo);
  const primerInput = fondo.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
  if (primerInput) requestAnimationFrame(() => { if (!fondo.contains(document.activeElement)) primerInput.focus(); });
  return { el: fondo.querySelector('.modal'), cerrar };
}

export function confirmar(mensaje, { titulo = '¿Estás seguro?', boton = 'Sí, continuar', peligro = true } = {}) {
  return new Promise(resolve => {
    let respondido = false;
    const m = abrirModal(`
      <h3>${esc(titulo)}</h3>
      <p style="font-weight:600; white-space:pre-line;">${esc(mensaje)}</p>
      <div class="modal-pie"><button class="btn btn-outline" data-no>Cancelar</button><button class="btn ${peligro ? 'btn-red' : 'btn-primary'}" data-si>${esc(boton)}</button></div>`,
      { alCerrar: () => { if (!respondido) resolve(false); } });
    m.el.querySelector('[data-no]').onclick = () => { respondido = true; resolve(false); m.cerrar(); };
    m.el.querySelector('[data-si]').onclick = () => { respondido = true; resolve(true); m.cerrar(); };
  });
}

// campos: [{ nombre, etiqueta, tipo='text', valor, placeholder, opciones:[{valor,texto}] }]
export function pedirDatos(titulo, campos, { boton = 'Guardar', nota = '' } = {}) {
  return new Promise(resolve => {
    let respondido = false;
    const html = campos.map(c => {
      if (c.tipo === 'select') return `<label class="lbl">${esc(c.etiqueta)}</label><select class="input" name="${c.nombre}">${c.opciones.map(o => `<option value="${esc(o.valor)}" ${String(o.valor) === String(c.valor ?? '') ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
      if (c.tipo === 'textarea') return `<label class="lbl">${esc(c.etiqueta)}</label><textarea class="input" name="${c.nombre}" placeholder="${esc(c.placeholder || '')}">${esc(c.valor ?? '')}</textarea>`;
      if (c.tipo === 'checkbox') return `<label class="check" style="margin-top:12px;"><input type="checkbox" name="${c.nombre}" ${c.valor ? 'checked' : ''}> ${esc(c.etiqueta)}</label>`;
      return `<label class="lbl">${esc(c.etiqueta)}</label><input class="input" name="${c.nombre}" type="${c.tipo || 'text'}" value="${esc(c.valor ?? '')}" placeholder="${esc(c.placeholder || '')}">`;
    }).join('');
    const m = abrirModal(`<h3>${esc(titulo)}</h3>${nota ? `<p class="hint">${esc(nota)}</p>` : ''}<form>${html}<div class="err" data-err></div>
      <div class="modal-pie"><button type="button" class="btn btn-outline" data-cerrar2>Cancelar</button><button class="btn btn-primary" type="submit">${esc(boton)}</button></div></form>`,
      { alCerrar: () => { if (!respondido) resolve(null); } });
    m.el.querySelector('[data-cerrar2]').onclick = () => m.cerrar();
    m.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const datos = {};
      campos.forEach(c => {
        const el = m.el.querySelector(`[name="${c.nombre}"]`);
        datos[c.nombre] = c.tipo === 'checkbox' ? el.checked : el.value.trim();
      });
      const faltante = campos.find(c => c.requerido && !datos[c.nombre]);
      if (faltante) { m.el.querySelector('[data-err]').textContent = `Completa: ${faltante.etiqueta}`; return; }
      respondido = true; resolve(datos); m.cerrar();
    };
  });
}

// ---------- Overlay de progreso ----------
export function cargando(titulo = 'Cargando...') {
  const el = document.createElement('div');
  el.className = 'cargando';
  el.innerHTML = `<div class="caja"><div class="spinner"></div><p class="titulo" style="font-size:16px;">${esc(titulo)}</p><p class="small muted" data-txt></p><div class="barra hidden"><div></div></div></div>`;
  document.body.appendChild(el);
  return {
    progreso(actual, total) {
      el.querySelector('.barra').classList.remove('hidden');
      el.querySelector('.barra > div').style.width = Math.round((actual / Math.max(total, 1)) * 100) + '%';
      el.querySelector('[data-txt]').textContent = `${actual} de ${total}`;
    },
    texto(t) { el.querySelector('[data-txt]').textContent = t; },
    cerrar() { el.remove(); }
  };
}

// ---------- Avatares ----------
export const AVATARES_ALUMNO = ['😀','😎','🤓','🥳','🦁','🐱','🐶','🦊','🐼','🐸','🦄','🐵','👑','⭐','🚀','🎮','⚽','🎨','📚','🧠','💡','🔥','🌟','🍀','🎯','🐨','🐯','🦋','🐢','🌈','🐙','🦉'];
export const AVATARES_PROFESOR = ['👩‍🏫','👨‍🏫','🧑‍🏫','👩‍🔬','👨‍🔬','🧑‍🔬','👩‍💻','👨‍💻','📘','🧪','🔭','🧮','🌍','🎓','📐','🦉'];
export function esUrl(a) { return /^https?:\/\//.test(a || ''); }
export function avatarHtml(a, clase = '', defecto = '🙂') {
  return `<span class="avatar ${clase}">${esUrl(a) ? `<img src="${esc(a)}" alt="">` : esc(a || defecto)}</span>`;
}

// Selector de avatar: emojis + subir foto. Devuelve { valor(), archivo() }
export function selectorAvatar(cont, { emojis = AVATARES_ALUMNO, actual = '', permitirFoto = true } = {}) {
  let elegido = actual || emojis[0];
  let archivo = null;
  cont.innerHTML = `
    <div class="row" style="margin-bottom:8px;"><span data-prev>${avatarHtml(elegido, 'lg')}</span>
      ${permitirFoto ? `<label class="btn btn-sm btn-outline" style="cursor:pointer;">📷 Subir foto<input type="file" accept="image/*" hidden data-foto></label>` : ''}
    </div>
    <div class="avatar-grid">${emojis.map(e => `<button type="button" class="avatar-op ${e === elegido ? 'sel' : ''}" data-e="${e}">${e}</button>`).join('')}</div>`;
  const prev = cont.querySelector('[data-prev]');
  cont.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
    elegido = b.dataset.e; archivo = null;
    cont.querySelectorAll('.avatar-op').forEach(x => x.classList.toggle('sel', x === b));
    prev.innerHTML = avatarHtml(elegido, 'lg');
  });
  const inp = cont.querySelector('[data-foto]');
  if (inp) inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast('La foto debe pesar menos de 3 MB', 'error'); return; }
    archivo = f;
    cont.querySelectorAll('.avatar-op').forEach(x => x.classList.remove('sel'));
    prev.innerHTML = `<span class="avatar lg"><img src="${URL.createObjectURL(f)}" alt=""></span>`;
  };
  return { valor: () => elegido, archivo: () => archivo };
}

// Reduce una imagen antes de subirla
export async function reducirImagen(archivo, maxLado = 1200, calidad = 0.85) {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif' || archivo.type === 'image/svg+xml') return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    if (escala === 1 && archivo.size < 400 * 1024) return archivo;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', calidad));
    return blob ? new File([blob], 'imagen.jpg', { type: 'image/jpeg' }) : archivo;
  } catch { return archivo; }
}

export async function subirImagen(archivo, { bucket = 'preguntas-imagenes', carpeta = '', maxLado = 1200 } = {}) {
  const f = await reducirImagen(archivo, maxLado);
  const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const nombre = `${carpeta ? carpeta + '/' : ''}img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(nombre, f, { upsert: true, contentType: f.type });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
}

export async function subirAvatar(archivo, uid) {
  return subirImagen(archivo, { bucket: 'avatares', carpeta: uid, maxLado: 400 });
}

// Campo de imagen reutilizable: URL + archivo + pegar (Ctrl+V). Devuelve { valor() , poner(url) }
export function campoImagen(cont, actual = '') {
  cont.innerHTML = `
    <div class="row"><input class="input grow" data-url placeholder="URL de la imagen (opcional)" value="${esc(actual)}">
      <label class="btn btn-sm btn-outline" style="cursor:pointer;">📁 Archivo<input type="file" accept="image/*" hidden data-arch></label>
      <button type="button" class="btn btn-sm btn-ghost" data-quitar title="Quitar imagen">✕</button></div>
    <div class="zona-pegar" tabindex="0" data-pegar style="margin-top:6px;">📋 Haz clic aquí y pega una imagen (Ctrl+V)</div>
    <div data-estado class="hint"></div>
    <img data-prev style="max-height:120px; border-radius:10px; margin-top:6px; ${actual ? '' : 'display:none;'}" src="${esc(actual)}" alt="">`;
  const url = cont.querySelector('[data-url]'), prev = cont.querySelector('[data-prev]'), estado = cont.querySelector('[data-estado]');
  const poner = (u) => { url.value = u || ''; prev.src = u || ''; prev.style.display = u ? '' : 'none'; };
  url.oninput = () => poner(url.value.trim());
  prev.onerror = () => { prev.style.display = 'none'; };
  const subir = async (f) => {
    estado.textContent = 'Subiendo imagen...';
    try { poner(await subirImagen(f)); estado.textContent = ''; }
    catch (e) { estado.textContent = ''; toast('No se pudo subir: ' + mensajeError(e), 'error'); }
  };
  cont.querySelector('[data-arch]').onchange = (e) => { if (e.target.files[0]) subir(e.target.files[0]); e.target.value = ''; };
  cont.querySelector('[data-pegar]').onpaste = (e) => {
    const it = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!it) { toast('No hay ninguna imagen en el portapapeles', 'error'); return; }
    e.preventDefault(); subir(it.getAsFile());
  };
  cont.querySelector('[data-quitar]').onclick = () => poner('');
  return { valor: () => url.value.trim(), poner };
}

export function activarZoom(raiz = document) {
  raiz.querySelectorAll('img.zoom').forEach(img => {
    img.onclick = () => {
      const ov = document.createElement('div');
      ov.className = 'qr-grande'; ov.style.cursor = 'zoom-out';
      ov.innerHTML = `<img src="${esc(img.src)}" style="max-width:100%; max-height:100%; border-radius:12px;">`;
      ov.onclick = () => ov.remove();
      document.body.appendChild(ov);
    };
  });
}

// ---------- Sesión ----------
export async function miPerfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.rpc('mi_perfil');
  if (error) throw error;
  return data;
}

export function paginaDeRol(rol) {
  return rol === 'admin' ? 'admin.html' : rol === 'profesor' ? 'profesor.html' : 'alumno.html';
}

// Exige sesión con alguno de los roles. Si no, redirige al login.
export async function exigirRol(roles) {
  let perfil = null;
  try { perfil = await miPerfil(); } catch (e) { console.error(e); }
  if (!perfil) { location.href = 'index.html'; return null; }
  if (perfil.estado === 'restringido') { mostrarRestringido(perfil); return null; }
  if (!roles.includes(perfil.rol)) { location.href = paginaDeRol(perfil.rol); return null; }
  return perfil;
}

export function mostrarRestringido(perfil) {
  document.body.className = 'centrado';
  document.body.innerHTML = `<div class="hoja center">
    <div style="font-size:54px;">🔒</div><h1 style="margin:6px 0;">Cuenta restringida</h1>
    <p class="muted" style="font-weight:700; margin-bottom:14px;">${esc(perfil.mensaje_restriccion || 'Tu cuenta fue restringida por el administrador. Comunícate con él para más información.')}</p>
    <button class="btn btn-primary btn-block" id="salirR">Salir</button></div>`;
  document.getElementById('salirR').onclick = async () => { await supabase.auth.signOut(); location.href = 'index.html'; };
}

export async function iniciarSesion(usuario, clave) {
  const u = sanitizarUsuario(usuario);
  if (!u || !clave) throw new Error('Completa usuario y contraseña.');
  const { data: email, error: e1 } = await supabase.rpc('email_por_usuario', { p_usuario: u });
  if (e1) throw e1;
  if (!email) throw new Error('Usuario o contraseña incorrectos.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error) throw error;
  return miPerfil();
}

export async function salir() {
  await supabase.auth.signOut();
  location.href = 'index.html';
}

// Cierra sesión tras un tiempo sin actividad
export function cierreInactividad(minutos = 60) {
  let t;
  const reiniciar = () => { clearTimeout(t); t = setTimeout(salir, minutos * 60 * 1000); };
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, reiniciar, { passive: true }));
  reiniciar();
}

export function descargarBlob(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function urlBase() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }

// Dibuja un QR (usa qrcodejs cargado por <script>)
export function dibujarQR(el, texto, lado = 180) {
  el.innerHTML = '';
  if (window.QRCode) new window.QRCode(el, { text: texto, width: lado, height: lado, correctLevel: window.QRCode.CorrectLevel.M });
  else el.textContent = 'No se pudo generar el QR, usa el enlace.';
}

export function mostrarQRGrande(titulo, url, codigo = '', subtitulo = 'Escanea para unirte') {
  const ov = document.createElement('div');
  ov.className = 'qr-grande';
  ov.innerHTML = `<div class="caja"><h2 style="margin-bottom:10px;">${esc(titulo)}</h2><div data-qr style="display:inline-block;"></div>
    ${codigo ? `<div class="codigo-grande" style="margin-top:10px;">${esc(codigo)}</div>` : ''}
    <p class="muted" style="font-weight:700; margin-top:6px;">${esc(subtitulo)}</p>
    <p class="small" style="word-break:break-all; margin-top:6px;">${esc(url)}</p></div>
    <button class="btn btn-outline">Cerrar</button>`;
  document.body.appendChild(ov);
  dibujarQR(ov.querySelector('[data-qr]'), url, Math.min(window.innerWidth, window.innerHeight) * 0.55);
  ov.onclick = (e) => { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); };
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado'); }
  catch { prompt('Copia este texto:', texto); }
}

// ---------- Tipos de pregunta ----------
export const TIPOS = {
  verdadero_falso: { nombre: 'Verdadero / Falso', ico: '✔️' },
  opcion_unica: { nombre: 'Opción única', ico: '🔘' },
  opcion_multiple: { nombre: 'Opción múltiple', ico: '☑️' },
  completar: { nombre: 'Completar', ico: '✏️' },
  lluvia_ideas: { nombre: 'Lluvia de ideas', ico: '💭' }
};
export const MODOS = {
  practica: { nombre: 'Práctica', ico: '🎯', clase: '' },
  examen: { nombre: 'Examen', ico: '📝', clase: 'red' },
  estudio: { nombre: 'Estudio', ico: '🧠', clase: 'amber' }
};

// Nota según la escala del grupo
export function notaLiteral(n) { if (n == null) return null; return n >= 18 ? 'AD' : n >= 14 ? 'A' : n >= 11 ? 'B' : 'C'; }
export function textoNota(n, escala = 'vigesimal') {
  if (n == null) return '—';
  const v = Number(n).toFixed(1).replace(/\.0$/, '');
  if (escala === 'literal') return notaLiteral(n);
  if (escala === 'ambas') return `${v} (${notaLiteral(n)})`;
  return v;
}
export function claseNota(n) { const l = notaLiteral(n); return l ? 'nota-' + l.toLowerCase() : ''; }
