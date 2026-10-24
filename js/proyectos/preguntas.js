// ============================================================
// Proyectos en grupo: hojas de preguntas (pregunta abierta, V/F, opción múltiple, completar, lluvia de ideas)
// - configuración inicial de cada tipo
// - zona de resultados que se ve en la pantalla (pintarZona)
// - formulario del participante en el celular (pintarParticipante)
// - participantes simulados para probar sin guardar nada (crearSimulacion)
// Las respuestas tienen la misma forma que tendrán en vivo (Fase 2): { alias, avatar, valor }.
// ============================================================

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const azar = (a) => a[Math.floor(Math.random() * a.length)];
const barajar = (a) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };

export const TIPOS_PREGUNTA = {
  pregunta: { ico: '💬', nombre: 'Pregunta abierta' },
  vf: { ico: '✔️', nombre: 'Verdadero / Falso' },
  opcion: { ico: '🔘', nombre: 'Opción múltiple' },
  completar: { ico: '✏️', nombre: 'Completar' },
  lluvia: { ico: '💭', nombre: 'Lluvia de ideas' }
};
export const esPregunta = (tipo) => Object.hasOwn(TIPOS_PREGUNTA, tipo);
export const COLORES_OPCION = ['#7C6FF0', '#FF9F43', '#2FAE6C', '#E14D72', '#38BDF8', '#A855F7'];
export const LETRAS = 'ABCDEF';

export function configInicial(tipo) {
  const base = { modo: 'persona', tiempo: 0 };   // tiempo: segundos para responder (0 = sin límite)
  if (tipo === 'pregunta') return { ...base, enunciado: '¿Qué aprendiste hoy?', limite: 140 };
  if (tipo === 'vf') return { ...base, enunciado: 'El Sol es una estrella.', correcta: true };
  if (tipo === 'opcion') {
    const ops = ['Júpiter', 'Saturno', 'La Tierra', 'Marte'].map(texto => ({ id: uid(), texto }));
    return { ...base, enunciado: '¿Cuál es el planeta más grande del sistema solar?', opciones: ops, correctas: [ops[0].id] };
  }
  if (tipo === 'completar') return { ...base, frase: 'El agua hierve a ___ grados.', aceptadas: [['100', 'cien']] };
  if (tipo === 'lluvia') return { ...base, enunciado: '¿Con qué palabra describes a tu familia?', max: 3 };
  return {};
}

// Tiempo por pregunta: segundos que quedan (null si no tiene límite). inicio y ahora en ms.
export const tiempoDe = (hoja) => esPregunta(hoja?.tipo) ? Math.max(0, Math.round(Number(hoja.config?.tiempo) || 0)) : 0;
export function quedan(hoja, inicio, ahora = Date.now()) {
  const t = tiempoDe(hoja);
  if (!t) return null;
  return isNaN(inicio) ? t : t - (ahora - inicio) / 1000;
}

// Texto que muestra el elemento "enunciado" de la hoja
export function textoEnunciado(hoja) {
  const c = hoja?.config || {};
  if (hoja?.tipo === 'completar') return String(c.frase || '').replace(/_{3,}/g, '______');
  return String(c.enunciado || '');
}
export const huecos = (frase) => (String(frase || '').match(/_{3,}/g) || []).length;
export function normalizar(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!¿?.,;:"'()]/g, ' ').replace(/\s+/g, ' ').trim();
}
// ¿Tiene respuesta correcta configurada?
export function tieneCorrecta(hoja) {
  const c = hoja.config || {};
  if (hoja.tipo === 'vf') return typeof c.correcta === 'boolean';
  if (hoja.tipo === 'opcion') return (c.correctas || []).length > 0;
  if (hoja.tipo === 'completar') return (c.aceptadas || []).some(a => a.length);
  return false;
}
export function esCorrecta(hoja, valor) {
  const c = hoja.config || {};
  if (hoja.tipo === 'vf') return valor?.valor === c.correcta;
  if (hoja.tipo === 'opcion') return (c.correctas || []).includes(valor?.opcion);
  if (hoja.tipo === 'completar') {
    const n = Math.max(1, huecos(c.frase));
    return Array.from({ length: n }, (_, i) => (c.aceptadas?.[i] || []).map(normalizar).includes(normalizar(valor?.textos?.[i]))).every(Boolean);
  }
  return null;
}

