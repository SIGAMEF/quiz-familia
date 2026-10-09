// ============================================================
// Plantilla Excel, lectura/validación de preguntas y libreta
// Requiere ExcelJS cargado con <script> (window.ExcelJS)
// ============================================================
import { descargarBlob, normalizar, notaLiteral } from './comun.js';

export const COLUMNAS = ['tema', 'subtema', 'tipo', 'enunciado', 'imagen_url', 'puntos',
  'opcion_1', 'opcion_2', 'opcion_3', 'opcion_4', 'opcion_5', 'opcion_6',
  'correctas', 'respuestas_completar', 'explicacion'];

const TIPOS_VALIDOS = ['verdadero_falso', 'opcion_unica', 'opcion_multiple', 'completar', 'lluvia_ideas'];
const SINONIMOS_TIPO = {
  vf: 'verdadero_falso', 'v/f': 'verdadero_falso', 'verdadero/falso': 'verdadero_falso', verdadero_falso: 'verdadero_falso', 'verdadero falso': 'verdadero_falso',
  unica: 'opcion_unica', opcion_unica: 'opcion_unica', 'opcion unica': 'opcion_unica', alternativa: 'opcion_unica', alternativas: 'opcion_unica',
  multiple: 'opcion_multiple', opcion_multiple: 'opcion_multiple', 'opcion multiple': 'opcion_multiple', 'seleccion multiple': 'opcion_multiple',
  completar: 'completar', rellenar: 'completar', 'completar espacios': 'completar',
  lluvia: 'lluvia_ideas', lluvia_ideas: 'lluvia_ideas', 'lluvia de ideas': 'lluvia_ideas', abierta: 'lluvia_ideas'
};

const EJEMPLOS = [
  ['Ciencia', 'Seres vivos', 'verdadero_falso', 'Las plantas producen su propio alimento.', '', 1, '', '', '', '', '', '', 'V', '', 'Lo hacen mediante la fotosíntesis.'],
  ['Ciencia', 'Seres vivos', 'opcion_unica', '¿Qué órgano bombea la sangre?', '', 1, 'Pulmón', 'Corazón', 'Hígado', 'Riñón', '', '', '2', '', ''],
  ['Ciencia', 'Reinos', 'opcion_multiple', '¿Cuáles de estos animales son mamíferos?', '', 2, 'Perro', 'Ballena', 'Tiburón', 'Murciélago', '', '', '1,2,4', '', 'El tiburón es un pez.'],
  ['Matemática', 'Operaciones', 'completar', 'La mitad de 10 es ___ y el doble de 3 es ___.', '', 1, '', '', '', '', '', '', '', '5|cinco; 6|seis', ''],
  ['Matemática', 'Opinión', 'lluvia_ideas', '¿Para qué usas las matemáticas en tu vida diaria?', '', 1, '', '', '', '', '', '', '', '', ''],
  ['Matemática', 'Geometría', 'opcion_unica', '¿Cuántos lados tiene un hexágono?', '', 1, 'Cinco', 'Seis', 'Ocho', '', '', '', 'Seis', '', 'Puedes escribir el número de opción o el texto de la correcta.']
];

const INSTRUCCIONES = [
  ['Columna', '¿Obligatoria?', 'Qué escribir'],
  ['tema', 'Recomendada', 'El tema o curso. Si eliges "un quiz por cada tema", cada tema distinto será un quiz aparte con ese nombre.'],
  ['subtema', 'No', 'Sirve para filtrar y buscar preguntas después. El alumno lo ve como etiqueta arriba de la pregunta.'],
  ['tipo', 'Sí', 'verdadero_falso · opcion_unica · opcion_multiple · completar · lluvia_ideas (elige de la lista desplegable).'],
  ['enunciado', 'Sí', 'El texto de la pregunta. En "completar" escribe ___ (tres guiones bajos) donde va cada espacio.'],
  ['imagen_url', 'No', 'Enlace a una imagen (https://...). También puedes agregarla después desde el editor.'],
  ['puntos', 'No', 'Puntos que vale la pregunta. Si lo dejas vacío vale 1.'],
  ['opcion_1 … opcion_6', 'Según tipo', 'Las alternativas para opcion_unica y opcion_multiple (mínimo 2). En verdadero_falso déjalas vacías.'],
  ['correctas', 'Según tipo', 'verdadero_falso: V o F. opcion_unica: el número de la correcta (ej. 2) o su texto. opcion_multiple: los números separados por coma (ej. 1,3).'],
  ['respuestas_completar', 'Solo completar', 'Una respuesta por cada ___ separadas por punto y coma ( ; ). Respuestas alternativas válidas con | . Ej: 5|cinco; 6|seis'],
  ['explicacion', 'No', 'Se muestra al alumno después de responder (en práctica y estudio).'],
  ['', '', ''],
  ['Pegar sin Excel', '', 'También puedes copiar las filas desde Excel (sin la cabecera) y pegarlas en la app, en el mismo orden de columnas.'],
  ['Calificación', '', 'Completar no distingue mayúsculas ni tildes. Lluvia de ideas no se califica: las respuestas se muestran en la pizarra.']
];

