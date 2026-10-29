// ============================================================
// Cultos: lectura y guardado de canciones en Supabase (tabla canciones, sql/12_cultos.sql)
// Se lee con mis_canciones() (las mías + las compartidas de mi institución) y se escribe
// directo en la tabla (las reglas RLS solo dejan tocar lo propio).
// ============================================================
import { supabase } from '../comun.js';

const COLUMNAS = 'id, profesor_id, titulo, autor, tono, etiquetas, bloques, orden_canto, opciones, compartida, resaltados, detalles, created_at, updated_at';
const sinPermiso = (error) => /JSON object requested|0 rows|multiple \(or no\) rows/i.test(error?.message || '')
  ? new Error('Ya no existe o no es tuya.') : error;

export const datosCanciones = {
  async listar() {
    const { data, error } = await supabase.rpc('mis_canciones');
    if (error) throw error;
    return data || [];
  },
  async obtener(id) {
    const { data, error } = await supabase.from('canciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return { ...data, mia: data.profesor_id === session?.user?.id };
  },
  async crear(fila) {
    const { data, error } = await supabase.from('canciones').insert(fila).select(COLUMNAS).single();
    if (error) throw error;
    return { ...data, mia: true };
  },
  async guardar(id, fila) {
    const { data, error } = await supabase.from('canciones').update(fila).eq('id', id).select(COLUMNAS).single();
    if (error) throw sinPermiso(error);
    return { ...data, mia: true };
  },
  async eliminar(id) {
    const { error } = await supabase.from('canciones').delete().eq('id', id);
    if (error) throw error;
  }
};

// Plantillas propias (tabla plantillas_culto); las prediseñadas están en js/cultos/plantillas.js
const COLS_PLANTILLA = 'id, nombre, categoria, base, diseno, created_at, updated_at';
export const datosPlantillas = {
  async listar() {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('plantillas_culto').select(COLS_PLANTILLA)
      .eq('profesor_id', session?.user?.id || '00000000-0000-0000-0000-000000000000').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async obtener(id) {
    const { data, error } = await supabase.from('plantillas_culto').select(COLS_PLANTILLA).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async crear(fila) {
    const { data, error } = await supabase.from('plantillas_culto').insert(fila).select(COLS_PLANTILLA).single();
    if (error) throw error;
    return data;
  },
  async guardar(id, fila) {
    const { data, error } = await supabase.from('plantillas_culto').update(fila).eq('id', id).select(COLS_PLANTILLA).single();
    if (error) throw sinPermiso(error);
    return data;
  },
  async eliminar(id) {
    const { error } = await supabase.from('plantillas_culto').delete().eq('id', id);
    if (error) throw error;
  }
};