// ======================= ZONA DE RESULTADOS (pantalla) =======================
// res: { respuestas: [{alias, avatar, valor}], revelar, cerrado } o null (editor: vista previa sin datos)
export function pintarZona(d, hoja, res) {
  const c = hoja.config || {};
  const resp = res?.respuestas || [];
  const revelar = !!res?.revelar && tieneCorrecta(hoja);
  let html = '';
  if (hoja.tipo === 'vf' || hoja.tipo === 'opcion') {
    const ops = hoja.tipo === 'vf'
      ? [{ id: true, texto: 'Verdadero', letra: '✔', color: '#2FAE6C' }, { id: false, texto: 'Falso', letra: '✘', color: '#E14D72' }]
      : (c.opciones || []).map((o, i) => ({ id: o.id, texto: o.texto, imagen: o.imagen, letra: LETRAS[i], color: COLORES_OPCION[i % 6] }));
    const votos = (id) => resp.filter(r => (hoja.tipo === 'vf' ? r.valor?.valor : r.valor?.opcion) === id).length;
    const total = resp.length || 1;
    const ok = (id) => hoja.tipo === 'vf' ? c.correcta === id : (c.correctas || []).includes(id);
    html = `<div class="zb">${ops.map(o => {
      const v = votos(o.id), p = Math.round(v * 100 / total);
      return `<div class="zb-fila ${revelar ? (ok(o.id) ? 'ok' : 'apagada') : ''}"><span class="zb-letra" style="background:${o.color}">${esc(o.letra)}</span>
        <span class="zb-txt">${urlImagen(o.imagen) ? `<img class="zb-img" src="${esc(o.imagen)}" alt="">` : ''}${esc(o.texto)}${revelar && ok(o.id) ? ' ✅' : ''}</span>
        <span class="zb-barra"><i style="width:${resp.length ? p : 0}%; background:${o.color}"></i></span><b class="zb-n">${v}</b></div>`;
    }).join('')}</div>`;
  } else if (hoja.tipo === 'pregunta') {
    html = resp.length ? `<div class="zn">${resp.slice(-24).reverse().map((r, i) => `<div class="zn-nota" style="--r:${(i * 37 % 7) - 3}deg">${esc(r.valor?.texto)}<small>${esc(r.avatar || '')} ${esc(r.alias)}</small></div>`).join('')}</div>
      ${resp.length > 24 ? `<div class="zona-mas">y ${resp.length - 24} respuestas más</div>` : ''}` : vacio('💬', 'Aquí aparecerán las respuestas como tarjetas');
  } else if (hoja.tipo === 'lluvia') {
    const cuenta = new Map();
    for (const r of resp) {
      const k = normalizar(r.valor?.texto);
      if (!k) continue;
      const e = cuenta.get(k) || { texto: r.valor.texto.trim(), n: 0 };
      e.n++; cuenta.set(k, e);
    }
    const lista = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 40);
    const max = lista[0]?.n || 1;
    const orden = lista.map((p, i) => ({ ...p, i })).sort((a, b) => ((a.i * 7919) % 13) - ((b.i * 7919) % 13));
    html = lista.length ? `<div class="zl">${orden.map(p => `<span class="zl-p" style="font-size:calc(${(3 + 6 * p.n / max).toFixed(1)} * var(--u)); color:${COLORES_OPCION[p.i % 6]}">${esc(p.texto)}</span>`).join('')}</div>`
      : vacio('💭', 'Las ideas aparecerán aquí y crecerán cuanto más se repitan');
  } else if (hoja.tipo === 'completar') {
    const n = Math.max(1, huecos(c.frase));
    const bien = resp.filter(r => esCorrecta(hoja, r.valor)).length;
    const pct = resp.length ? Math.round(bien * 100 / resp.length) : 0;
    const cuenta = new Map();
    for (const r of resp) {
      const t = (r.valor?.textos || []).slice(0, n).map(x => String(x || '').trim()).join(' · ');
      const k = normalizar(t);
      const e = cuenta.get(k) || { texto: t || '(vacío)', n: 0, ok: esCorrecta(hoja, r.valor) };
      e.n++; cuenta.set(k, e);
    }
    const top = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    html = `<div class="zc"><div class="zc-anillo" style="--p:${revelar || !tieneCorrecta(hoja) ? pct : 0}"><b>${revelar ? pct + '%' : resp.length ? '?' : '–'}</b><small>${revelar ? 'aciertos' : 'aciertos (revela)'}</small></div>
      <div class="zc-lista">${top.map(t => `<span class="zc-chip ${revelar ? (t.ok ? 'ok' : 'mal') : ''}">${esc(t.texto)} <b>${t.n}</b></span>`).join('') || '<span class="zona-vacia-txt">Las respuestas más comunes aparecerán aquí</span>'}
      ${revelar ? `<div class="zc-correcta">✅ ${(c.aceptadas || []).map(a => esc(a[0] || '')).join(' · ')}</div>` : ''}</div></div>`;
  }
  const pie = res ? `<div class="zona-pie">💬 ${resp.length} ${resp.length === 1 ? 'respuesta' : 'respuestas'}${res.cerrado ? ' · 🔒 Respuestas cerradas' : ''}</div>` : '';
  d.innerHTML = `<div class="zona">${html}${pie}</div>`;
}
const vacio = (ico, txt) => `<div class="zona-vacia"><span>${ico}</span>${esc(txt)}</div>`;
const urlImagen = (u) => typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]+$/.test(u);