function libro() {
  if (!window.ExcelJS) throw new Error('No se cargó la librería de Excel. Revisa tu conexión y recarga la página.');
  return new window.ExcelJS.Workbook();
}

function estiloCabecera(fila, color = 'FF6C5CE7') {
  fila.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = bordes();
  });
  fila.height = 30;
}
function bordes(color = 'FFD9D2F5') {
  const b = { style: 'thin', color: { argb: color } };
  return { top: b, left: b, bottom: b, right: b };
}

// ---------- Plantilla ----------
export async function descargarPlantilla() {
  const wb = libro();
  wb.creator = 'QuizApp';
  const hoja = wb.addWorksheet('Preguntas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow(COLUMNAS);
  estiloCabecera(hoja.getRow(1));
  EJEMPLOS.forEach(e => hoja.addRow(e));
  const anchos = [14, 16, 18, 48, 22, 8, 16, 16, 16, 16, 14, 14, 12, 24, 34];
  anchos.forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  hoja.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
  for (let r = 2; r <= 1000; r++) {
    hoja.getCell(r, 3).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['"' + TIPOS_VALIDOS.join(',') + '"'],
      showErrorMessage: true, errorTitle: 'Tipo no válido', error: 'Elige un tipo de la lista.'
    };
    hoja.getCell(r, 6).dataValidation = { type: 'decimal', operator: 'greaterThan', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Los puntos deben ser mayores que 0' };
  }
  for (let r = 2; r <= EJEMPLOS.length + 1; r++) {
    hoja.getRow(r).eachCell({ includeEmpty: true }, c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F4FF' } }; });
  }

  const ins = wb.addWorksheet('Instrucciones');
  INSTRUCCIONES.forEach(f => ins.addRow(f));
  estiloCabecera(ins.getRow(1));
  ins.getColumn(1).width = 22; ins.getColumn(2).width = 16; ins.getColumn(3).width = 100;
  ins.eachRow((row, n) => { if (n > 1) { row.alignment = { wrapText: true, vertical: 'top' }; row.getCell(1).font = { bold: true }; } });

  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'plantilla_preguntas_quizapp.xlsx');
}

// ---------- Lectura ----------
function textoCelda(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text != null) return String(typeof v.text === 'object' && v.text.richText ? v.text.richText.map(t => t.text).join('') : v.text);
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.hyperlink) return String(v.hyperlink);
    return '';
  }
  return String(v);
}

// Convierte filas crudas en filas de objetos {columna: valor}. Si hay cabecera, usa sus nombres.
function aObjetos(filas) {
  filas = filas.filter(f => f.some(c => String(c ?? '').trim() !== ''));
  if (!filas.length) return [];
  let columnas = COLUMNAS;
  const primera = filas[0].map(c => normalizar(c).replace(/\s+/g, '_'));
  if (primera.includes('enunciado') && primera.includes('tipo')) {
    columnas = primera;
    filas = filas.slice(1);
  }
  return filas.map(f => {
    const o = {};
    columnas.forEach((col, i) => { if (col) o[col] = String(f[i] ?? '').trim(); });
    return o;
  });
}

export async function leerExcel(archivo) {
  const wb = libro();
  await wb.xlsx.load(await archivo.arrayBuffer());
  const hoja = wb.getWorksheet('Preguntas') || wb.worksheets[0];
  if (!hoja) throw new Error('El archivo no tiene hojas.');
  const filas = [];
  hoja.eachRow({ includeEmpty: false }, row => {
    const f = [];
    for (let c = 1; c <= Math.max(row.cellCount, COLUMNAS.length); c++) f.push(textoCelda(row.getCell(c).value));
    filas.push(f);
  });
  return aObjetos(filas);
}

