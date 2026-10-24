// ============================================================
// Proyectos en grupo: hoja "Agrupar"
// - zona de la pantalla: registro (QR + PIN + participantes que van llegando) y luego los grupos
// - reparto al azar y equilibrado para la simulación (en vivo lo hace el servidor)
// - formulario de registro y vista "Estás en el grupo…" del celular del participante
// ============================================================

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]+$/.test(u);
const barajar = (a) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };

// Los mismos colores y emojis que usa el servidor (proyecto_formar_grupos)
export const COLORES_GRUPO = ['#7C6FF0', '#FF9F43', '#2FAE6C', '#E14D72', '#38BDF8', '#A855F7', '#F59E0B', '#14B8A6', '#EC4899', '#6366F1', '#84CC16', '#EF4444'];
export const EMOJIS_GRUPO = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐨', '🦄', '🐙', '🦉', '🐬', '🐝', '🐢'];
export const AVATARES = ['😀', '😎', '🤓', '🥳', '🦁', '🐱', '🐶', '🦊', '🐼', '🐸', '🦄', '🐵', '🐯', '🐨', '🦉', '🐢', '🦋', '🐙', '⭐', '🚀', '⚽', '🎨', '🌈', '🍀'];

export const configAgruparInicial = () => ({ por: 'grupos', cantidad: 4, nombres: [] });

// Cuántos grupos salen y de qué tamaño: "Quedarán 3 grupos de 7 y 2 grupos de 6"
export function numeroGrupos(n, cantidad, por) {
  const c = Math.max(1, Math.round(Number(cantidad) || 1));
  return Math.max(1, Math.min(n || 1, por === 'personas' ? Math.ceil(n / c) : c, 60));
}
export function resumenReparto(n, cantidad, por) {
  if (n < 2) return 'Se necesitan al menos 2 participantes.';
  const k = numeroGrupos(n, cantidad, por);
  const base = Math.floor(n / k), extra = n % k;
  const g = (cant, tam) => `${cant} ${cant === 1 ? 'grupo' : 'grupos'} de ${tam}`;
  return 'Quedarán ' + (extra ? `${g(extra, base + 1)} y ${g(k - extra, base)}` : g(k, base)) + '.';
}
// Reparto local (simulación): se barajan y se reparten por turnos
export function formarLocal(participantes, cantidad, por, nombres = []) {
  const k = numeroGrupos(participantes.length, cantidad, por);
  const grupos = Array.from({ length: k }, (_, i) => ({ id: 'g' + (i + 1) + '-' + Math.random().toString(36).slice(2, 6), numero: i + 1,
    nombre: (nombres[i] || '').trim() || `Grupo ${i + 1}`, color: COLORES_GRUPO[i % 12], emoji: EMOJIS_GRUPO[i % 12], confirmado: false }));
  barajar(participantes).forEach((p, i) => { p.grupo_id = grupos[i % k].id; });
  return grupos;
}

const cara = (p, clase = '') => `<span class="zg-cara ${clase}">${esUrl(p.foto_url) ? `<img src="${esc(p.foto_url)}" alt="">` : esc(p.avatar || '🙂')}</span>`;