// ======================= FORMULARIO DEL PARTICIPANTE (celular) =======================
// Texto corto de una respuesta (para "¡Respuesta enviada!" y la corrección)
export function textoRespuesta(hoja, valor) {
  const c = hoja.config || {};
  if (!valor) return '';
  if (hoja.tipo === 'vf') return valor.valor ? 'Verdadero' : 'Falso';
  if (hoja.tipo === 'opcion') return (c.opciones || []).find(o => o.id === valor.opcion)?.texto || '';
  if (hoja.tipo === 'completar') return (valor.textos || []).join(' · ');
  return valor.texto || '';
}
function textoCorrecta(hoja) {
  const c = hoja.config || {};
  if (hoja.tipo === 'vf') return c.correcta ? 'Verdadero' : 'Falso';
  if (hoja.tipo === 'opcion') return (c.opciones || []).filter(o => (c.correctas || []).includes(o.id)).map(o => o.texto).join(' / ');
  if (hoja.tipo === 'completar') return (c.aceptadas || []).map(a => a[0] || '').join(' · ');
  return '';
}

// Opciones:
// - alEnviar(valor): puede devolver una promesa; si falla, se muestra el error y se conserva lo escrito.
// - respuestas: en vivo, lo que ya respondió (o su grupo): [{ valor, alias, mia }]. Sin "respuestas" es una vista previa.
// - cerrado, revelar, modoGrupo, nota
export function pintarParticipante(cont, hoja, { alEnviar = () => {}, nota = '', respuestas = null, cerrado = false, revelar = false, modoGrupo = false } = {}) {
  const c = hoja.config || {};
  const tipo = TIPOS_PREGUNTA[hoja.tipo];
  const enVivo = Array.isArray(respuestas);
  let enviadas = enVivo ? respuestas.map(r => r.valor?.texto).filter(Boolean) : [];   // lluvia: varias ideas
  let previa = null;                // vista previa: lo último enviado
  let cambiando = false;
  const caja = document.createElement('div');
  caja.className = 'part';
  const max = Math.max(1, Math.min(10, Number(c.max) || 3));

  const pintar = () => {
    const actual = enVivo ? respuestas[0] : previa;
    let cuerpo = '';
    if (hoja.tipo !== 'lluvia' && actual && !cambiando) {
      const otro = enVivo && modoGrupo && !actual.mia ? `<small>Respondió ${esc(actual.alias)} por tu grupo</small>` : '';
      let correccion = '';
      if (revelar && tieneCorrecta(hoja)) {
        correccion = esCorrecta(hoja, actual.valor) ? '<div class="part-ok">✅ ¡Correcto!</div>'
          : `<div class="part-mal">❌ La respuesta correcta era: <b>${esc(textoCorrecta(hoja))}</b></div>`;
      }
      cuerpo = `<div class="part-hecho">✅<b>¡Respuesta enviada!</b><small>${esc(textoRespuesta(hoja, actual.valor))}</small>${otro}</div>${correccion}
        ${cerrado ? '<div class="part-cuenta" style="text-align:center;">🔒 Las respuestas están cerradas</div>' : '<button class="part-btn sec" data-otra>Cambiar respuesta</button>'}`;
    } else if (cerrado && !(hoja.tipo === 'lluvia' && enviadas.length)) {
      cuerpo = `<div class="part-hecho">🔒<b>Las respuestas están cerradas</b><small>Mira la pantalla.</small></div>`;
      if (revelar && tieneCorrecta(hoja)) cuerpo += `<div class="part-ok">La respuesta correcta era: <b>${esc(textoCorrecta(hoja))}</b></div>`;
    } else if (hoja.tipo === 'vf') {
      cuerpo = `<div class="part-ops dos"><button class="part-op" data-v="1" style="--c:#2FAE6C">✔<span>Verdadero</span></button>
        <button class="part-op" data-v="0" style="--c:#E14D72">✘<span>Falso</span></button></div>`;
    } else if (hoja.tipo === 'opcion') {
      cuerpo = `<div class="part-ops">${(c.opciones || []).map((o, i) => `<button class="part-op fila" data-op="${esc(o.id)}" style="--c:${COLORES_OPCION[i % 6]}"><i>${LETRAS[i]}</i>${urlImagen(o.imagen) ? `<img src="${esc(o.imagen)}" alt="">` : ''}<span>${esc(o.texto)}</span></button>`).join('')}</div>`;
    } else if (hoja.tipo === 'pregunta') {
      const lim = Math.max(10, Math.min(500, Number(c.limite) || 140));
      cuerpo = `<textarea class="part-campo" data-t maxlength="${lim}" placeholder="Escribe tu respuesta"></textarea>
        <div class="part-cuenta"><span data-n>0</span> / ${lim}</div><button class="part-btn" data-enviar>Enviar</button>`;
    } else if (hoja.tipo === 'completar') {
      const partes = String(c.frase || '').split(/_{3,}/);
      cuerpo = `<div class="part-frase">${partes.map((p, i) => esc(p) + (i < partes.length - 1 ? `<input class="part-hueco" data-h="${i}" autocomplete="off" aria-label="Espacio ${i + 1}">` : '')).join('')}</div>
        <button class="part-btn" data-enviar>Enviar</button>`;
    } else if (hoja.tipo === 'lluvia') {
      const quedan = max - enviadas.length;
      cuerpo = quedan > 0 && !cerrado ? `<input class="part-campo" data-t maxlength="60" placeholder="Escribe una idea corta">
        <button class="part-btn" data-enviar>Enviar idea</button><div class="part-cuenta">Puedes enviar ${quedan} ${quedan === 1 ? 'idea más' : 'ideas más'}</div>`
        : `<div class="part-hecho">✅<b>¡Gracias por tus ideas!</b>${cerrado ? '<small>🔒 Las respuestas están cerradas</small>' : ''}</div>`;
      if (enviadas.length) cuerpo += `<div class="part-ideas">${enviadas.map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
    }
    caja.innerHTML = `<div class="part-card"><div class="part-tipo">${tipo?.ico || ''} ${esc(tipo?.nombre || '')}${modoGrupo ? ' · 👥 responde tu grupo' : ''}</div>
      <div class="part-enun">${esc(textoEnunciado(hoja)) || '<i>(sin enunciado)</i>'}</div>${cuerpo}<div class="reg-err" data-err aria-live="polite"></div></div>${nota ? `<div class="part-nota">${esc(nota)}</div>` : ''}`;

    const err = caja.querySelector('[data-err]');
    const enviar = async (valor, boton) => {
      err.textContent = '';
      caja.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await alEnviar(valor);
        if (hoja.tipo === 'lluvia') enviadas.push(valor.texto);
        else if (enVivo) respuestas = [{ valor, alias: '', mia: true }];
        else previa = { valor };
        cambiando = false;
        pintar();
      } catch (x) {
        caja.querySelectorAll('button').forEach(b => { b.disabled = false; });
        err.textContent = x?.message || 'No se pudo enviar. Inténtalo otra vez.';
        boton?.focus();
      }
    };
    caja.querySelectorAll('[data-v]').forEach(b => b.onclick = () => enviar({ valor: b.dataset.v === '1' }, b));
    caja.querySelectorAll('[data-op]').forEach(b => b.onclick = () => enviar({ opcion: b.dataset.op }, b));
    const t = caja.querySelector('[data-t]'), n = caja.querySelector('[data-n]');
    if (t && n) t.oninput = () => { n.textContent = t.value.length; };
    const btn = caja.querySelector('[data-enviar]');
    if (btn) btn.onclick = () => {
      if (hoja.tipo === 'completar') {
        const campos = [...caja.querySelectorAll('[data-h]')];
        const vacio = campos.find(i => !i.value.trim());
        if (vacio) return vacio.focus();
        enviar({ textos: campos.map(i => i.value.trim()) }, btn);
      } else {
        const v = t.value.trim();
        if (!v) return t.focus();
        enviar({ texto: v }, btn);
      }
    };
    if (t) t.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && t.tagName === 'INPUT') { e.preventDefault(); btn?.click(); } };
    const otra = caja.querySelector('[data-otra]');
    if (otra) otra.onclick = () => { cambiando = true; pintar(); };
  };
  pintar();
  cont.appendChild(caja);
}

// ======================= PARTICIPANTES SIMULADOS (sin guardar) =======================
const NOMBRES = ['Ana', 'Luis', 'Sofía', 'Mateo', 'Valeria', 'Diego', 'Camila', 'Joaquín', 'Lucía', 'Thiago', 'Isabella', 'Gael', 'Mía', 'Santiago',
  'Renata', 'Sebastián', 'Emma', 'Nicolás', 'Abril', 'Adrián', 'Zoe', 'Bruno', 'Julieta', 'Iker', 'Antonella', 'Dylan', 'Ximena', 'Fabián', 'Paula', 'Andrés'];
const AVATARES = ['🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🦄', '🐵', '🐶', '🐱', '🐧', '🦉'];
const FRASES = ['Me gustó mucho la clase', 'Aprendí algo nuevo', 'Fue interesante', 'Quiero saber más', 'No estaba seguro al inicio',
  'Lo entendí con el ejemplo', 'Me pareció fácil', 'Fue un reto', 'Trabajar en equipo ayuda', 'Hay que practicar más', 'Me encantó',
  'Lo voy a contar en casa', 'Me costó un poco', '¡Súper divertido!', 'Necesito repasarlo'];
const IDEAS = ['amor', 'unión', 'alegría', 'respeto', 'apoyo', 'paz', 'diversión', 'familia', 'confianza', 'fe', 'amistad', 'risas',
  'ayuda', 'cariño', 'paciencia', 'esfuerzo', 'música', 'comida', 'juegos', 'abrazos'];

export function crearSimulacion() {
  const participantes = barajar(NOMBRES).slice(0, 10 + Math.floor(Math.random() * 21)).map((alias, i) => ({ id: 'sim' + i, alias, avatar: azar(AVATARES) }));
  const estados = new Map();
  const estado = (hoja) => {
    if (!estados.has(hoja.id)) {
      const veces = hoja.tipo === 'lluvia' ? Math.max(1, Math.min(10, Number(hoja.config?.max) || 3)) : 1;
      // en lluvia cada uno manda entre 1 y "max" ideas
      const turnos = barajar(participantes.flatMap(p => Array.from({ length: hoja.tipo === 'lluvia' ? 1 + Math.floor(Math.random() * veces) : 1 }, () => p)));
      estados.set(hoja.id, { respuestas: [], cerrado: false, revelar: false, turnos });
    }
    return estados.get(hoja.id);
  };
  // Agrega 1 o 2 respuestas falsas. Devuelve true si hubo cambios.
  const paso = (hoja) => {
    const e = estado(hoja);
    if (e.cerrado || !e.turnos.length) return false;
    for (let k = 0; k < 1 + Math.floor(Math.random() * 2) && e.turnos.length; k++) {
      const p = e.turnos.pop();
      e.respuestas.push({ ...p, valor: valorFalso(hoja) });
    }
    return true;
  };
  return { participantes, estado, paso, reiniciar: (hoja) => estados.delete(hoja.id) };
}

function valorFalso(hoja) {
  const c = hoja.config || {};
  if (hoja.tipo === 'vf') return { valor: typeof c.correcta === 'boolean' ? (Math.random() < 0.7 ? c.correcta : !c.correcta) : Math.random() < 0.5 };
  if (hoja.tipo === 'opcion') {
    const ops = c.opciones || [];
    const pesos = ops.map(o => (c.correctas || []).includes(o.id) ? 3 : 0.6 + Math.random());
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ops.length; i++) { r -= pesos[i]; if (r <= 0) return { opcion: ops[i].id }; }
    return { opcion: ops[0]?.id };
  }
  if (hoja.tipo === 'completar') {
    const n = Math.max(1, huecos(c.frase));
    return { textos: Array.from({ length: n }, (_, i) => {
      const ok = c.aceptadas?.[i] || [];
      if (ok.length && Math.random() < 0.65) return azar(ok);
      return azar(['no sé', ok[0] ? ok[0].slice(0, -1) || 'x' : 'algo', '50', 'otra cosa', ok[0] ? ok[0] + 's' : 'nada']);
    }) };
  }
  if (hoja.tipo === 'lluvia') return { texto: azar(IDEAS.slice(0, 8 + Math.floor(Math.random() * 12))) };
  return { texto: azar(FRASES) };
}