// Texto copiado desde Excel: columnas separadas por TAB, celdas con saltos entre comillas
export function leerPegado(texto) {
  const filas = [];
  let fila = [], celda = '', comillas = false;
  const t = texto.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"' && celda === '') comillas = true;
    else if (ch === '\t') { fila.push(celda); celda = ''; }
    else if (ch === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += ch;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  if (filas.length && !filas.some(f => f.length > 1)) {
    throw new Error('No se detectaron columnas. Copia las filas directamente desde Excel (las columnas se separan con tabulación).');
  }
  return aObjetos(filas);
}

// ---------- Conversión y validación ----------
function contarEspacios(enunciado) { return (String(enunciado).match(/_{2,}/g) || []).length; }

export function normalizarTipo(t) {
  const n = normalizar(t).replace(/\s+/g, ' ');
  return SINONIMOS_TIPO[n] || SINONIMOS_TIPO[n.replace(/ /g, '_')] || n.replace(/ /g, '_');
}

// Valida una pregunta en el formato que acepta la base (igual que _error_pregunta en SQL)
export function errorPregunta(p) {
  if (!TIPOS_VALIDOS.includes(p.tipo)) return `Tipo "${p.tipo || '(vacío)'}" no válido`;
  if (!String(p.enunciado || '').trim()) return 'Falta el enunciado';
  if (p.puntos != null && !(Number(p.puntos) > 0)) return 'Los puntos deben ser un número mayor que 0';
  const ops = (p.opciones || []).filter(o => String(o.texto || '').trim() || o.imagen_url);
  const ok = ops.filter(o => o.es_correcta).length;
  if (p.tipo === 'verdadero_falso' && (ops.length !== 2 || ok !== 1)) return 'Verdadero/Falso: indica V o F en "correctas"';
  if (p.tipo === 'opcion_unica') {
    if (ops.length < 2) return 'Necesita al menos 2 opciones';
    if (ok === 0) return 'Ninguna opción marcada como correcta';
    if (ok > 1) return 'Hay más de una correcta: usa el tipo opcion_multiple';
  }
  if (p.tipo === 'opcion_multiple') {
    if (ops.length < 2) return 'Necesita al menos 2 opciones';
    if (ok === 0) return 'Marca al menos una opción correcta';
  }
  if (p.tipo === 'completar') {
    const resp = (p.respuestas_texto || []).filter(r => String(r).trim());
    if (!resp.length) return 'Falta la respuesta en "respuestas_completar"';
    const esp = contarEspacios(p.enunciado);
    if (esp > 0 && esp !== resp.length) return `El enunciado tiene ${esp} espacio(s) ___ pero hay ${resp.length} respuesta(s)`;
  }
  return null;
}

function indicesCorrectas(valor, opciones) {
  const partes = String(valor || '').split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  const idx = new Set();
  for (const p of partes) {
    if (/^\d+$/.test(p) && opciones[Number(p) - 1]) { idx.add(Number(p) - 1); continue; }
    if (/^[a-fA-F]$/.test(p)) { idx.add(p.toUpperCase().charCodeAt(0) - 65); continue; }
    const k = opciones.findIndex(o => normalizar(o) === normalizar(p));
    if (k >= 0) idx.add(k); else return null;
  }
  return idx;
}

// fila {tema, subtema, tipo, ...} → { tema, pregunta, error }
export function filaAPregunta(f) {
  const tipo = normalizarTipo(f.tipo || '');
  const p = {
    tipo, enunciado: (f.enunciado || '').trim(), imagen_url: (f.imagen_url || '').trim() || null,
    subtema: (f.subtema || '').trim() || null,
    puntos: f.puntos === '' || f.puntos == null ? 1 : Number(String(f.puntos).replace(',', '.')),
    explicacion: (f.explicacion || '').trim() || null, opciones: [], respuestas_texto: []
  };
  let error = null;
  if (tipo === 'verdadero_falso') {
    const v = normalizar(f.correctas);
    const esV = ['v', 'verdadero', '1', 'true', 'si', 'sí', 'x'].includes(v);
    const esF = ['f', 'falso', '2', 'false', 'no'].includes(v);
    if (!esV && !esF) error = 'Verdadero/Falso: escribe V o F en "correctas"';
    p.opciones = [{ texto: 'Verdadero', es_correcta: esV }, { texto: 'Falso', es_correcta: esF && !esV }];
  } else if (tipo === 'opcion_unica' || tipo === 'opcion_multiple') {
    const textos = [1, 2, 3, 4, 5, 6].map(i => (f['opcion_' + i] || '').trim());
    const presentes = textos.map((t, i) => ({ t, i })).filter(x => x.t);
    const idx = indicesCorrectas(f.correctas, textos);
    if (idx === null) error = `No se entiende "correctas": ${f.correctas}`;
    else if ([...idx].some(i => !textos[i])) error = '"correctas" apunta a una opción vacía';
    p.opciones = presentes.map(x => ({ texto: x.t, es_correcta: !!(idx && idx.has(x.i)) }));
  } else if (tipo === 'completar') {
    const fuente = (f.respuestas_completar || '').trim() || (f.correctas || '').trim();
    p.respuestas_texto = fuente ? fuente.split(';').map(s => s.split('|').map(a => a.trim()).filter(Boolean).join('|')).filter(Boolean) : [];
  }
  return { tema: (f.tema || '').trim(), pregunta: p, error: error || errorPregunta(p), original: f };
}

// ---------- Errores a Excel ----------
export async function descargarErrores(filas) {
  const wb = libro();
  const hoja = wb.addWorksheet('Preguntas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow([...COLUMNAS, 'motivo_del_error']);
  estiloCabecera(hoja.getRow(1));
  hoja.getRow(1).getCell(COLUMNAS.length + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE14D72' } };
  filas.forEach(r => {
    const fila = hoja.addRow([...COLUMNAS.map(c => r.original[c] ?? ''), r.error]);
    fila.getCell(COLUMNAS.length + 1).font = { bold: true, color: { argb: 'FFE14D72' } };
  });
  [14, 16, 18, 48, 22, 8, 16, 16, 16, 16, 14, 14, 12, 24, 34, 50].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf]), 'preguntas_con_errores.xlsx');
}

