// ============================================================
// Visibilidad de una actividad (quiz, juego o proyecto): cuatro niveles
//   🔒 privado · 👥 grupos (publicado a tus grupos o alumnos) · 🌐 público (biblioteca) · ⭐ destacado (portada)
// ============================================================
import { supabase, $, $$, esc, toast, confirmar, mensajeError } from './comun.js';

export const NIVELES = {
  privado: { ico: '🔒', nombre: 'Privado', desc: 'Solo tú lo ves.' },
  grupos: { ico: '👥', nombre: 'Mis grupos', desc: 'Lo ven los alumnos de los grupos donde lo publiques.' },
  publico: { ico: '🌐', nombre: 'Público', desc: 'Aparece en la biblioteca de la página principal para cualquiera.' },
  destacado: { ico: '⭐', nombre: 'Destacado', desc: 'Además, se muestra en la portada, en “Creado por nuestros profesores”.' }
};

// Nivel actual. publicadas: cuántas publicaciones en grupos siguen activas
export const nivelDe = ({ publico, destacado, publicadas = 0 }) =>
  destacado && publico ? 'destacado' : publico ? 'publico' : publicadas > 0 ? 'grupos' : 'privado';

/**
 * Pinta el selector en `slot`.
 * clase: 'quiz' | 'juego' | 'proyecto' · item: { id, titulo, publico, destacado } · publicadas: publicaciones activas
 * alGrupos(): abre la publicación en grupos de esa actividad · alCambiar(): recargar la lista
 */
export function pintarVisibilidad(slot, { clase, item, publicadas = 0, alGrupos, alCambiar }) {
  if (!slot) return;
  const actual = nivelDe({ ...item, publicadas });
  slot.innerHTML = `<label class="vis-sel vis-${actual}" title="${esc(NIVELES[actual].desc)}">
    <span class="sr-only">Quién lo ve</span>
    <select data-nivel aria-label="Quién lo ve">${Object.entries(NIVELES).map(([k, n]) =>
      `<option value="${k}" ${k === actual ? 'selected' : ''}>${n.ico} ${n.nombre}</option>`).join('')}</select></label>`;
  const sel = $('[data-nivel]', slot);
  sel.onchange = async () => {
    const nivel = sel.value;
    const volver = () => { sel.value = actual; };
    if (nivel === 'privado' && publicadas > 0 &&
        !await confirmar(`“${item.titulo}” dejará de verse en tus grupos y en la página principal. Las publicaciones y los resultados se conservan: puedes volver a activarlas.`, { titulo: '¿Hacerlo privado?', boton: 'Hacer privado' })) return volver();
    if ((nivel === 'publico' || nivel === 'destacado') && !item.publico && clase === 'quiz' && publicadas > 0 &&
        !await confirmar('Al hacerlo público, cualquiera podrá jugarlo y conocer las preguntas (las respuestas no se muestran antes de responder).\nSi lo usas como examen, mejor haz una copia para compartir.', { titulo: '¿Hacer público este quiz?', boton: 'Hacer público', peligro: false })) return volver();
    if (nivel === 'destacado' &&
        !await confirmar(`“${item.titulo}” se mostrará en la portada, en “Creado por nuestros profesores”, para que cualquiera lo juegue. El administrador puede quitarlo de la portada.`, { titulo: '⭐ ¿Destacar en la portada?', boton: 'Destacar', peligro: false })) return volver();
    sel.disabled = true;
    try {
      const { error } = await supabase.rpc('actividad_visibilidad', { p_clase: clase, p_id: item.id, p_nivel: nivel });
      if (error) throw error;
      toast({ privado: 'Ahora es privado', grupos: 'Elige los grupos donde publicarlo', publico: 'Ahora aparece en la biblioteca de la página principal', destacado: '⭐ Destacado en la portada' }[nivel]);
      if (nivel === 'grupos' && alGrupos) alGrupos(); else alCambiar && alCambiar();
    } catch (e) { toast(mensajeError(e), 'error'); volver(); sel.disabled = false; }
  };
}

// Chips de filtro reutilizables: [[clave, texto]], devuelve nada; alElegir(clave)
export function chipsFiltro(cont, opciones, actual, alElegir) {
  cont.innerHTML = opciones.map(([k, t]) => `<button type="button" class="chip ${k === actual ? 'activo' : ''}" data-f="${k}">${esc(t)}</button>`).join('');
  $$('[data-f]', cont).forEach(b => b.onclick = () => alElegir(b.dataset.f));
}
