// ============================================================
// Piezas de juego compartidas (alumno y en vivo)
// ============================================================
import { $, $$, esc, activarZoom, TIPOS } from './comun.js';

// ---------- Sonidos ----------
let ctx = null;
function audio() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
export function tono(tipo) {
  try {
    const c = audio();
    const notas = tipo === 'correcto' ? [[523, 0], [659, .08], [784, .16]] : [[300, 0], [180, .12]];
    notas.forEach(([f, t]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = tipo === 'correcto' ? 'sine' : 'sawtooth';
      o.frequency.value = f; g.gain.value = tipo === 'correcto' ? 0.13 : 0.08;
      const ini = c.currentTime + t;
      o.start(ini); g.gain.exponentialRampToValueAtTime(0.001, ini + 0.28); o.stop(ini + 0.3);
    });
  } catch { }
}
export function tic(urgente) {
  try {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'square'; o.frequency.value = urgente ? 1400 : 1000; g.gain.value = urgente ? 0.05 : 0.025;
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); o.stop(c.currentTime + 0.09);
  } catch { }
}

// ---------- Música de fondo ----------
let musica = null, nodos = null, sonando = false;
export function musicaActiva() { return localStorage.getItem('quiz_musica') !== '0'; }
export function iniciarMusica() {
  if (sonando || !musicaActiva()) return;
  sonando = true;
  if (!musica) { musica = new Audio('musica-fondo.mp3'); musica.loop = true; musica.volume = 0.3; }
  musica.play().catch(() => {
    try {
      const c = audio(), o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o1.frequency.value = 110; o2.frequency.value = 165; g.gain.value = 0.03;
      o1.connect(g); o2.connect(g); g.connect(c.destination); o1.start(); o2.start();
      nodos = [o1, o2];
    } catch { }
  });
}
export function detenerMusica() {
  sonando = false;
  if (musica) { musica.pause(); musica.currentTime = 0; }
  if (nodos) { nodos.forEach(n => n.stop()); nodos = null; }
}
export function alternarMusica() {
  const activa = !musicaActiva();
  localStorage.setItem('quiz_musica', activa ? '1' : '0');
  if (activa) iniciarMusica(); else detenerMusica();
  return activa;
}

// ---------- Voz ----------
export function vozActiva() { return localStorage.getItem('quiz_voz_pregunta') === '1'; }
export function alternarVoz() { const v = !vozActiva(); localStorage.setItem('quiz_voz_pregunta', v ? '1' : '0'); return v; }
function textoParaVoz(t) { return String(t || '').replace(/_{2,}\s*$/g, '').replace(/_{2,}/g, ', espacio, '); }
export function decir(texto, alTerminar) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(textoParaVoz(texto));
    u.lang = 'es-ES'; u.rate = 1;
    if (alTerminar) { u.onend = alTerminar; u.onerror = alTerminar; }
    speechSynthesis.speak(u);
  } catch { if (alTerminar) alTerminar(); }
}
export function callar() { try { speechSynthesis.cancel(); } catch { } }

// ---------- Cronómetro circular ----------
export function cronometro(cont, segundos, { alTerminar, sonido = true } = {}) {
  const C = 2 * Math.PI * 22;
  cont.innerHTML = `<div style="position:relative; width:52px; height:52px;">
    <svg viewBox="0 0 50 50" style="transform:rotate(-90deg); width:100%; height:100%;">
      <circle cx="25" cy="25" r="22" fill="none" stroke="var(--line)" stroke-width="5"></circle>
      <circle data-arco cx="25" cy="25" r="22" fill="none" stroke="var(--primary)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" style="transition:stroke-dashoffset 1s linear;"></circle></svg>
    <span data-num class="titulo" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--primary-dark); font-size:15px;">${segundos}</span></div>`;
  let resto = segundos, id = null;
  const arco = $('[data-arco]', cont), num = $('[data-num]', cont);
  const api = {
    iniciar() {
      if (id) return;
      id = setInterval(() => {
        resto--;
        num.textContent = Math.max(0, resto);
        arco.setAttribute('stroke-dashoffset', C * (1 - Math.max(0, resto) / segundos));
        if (resto <= 3 && resto > 0) { arco.style.stroke = 'var(--red-strong)'; if (sonido) tic(true); }
        else if (resto > 0 && sonido) tic(false);
        if (resto <= 0) { api.detener(); if (alTerminar) alTerminar(); }
      }, 1000);
    },
    detener() { clearInterval(id); id = null; },
    restante: () => resto
  };
  return api;
}