// ---------- Exportar preguntas de un quiz (para editarlas en Excel) ----------
export async function exportarPreguntas(titulo, preguntas) {
  const wb = libro();
  const hoja = wb.addWorksheet('Preguntas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow(COLUMNAS);
  estiloCabecera(hoja.getRow(1));
  preguntas.forEach(p => {
    const ops = p.opciones || [];
    let correctas = '';
    if (p.tipo === 'verdadero_falso') correctas = ops.find(o => o.es_correcta)?.texto === 'Falso' ? 'F' : 'V';
    else correctas = ops.map((o, i) => o.es_correcta ? i + 1 : null).filter(Boolean).join(',');
    hoja.addRow([titulo, p.subtema || '', p.tipo, p.enunciado, p.imagen_url || '', Number(p.puntos),
      ...[0, 1, 2, 3, 4, 5].map(i => p.tipo === 'verdadero_falso' ? '' : (ops[i]?.texto || '')),
      p.tipo === 'completar' ? '' : correctas, (p.respuestas_texto || []).join('; '), p.explicacion || '']);
  });
  [14, 16, 18, 48, 22, 8, 16, 16, 16, 16, 14, 14, 12, 24, 34].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf]), `preguntas_${titulo.replace(/[^\w]+/g, '_').slice(0, 40)}.xlsx`);
}

// ---------- Libreta de notas ----------
const COLOR_NIVEL = { AD: 'FFD1FAE5', A: 'FFE0F2FE', B: 'FFFEF3C7', C: 'FFFFE4E6' };

