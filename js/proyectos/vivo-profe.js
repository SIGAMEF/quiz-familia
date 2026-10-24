// ============================================================
// Proyectos en grupo: control de la sesión en vivo (profesor)
// Consulta proyecto_estado_profe cada 1,5 s (como las salas de juego) y expone las acciones.
// ============================================================
import { supabase, urlBase, mensajeError } from '../comun.js';
import { esPregunta } from './preguntas.js';
import { ajustarReloj } from './ruleta.js';

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

export const enlaceParticipante = (pin) => `${urlBase()}proyecto.html?pin=${pin}`;

// Borra del Storage las fotos de participantes que devuelve reiniciar/borrar
export async function borrarFotos(rutas) {
  if (!rutas?.length) return;
  try { await supabase.storage.from('preguntas-imagenes').remove(rutas); } catch { /* quedan huérfanas, no es grave */ }
}

// api.alCambiar(datos) se llama cada vez que llega el estado; api.alError(mensaje) si falla la consulta 3 veces seguidas
export function crearVivo(sesion, { alCambiar = () => {}, alError = () => {} } = {}) {
  let datos = { sesion, participantes: [], grupos: [], respuestas: [] };
  let t = null, activo = false, fallos = 0;

  const sondear = async () => {
    clearTimeout(t);
    if (!activo) return;
    try {
      datos = await rpc('proyecto_estado_profe', { p_sesion: datos.sesion.id });
      ajustarReloj(datos.ahora);
      fallos = 0;
      api.alCambiar(datos);
    } catch (e) {
      if (++fallos === 3) api.alError(mensajeError(e));
    } finally {
      if (activo && datos.sesion.estado !== 'finalizada') t = setTimeout(sondear, 1500);
    }
  };
  // cada acción se aplica y enseguida se vuelve a consultar
  const accion = async (nombre, args) => {
    const r = await rpc(nombre, args);
    await sondear();
    return r;
  };
  const id = () => datos.sesion.id;

  const api = {
    alCambiar, alError,
    get sesion() { return datos.sesion; },
    get datos() { return datos; },
    get url() { return enlaceParticipante(datos.sesion.pin); },
    iniciar() { activo = true; return sondear(); },
    detener() { activo = false; clearTimeout(t); },
    ir: (hoja) => accion('proyecto_ir_a_hoja', { p_sesion: id(), p_hoja: hoja }),
    registro: (abierto, tardios = null) => accion('proyecto_registro', { p_sesion: id(), p_abierto: abierto, p_tardios: tardios }),
    respuestas: (abiertas, revelar = null) => accion('proyecto_respuestas', { p_sesion: id(), p_abiertas: abiertas, p_revelar: revelar }),
    pausar: (si) => accion('proyecto_pausar', { p_sesion: id(), p_pausar: si }),
    // al finalizar se borran las fotos de los participantes
    finalizar: async () => { const r = await accion('proyecto_finalizar', { p_sesion: id() }); await borrarFotos(r?.fotos); return r; },
    expulsar: (p) => accion('proyecto_expulsar', { p_sesion: id(), p_participante: p }),
    formar: (hoja, cantidad, por) => accion('proyecto_formar_grupos', { p_sesion: id(), p_hoja: hoja, p_cantidad: cantidad, p_por: por }),
    confirmar: (hoja, si = true) => accion('proyecto_confirmar_grupos', { p_sesion: id(), p_hoja: hoja, p_confirmar: si }),
    renombrar: (g, nombre, color, emoji) => accion('proyecto_renombrar_grupo', { p_grupo: g, p_nombre: nombre, p_color: color, p_emoji: emoji }),
    mover: (p, g) => accion('proyecto_mover_participante', { p_participante: p, p_grupo: g }),
    girar: (hoja) => accion('ruleta_girar', { p_sesion: id(), p_hoja: hoja }),
    reiniciarRuleta: (hoja) => accion('ruleta_reiniciar', { p_sesion: id(), p_hoja: hoja }),
    juego: (que) => accion('proyecto_juego', { p_sesion: id(), p_accion: que }),   // 'iniciar' | 'terminar' | 'reiniciar'
    async reiniciar() {
      const r = await rpc('proyecto_reiniciar_sesion', { p_sesion: id() });
      await borrarFotos(r.fotos);
      datos.sesion = r.sesion;
      await sondear();
      return r.sesion;
    },
    // Lo que necesita la zona de una hoja (mismo formato que la simulación)
    res(hoja) {
      const s = datos.sesion;
      if (hoja.tipo === 'agrupar') {
        return { participantes: datos.participantes, grupos: datos.grupos.filter(g => g.hoja_id === hoja.id),
          pin: s.pin, url: enlaceParticipante(s.pin), profe: true, registro_abierto: s.registro_abierto };
      }
      if (hoja.tipo === 'juego') {
        const actual = s.hoja_id === hoja.id;
        // los grupos confirmados más recientes (de la última hoja Agrupar que se usó)
        const conf = datos.grupos.filter(g => g.confirmado).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const hg = conf.at(-1)?.hoja_id;
        return { participantes: datos.participantes, respuestas: actual ? datos.respuestas : [], grupos: conf.filter(g => g.hoja_id === hg),
          modoGrupo: hoja.config?.modo === 'grupo', inicio: actual && s.juego_inicio ? Date.parse(s.juego_inicio) : null,
          abiertas: actual && s.respuestas_abiertas, servidor: true, profe: true };
      }
      if (hoja.tipo === 'ruleta') {
        const r = datos.ruleta;
        return r?.hoja_id === hoja.id ? { candidatos: r.candidatos, sorteos: r.sorteos, profe: true } : { cargando: true, profe: true };
      }
      if (!esPregunta(hoja.tipo)) return null;
      const actual = s.hoja_id === hoja.id;
      const porGrupo = hoja.config?.modo === 'grupo';
      const grupo = (gid) => datos.grupos.find(g => g.id === gid);
      return {
        respuestas: actual ? datos.respuestas.map(r => {
          const g = porGrupo ? grupo(r.grupo_id) : null;
          return { alias: g ? g.nombre : r.alias, avatar: g ? g.emoji : r.avatar, valor: r.valor };
        }) : [],
        cerrado: actual && !s.respuestas_abiertas, revelar: actual && s.revelar
      };
    }
  };
  return api;
}