// ======================= ZONA DE LA PANTALLA =======================
// res: { participantes:[{id, alias, avatar, foto_url, grupo_id}], grupos:[...de esta hoja], pin, url, profe, registro_abierto } o null (vista previa)
export function pintarZonaAgrupar(d, hoja, res) {
  const parts = res?.participantes || [];
  const grupos = res?.grupos || [];
  let html;
  if (grupos.length) {
    const confirmados = grupos.every(g => g.confirmado);
    const sin = parts.filter(p => !grupos.some(g => g.id === p.grupo_id));
    const columna = (g) => {
      const miembros = parts.filter(p => p.grupo_id === g?.id);
      return `<div class="zg-col" ${res?.profe ? `data-grupo="${g ? esc(g.id) : ''}"` : ''} style="--c:${g ? esc(g.color) : '#8E86AC'}">
        <div class="zg-col-cab">${g ? `${esc(g.emoji || '')} ${esc(g.nombre)}` : 'Sin grupo'}<small>${miembros.length}</small></div>
        <div class="zg-miembros">${miembros.map(p => `<span class="zg-chip" ${res?.profe ? `draggable="true" data-mover="${esc(p.id)}"` : ''}>${cara(p)}<b>${esc(p.alias)}</b></span>`).join('')}</div></div>`;
    };
    html = `<div class="zg-titulo">${confirmados ? '✅ Grupos formados' : '👀 Vista previa de los grupos'}${!confirmados && res?.profe ? '<small>Arrastra a alguien para cambiarlo de grupo. Pulsa “Confirmar grupos” cuando estés listo.</small>' : ''}</div>
      <div class="zg-cols" style="--n:${Math.min(5, grupos.length + (sin.length ? 1 : 0))}">${grupos.map(columna).join('')}${sin.length ? columna(null) : ''}</div>`;
  } else {
    const burbujas = parts.length
      ? parts.map(p => `<span class="zg-burbuja">${cara(p)}<b>${esc(p.alias)}</b>${res?.profe ? `<button class="zg-x" data-expulsar="${esc(p.id)}" title="Retirar a ${esc(p.alias)}" aria-label="Retirar a ${esc(p.alias)}">✕</button>` : ''}</span>`).join('')
      : `<div class="zona-vacia"><span>👋</span>${res ? 'Esperando participantes… escaneen el QR o entren con el PIN' : 'Aquí aparecerán los participantes al unirse'}</div>`;
    html = `<div class="zg-registro">
      <div class="zg-acceso"><div class="zg-qr" data-qr>${res?.url ? '' : '<span>QR</span>'}</div>
        <div class="zg-pin"><small>PIN</small><b>${res?.pin ? esc(res.pin.replace(/(\d{3})(\d{3})/, '$1 $2')) : '000 000'}</b></div>
        ${res?.url ? `<div class="zg-enlace"><small>o entra desde una computadora:</small><span>${esc(res.url.replace(/^https?:\/\//, ''))}</span>
          ${res.profe ? '<button data-copiar-enlace title="Copiar el enlace">📋 Copiar</button>' : ''}</div>` : ''}
        ${res?.registro_abierto === false ? '<div class="zg-cerrado">🔒 Registro cerrado</div>' : ''}</div>
      <div class="zg-gente"><div class="zg-cuenta">Registrados: <b>${parts.length}</b></div><div class="zg-burbujas">${burbujas}</div></div></div>`;
  }
  d.innerHTML = `<div class="zona zona-agrupar">${html}</div>`;
  // QR del enlace para unirse (qrcodejs, cargado por la página)
  const qr = d.querySelector('[data-qr]');
  if (qr && res?.url && window.QRCode) {
    requestAnimationFrame(() => {
      const lado = Math.max(80, Math.round(qr.getBoundingClientRect().width)) || 160;
      qr.innerHTML = '';
      new window.QRCode(qr, { text: res.url, width: lado, height: lado, correctLevel: window.QRCode.CorrectLevel.M });
    });
  }
}

// ======================= CELULAR DEL PARTICIPANTE =======================
// Reduce la foto a 256 px (JPEG) antes de subirla
export async function fotoPequena(archivo) {
  const bmp = await createImageBitmap(archivo);
  const lado = 256, k = Math.min(1, lado / Math.min(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = Math.min(w, lado); c.height = Math.min(h, lado);
  c.getContext('2d').drawImage(bmp, (c.width - w) / 2, (c.height - h) / 2, w, h);   // recorte cuadrado al centro
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}

// Formulario para unirse. alUnirse({ nombre, alias, avatar, foto }) devuelve una promesa; si falla, se muestra el error.
export function pintarRegistro(cont, { titulo = '', subtitulo = '', alUnirse, cerrado = false } = {}) {
  let avatar = AVATARES[Math.floor(Math.random() * AVATARES.length)], foto = null;
  const caja = document.createElement('div');
  caja.className = 'part';
  caja.innerHTML = `<div class="part-card reg">
    ${titulo ? `<div class="part-enun" style="text-align:center;">${esc(titulo)}</div>` : ''}
    ${subtitulo ? `<div class="part-tipo" style="text-align:center;">${esc(subtitulo)}</div>` : ''}
    ${cerrado ? '<div class="part-hecho">🔒<b>El registro está cerrado</b><small>Pídele al profesor que lo abra.</small></div>' : `
    <form data-f novalidate>
      <label class="reg-lbl">Tu nombre *</label><input class="part-campo" data-nombre maxlength="40" autocomplete="name" placeholder="Ej: Ana Pérez">
      <label class="reg-lbl">Alias (opcional, es el que se ve en pantalla)</label><input class="part-campo" data-alias maxlength="30" placeholder="Ej: Anita">
      <label class="reg-lbl">Tu avatar</label>
      <div class="reg-avatar"><span class="reg-prev" data-prev>${esc(avatar)}</span>
        <label class="part-btn sec reg-foto">📷 Subir foto<input type="file" accept="image/*" hidden data-foto></label></div>
      <div class="reg-emojis">${AVATARES.map(a => `<button type="button" data-a="${a}" class="${a === avatar ? 'sel' : ''}">${a}</button>`).join('')}</div>
      <div class="reg-err" data-err aria-live="polite"></div>
      <button class="part-btn" data-unirse>Unirse</button>
    </form>`}</div>`;
  cont.appendChild(caja);
  if (cerrado) return;
  const prev = caja.querySelector('[data-prev]');
  caja.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    avatar = b.dataset.a; foto = null;
    caja.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('sel', x === b));
    prev.textContent = avatar;
  });
  caja.querySelector('[data-foto]').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    try {
      foto = await fotoPequena(f);
      prev.innerHTML = `<img src="${URL.createObjectURL(foto)}" alt="">`;
      caja.querySelectorAll('[data-a]').forEach(x => x.classList.remove('sel'));
    } catch { caja.querySelector('[data-err]').textContent = 'No se pudo leer esa foto. Elige un avatar.'; }
  };
  caja.querySelector('[data-f]').onsubmit = async (e) => {
    e.preventDefault();
    const err = caja.querySelector('[data-err]'), btn = caja.querySelector('[data-unirse]');
    const nombre = caja.querySelector('[data-nombre]').value.trim(), alias = caja.querySelector('[data-alias]').value.trim();
    if (!nombre) { err.textContent = 'Escribe tu nombre.'; caja.querySelector('[data-nombre]').focus(); return; }
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Uniéndote…';
    try { await alUnirse({ nombre, alias, avatar, foto }); }
    catch (x) { err.textContent = x?.message || 'No se pudo unir. Inténtalo otra vez.'; btn.disabled = false; btn.textContent = 'Unirse'; }
  };
}

// "Estás en el 🟦 Grupo 3: Los Leones" con sus compañeros; o la espera mientras se forman
// soloRegistro: hoja Unirse (no se forman grupos)
export function pintarMiGrupo(cont, yo, { soloRegistro = false } = {}) {
  const g = soloRegistro ? null : yo?.grupo;
  const caja = document.createElement('div');
  caja.className = 'part';
  caja.innerHTML = g ? `<div class="part-card mi-grupo" style="--c:${esc(g.color)}">
      <div class="part-tipo" style="text-align:center;">Estás en el</div>
      <div class="mi-grupo-nombre">${esc(g.emoji || '')} ${esc(g.nombre)}</div>
      <div class="mi-grupo-lista">${(g.companeros || []).map(p => `<span class="${p.yo ? 'yo' : ''}">${cara(p, 'g')}<b>${esc(p.alias)}${p.yo ? ' (tú)' : ''}</b></span>`).join('')}</div></div>`
    : `<div class="part-card"><div class="part-hecho">${cara(yo || {}, 'xl')}<b>¡Ya estás registrado, ${esc(yo?.alias || '')}!</b><small>${soloRegistro ? 'Espera a que empiece la actividad. ¡Mira la pantalla!' : 'Espera a que el profesor forme los grupos.'}</small></div></div>`;
  cont.appendChild(caja);
}
