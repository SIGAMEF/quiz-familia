// ============================================================
// juegos.html?j=<juego>&s=<set>  — prepara y lanza un juego libre
// ============================================================
import { $, $$, esc, paisaje, formJugadores, sonar, alternarSonido, sonidoActivo, prefs, alFinalizarPartida, relojBarra, pantallaFinal, selectorEmoji } from './util.js';
import { contenidoSala, abrirSala, unirseSala } from './sala.js';
import { imprimir, puedeImprimir } from './imprimir.js';
import { sopaDe } from './sopa.js';
import { imagenPuzzle } from './imagenes.js';
import { JUEGOS, setsPara, buscarSet, conImagenes } from './contenido.js';

const MODULOS = {
  ahorcado: () => import('./ahorcado.js'), sopa: () => import('./sopa.js'), memoria: () => import('./memoria.js'),
  ordena: () => import('./ordena.js'), quiz: () => import('./quiz.js'), trivia: () => import('./quiz.js'),
  frase: () => import('./frase.js'), rompecabezas: () => import('./rompecabezas.js'), quizpublico: () => import('./quizlibre.js')
};
// Opciones de cada juego
const OPCIONES = {
  ahorcado: { jugadores: true, campo: 'cantidad', titulo: 'Palabras', valores: [[4, '4'], [6, '6'], [10, '10']], def: 6,
    reglas: ['Se turnan para elegir letras.', 'Letra correcta: un punto por cada vez que aparece, y sigues tú.', 'Letra incorrecta: el cangurito pierde energía y pasa el turno.', 'Quien completa la palabra gana 2 puntos más.', 'Cada jugador tiene 3 pistas: cada una destapa una letra.'] },
  sopa: { jugadores: false, campo: 'nivel', titulo: 'Dificultad', valores: [['facil', '🟢 Fácil'], ['medio', '🟡 Medio'], ['dificil', '🔴 Difícil']], def: 'facil',
    reglas: ['Busca las palabras de la lista dentro de la sopa.', 'Fácil: horizontal y vertical. Medio: también en diagonal. Difícil: en todas las direcciones, incluso al revés.', 'Mientras más rápido termines, más puntos.'] },
  memoria: { jugadores: true, campo: 'parejas', titulo: 'Parejas', valores: [[6, '6'], [8, '8'], [10, '10']], def: 6,
    reglas: ['Voltea dos cartas. Si forman pareja, son tuyas y vuelves a jugar.', 'Si no, se tapan otra vez y pasa el turno.', 'Gana quien junte más parejas.'] },
  ordena: { jugadores: false, campo: 'cantidad', titulo: 'Palabras', valores: [[5, '5'], [8, '8'], [12, '12']], def: 8,
    reglas: ['Toca las letras en el orden correcto para armar la palabra.', 'Lee la pista si no sabes cuál es.', '“Una letra” te ayuda, pero da menos puntos.'] },
  quiz: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10']], def: 10,
    reglas: ['Tienes 15 segundos por pregunta.', 'Respuesta correcta: 500 puntos más un bono por rapidez.'] },
  trivia: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10']], def: 10,
    reglas: ['Tienes 15 segundos por pregunta.', 'Respuesta correcta: 500 puntos más un bono por rapidez.'] },
  frase: { jugadores: false, campo: 'cantidad', titulo: 'Frases', valores: [[4, '4'], [6, '6'], [8, '8']], def: 6,
    reglas: ['Toca las palabras en el orden correcto para formar la frase.', 'La pista te dice de qué trata (o la cita, en los versículos).', '“Una palabra” te ayuda, pero da menos puntos.'] },
  rompecabezas: { jugadores: false, campo: 'piezas', titulo: 'Piezas', valores: [[3, '3 × 3'], [4, '4 × 4'], [5, '5 × 5']], def: 3,
    reglas: ['Toca una pieza y luego otra para cambiarlas de lugar.', 'Las piezas que ya están en su sitio se marcan en verde.', 'Con “Una foto de la familia” puedes armar tu propia foto.'] },
  quizpublico: { jugadores: false, campo: 'cantidad', titulo: 'Preguntas', valores: [[5, '5'], [10, '10'], [999, 'Todas']], def: 10,
    reglas: ['Responde cada pregunta y mira si acertaste.', 'Hay preguntas de una o varias respuestas, verdadero o falso y para completar.'] }
};
const TIEMPOS = [[0, 'Sin límite'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']];
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
    return unirseSala({ rpc, cont, barra, volverA: INICIO }, PIN_SALA);
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
  let segundos = fijo && fijo.segundos ? Number(fijo.segundos) : Number(prefs.leer(`tiempo_${juego}`, 0));
  if (!TIEMPOS.some(([v]) => v === segundos)) segundos = TIEMPOS.reduce((a, [v]) => Math.abs(v - segundos) < Math.abs(a - segundos) ? v : a, 0);

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
      <h2>⏱ Tiempo para jugar</h2>
      <div class="segmento" role="group" aria-label="Tiempo">${TIEMPOS.map(([v, t]) => `<button type="button" data-tiempo="${v}" aria-pressed="${v === segundos}">${t}</button>`).join('')}</div>
      ${fijo && fijo.segundos ? `<p class="hint" style="margin-top:4px;">El profesor sugiere ${Math.round(fijo.segundos / 60 * 10) / 10} min.</p>` : ''}
      <div class="modo-juego">
        <button class="b3 amarillo grande" data-jugar>▶ Jugar aquí</button>
        ${!ID_PUB && !PREVIA ? '<button class="b3 azul grande" data-enlinea>🌐 Jugar en línea con otros</button>' : ''}
      </div>
      ${!ID_PUB && !PREVIA ? '<p class="hint" style="text-align:center;">En línea: compartes un PIN, cada uno juega desde su celular y tú inicias para todos.</p>' : ''}
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
  $$('[data-tiempo]', cont).forEach(b => b.onclick = () => {
    segundos = Number(b.dataset.tiempo); if (!fijo) prefs.guardar(`tiempo_${juego}`, segundos);
    $$('[data-tiempo]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  $$('[data-v]', cont).forEach(b => b.onclick = () => {
    valor = b.dataset.v; sopaImpresa = null; $$('[data-v]', cont).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  const leerJug = op.jugadores && !unJugador ? formJugadores($('[data-jug]', cont), { etiqueta2: juego === 'ahorcado' ? '2 jugadores o equipos' : '2 jugadores' }) : null;
  $$('[data-imp]', cont).forEach(b => b.onclick = async () => {
    try {
      const set = await setCompleto(setId);
      const tipo = juego === 'quizpublico' || juego === 'trivia' ? 'quiz' : juego;
      if (juego === 'sopa' && !set.grilla && !sopaImpresa) sopaImpresa = sopaDe(set, valor, pistas);
      if (juego === 'rompecabezas' && set.id === 'foto') throw new Error('Para imprimir con una foto, primero créalo como juego en tu panel de profesor.');
      const imagen = juego === 'rompecabezas' && !set.imagen_url ? imagenPuzzle(set.id) : null;
      await imprimir(tipo, set, { solucion: b.dataset.imp === '1', sopa: set.grilla ? null : sopaImpresa, nivel: valor, piezas: valor, imagen, pistas });
    } catch (e) { alert(e.message); }
  });
  const bLinea = $('[data-enlinea]', cont);
  if (bLinea) bLinea.onclick = async () => {
    if (!fijo) { prefs.guardar(`set_${juego}`, setId); prefs.guardar(`op_${juego}`, valor); }
    try { await crearSalaEnLinea({ juego, setId, setCompletoFn: setCompleto, campo: op.campo, valor, pistas: juego === 'sopa' ? pistas : undefined, segundos }); }
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
        relojLocal = null;
        alFinalizarPartida((info) => { if (relojLocal) relojLocal.ocultar(); if (registrarAlTerminar) registrarAlTerminar(info); });
        if (segundos) {
          relojLocal = relojBarra(barra, Date.now() + segundos * 1000, { total: segundos, alAcabar: () => {
            pantallaFinal(cont, { jugadores: jugs, titulo: '⏰ ¡Se acabó el tiempo!', detalle: 'Puntos logrados antes de que terminara el tiempo.', alRepetir: lanzar, alMenu });
          } });
        }
        m.iniciar(cont, { set, jugadores: jugs, opciones: { [op.campo]: valor, pistas: juego === 'sopa' ? pistas : undefined }, alMenu, alRepetir: lanzar });
      };
      lanzar();
    } catch (e) { b.disabled = false; alert(e.message || String(e)); }
  };
}
// ---------- Crear una sala en línea ----------
async function crearSalaEnLinea({ juego, setId, setCompletoFn, campo, valor, pistas, segundos }) {
  const set = await setCompletoFn(setId);
  const armar = () => contenidoSala({ juego, set, campo, valor, pistas });
  armar();   // valida (por ejemplo, la foto propia no se puede compartir)
  const g = prefs.leer('jugadores', [{ nombre: '', avatar: '🧒' }])[0];
  cont.innerHTML = `<div class="tabla-juego">
      <div class="center"><div class="rotulo-tabla">🌐 Jugar en línea</div><p class="lema">${esc(set.titulo)} · ${segundos ? `⏱ ${Math.round(segundos / 60 * 10) / 10} min para todos` : 'sin límite de tiempo'}</p></div>
      <label class="check" style="margin-top:10px;"><input type="checkbox" data-juego checked> Yo también juego</label>
      <div data-mis-datos><label class="lbl" for="aliasHost">Tu nombre</label><input class="input" id="aliasHost" maxlength="30" value="${esc(g.nombre && g.nombre !== 'Jugador 1' ? g.nombre : '')}" placeholder="Ej: Mamá">
        <label class="lbl">Tu avatar</label><div data-av></div></div>
      <p class="err" data-err></p>
      <button class="b3 amarillo grande" data-crear>Crear sala y mostrar el PIN</button>
      <button class="b3 morado chico" data-atras style="margin-top:10px;">← Volver</button></div>`;
  const av = selectorEmoji($('[data-av]', cont), g.avatar);
  $('[data-juego]', cont).onchange = (e) => { $('[data-mis-datos]', cont).hidden = !e.target.checked; };
  $('[data-atras]', cont).onclick = () => preparar();
  $('[data-crear]', cont).onclick = async (e) => {
    const boton = e.currentTarget;
    const juega = $('[data-juego]', cont).checked, alias = $('#aliasHost', cont).value.trim();
    if (juega && !alias) { $('[data-err]', cont).textContent = 'Escribe tu nombre.'; return; }
    boton.disabled = true;
    try {
      const r = await rpc('sala_crear', { p_tipo: juego === 'quiz' && set.remoto ? 'quizpublico' : juego, p_titulo: set.titulo, p_contenido: armar(),
        p_segundos: segundos || null, p_alias: alias, p_avatar: av(), p_juega: juega });
      if (juega) prefs.guardar('jugadores', [{ nombre: alias, avatar: av() }, ...prefs.leer('jugadores', []).slice(1)]);
      if (set.remoto && juego !== 'quiz') rpc('juego_jugado', { p_id: set.id }).catch(() => {});
      history.replaceState(null, '', `?sala=${r.codigo}`);
      $('#nombreJuego').textContent = '🌐 Sala en línea';
      abrirSala({ rpc, cont, barra, volverA: INICIO, nuevaRonda: armar },
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
  if (cont.classList.contains('jugando')) { cont.classList.remove('jugando'); preparar(); }
  else location.href = volverA;
};
