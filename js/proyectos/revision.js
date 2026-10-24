// ============================================================
// Proyectos en grupo: clasificación de las hojas y revisión del proyecto
// - presentación: Contenido
// - registro: 📲 Unirse y 👥 Agrupar (los participantes se unen con el QR o el PIN)
// - interactivas: preguntas, lluvia de ideas, ruleta de participantes y juegos (necesitan participantes unidos)
// - grupales: "una respuesta por grupo", juego por grupos y ruleta de grupos (necesitan una hoja Agrupar antes)
// La usan el editor (⚠ en las miniaturas y antes de "En vivo") y la presentación (avisos).
// ============================================================
import { esPregunta, huecos } from './preguntas.js';

export const esRegistro = (h) => h?.tipo === 'unirse' || h?.tipo === 'agrupar';
export const necesitaUnirse = (h) => esPregunta(h?.tipo) || h?.tipo === 'juego' || (h?.tipo === 'ruleta' && h.config?.origen === 'participantes');
export const usaGrupos = (h) => ((esPregunta(h?.tipo) || h?.tipo === 'juego') && h.config?.modo === 'grupo') || (h?.tipo === 'ruleta' && h.config?.origen === 'grupos');
const conZona = (h) => esPregunta(h.tipo) || ['agrupar', 'unirse', 'ruleta', 'juego'].includes(h.tipo);

const textoDe = (el) => String(el?.texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
// "Hoja 3: Equipos de ciencias"
export function nombreHoja(hojas, i) {
  const h = hojas[i];
  const t = h.diseno?.elementos?.find(e => e.tipo === 'texto' && !e.vinculo);
  return `Hoja ${i + 1}${t && textoDe(t) ? `: ${textoDe(t).slice(0, 40)}` : ''}`;
}
// Las hojas Agrupar antes de la hoja i: [{ i, id, nombre }]
export const agruparAntes = (hojas, i) => hojas.slice(0, i).map((h, k) => ({ h, k }))
  .filter(x => x.h.tipo === 'agrupar').map(x => ({ i: x.k, id: x.h.id, nombre: nombreHoja(hojas, x.k) }));

/**
 * Lo que le falta a la hoja i: [{ txt, arreglo }]
 * arreglo: { tipo: 'unirse' | 'agrupar', en } (insertar esa hoja en la posición "en"), { tipo: 'zona' },
 *          { tipo: 'grupos', id } (usar los grupos de esa hoja Agrupar) o null (hay que ir a la hoja)
 */
export function problemas(hojas, i) {
  const h = hojas[i], c = h.config || {}, out = [];
  if (necesitaUnirse(h) && !hojas.slice(0, i).some(esRegistro)) {
    const primera = hojas.findIndex(necesitaUnirse);
    out.push({ txt: 'Los participantes todavía no se unieron: falta una hoja 📲 Unirse (o Agrupar) antes.', arreglo: { tipo: 'unirse', en: primera } });
  }
  if (usaGrupos(h)) {
    const ag = agruparAntes(hojas, i), ultima = ag.at(-1);
    if (!ag.length) out.push({ txt: 'Usa grupos, pero no hay una hoja 👥 Agrupar antes.', arreglo: { tipo: 'agrupar', en: i } });
    else if (c.hoja_grupos && !ag.some(a => a.id === c.hoja_grupos)) out.push({ txt: 'La hoja Agrupar elegida ya no está antes de esta.', arreglo: { tipo: 'grupos', id: ultima.id } });
    else if (c.hoja_grupos && c.hoja_grupos !== ultima.id) {
      out.push({ txt: `Los grupos de la hoja elegida se vuelven a formar en la ${ultima.nombre.split(':')[0].toLowerCase()}: se usarán esos.`, arreglo: { tipo: 'grupos', id: ultima.id } });
    }
  }
  if (conZona(h) && !h.diseno?.elementos?.some(e => e.tipo === 'zona')) {
    out.push({ txt: 'Falta el área de respuestas (o la del registro, la ruleta o el ranking).', arreglo: { tipo: 'zona' } });
  }
  if (esPregunta(h.tipo)) {
    if (h.tipo === 'completar') {
      const n = huecos(c.frase);
      if (!String(c.frase || '').trim()) out.push({ txt: 'La frase para completar está vacía.', arreglo: null });
      else if (!n) out.push({ txt: 'La frase no tiene espacios: escribe ___ donde va cada uno.', arreglo: null });
      else if (Array.from({ length: n }, (_, k) => (c.aceptadas?.[k] || []).length).some(x => !x)) out.push({ txt: 'Falta la respuesta aceptada de algún espacio.', arreglo: null });
    } else if (!String(c.enunciado || '').trim()) out.push({ txt: 'Falta escribir la pregunta.', arreglo: null });
    if (h.tipo === 'opcion') {
      const ops = c.opciones || [];
      if (ops.length < 2) out.push({ txt: 'Necesita al menos 2 opciones.', arreglo: null });
      else if (ops.some(o => !String(o.texto || '').trim() && !o.imagen)) out.push({ txt: 'Hay una opción vacía.', arreglo: null });
    }
  }
  if (h.tipo === 'ruleta' && (c.origen || 'nombres') === 'nombres' && !(c.lista || []).some(x => String(x).trim())) {
    out.push({ txt: 'La ruleta no tiene nombres.', arreglo: null });
  }
  return out;
}

// Todas las hojas con problemas: [{ i, lista }]
export const revisar = (hojas) => hojas.map((_, i) => ({ i, lista: problemas(hojas, i) })).filter(x => x.lista.length);