// ---------- Dibujo de una pregunta ----------
// p: pregunta pública {id, tipo, enunciado, imagen_url, subtema, opciones, espacios}
// op.onResponder(opcionesIds, textos) → se llama una sola vez
export function pintarPregunta(cont, p, { onResponder, numero = '', colores = false } = {}) {
  const tipo = TIPOS[p.tipo] || { nombre: p.tipo, ico: '' };
  let enunciadoHtml = `<p class="titulo" style="font-size:20px; margin:6px 0 16px; line-height:1.4; white-space:pre-wrap;">${numero}${esc(p.enunciado)}</p>`;
  let cuerpo = '';
  const coloresKahoot = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#864CBF', '#0AA3A3', '#E05D00', '#7A5C3E'];
  const figuras = ['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚'];

  if (p.tipo === 'completar') {
    const partes = String(p.enunciado).split(/_{2,}/);
    if (partes.length > 1) {
      enunciadoHtml = `<p class="titulo" style="font-size:20px; margin:6px 0 16px; line-height:2;">${numero}${partes.map((t, i) => esc(t) + (i < partes.length - 1 ? `<input class="input" data-blank="${i}" autocomplete="off" autocapitalize="none" style="display:inline-block; width:auto; min-width:110px; max-width:220px; padding:4px 10px; margin:0 4px; font-size:16px;">` : '')).join('')}</p>`;
      cuerpo = `<button class="btn btn-primary btn-block" data-enviar>Responder</button>`;
    } else {
      cuerpo = `<input class="input" data-blank="0" placeholder="Escribe tu respuesta..." autocomplete="off" style="margin-bottom:12px;"><button class="btn btn-primary btn-block" data-enviar>Responder</button>`;
    }
  } else if (p.tipo === 'lluvia_ideas') {
    cuerpo = `<textarea class="input" data-idea maxlength="300" placeholder="Escribe tu idea..." style="min-height:90px;"></textarea>
      <button class="btn btn-primary btn-block" data-enviar style="margin-top:10px;">💭 Enviar mi idea</button>`;
  } else {
    cuerpo = (p.multiple ? '<p class="small muted" style="font-weight:800; margin-bottom:8px;">Puedes marcar varias respuestas</p>' : '') +
      p.opciones.map((o, i) => `<button class="opcion" data-op="${o.id}" ${colores ? `style="border-left:8px solid ${coloresKahoot[i % 8]};"` : ''}>
        ${colores ? `<span style="color:${coloresKahoot[i % 8]}; margin-right:6px;">${figuras[i % 8]}</span>` : ''}${esc(o.texto)}
        ${o.imagen_url ? `<img src="${esc(o.imagen_url)}" alt="">` : ''}</button>`).join('') +
      (p.multiple ? '<button class="btn btn-primary btn-block" data-enviar>Responder</button>' : '');
  }

  cont.innerHTML = `
    <div class="row" style="gap:6px; margin-bottom:6px;">${p.subtema ? `<span class="badge">${esc(p.subtema)}</span>` : ''}<span class="badge gray">${tipo.ico} ${tipo.nombre}</span></div>
    ${p.imagen_url ? `<img class="zoom" src="${esc(p.imagen_url)}" alt="" title="Toca para ampliar">` : ''}
    ${enunciadoHtml}
    <div data-zona>${cuerpo}</div>
    <div data-feedback></div>`;
  activarZoom(cont);

  let respondida = false;
  const responder = (ids, textos) => {
    if (respondida) return;
    respondida = true;
    deshabilitar(cont);
    onResponder(ids, textos);
  };
  const seleccion = new Set();
  $$('[data-op]', cont).forEach(b => b.onclick = () => {
    if (p.multiple) { b.classList.toggle('sel'); b.classList.contains('sel') ? seleccion.add(b.dataset.op) : seleccion.delete(b.dataset.op); }
    else { b.classList.add('sel'); responder([b.dataset.op], []); }
  });
  const enviar = $('[data-enviar]', cont);
  if (enviar) enviar.onclick = () => {
    if (p.tipo === 'opcion_multiple') { if (!seleccion.size) return; responder([...seleccion], []); }
    else if (p.tipo === 'completar') {
      const textos = $$('[data-blank]', cont).map(i => i.value.trim());
      if (textos.every(t => !t)) return;
      responder([], textos);
    } else if (p.tipo === 'lluvia_ideas') {
      const t = $('[data-idea]', cont).value.trim(); if (!t) return;
      responder([], [t]);
    }
  };
  $$('[data-blank]', cont).forEach((inp, i, todos) => inp.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (todos[i + 1]) todos[i + 1].focus(); else enviar.click(); }
  });
  const primero = $('[data-blank], [data-idea]', cont);
  if (primero) setTimeout(() => primero.focus(), 100);

  return {
    yaRespondida: () => respondida,
    // se acabó el tiempo: envía lo que haya escrito/marcado
    forzar() {
      if (respondida) return;
      if (p.tipo === 'completar') responder([], $$('[data-blank]', cont).map(i => i.value.trim()));
      else if (p.tipo === 'lluvia_ideas') responder([], [$('[data-idea]', cont).value.trim()].filter(Boolean));
      else responder([...seleccion], []);
    }
  };
}

