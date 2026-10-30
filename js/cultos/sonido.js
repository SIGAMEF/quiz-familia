// ============================================================
// Cultos: sonido de fondo (pad suave en bucle), generado con WebAudio: no se descarga nada.
// Suena en la consola (el equipo del operador), siempre empieza apagado y se enciende con 🔊 Sonido.
// Cada ambiente es un acorde largo con osciladores un poco desafinados, un filtro que "respira" y
// entrada y salida suaves.
// ============================================================
export const AMBIENTES = {
  calido: { nombre: 'Cálido', notas: [130.81, 196.0, 261.63, 329.63, 392.0] },        // Do mayor abierto
  celestial: { nombre: 'Celestial', notas: [220.0, 277.18, 329.63, 440.0, 659.25] },   // La mayor, alto
  profundo: { nombre: 'Profundo', notas: [98.0, 146.83, 196.0, 233.08, 293.66] },     // Sol menor, grave
  esperanza: { nombre: 'Esperanza', notas: [146.83, 220.0, 293.66, 369.99, 440.0] }    // Re mayor
};

let ctx = null, salida = null, voces = [], actual = null, vol = 0.5;

function crearContexto() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Este navegador no puede generar sonido.');
  ctx = new AC();
  salida = ctx.createGain();
  salida.gain.value = 0;
  // un eco corto para que suene más amplio
  const eco = ctx.createDelay(1); eco.delayTime.value = 0.32;
  const re = ctx.createGain(); re.gain.value = 0.28;
  salida.connect(ctx.destination); salida.connect(eco); eco.connect(re); re.connect(eco); re.connect(ctx.destination);
  return ctx;
}

function apagarVoces(seg = 2) {
  const t = ctx.currentTime;
  for (const v of voces) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + seg); v.osc.forEach(o => o.stop(t + seg + 0.1)); } catch { /* ya parada */ } }
  voces = [];
}

// Enciende (o cambia) el ambiente. Debe llamarse desde un clic (los navegadores lo exigen).
export async function sonar(tipo = 'calido') {
  crearContexto();
  if (ctx.state === 'suspended') await ctx.resume();
  const a = AMBIENTES[tipo] || AMBIENTES.calido;
  if (actual === tipo && voces.length) return;
  apagarVoces(2.5);
  actual = tipo;
  const t = ctx.currentTime;
  a.notas.forEach((f, k) => {
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 650 + k * 90; filtro.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + k * 0.013;
    const lfoG = ctx.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(filtro.frequency);
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.11 / Math.sqrt(a.notas.length) * (k === 0 ? 1.4 : 1), t + 4 + k * 0.6);
    const osc = [-6, 0, 7].map(c => { const o = ctx.createOscillator(); o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = c; o.connect(filtro); o.start(t); return o; });
    filtro.connect(g); g.connect(salida);
    lfo.start(t); osc.push(lfo);
    voces.push({ g, osc });
  });
  salida.gain.cancelScheduledValues(t);
  salida.gain.setValueAtTime(salida.gain.value, t);
  salida.gain.linearRampToValueAtTime(vol, t + 1.5);
}

export function callar() {
  if (!ctx) return;
  apagarVoces(2);
  actual = null;
}
export function volumen(v) {
  vol = Math.max(0, Math.min(1, Number(v) || 0));
  if (ctx && salida) { const t = ctx.currentTime; salida.gain.cancelScheduledValues(t); salida.gain.setValueAtTime(salida.gain.value, t); salida.gain.linearRampToValueAtTime(vol, t + 0.3); }
}
export const sonando = () => !!actual;
export const ambienteActual = () => actual;