export async function descargarLibreta(lib, escala) {
  const wb = libro();
  wb.creator = 'QuizApp';
  const hoja = wb.addWorksheet('Libreta', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const pubs = lib.publicaciones || [];
  const conLiteralExtra = escala === 'ambas';
  const totalCols = 3 + pubs.length + 1 + (conLiteralExtra ? 1 : 0);

  hoja.mergeCells(1, 1, 1, totalCols);
  const t = hoja.getCell(1, 1);
  t.value = 'LIBRETA DE NOTAS';
  t.font = { bold: true, size: 16, color: { argb: 'FF6C5CE7' } };
  t.alignment = { horizontal: 'center' };
  const info = [
    ['Institución', lib.profesor?.institucion || ''], ['Docente', lib.profesor?.nombre || ''],
    ['Curso', lib.profesor?.curso || ''], ['Grupo', `${lib.grupo?.nombre || ''}${lib.grupo?.nivel ? ' – ' + lib.grupo.nivel : ''}`],
    ['Periodo', lib.periodo || 'Todos'],
    ['Nota considerada', { mejor: 'Mejor intento', ultimo: 'Último intento', promedio: 'Promedio de intentos' }[lib.criterio] || lib.criterio],
    ['Fecha', new Date().toLocaleDateString('es-PE')]
  ];
  info.forEach(([k, v], i) => {
    const r = hoja.getRow(2 + i);
    r.getCell(1).value = k; r.getCell(1).font = { bold: true, color: { argb: 'FF8E86AC' } };
    hoja.mergeCells(2 + i, 2, 2 + i, Math.max(3, totalCols));
    r.getCell(2).value = v; r.getCell(2).font = { bold: true };
  });

  const filaCab = 2 + info.length + 1;
  const cab = ['N°', 'Apellidos y nombres', 'Usuario', ...pubs.map(p => `${p.titulo}${p.peso && Number(p.peso) !== 1 ? ` (peso ${p.peso})` : ''}`), 'Promedio'];
  if (conLiteralExtra) cab.push('Nivel');
  hoja.getRow(filaCab).values = cab;
  estiloCabecera(hoja.getRow(filaCab));
  hoja.getRow(filaCab).height = 48;

  (lib.alumnos || []).forEach((a, i) => {
    const valores = [i + 1, a.nombre, a.usuario];
    pubs.forEach(p => {
      const n = a.notas?.[p.id]?.nota;
      valores.push(n == null ? '' : (escala === 'literal' ? notaLiteral(n) : Number(n)));
    });
    valores.push(a.promedio == null ? '' : (escala === 'literal' ? notaLiteral(a.promedio) : Number(a.promedio)));
    if (conLiteralExtra) valores.push(a.promedio == null ? '' : notaLiteral(a.promedio));
    const fila = hoja.getRow(filaCab + 1 + i);
    fila.values = valores;
    fila.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = bordes();
      if (col >= 4) {
        c.alignment = { horizontal: 'center' };
        const idxNota = col - 4;
        const n = idxNota < pubs.length ? a.notas?.[pubs[idxNota].id]?.nota : a.promedio;
        if (n != null && n !== '') {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NIVEL[notaLiteral(n)] } };
          if (typeof c.value === 'number') c.numFmt = '0.0';
        }
      }
    });
    const celProm = fila.getCell(4 + pubs.length);
    celProm.font = { bold: true };
  });

  hoja.getColumn(1).width = 5; hoja.getColumn(2).width = 34; hoja.getColumn(3).width = 16;
  for (let c = 4; c <= totalCols; c++) hoja.getColumn(c).width = 13;
  hoja.views = [{ state: 'frozen', xSplit: 3, ySplit: filaCab }];

  const ley = hoja.getRow(filaCab + (lib.alumnos || []).length + 3);
  ley.getCell(2).value = 'Escala: AD (18–20) logro destacado · A (14–17) logro esperado · B (11–13) en proceso · C (0–10) en inicio';
  ley.getCell(2).font = { italic: true, color: { argb: 'FF8E86AC' } };

  const buf = await wb.xlsx.writeBuffer();
  const nombre = `libreta_${(lib.grupo?.nombre || 'grupo').replace(/[^\w]+/g, '_')}${lib.periodo ? '_' + lib.periodo.replace(/[^\w]+/g, '_') : ''}.xlsx`;
  descargarBlob(new Blob([buf]), nombre);
}

// Resultados de una publicación
export async function descargarResultados(titulo, filas, escala) {
  const wb = libro();
  const hoja = wb.addWorksheet('Resultados', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow(['Alumno', 'Usuario', 'Intento', 'Fecha', 'Puntaje', 'Máximo', 'Nota (0-20)', 'Nivel']);
  estiloCabecera(hoja.getRow(1));
  filas.forEach(f => {
    const r = hoja.addRow([f.nombre, f.usuario, f.intento, f.fecha ? new Date(f.fecha) : '', Number(f.puntaje), Number(f.puntaje_max), Number(f.nota), notaLiteral(f.nota)]);
    r.getCell(4).numFmt = 'dd/mm/yyyy hh:mm';
    r.getCell(7).numFmt = '0.0';
    r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NIVEL[notaLiteral(f.nota)] } };
    r.eachCell(c => { c.border = bordes(); });
  });
  [30, 16, 9, 18, 10, 10, 12, 8].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf]), `resultados_${titulo.replace(/[^\w]+/g, '_').slice(0, 40)}.xlsx`);
}

// Resultados de una sesión en vivo
export async function descargarVivo(titulo, filas) {
  const wb = libro();
  const hoja = wb.addWorksheet('Resultados', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow(['Posición', 'Nombre', 'Tipo', 'Puntaje', 'Aciertos', 'Respondidas', 'Tiempo (seg)']);
  estiloCabecera(hoja.getRow(1));
  filas.forEach((f, i) => {
    const r = hoja.addRow([i + 1, f.alias, f.es_alumno ? 'Alumno' : 'Invitado', Number(f.puntaje), f.aciertos, f.respondidas, Math.round(Number(f.tiempo_total_seg ?? f.tiempo ?? 0))]);
    r.eachCell(c => { c.border = bordes(); });
    if (i < 3) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ['FFFFE7A8', 'FFE5E1F5', 'FFFFD9C2'][i] } };
  });
  [10, 30, 12, 10, 10, 12, 12].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf]), `vivo_${titulo.replace(/[^\w]+/g, '_').slice(0, 40)}.xlsx`);
}
