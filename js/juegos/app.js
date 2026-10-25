// ============================================================
// juegos.html?j=<juego>&s=<set>  — prepara y lanza un juego libre
// ============================================================
import { $, $$, esc, paisaje, formJugadores, sonar, alternarSonido, sonidoActivo, prefs, alFinalizarPartida, relojBarra, pantallaFinal, selectorEmoji, pararRelojTurno, fondo } from './util.js?v=202610242304';
import { contenidoSala, abrirSala, unirseSala } from './sala.js?v=202610242304';
import { imprimir, puedeImprimir } from './imprimir.js?v=202610242304';
import { sopaDe } from './sopa.js?v=202610242304';
import { imagenPuzzle } from './imagenes.js?v=202610242304';
import { JUEGOS, setsPara, buscarSet, conImagenes } from './contenido.js?v=202610242304';

const MODULOS = {
  ahorcado: () => import('./ahorcado.js?v=202610242304'), sopa: () => import('./sopa.js?v=202610242304'), memoria: () => import('./memoria.js?v=202610242304'),
  ordena: () => import('./ordena.js?v=202610242304'), quiz: () => import('./quiz.js?v=202610242304'), trivia: () => import('./quiz.js?v=202610242304'), relampago: () => import('./quiz.js?v=202610242304'),
  frase: () => import('./frase.js?v=202610242304'), rompecabezas: () => import('./rompecabezas.js?v=202610242304'), quizpublico: () => import('./quizlibre.js?v=202610242304')
};
// Opciones de cada juego
const OPCIONES = {
  ahorcado: { jugadores: true, campo: 'cantidad', titulo: 'Palabras', valores: [[4, '4'], [6, '6'], [10, '10']], def: 6,
    reglas: ['Se turnan para elegir letras.', 'Letra correcta: un punto por cada vez que aparece, y sigues tú.', 'Letra incorrecta: el cangurito pierde energía y pasa el turno.', 'Quien completa la palabra gana 2 puntos más.', 'Cada jugador tiene 3 pistas: cada una destapa una letra.',
      'Fácil: el teclado marca las letras que ya salieron. Difícil: no se marcan, y repetir una letra cuenta como error.', 'Con tiempo por turno: si se acaba, le toca al siguiente.'] },
  sopa: { jugadores: false, campo: 'nivel', titulo: 'Dificultad', valores: [['facil', '🟢 Fácil'], ['medio', '🟡 Medio'], ['dificil', '🔴 Difícil']], def: 'facil',
    reglas: ['Busca las palabras de la lista dentro de la sopa.', 'Fácil: horizontal y vertical. Medio: también en diagonal. Difícil: en todas las direcciones, incluso al revés.', 'Mientras más rápido termines, más puntos.'] },
  memoria: { jugadores: true, campo: 'parejas', titulo: 'Parejas', valores: [[6, '6'], [8, '8'], [10, '10']], def: 6,
    reglas: ['Voltea dos cartas. Si forman pareja, son tuyas y vuelves a jugar.', 'Si no, se tapan otra vez y pasa el turno.', 'Gana quien junte más parejas.'] },
  ordena: { jugadores: false, campo: 'cantidad', titulo: 'Palabras', valores: [[5, '5'], [8, '8'], [12, '12']], def: 8,
    reglas: ['Toca las letras en el orden correcto para armar la palabra.', 'Lee la pista si no sabes cuál es.', '“Una letra” te ayuda, pero da menos puntos.'] },
  quiz: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10']], def: 10,
    reglas: ['Tienes 15 segundos por pregunta (puedes cambiarlo en “Tiempo por pregunta”). Faltando 5 segundos suena un aviso.', 'Respuesta correcta: 500 puntos más un bono por rapidez.'] },
  trivia: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10']], def: 10,
    reglas: ['Tienes 15 segundos por pregunta (puedes cambiarlo en “Tiempo por pregunta”). Faltando 5 segundos suena un aviso.', 'Respuesta correcta: 500 puntos más un bono por rapidez.'] },
  frase: { jugadores: false, campo: 'cantidad', titulo: 'Frases', valores: [[4, '4'], [6, '6'], [8, '8']], def: 6,
    reglas: ['Toca las palabras en el orden correcto para formar la frase.', 'La pista te dice de qué trata (o la cita, en los versículos).', '“Una palabra” te ayuda, pero da menos puntos.'] },
  rompecabezas: { jugadores: false, campo: 'piezas', titulo: 'Piezas', valores: [[3, '3 × 3'], [4, '4 × 4'], [5, '5 × 5']], def: 3,
    reglas: ['Toca una pieza y luego otra para cambiarlas de lugar.', 'Las piezas que ya están en su sitio se marcan en verde.', 'Con “Una foto de la familia” puedes armar tu propia foto.'] },
  quizpublico: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10'], [999, 'Todas']], def: 10,
    reglas: ['Responde cada pregunta y mira si acertaste.', 'Hay preguntas de una o varias respuestas, verdadero o falso y para completar.'] }
};
OPCIONES.relampago = OPCIONES.quiz;
const TIEMPOS = [[0, 'Sin límite'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']];
// Tiempo de cada turno (o de cada pregunta en los quizzes); al acabarse le toca al siguiente
const TURNOS = [[0, 'Sin límite'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [60, '1 min']];
const ES_QUIZ = (j) => ['quiz', 'trivia', 'relampago', 'quizpublico'].includes(j);

// Segmento de tiempos con la opción "✏️ Personalizado" (un número en minutos o segundos).
// alCambiar(segundos) se llama al elegir una opción o al escribir el número.
function segmentoTiempo(caja, { lista, segundos, unidad, min, max, etiqueta, alCambiar }) {
  const factor = unidad === 'min' ? 60 : 1;
  const propio = !lista.some(([v]) => v === segundos);
  caja.innerHTML = `<div class="segmento" role="group" aria-label="${esc(etiqueta)}">${lista.map(([v, t]) => `<button type="button" data-t="${v}" aria-pressed="${!propio && v === segundos}">${t}</button>`).join('')}
      <button type="button" data-t="propio" aria-pressed="${propio}">✏️ Personalizado</button></div>
    <div class="tiempo-propio" data-propio ${propio ? '' : 'hidden'}><input class="input" type="number" inputmode="numeric" min="${min}" max="${max}" step="1"
      value="${propio ? Math.round(segundos / factor * 10) / 10 : (unidad === 'min' ? 4 : 25)}" aria-label="${esc(etiqueta)} en ${unidad === 'min' ? 'minutos' : 'segundos'}"> <span>${unidad === 'min' ? 'minutos' : 'segundos'} (de ${min} a ${max})</span></div>`;
  const inp = $('input', caja), fila = $('[data-propio]', caja);
  const leerPropio = () => { const n = Math.min(max, Math.max(min, Number(inp.value) || min)); return Math.round(n * factor); };
  $$('[data-t]', caja).forEach(b => b.onclick = () => {
    $$('[data-t]', caja).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    fila.hidden = b.dataset.t !== 'propio';
    if (b.dataset.t === 'propio') { inp.focus(); alCambiar(leerPropio()); } else alCambiar(Number(b.dataset.t));
  });
  inp.oninput = () => alCambiar(leerPropio());
  inp.onchange = () => { inp.value = leerPropio() / factor; alCambiar(leerPropio()); };
}
const INFO_QUIZ = { nombre: 'Quiz', ico: '📝', desc: 'Un quiz compartido por un profesor. ¡Demuestra cuánto sabes!' };

const PREVIA = !!window.__VISTA_PREVIA__;
const INICIO = PREVIA ? './' : 'index.html';
// juegos.html?j=ahorcado&s=animales  (o #ahorcado.animales en la vista previa)
// juegos.html?g=<juego de un profesor>   ?jp=<juego asignado al grupo>   ?q=<quiz público>
const params = new URLSearchParams(location.search);
const [hJ, hS] = location.hash.slice(1).split('.');
if (!params.get('j') && hJ) { params.set('j', hJ); if (hS) params.set('s', hS); }
const ID_JUEGO = params.get('g'), ID_PUB = params.get('jp'), ID_QUIZ = params.get('q'), PIN_SALA = params.get('sala');
const REMOTO = !!(ID_JUEGO || ID_PUB || ID_QUIZ);
const barra = $('#barraTiempo');
const cont = $('#juego');
const volverA = ID_PUB ? 'alumno.html' : INICIO + '#juegos';

let api = null;   // supabase, solo si hace falta (la vista previa no lo usa)
async function rpc(nombre, args) {
  if (!api) api = await import('../comun.js');
  const { data, error } = await api.supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}
// Aviso instantáneo entre los dispositivos de una sala (Supabase Realtime, sin tocar la base)
async function canal(nombre, alAviso) {
  if (!api) api = await import('../comun.js');
  const ch = api.supabase.channel(nombre, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'aviso' }, () => alAviso()).subscribe();
  return {
    avisar: () => { try { ch.send({ type: 'broadcast', event: 'aviso', payload: {} }).catch(() => {}); } catch { /* sin tiempo real */ } },
    cerrar: () => { try { api.supabase.removeChannel(ch); } catch { /* ya cerrado */ } }
  };
}
const aSet = (j) => ({ ...j.datos, id: j.id, remoto: true, tipo: j.tipo, titulo: j.titulo, tema: j.tema, categoria: j.tema || '', autor: j.autor, ico: JUEGOS[j.tipo]?.ico || '🎲', publicacion_id: j.publicacion_id, segundos: j.segundos || null });

let juego = MODULOS[params.get('j')] && params.get('j') !== 'quizpublico' ? params.get('j') : 'ahorcado';
let fijo = null;        // set único cuando se abre un juego concreto (g, jp, q)
let perfil = null;      // alumno que juega un juego asignado

const bSon = $('#bSonido');
const pintarSon = () => { bSon.textContent = sonidoActivo() ? '🔊' : '🔇'; bSon.setAttribute('aria-label', sonidoActivo() ? 'Silenciar' : 'Activar sonido'); };
bSon.onclick = () => { alternarSonido(); pintarSon(); };
pintarSon();
paisaje();

function encabezado() {
  const info = juego === 'quizpublico' ? INFO_QUIZ : JUEGOS[juego];
  document.title = `${fijo ? fijo.titulo + ' · ' : ''}${info.nombre} · Quiz Familia Marroquín`;
  $('#nombreJuego').textContent = `${info.ico} ${info.nombre}`;
  return info;
}

async function arrancar() {
  if (PIN_SALA) {
    $('#nombreJuego').textContent = '🌐 Sala en línea';
    return unirseSala({ rpc, canal, cont, barra, volverA: INICIO }, PIN_SALA);
  }
  if (!REMOTO) return preparar();
  cont.innerHTML = '<div class="tabla-juego center" style="padding:40px;">Cargando el juego…</div>';
  try {
    if (ID_QUIZ) {
      const r = await rpc('quiz_libre', { p_quiz: ID_QUIZ });
      juego = 'quizpublico';
      fijo = { id: r.quiz.id, remoto: true, titulo: r.quiz.titulo, tema: r.quiz.tema, categoria: r.quiz.tema || '', autor: r.quiz.autor, ico: '📝', preguntas: r.preguntas };
    } else if (ID_PUB) {
      perfil = await api_perfil();
      const j = await rpc('juego_de_publicacion', { p_pub: ID_PUB });
      juego = j.tipo; fijo = aSet(j);
      registrarAlTerminar = ({ jugadores, detalle }) => {
        rpc('registrar_juego', { p_pub: ID_PUB, p_puntaje: jugadores[0].puntos, p_detalle: detalle, p_segundos: Math.round((Date.now() - inicioPartida) / 1000) })
          .then(() => { const d = document.querySelector('.final-detalle'); if (d) d.insertAdjacentHTML('afterend', '<p class="final-detalle">✅ Tu resultado quedó guardado para tu profesor.</p>'); })
          .catch(() => {});
      };
    } else {
      const j = await rpc('juego_libre', { p_id: ID_JUEGO });
      if (!j) throw new Error('Este juego no existe o no es público.');
      juego = j.tipo; fijo = aSet(j);
      if (j.publico) rpc('juego_jugado', { p_id: j.id }).catch(() => {});
    }
  } catch (e) {
    cont.innerHTML = `<div class="tabla-juego center" style="padding:30px;"><div style="font-size:48px;">🙈</div><h2>No se pudo abrir el juego</h2>
      <p class="ordena-pista">${esc(e.message || String(e))}</p><a class="b3 azul" href="${volverA}" style="display:inline-block; text-decoration:none; margin-top:10px;">Volver</a></div>`;
    encabezado();
    return;
  }
  preparar();
}
async function api_perfil() { if (!api) api = await import('../comun.js'); try { return await api.miPerfil(); } catch { return null; } }

let inicioPartida = Date.now();
let registrarAlTerminar = null;   // juego asignado por el profesor: guarda el resultado
let relojLocal = null;
const cacheRemotos = new Map();
async function setCompleto(id) {
  const local = !fijo && setsPara(juego).find(s => s.id === id);
  if (local) return local;
  if (fijo && fijo.id === id) return fijo;
  if (!cacheRemotos.has(id)) {
    if (juego === 'quiz') {
      const r = await rpc('quiz_libre', { p_quiz: id });
      cacheRemotos.set(id, { id, remoto: true, titulo: r.quiz.titulo, tema: r.quiz.tema, categoria: r.quiz.tema || '', autor: r.quiz.autor, ico: '📝', preguntas: r.preguntas });
    } else cacheRemotos.set(id, aSet(await rpc('juego_libre', { p_id: id })));
  }
  return cacheRemotos.get(id);
}

function preparar() {
  const info = encabezado();
  const op = OPCIONES[juego];
  const sets = fijo ? [fijo] : setsPara(juego);
  let setId = fijo ? fijo.id : (buscarSet(juego, params.get('s'))?.id || prefs.leer(`set_${juego}`, sets[0].id));
  if (!fijo && !buscarSet(juego, setId)) setId = sets[0].id;
  let valor = prefs.leer(`op_${juego}`, op.def);
  if (fijo && juego === 'rompecabezas' && fijo.piezas) valor = fijo.piezas;
  const sopaFija = juego === 'sopa' && fijo && fijo.grilla;
  const unJugador = !!ID_PUB;
  let sopaImpresa = null;   // la misma sopa para la ficha y el solucionario
  let segundos = fijo && fijo.segundos ? Number(fijo.segundos) : Number(prefs.leer(`tiempo_${juego}`, 0)) || 0;
  segundos = Math.min(3600, Math.max(0, segundos));
  if (segundos && segundos < 60) segundos = 60;     // el personalizado va de 1 a 60 minutos
  const esQuiz = ES_QUIZ(juego);
  let segTurno = Number(fijo?.seg_turno ?? prefs.leer(`turno_${juego}`, esQuiz && juego !== 'quizpublico' ? 15 : 0)) || 0;
  if (esQuiz && juego !== 'quizpublico' && !segTurno) segTurno = 15;
  let dificultad = juego === 'ahorcado' ? (fijo?.dificultad || prefs.leer('dificultad_ahorcado', 'facil')) : null;
  // lo que se suma a las opciones del juego: el tiempo por turno y, en el ahorcado, la dificultad
  const extra = () => ({ ...(segTurno ? { seg_turno: segTurno } : {}), ...(dificultad ? { nivel: dificultad } : {}) });

  cont.innerHTML = `
    <div class="portada-juego">
      <div class="rotulo-tabla grande">${esc(fijo ? fijo.titulo : info.nombre)}</div>
      <p class="lema">${fijo ? `${esc(info.nombre)}${fijo.tema ? ' · ' + esc(fijo.tema) : ''}${fijo.autor ? ` · por ${esc(fijo.autor)}` : ''}` : esc(info.desc)}</p>
    </div>
    <div class="tabla-juego prep">
      ${fijo ? '' : `<h2>${juego === 'rompecabezas' ? 'Elige la imagen' : 'Elige el tema'}</h2>
      <div class="temas" role="radiogroup" aria-label="Tema" data-temas>${sets.map(s => botonTema(s, setId)).join('')}</div>`}
      ${op.jugadores && !unJugador ? '<h2>¿Quiénes juegan?</h2><div data-jug></div>' : ''}
      ${sopaFija ? `<p class="ordena-pista">Sopa de ${fijo.filas} × ${fijo.columnas} con ${fijo.ubicaciones.length} palabras.</p>` : `<h2>${esc(op.titulo)}</h2>
      <div class="segmento" role="group" aria-label="${esc(op.titulo)}">${op.valores.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(valor)}">${t}</button>`).join('')}</div>`}
      ${juego === 'sopa' ? '<div data-modo-sopa></div>' : ''}
      ${juego === 'ahorcado' ? `<h2>Dificultad</h2>
      <div class="segmento" role="group" aria-label="Dificultad">${[['facil', '🟢 Fácil'], ['dificil', '🔴 Difícil']].map(([v, t]) => `<button type="button" data-dif="${v}" aria-pressed="${v === dificultad}">${t}</button>`).join('')}</div>
      <p class="hint" data-dif-txt></p>` : ''}
      <h2>⏱ Tiempo para jugar</h2>
      <div data-tiempo></div>
      ${fijo && fijo.segundos ? `<p class="hint" style="margin-top:4px;">El profesor sugiere ${Math.round(fijo.segundos / 60 * 10) / 10} min.</p>` : ''}
      <h2>⏳ Tiempo por ${esQuiz ? 'pregunta' : 'turno'}</h2>
      <div data-turno></div>
      <p class="hint" style="margin-top:4px;">${esQuiz ? 'Faltando 5 segundos suena un aviso; al acabarse, pasa a la siguiente pregunta (y al siguiente jugador).' : 'Cada jugador tiene ese tiempo para mover. Faltando 5 segundos suena un aviso; al acabarse, le toca al siguiente.'}</p>
      <div class="modo-juego">
        <button class="b3 amarillo grande" data-jugar>▶ Jugar aquí</button>
        ${!ID_PUB && !PREVIA ? '<button class="b3 azul grande" data-enlinea>🌐 Jugar en línea con otros</button>' : ''}
      </div>
      ${!ID_PUB && !PREVIA ? '<p class="hint" style="text-align:center;">En línea: compartes un PIN y cada uno entra desde su celular. Juegan una sola partida por turnos, o todos a la vez.</p>' : ''}
      ${PREVIA ? '' : `<div class="final-botones imprimir-botones">${puedeImprimir(juego === 'quizpublico' ? 'quiz' : juego) ? `<button class="b3 azul chico" data-imp="0">🖨 Imprimir ficha</button>${juego === 'quizpublico' ? '' : '<button class="b3 morado chico" data-imp="1">🖨 Imprimir solución</button>'}` : ''}</div>`}
      <details class="reglas"><summary>Cómo se juega</summary><ul>${op.reglas.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>
    </div>`;
  // Sopa: buscar con palabras o con dibujos (si el tema tiene imágenes)
  let pistas = prefs.leer('pistas_sopa', 'palabras');
  const MODOS_SOPA = [['palabras', '🔤 Palabras'], ['imagenes', '🖼 Dibujos'], ['imagenes_desc', '🖼 Dibujos y pista']];
  const pintarModoSopa = async () => {
    const caja = $('[data-modo-sopa]', cont); if (!caja) return;
    let set; try { set = await setCompleto(setId); } catch { return; }
    const conFig = (set.palabras || []).filter(x => x.imagen).length >= (set.grilla ? 1 : 4);
    if (!conFig) { caja.innerHTML = ''; pistas = 'palabras'; return; }
    if (set.pistas && set.remoto && !caja.dataset.listo) pistas = set.pistas;
    caja.dataset.listo = '1';
    caja.innerHTML = `<h2>¿Qué se muestra para buscar?</h2><div class="segmento" role="group" aria-label="Pistas">${MODOS_SOPA.map(([v, t]) => `<button type="button" data-pistas="${v}" aria-pressed="${v === pistas}">${t}</button>`).join('')}</div>`;
    $$('[data-pistas]', caja).forEach(b => b.onclick = () => { pistas = b.dataset.pistas; sopaImpresa = null; prefs.guardar('pistas_sopa', pistas); $$('[data-pistas]', caja).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  };
  const activarTemas = () => $$('[data-s]', cont).forEach(b => b.onclick = () => {
    setId = b.dataset.s; sopaImpresa = null; $$('[data-s]', cont).forEach(x => x.setAttribute('aria-checked', String(x === b))); sonar.clic();
    pintarModoSopa();
  });
  pintarModoSopa();
  activarTemas();
  // temas públicos de los profesores para este juego
  if (!fijo && !PREVIA) {
    rpc('biblioteca_libre', { p_tipo: juego }).then(lista => {
      const caja = $('[data-temas]', cont); if (!caja || !lista.length) return;
      caja.insertAdjacentHTML('beforeend', lista.map(t => botonTema({ id: t.id, titulo: t.titulo, ico: JUEGOS[juego].ico, categoria: `${t.tema ? t.tema + ' · ' : ''}por ${t.autor}` }, setId)).join(''));
      activarTemas();
    }).catch(() => {});
  }
  segmentoTiempo($('[data-tiempo]', cont), { lista: TIEMPOS, segundos, unidad: 'min', min: 1, max: 60, etiqueta: 'Tiempo para jugar',
    alCambiar: (v) => { segundos = v; if (!fijo) prefs.guardar(`tiempo_${juego}`, segundos); } });
  segmentoTiempo($('[data-turno]', cont), { lista: esQuiz && juego !== 'quizpublico' ? TURNOS.slice(1) : TURNOS, segundos: segTurno, unidad: 's', min: 5, max: 300,
    etiqueta: `Tiempo por ${esQuiz ? 'pregunta' : 'turno'}`, alCambiar: (v) => { segTurno = v; if (!fijo) prefs.guardar(`turno_${juego}`, segTurno); } });
  const TXT_DIF = { facil: 'El teclado marca las letras que ya salieron.', dificil: 'No se marcan las letras que ya salieron: si repites una, pierdes el turno.' };
  const pintarDif = () => { const t = $('[data-dif-txt]', cont); if (t) t.textContent = TXT_DIF[dificultad]; };
  $$('[data-dif]', cont).forEach(b => b.onclick = () => {
    dificultad = b.dataset.dif; prefs.guardar('dificultad_ahorcado', dificultad); pintarDif();
    $$('[data-dif]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  pintarDif();
  $$('[data-v]', cont).forEach(b => b.onclick = () => {
    valor = b.dataset.v; sopaImpresa = null; $$('[data-v]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  const leerJug = op.jugadores && !unJugador ? formJugadores($('[data-jug]', cont), { etiqueta2: juego === 'ahorcado' ? '2 jugadores o equipos' : '2 jugadores' }) : null;
  $$('[data-imp]', cont).forEach(b => b.onclick = async () => {
    try {
      const set = await setCompleto(setId);
      const tipo = ['quizpublico', 'trivia', 'relampago'].includes(juego) ? 'quiz' : juego;
      if (juego === 'sopa' && !set.grilla && !sopaImpresa) sopaImpresa = sopaDe(set, valor, pistas);
      if (juego === 'rompecabezas' && set.id === 'foto') throw new Error('Para imprimir con una foto, primero créalo como juego en tu panel de profesor.');
      const imagen = juego === 'rompecabezas' && !set.imagen_url ? imagenPuzzle(set.id) : null;
      await imprimir(tipo, set, { solucion: b.dataset.imp === '1', sopa: set.grilla ? null : sopaImpresa, nivel: valor, piezas: valor, imagen, pistas });
    } catch (e) { alert(e.message); }
  });
  const bLinea = $('[data-enlinea]', cont);
  if (bLinea) bLinea.onclick = async () => {
    if (!fijo) { prefs.guardar(`set_${juego}`, setId); prefs.guardar(`op_${juego}`, valor); }
    try { await crearSalaEnLinea({ juego, setId, setCompletoFn: setCompleto, campo: op.campo, valor, pistas: juego === 'sopa' ? pistas : undefined, segundos, extra: extra() }); }
    catch (e) { alert(e.message || String(e)); preparar(); }
  };
  $('[data-jugar]', cont).onclick = async () => {
    const b = $('[data-jugar]', cont); b.disabled = true;
    try {
      if (!fijo) { prefs.guardar(`set_${juego}`, setId); prefs.guardar(`op_${juego}`, valor); }
      const guardado = prefs.leer('jugadores', [{ nombre: 'Tú', avatar: '🧒' }])[0];
      const jugadores = leerJug ? leerJug()
        : [{ nombre: perfil ? (perfil.nombre || perfil.usuario) : (guardado.nombre || 'Tú'), avatar: perfil?.avatar && !/^http/.test(perfil.avatar) ? perfil.avatar : (guardado.avatar || '🧒'), color: 'j1', puntos: 0 }];
      const set = await setCompleto(setId);
      if (!fijo && !PREVIA && !set.remoto) history.replaceState(null, '', `?j=${juego}&s=${setId}`);
      if (set.remoto && !fijo && juego !== 'quiz') rpc('juego_jugado', { p_id: set.id }).catch(() => {});
      let m = await MODULOS[juego]();
      // un quiz público elegido desde la lista se juega con el módulo de quiz del profesor
      if (juego === 'quiz' && set.remoto) m = await MODULOS.quizpublico();
      const lanzar = () => {
        window.scrollTo(0, 0); cont.classList.add('jugando'); inicioPartida = Date.now();
        const jugs = jugadores.map(j => ({ ...j }));
        const alMenu = () => { location.href = volverA; };
        if (relojLocal) relojLocal.ocultar();
        relojLocal = null; pararRelojTurno(); fondo.iniciar();
        alFinalizarPartida((info) => { if (relojLocal) relojLocal.ocultar(); if (registrarAlTerminar) registrarAlTerminar(info); });
        if (segundos) {
          relojLocal = relojBarra(barra, Date.now() + segundos * 1000, { total: segundos, alAcabar: () => {
            pantallaFinal(cont, { jugadores: jugs, titulo: '⏰ ¡Se acabó el tiempo!', detalle: 'Puntos logrados antes de que terminara el tiempo.', alRepetir: lanzar, alMenu });
          } });
        }
        m.iniciar(cont, { set, jugadores: jugs, opciones: { [op.campo]: valor, pistas: juego === 'sopa' ? pistas : undefined, ...extra() }, alMenu, alRepetir: lanzar });
      };
      lanzar();
    } catch (e) { b.disabled = false; alert(e.message || String(e)); }
  };
}
// ---------- Crear una sala en línea ----------
async function crearSalaEnLinea({ juego, setId, setCompletoFn, campo, valor, pistas, segundos, extra = {} }) {
  const set = await setCompletoFn(setId);
  let modo = prefs.leer('modo_sala', 'turnos') === 'carrera' ? 'carrera' : 'turnos';
  const armar = () => contenidoSala({ juego, set, campo, valor, pistas, modo, extra });
  armar();   // valida (por ejemplo, la foto propia no se puede compartir)
  const g = prefs.leer('jugadores', [{ nombre: '', avatar: '🧒' }])[0];
  const MODOS = [['turnos', '🎲 Por turnos', 'Una sola partida para todos. Cuando te toca, mueves tú desde tu celular; los demás miran el mismo tablero.'],
                 ['carrera', '🏁 Todos a la vez', 'Cada uno juega su propia partida al mismo tiempo y gana quien haga más puntos.']];
  cont.innerHTML = `<div class="tabla-juego">
      <div class="center"><div class="rotulo-tabla">🌐 Jugar en línea</div><p class="lema">${esc(set.titulo)} · ${segundos ? `⏱ ${Math.round(segundos / 60 * 10) / 10} min para todos` : 'sin límite de tiempo'}${extra.seg_turno ? ` · ⏳ ${extra.seg_turno} s por ${ES_QUIZ(juego) ? 'pregunta' : 'turno'}` : ''}${extra.nivel === 'dificil' ? ' · 🔴 Difícil' : ''}</p></div>
      <h2>¿Cómo juegan?</h2>
      <div class="segmento" role="group" aria-label="Modo de juego">${MODOS.map(([v, t]) => `<button type="button" data-modo="${v}" aria-pressed="${v === modo}">${t}</button>`).join('')}</div>
      <p class="hint" data-modo-txt>${MODOS.find(m => m[0] === modo)[2]}</p>
      <label class="check" style="margin-top:10px;"><input type="checkbox" data-juego checked> Yo también juego</label>
      <div data-mis-datos><label class="lbl" for="aliasHost">Tu nombre</label><input class="input" id="aliasHost" maxlength="30" value="${esc(g.nombre && g.nombre !== 'Jugador 1' ? g.nombre : '')}" placeholder="Ej: Mamá">
        <label class="lbl">Tu avatar</label><div data-av></div></div>
      <p class="err" data-err></p>
      <button class="b3 amarillo grande" data-crear>Crear sala y mostrar el PIN</button>
      <button class="b3 morado chico" data-atras style="margin-top:10px;">← Volver</button></div>`;
  const av = selectorEmoji($('[data-av]', cont), g.avatar);
  $$('[data-modo]', cont).forEach(b => b.onclick = () => {
    modo = b.dataset.modo; prefs.guardar('modo_sala', modo);
    $$('[data-modo]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('[data-modo-txt]', cont).textContent = MODOS.find(m => m[0] === modo)[2];
  });
  $('[data-juego]', cont).onchange = (e) => { $('[data-mis-datos]', cont).hidden = !e.target.checked; };
  $('[data-atras]', cont).onclick = () => preparar();
  $('[data-crear]', cont).onclick = async (e) => {
    const boton = e.currentTarget;
    const juega = $('[data-juego]', cont).checked, alias = $('#aliasHost', cont).value.trim();
    if (juega && !alias) { $('[data-err]', cont).textContent = 'Escribe tu nombre.'; return; }
    boton.disabled = true;
    try {
      const r = await rpc('sala_crear', { p_tipo: juego === 'quiz' && set.remoto ? 'quizpublico' : juego === 'relampago' ? 'quiz' : juego, p_titulo: set.titulo, p_contenido: armar(),
        p_segundos: segundos || null, p_alias: alias, p_avatar: av(), p_juega: juega });
      if (juega) prefs.guardar('jugadores', [{ nombre: alias, avatar: av() }, ...prefs.leer('jugadores', []).slice(1)]);
      if (set.remoto && juego !== 'quiz') rpc('juego_jugado', { p_id: set.id }).catch(() => {});
      history.replaceState(null, '', `?sala=${r.codigo}`);
      $('#nombreJuego').textContent = '🌐 Sala en línea';
      abrirSala({ rpc, canal, cont, barra, volverA: INICIO, nuevaRonda: armar },
        { sala_id: r.sala_id, codigo: r.codigo, host_token: r.host_token, yo: juega ? { id: r.jugador_id, token: r.token } : null });
    } catch (er) { $('[data-err]', cont).textContent = er.message || String(er); boton.disabled = false; }
  };
}

function botonTema(s, setId) {
  return `<button type="button" role="radio" class="tema" data-s="${s.id}" aria-checked="${s.id === setId}">
    <span class="tema-ico" aria-hidden="true">${s.ico}</span><span><b>${esc(s.titulo)}</b><small>${esc(s.categoria || '')}</small></span></button>`;
}

arrancar();
$('#bVolver').onclick = () => {
  if (PIN_SALA || new URLSearchParams(location.search).get('sala')) { if (confirm('¿Salir de la sala?')) location.href = INICIO; return; }
  if (relojLocal) { relojLocal.ocultar(); relojLocal = null; }
  pararRelojTurno(); fondo.parar();
  if (cont.classList.contains('jugando')) { cont.classList.remove('jugando'); preparar(); }
  else location.href = volverA;
};
