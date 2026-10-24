// ============================================================
// Proyectos en grupo: modo presentación (pantalla completa, sin participantes reales)
// Se avanza con las flechas, la barra espaciadora, un clic o deslizando el dedo.
// En un celular en vertical se usa el acomodo para celular.
// En las hojas de preguntas, "Simular participantes" genera respuestas falsas (no se guarda nada).
// ============================================================
import { pintarHoja, pintarHojaMovil, repintarElemento } from './lienzo.js';
import { esPregunta, tieneCorrecta, crearSimulacion } from './preguntas.js';

const esCelular = () => innerWidth < innerHeight && innerWidth < 820;

export function presentar(hojas, { inicio = 0, alSalir } = {}) {
  let i = Math.min(Math.max(0, inicio), hojas.length - 1);
  let sim = null, tSim = null, formato = null, lienzo = null;
  const ov = document.createElement('div');
  ov.className = 'pres';
  ov.innerHTML = `<div class="escenario" data-esc><div class="marco" data-marco></div></div>
    <div class="pres-ctrl">
      <button data-ant title="Anterior (←)" aria-label="Hoja anterior">◀</button>
      <span class="cont" data-cont></span>
      <button data-sig title="Siguiente (→)" aria-label="Hoja siguiente">▶</button>
      <span class="pres-preg" data-preg hidden>
        <button data-sim title="Simular participantes (respuestas falsas, no se guardan)">🎭<span class="pres-txt"> Simular</span></button>
        <span class="cont" data-gente hidden></span>
        <button data-cerrar-r title="Cerrar o abrir las respuestas">🔒</button>
        <button data-revelar title="Revelar la respuesta correcta">👁<span class="pres-txt"> Revelar</span></button>
      </span>
      <button data-pc title="Pantalla completa (F)" aria-label="Pantalla completa">⛶</button>
      <button data-salir title="Salir (Esc)" aria-label="Salir de la presentación">✕</button>
    </div>`;
  document.body.appendChild(ov);
  const $ = (s) => ov.querySelector(s);
  const hoja = () => hojas[i];
  const res = () => sim && esPregunta(hoja().tipo) ? sim.estado(hoja()) : null;

  const pintar = () => {
    const esc = $('[data-esc]');
    formato = esCelular() ? 'movil' : 'web';
    esc.classList.toggle('movil', formato === 'movil');
    let marco = $('[data-marco]');
    marco.classList.remove('entra'); void marco.offsetWidth; marco.classList.add('entra');
    lienzo = formato === 'movil'
      ? pintarHojaMovil(marco, hoja(), { modo: 'ver', res: res() }).lienzo
      : pintarHoja(marco, hoja(), { modo: 'ver', res: res() });
    pintarControles();
  };
  // solo la zona de respuestas (para no recargar videos ni imágenes)
  const pintarZona = () => {
    const z = hoja().diseno.elementos.find(e => e.tipo === 'zona');
    if (z && lienzo) repintarElemento(lienzo, z, 'ver', { hoja: hoja(), res: res() });
    pintarControles();
  };
  const pintarControles = () => {
    $('[data-cont]').textContent = `${i + 1} / ${hojas.length}`;
    $('[data-ant]').disabled = i === 0;
    $('[data-sig]').disabled = i === hojas.length - 1;
    const preg = esPregunta(hoja().tipo);
    $('[data-preg]').hidden = !preg;
    if (!preg) return;
    const e = res();
    $('[data-sim]').classList.toggle('activo', !!sim);
    $('[data-gente]').hidden = !sim;
    if (sim) $('[data-gente]').textContent = `👥 ${sim.participantes.length}`;
    $('[data-cerrar-r]').disabled = !e;
    $('[data-cerrar-r]').textContent = e?.cerrado ? '🔓' : '🔒';
    $('[data-cerrar-r]').title = e?.cerrado ? 'Abrir las respuestas' : 'Cerrar las respuestas';
    $('[data-revelar]').hidden = !tieneCorrecta(hoja());
    $('[data-revelar]').disabled = !e;
    $('[data-revelar]').classList.toggle('activo', !!e?.revelar);
  };
  const mostrar = (n) => {
    if (n < 0 || n >= hojas.length) return;
    i = n;
    pintar();
  };
  // cada 0,45 s llegan 1 o 2 respuestas simuladas a la hoja actual
  const latido = () => {
    clearTimeout(tSim);
    if (!sim) return;
    if (esPregunta(hoja().tipo) && sim.paso(hoja())) pintarZona();
    tSim = setTimeout(latido, 450);
  };
  $('[data-sim]').onclick = () => {
    if (sim) { sim = null; clearTimeout(tSim); pintar(); return; }
    sim = crearSimulacion();
    pintar();
    latido();
  };
  $('[data-cerrar-r]').onclick = () => { const e = res(); if (e) { e.cerrado = !e.cerrado; pintarZona(); } };
  $('[data-revelar]').onclick = () => { const e = res(); if (e) { e.revelar = !e.revelar; pintarZona(); } };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else ov.requestFullscreen?.().catch(() => {});
  };
  const alRedimensionar = () => { if ((esCelular() ? 'movil' : 'web') !== formato) pintar(); };
  const cerrar = () => {
    clearTimeout(tSim); sim = null;
    document.removeEventListener('keydown', tecla);
    removeEventListener('resize', alRedimensionar);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    ov.remove();
    alSalir && alSalir(i);
  };
  const tecla = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); mostrar(i + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); mostrar(i - 1); }
    else if (e.key === 'Home') mostrar(0);
    else if (e.key === 'End') mostrar(hojas.length - 1);
    else if (e.key === 'Escape') cerrar();
    else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
  };
  document.addEventListener('keydown', tecla);
  addEventListener('resize', alRedimensionar);
  $('[data-ant]').onclick = () => mostrar(i - 1);
  $('[data-sig]').onclick = () => mostrar(i + 1);
  $('[data-pc]').onclick = pantallaCompleta;
  $('[data-salir]').onclick = cerrar;

  // clic: tercio izquierdo retrocede, el resto avanza; deslizar con el dedo también
  const esc = $('[data-esc]');
  let x0 = null, y0 = null;
  esc.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  esc.addEventListener('pointerup', (e) => {
    if (x0 == null || e.target.closest('.pe-video, .movil-scroll .pe-zona')) { x0 = null; return; }
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { mostrar(dx < 0 ? i + 1 : i - 1); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const r = esc.getBoundingClientRect();
      mostrar(e.clientX < r.left + r.width / 3 ? i - 1 : i + 1);
    }
  });

  // los controles se ocultan si el mouse no se mueve
  let t;
  const despertar = () => { ov.classList.remove('quieto'); clearTimeout(t); t = setTimeout(() => ov.classList.add('quieto'), 2500); };
  ov.addEventListener('pointermove', despertar);
  despertar();

  pantallaCompleta();
  mostrar(i);
  return { cerrar, ir: mostrar };
}