export function deshabilitar(cont) {
  $$('button.opcion, [data-blank], [data-idea], [data-enviar]', cont).forEach(e => { e.disabled = true; });
}

// r: respuesta del servidor {mostrar, es_correcta, correcta_texto, correctas_ids, explicacion, puntos}
export function mostrarCorreccion(cont, p, r, { voz = true, extra = '' } = {}) {
  const fb = $('[data-feedback]', cont);
  if (p.tipo === 'lluvia_ideas') {
    fb.innerHTML = `<div class="feedback neutro">💭 ¡Idea enviada! ${extra}</div>`;
    return;
  }
  if (r.mostrar === false) {
    fb.innerHTML = `<div class="feedback neutro">✔ Respuesta registrada</div>`;
    return;
  }
  const ok = r.es_correcta === true;
  const parcial = !ok && Number(r.fraccion) > 0;
  (r.correctas_ids || []).forEach(id => { const b = $(`[data-op="${id}"]`, cont); if (b) b.classList.add('correcta'); });
  $$('[data-op].sel', cont).forEach(b => { if (!(r.correctas_ids || []).includes(b.dataset.op)) b.classList.add('incorrecta'); });
  $$('[data-blank]', cont).forEach(i => { i.style.borderColor = ok ? 'var(--green-strong)' : 'var(--red-strong)'; });
  tono(ok || parcial ? 'correcto' : 'incorrecto');
  fb.innerHTML = `<div class="feedback ${ok ? 'bien' : 'mal'}">
    ${ok ? '✅ ¡Correcto!' : parcial ? `🟡 Parcialmente correcto (${Math.round(r.fraccion * 100)}%)` : '❌ Incorrecto'}
    ${r.puntos != null && Number(r.puntos) > 0 ? ` +${Number(r.puntos)} pts` : ''} ${extra}
    ${!ok && r.correcta_texto ? `<div style="margin-top:4px;">La respuesta correcta: <b>${esc(r.correcta_texto)}</b></div>` : ''}
    ${r.explicacion ? `<div style="margin-top:6px; font-weight:700; color:var(--ink);">💡 ${esc(r.explicacion)}</div>` : ''}</div>`;
  if (voz) decir(ok ? `Correcto${r.correcta_texto ? '. Es ' + r.correcta_texto : ''}` : `Incorrecto${r.correcta_texto ? '. Es ' + r.correcta_texto : ''}`);
}
