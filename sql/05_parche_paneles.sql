-- =====================================================================
-- PASO 5 — Funciones de apoyo para los paneles (profesor, alumno, admin)
-- Se puede ejecutar varias veces sin problema.
-- =====================================================================

-- Pregunta completa (con respuestas) — solo para el dueño
create or replace function public._pregunta_completa(p public.preguntas) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object('opciones', coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto, 'imagen_url', o.imagen_url,
                                        'es_correcta', o.es_correcta, 'orden', o.orden) order by o.orden)
    from opciones o where o.pregunta_id = p.id), '[]'::jsonb));
$$;
revoke execute on function public._pregunta_completa(public.preguntas) from public, anon, authenticated;

-- Mis quizzes con conteos
create or replace function public.mis_quizzes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'titulo', q.titulo, 'tema', q.tema, 'descripcion', q.descripcion,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'n_preguntas', (select count(*) from preguntas p where p.quiz_id = q.id),
    'puntos', (select coalesce(sum(p.puntos), 0) from preguntas p where p.quiz_id = q.id and p.tipo <> 'lluvia_ideas'),
    'n_publicaciones', (select count(*) from publicaciones pu where pu.quiz_id = q.id),
    'subtemas', (select coalesce(jsonb_agg(distinct p.subtema) filter (where p.subtema is not null), '[]'::jsonb)
                 from preguntas p where p.quiz_id = q.id)
  ) order by q.updated_at desc), '[]'::jsonb)
  from quizzes q where q.profesor_id = auth.uid();
$$;

-- Todas las preguntas de un quiz, con respuestas (editor)
create or replace function public.preguntas_de_quiz(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_dueno_quiz(p_quiz) or es_admin()) then raise exception 'No es tu quiz'; end if;
  return (select coalesce(jsonb_agg(_pregunta_completa(p) order by p.orden, p.created_at), '[]'::jsonb)
          from preguntas p where p.quiz_id = p_quiz);
end $$;

-- Buscar en todas mis preguntas
create or replace function public.banco_preguntas(p_texto text default null, p_quiz uuid default null,
  p_subtema text default null, p_tipo text default null, p_limite int default 300) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select p.*, q.titulo as quiz_titulo
    from preguntas p join quizzes q on q.id = p.quiz_id
    where q.profesor_id = auth.uid()
      and (p_quiz is null or p.quiz_id = p_quiz)
      and (coalesce(p_subtema, '') = '' or p.subtema = p_subtema)
      and (coalesce(p_tipo, '') = '' or p.tipo = p_tipo)
      and not exists (
        select 1 from unnest(string_to_array(_normalizar(p_texto), ' ')) w
        where w <> '' and position(w in _normalizar(p.enunciado || ' ' || coalesce(p.subtema, '') || ' ' || q.titulo)) = 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'preguntas', coalesce((select jsonb_agg(x.j order by x.quiz_titulo, x.orden) from (
        select b.quiz_titulo, b.orden,
               _pregunta_completa(pr) || jsonb_build_object('quiz_titulo', b.quiz_titulo) as j
        from base b join preguntas pr on pr.id = b.id
        order by b.quiz_titulo, b.orden limit greatest(1, least(coalesce(p_limite, 300), 1000))) x), '[]'::jsonb),
    'subtemas', coalesce((select jsonb_agg(distinct p.subtema) filter (where p.subtema is not null)
                          from preguntas p join quizzes q on q.id = p.quiz_id where q.profesor_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- Agregar varias preguntas a un quiz existente (carga masiva)
create or replace function public.agregar_preguntas(p_quiz uuid, p_preguntas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare pr jsonb; v_err text; v_orden int; n int := 0; v_omit jsonb := '[]';
begin
  if not ((es_dueno_quiz(p_quiz) and esta_activo()) or es_admin()) then raise exception 'No es tu quiz'; end if;
  select coalesce(max(orden), 0) into v_orden from preguntas where quiz_id = p_quiz;
  for pr in select * from jsonb_array_elements(coalesce(p_preguntas, '[]'::jsonb)) loop
    v_err := _error_pregunta(pr);
    if v_err is not null then
      v_omit := v_omit || jsonb_build_object('enunciado', pr->>'enunciado', 'motivo', v_err);
      continue;
    end if;
    v_orden := v_orden + 1; n := n + 1;
    perform _insertar_pregunta(p_quiz, pr, v_orden);
  end loop;
  return jsonb_build_object('agregadas', n, 'omitidas', v_omit);
end $$;

-- Mis grupos con conteos
create or replace function public.mis_grupos_profesor() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(g) || jsonb_build_object(
    'n_alumnos', (select count(*) from alumno_grupos ag where ag.grupo_id = g.id),
    'n_publicaciones', (select count(*) from publicaciones pu where pu.grupo_id = g.id)
  ) order by g.nombre), '[]'::jsonb)
  from grupos g where g.profesor_id = auth.uid();
$$;

-- Mis publicaciones con resumen
create or replace function public.mis_publicaciones_profesor() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(pu) || jsonb_build_object(
    'quiz_titulo', q.titulo, 'grupo_nombre', g.nombre, 'escala', g.escala, 'periodo_nombre', pe.nombre,
    'n_preguntas', (select count(*) from preguntas p where p.quiz_id = q.id),
    'n_alumnos', (select count(*) from alumno_grupos ag where ag.grupo_id = g.id),
    'rindieron', (select count(distinct i.alumno_id) from intentos i where i.publicacion_id = pu.id and i.estado = 'finalizado'),
    'promedio', (select round(avg(x.nota), 1) from (
        select max(nota_vigesimal(i.puntaje, i.puntaje_max)) as nota from intentos i
        where i.publicacion_id = pu.id and i.estado = 'finalizado' group by i.alumno_id) x)
  ) order by pu.created_at desc), '[]'::jsonb)
  from publicaciones pu
  join grupos g on g.id = pu.grupo_id and g.profesor_id = auth.uid()
  join quizzes q on q.id = pu.quiz_id
  left join periodos pe on pe.id = pu.periodo_id;
$$;

-- Resultados de una publicación (incluye a quienes no rindieron)
create or replace function public.resultados_publicacion(p_pub uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_pub publicaciones%rowtype;
begin
  select * into v_pub from publicaciones where id = p_pub;
  if not found or not (es_dueno_grupo(v_pub.grupo_id) or es_admin()) then raise exception 'No es tu publicación'; end if;
  return jsonb_build_object(
    'intentos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'alumno_id', i.alumno_id, 'nombre', coalesce(p.nombre, p.usuario), 'usuario', p.usuario, 'avatar', p.avatar,
        'estado', i.estado, 'puntaje', i.puntaje, 'puntaje_max', i.puntaje_max,
        'nota', nota_vigesimal(i.puntaje, i.puntaje_max), 'iniciado_en', i.iniciado_en, 'finalizado_en', i.finalizado_en,
        'intento', (select count(*) from intentos i2 where i2.publicacion_id = i.publicacion_id and i2.alumno_id = i.alumno_id and i2.iniciado_en <= i.iniciado_en),
        'aciertos', (select count(*) from respuestas r where r.intento_id = i.id and r.es_correcta),
        'total', cardinality(i.preguntas_ids)
      ) order by coalesce(p.nombre, p.usuario), i.iniciado_en), '[]'::jsonb)
      from intentos i join perfiles p on p.id = i.alumno_id where i.publicacion_id = p_pub),
    'sin_rendir', (select coalesce(jsonb_agg(jsonb_build_object('alumno_id', p.id, 'nombre', coalesce(p.nombre, p.usuario), 'usuario', p.usuario, 'avatar', p.avatar)
                   order by coalesce(p.nombre, p.usuario)), '[]'::jsonb)
      from alumno_grupos ag join perfiles p on p.id = ag.alumno_id
      where ag.grupo_id = v_pub.grupo_id
        and not exists (select 1 from intentos i where i.publicacion_id = p_pub and i.alumno_id = p.id and i.estado = 'finalizado'))
  );
end $$;

-- Detalle de un intento (para que el profesor revise respuesta por respuesta)
create or replace function public.detalle_intento(p_intento uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_int intentos%rowtype; v_dueno boolean;
begin
  select * into v_int from intentos where id = p_intento;
  if not found then raise exception 'Intento no encontrado'; end if;
  select es_dueno_grupo(pu.grupo_id) or es_admin() into v_dueno from publicaciones pu where pu.id = v_int.publicacion_id;
  if not v_dueno then raise exception 'No tienes acceso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'enunciado', p.enunciado, 'tipo', p.tipo, 'puntos_max', p.puntos,
      'respondida', r.id is not null, 'es_correcta', r.es_correcta, 'puntos', r.puntos, 'tiempo_seg', r.tiempo_seg,
      'tu_respuesta', coalesce((select string_agg(coalesce(nullif(o.texto, ''), '(imagen)'), ' / ' order by o.orden) from opciones o where o.id = any(r.opciones_ids)),
                               nullif(array_to_string(r.textos, ', '), '')),
      'correcta_texto', (select k.o_texto from _calificar(p.id, '{}', '{}') k)) order by u.n), '[]'::jsonb)
    from unnest(v_int.preguntas_ids) with ordinality as u(pid, n)
    join preguntas p on p.id = u.pid
    left join respuestas r on r.intento_id = v_int.id and r.pregunta_id = p.id);
end $$;

-- Mis sesiones en vivo
create or replace function public.mis_sesiones_vivo() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'titulo', s.titulo, 'modo', s.modo, 'estado', s.estado, 'codigo', s.codigo, 'created_at', s.created_at,
    'quiz_titulo', q.titulo, 'grupo_nombre', g.nombre,
    'n_preguntas', (select count(*) from vivo_preguntas vp where vp.sesion_id = s.id),
    'n_participantes', (select count(*) from vivo_participantes pa where pa.sesion_id = s.id)
  ) order by s.created_at desc), '[]'::jsonb)
  from sesiones_vivo s join quizzes q on q.id = s.quiz_id left join grupos g on g.id = s.grupo_id
  where s.profesor_id = auth.uid();
$$;

-- Historial del alumno (para su pantalla)
create or replace function public.mi_historial(p_limite int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.f desc), '[]'::jsonb) from (
    select i.finalizado_en as f, jsonb_build_object(
      'id', i.id, 'publicacion_id', i.publicacion_id, 'titulo', q.titulo, 'modo', pu.modo,
      'puntaje', i.puntaje, 'puntaje_max', i.puntaje_max, 'nota', nota_vigesimal(i.puntaje, i.puntaje_max),
      'escala', g.escala, 'finalizado_en', i.finalizado_en) as j
    from intentos i join publicaciones pu on pu.id = i.publicacion_id
    join quizzes q on q.id = pu.quiz_id join grupos g on g.id = pu.grupo_id
    where i.alumno_id = auth.uid() and i.estado = 'finalizado'
    order by i.finalizado_en desc limit greatest(1, least(coalesce(p_limite, 30), 200))
  ) x;
$$;


-- El total de preguntas del resultado no cuenta las de lluvia de ideas (no se califican)
create or replace function public.finalizar_intento(p_intento uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_int intentos%rowtype; v_pub publicaciones%rowtype; v_nota numeric; v_revision jsonb;
begin
  update intentos set estado = 'finalizado', finalizado_en = now(),
         puntaje = (select coalesce(sum(puntos), 0) from respuestas where intento_id = p_intento)
  where id = p_intento and alumno_id = auth.uid() and estado = 'en_curso'
  returning * into v_int;
  if not found then
    select * into v_int from intentos where id = p_intento and alumno_id = auth.uid();
    if not found then raise exception 'Intento no válido'; end if;
  end if;
  select * into v_pub from publicaciones where id = v_int.publicacion_id;
  v_nota := nota_vigesimal(v_int.puntaje, v_int.puntaje_max);

  if v_pub.mostrar_respuestas then
    select coalesce(jsonb_agg(jsonb_build_object(
             'enunciado', p.enunciado, 'tipo', p.tipo, 'es_correcta', r.es_correcta,
             'respondida', r.id is not null,
             'tu_respuesta', coalesce(
                 (select string_agg(coalesce(nullif(o.texto, ''), '(imagen)'), ' / ' order by o.orden)
                  from opciones o where o.id = any(r.opciones_ids)),
                 nullif(array_to_string(r.textos, ', '), '')),
             'correcta_texto', (select k.o_texto from _calificar(p.id, '{}', '{}') k),
             'explicacion', p.explicacion) order by u.n), '[]'::jsonb)
      into v_revision
    from unnest(v_int.preguntas_ids) with ordinality as u(pid, n)
    join preguntas p on p.id = u.pid
    left join respuestas r on r.intento_id = v_int.id and r.pregunta_id = p.id;
  end if;

  return jsonb_build_object(
    'puntaje', v_int.puntaje, 'puntaje_max', v_int.puntaje_max,
    'nota', v_nota, 'nota_literal', nota_literal(v_nota),
    'escala', (select escala from grupos where id = v_pub.grupo_id),
    'aciertos', (select count(*) from respuestas where intento_id = v_int.id and es_correcta),
    'total', (select count(*) from preguntas where id = any(v_int.preguntas_ids) and tipo <> 'lluvia_ideas'),
    'revision', v_revision);
end $$;


-- vivo_preguntas_publicas: incluye la hora del servidor para sincronizar cronómetros
create or replace function public.vivo_preguntas_publicas(p_sesion uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_s sesiones_vivo%rowtype; v_total int; v_preg jsonb;
begin
  select * into v_s from sesiones_vivo where id = p_sesion;
  if not found then raise exception 'Sesión no encontrada'; end if;
  select count(*) into v_total from vivo_preguntas where sesion_id = p_sesion;

  with lista as (
    select vp.*, row_number() over (order by vp.orden, vp.id) - 1 as idx
    from vivo_preguntas vp where vp.sesion_id = p_sesion
  )
  select coalesce(jsonb_agg(_pregunta_publica(p, false)
                            || jsonb_build_object('puntos', l.puntos, 'indice', l.idx) order by l.idx), '[]'::jsonb)
    into v_preg
  from lista l join preguntas p on p.id = l.pregunta_id
  where (v_s.modo = 'plazo' and v_s.estado in ('en_curso','finalizado'))
     or (v_s.modo = 'vivo' and v_s.estado = 'en_curso' and l.idx <= v_s.pregunta_actual)
     or (v_s.modo = 'vivo' and v_s.estado = 'finalizado');

  return jsonb_build_object('total', v_total, 'preguntas', v_preg, 'ahora', now());
end $$;


-- vivo_estadisticas: incluye la hora del servidor para sincronizar cronómetros
create or replace function public.vivo_estadisticas(p_sesion uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_s sesiones_vivo%rowtype; v_actual uuid;
begin
  select * into v_s from sesiones_vivo where id = p_sesion;
  if not found or not (v_s.profesor_id = auth.uid() or es_admin()) then raise exception 'No es tu sesión'; end if;
  select pregunta_id into v_actual from (
    select pregunta_id, row_number() over (order by orden, id) - 1 as idx from vivo_preguntas where sesion_id = p_sesion) x
  where idx = v_s.pregunta_actual;

  return jsonb_build_object(
    'ahora', now(),
    'sesion', jsonb_build_object('id', v_s.id, 'estado', v_s.estado, 'pregunta_actual', v_s.pregunta_actual,
                                 'pregunta_iniciada_en', v_s.pregunta_iniciada_en, 'codigo', v_s.codigo),
    'participantes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', pa.id, 'alias', pa.alias, 'avatar', pa.avatar, 'estado', pa.estado, 'es_alumno', pa.alumno_id is not null,
        'puntaje', pa.puntaje, 'iniciado_en', pa.iniciado_en, 'tiempo_total_seg', pa.tiempo_total_seg,
        'respondidas', (select count(*) from vivo_respuestas r where r.participante_id = pa.id),
        'aciertos', (select count(*) from vivo_respuestas r where r.participante_id = pa.id and r.es_correcta),
        'tiempo', (select coalesce(sum(tiempo_seg), 0) from vivo_respuestas r where r.participante_id = pa.id))
        order by pa.puntaje desc, pa.created_at), '[]'::jsonb)
      from vivo_participantes pa where pa.sesion_id = p_sesion),
    'actual', case when v_actual is null then null else jsonb_build_object(
        'pregunta_id', v_actual,
        'respondieron', (select count(*) from vivo_respuestas r join vivo_participantes pa on pa.id = r.participante_id
                         where pa.sesion_id = p_sesion and r.pregunta_id = v_actual),
        'acertaron', (select count(*) from vivo_respuestas r join vivo_participantes pa on pa.id = r.participante_id
                      where pa.sesion_id = p_sesion and r.pregunta_id = v_actual and r.es_correcta),
        'distribucion', (select coalesce(jsonb_agg(jsonb_build_object('opcion_id', o.id, 'texto', o.texto,
                            'es_correcta', o.es_correcta,
                            'votos', (select count(*) from vivo_respuestas r join vivo_participantes pa on pa.id = r.participante_id
                                      where pa.sesion_id = p_sesion and r.pregunta_id = v_actual and o.id = any(r.opciones_ids)))
                            order by o.orden), '[]'::jsonb)
                         from opciones o where o.pregunta_id = v_actual)) end);
end $$;


-- En vivo: cada punto del quiz vale 1000 (estilo Kahoot) y el puntaje es entero
alter table public.vivo_preguntas alter column puntos type numeric(10,2);
alter table public.vivo_preguntas alter column puntos set default 1000;

create or replace function public.vivo_crear(p_quiz uuid, p_config jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid; v_total int; v_fijas uuid[]; v_ids uuid[]; v_pts jsonb;
begin
  if not ((es_dueno_quiz(p_quiz) and esta_activo()) or es_admin()) then raise exception 'No es tu quiz'; end if;
  v_fijas := coalesce(array(select jsonb_array_elements_text(p_config->'fijas')::uuid), '{}');
  v_pts   := coalesce(p_config->'puntos', '{}'::jsonb);   -- {"<pregunta_id>": 2, ...}
  v_total := coalesce(nullif(p_config->>'cantidad', '')::int,
                      (select count(*) from preguntas where quiz_id = p_quiz));

  v_ids := array(select id from preguntas where quiz_id = p_quiz and id = any(v_fijas) order by orden)
        || array(select id from preguntas where quiz_id = p_quiz and not (id = any(v_fijas))
                 order by case when coalesce((p_config->>'aleatorio')::boolean, true) then random() else orden::float8 end
                 limit greatest(0, v_total - cardinality(v_fijas)));
  if cardinality(v_ids) = 0 then raise exception 'El quiz no tiene preguntas'; end if;

  insert into sesiones_vivo (profesor_id, quiz_id, grupo_id, titulo, modo, seg_por_pregunta, seg_total,
                             puntos_velocidad, permite_invitados)
  values (auth.uid(), p_quiz, nullif(p_config->>'grupo_id', '')::uuid,
          coalesce(nullif(trim(p_config->>'titulo'), ''), (select titulo from quizzes where id = p_quiz)),
          coalesce(p_config->>'modo', 'vivo'),
          nullif(p_config->>'seg_por_pregunta', '')::int, nullif(p_config->>'seg_total', '')::int,
          coalesce((p_config->>'puntos_velocidad')::boolean, true),
          coalesce((p_config->>'permite_invitados')::boolean, true))
  returning id into v_id;

  insert into vivo_preguntas (sesion_id, pregunta_id, puntos, es_fija, orden)
  select v_id, u.pid,
         1000 * coalesce(nullif(v_pts->>(u.pid::text), '')::numeric, (select puntos from preguntas where id = u.pid)),
         u.pid = any(v_fijas), u.n
  from unnest(v_ids) with ordinality as u(pid, n);
  return v_id;
end $$;

create or replace function public.vivo_responder(p_participante uuid, p_token uuid, p_pregunta uuid,
  p_opciones uuid[] default '{}', p_textos text[] default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_pa vivo_participantes%rowtype; v_s sesiones_vivo%rowtype; v_q record; c record;
  v_t numeric; v_puntos numeric; v_p preguntas%rowtype;
begin
  v_pa := _vivo_participante(p_participante, p_token);
  select * into v_s from sesiones_vivo where id = v_pa.sesion_id;
  if v_s.estado <> 'en_curso' then raise exception 'La sesión no está en curso'; end if;
  if v_pa.estado = 'finalizado' then raise exception 'Ya terminaste'; end if;

  select x.* into v_q from (
    select vp.pregunta_id, vp.puntos, row_number() over (order by vp.orden, vp.id) - 1 as idx
    from vivo_preguntas vp where vp.sesion_id = v_s.id) x
  where x.pregunta_id = p_pregunta;
  if not found then raise exception 'Esa pregunta no es de esta sesión'; end if;

  if v_s.modo = 'vivo' then
    if v_q.idx <> v_s.pregunta_actual then raise exception 'Esa pregunta ya pasó'; end if;
    v_t := extract(epoch from now() - v_s.pregunta_iniciada_en);
    if v_s.seg_por_pregunta is not null and v_t > v_s.seg_por_pregunta + 2 then raise exception 'Se acabó el tiempo'; end if;
  else
    if v_pa.iniciado_en is null then raise exception 'Primero pulsa Empezar'; end if;
    if v_s.seg_total is not null and now() > v_pa.iniciado_en + make_interval(secs => v_s.seg_total + 5) then
      raise exception 'Se acabó tu tiempo';
    end if;
    v_t := extract(epoch from now() - coalesce(
             (select max(created_at) from vivo_respuestas where participante_id = v_pa.id), v_pa.iniciado_en));
  end if;

  select * into v_p from preguntas where id = p_pregunta;
  select * into c from _calificar(p_pregunta, p_opciones, p_textos);
  v_puntos := v_q.puntos * c.o_fraccion;
  -- bonus por rapidez (estilo Kahoot): entre 50% y 100% de los puntos según el tiempo
  if v_s.modo = 'vivo' and v_s.puntos_velocidad and v_s.seg_por_pregunta is not null and c.o_fraccion > 0 then
    v_puntos := v_puntos * (0.5 + 0.5 * greatest(0, 1 - v_t / v_s.seg_por_pregunta));
  end if;
  v_puntos := round(v_puntos);

  insert into vivo_respuestas (participante_id, pregunta_id, opciones_ids, textos, es_correcta, puntos, tiempo_seg)
  values (v_pa.id, p_pregunta, coalesce(p_opciones, '{}'), coalesce(p_textos, '{}'), c.o_correcta, v_puntos, round(v_t, 2))
  on conflict (participante_id, pregunta_id) do nothing;
  if not found then raise exception 'Ya respondiste esta pregunta'; end if;

  update vivo_participantes set puntaje = puntaje + v_puntos,
         estado = case when estado = 'esperando' then 'en_curso' else estado end
  where id = v_pa.id;

  return jsonb_build_object('es_correcta', c.o_correcta, 'fraccion', c.o_fraccion, 'puntos', v_puntos,
    'tiempo_seg', round(v_t, 2), 'correcta_texto', c.o_texto, 'explicacion', v_p.explicacion,
    'correctas_ids', (select coalesce(jsonb_agg(id), '[]'::jsonb) from opciones where pregunta_id = p_pregunta and es_correcta));
end $$;

-- Abrir un quiz en el editor: datos + preguntas en una sola llamada
create or replace function public.quiz_editor(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q quizzes%rowtype;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  select * into v_q from quizzes where id = p_quiz;
  if not found then raise exception 'Ese quiz ya no existe (id %).', p_quiz; end if;
  if not (v_q.profesor_id = auth.uid() or es_admin()) then raise exception 'Este quiz pertenece a otro profesor.'; end if;
  return jsonb_build_object(
    'quiz', to_jsonb(v_q),
    'preguntas', (select coalesce(jsonb_agg(_pregunta_completa(p) order by p.orden, p.created_at), '[]'::jsonb)
                  from preguntas p where p.quiz_id = p_quiz));
end $$;


-- =====================================================================
-- PUBLICACIONES CON ENLACE / QR  y  EN VIVO DESDE UNA PUBLICACIÓN
-- =====================================================================
-- Columnas nuevas (se pueden ejecutar varias veces)
alter table public.publicaciones add column if not exists permite_invitados boolean not null default false;
alter table public.intentos alter column alumno_id drop not null;
alter table public.intentos add column if not exists alias text;
alter table public.intentos add column if not exists avatar text;
alter table public.intentos add column if not exists token uuid;
alter table public.sesiones_vivo add column if not exists publicacion_id uuid references public.publicaciones(id) on delete set null;
alter table public.sesiones_vivo add column if not exists registrar_notas boolean not null default true;
alter table public.intentos add column if not exists vivo_sesion_id uuid references public.sesiones_vivo(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'intentos_alumno_o_invitado') then
    alter table public.intentos add constraint intentos_alumno_o_invitado
      check (alumno_id is not null or (alias is not null and token is not null));
  end if;
end $$;
create index if not exists intentos_vivo_sesion_idx on public.intentos (vivo_sesion_id);
create index if not exists sesiones_vivo_publicacion_idx on public.sesiones_vivo (publicacion_id);

-- ---------- Piezas internas compartidas por alumnos e invitados ----------
create or replace function public._pub_motivo(v_pub public.publicaciones) returns text
language sql stable set search_path = public as $$
  select case
    when not v_pub.activo then 'El profesor ocultó este quiz por ahora.'
    when v_pub.inicio is not null and now() < v_pub.inicio then 'Este quiz aún no está disponible.'
    when v_pub.fin is not null and now() > v_pub.fin then 'Este quiz ya cerró.'
    when not exists (select 1 from preguntas where quiz_id = v_pub.quiz_id) then 'Este quiz todavía no tiene preguntas.'
  end;
$$;

-- p_token null = alumno con sesión; p_token = invitado
create or replace function public._intento_de(p_intento uuid, p_token uuid) returns public.intentos
language plpgsql stable security definer set search_path = public as $$
declare v intentos%rowtype;
begin
  if p_token is null then
    select * into v from intentos where id = p_intento and alumno_id = auth.uid();
  else
    select * into v from intentos where id = p_intento and alumno_id is null and token = p_token;
  end if;
  if not found then raise exception 'Intento no válido'; end if;
  return v;
end $$;

create or replace function public._crear_intento(v_pub public.publicaciones, p_alumno uuid, p_alias text,
  p_avatar text, p_cantidad int) returns public.intentos
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_ids uuid[]; v_max numeric; v_n int; v_int intentos%rowtype;
begin
  if v_pub.modo = 'estudio' then
    -- primero las preguntas que todavía no ha visto, luego al azar
    v_n := greatest(1, coalesce(p_cantidad, v_pub.cantidad_preguntas, 10));
    v_ids := array(
      select p.id from preguntas p where p.quiz_id = v_pub.quiz_id
      order by exists (select 1 from respuestas r join intentos i on i.id = r.intento_id
                       where p_alumno is not null and i.alumno_id = p_alumno and r.pregunta_id = p.id), random()
      limit v_n);
  else
    v_ids := array(
      select p.id from preguntas p where p.quiz_id = v_pub.quiz_id
      order by case when v_pub.barajar_preguntas then random() else p.orden::float8 end, p.created_at
      limit v_pub.cantidad_preguntas);
  end if;
  if cardinality(v_ids) = 0 then raise exception 'Este quiz todavía no tiene preguntas'; end if;

  select coalesce(sum(puntos), 0) into v_max from preguntas where id = any(v_ids) and tipo <> 'lluvia_ideas';
  insert into intentos (publicacion_id, alumno_id, alias, avatar, token, preguntas_ids, puntaje_max)
  values (v_pub.id, p_alumno, p_alias, p_avatar, case when p_alumno is null then gen_random_uuid() end, v_ids, v_max)
  returning * into v_int;
  return v_int;
end $$;

create or replace function public._preguntas_intento(v_int public.intentos) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_pub publicaciones%rowtype; v_preg jsonb;
begin
  select * into v_pub from publicaciones where id = v_int.publicacion_id;
  select coalesce(jsonb_agg(_pregunta_publica(p, v_pub.barajar_opciones)
                            || jsonb_build_object('respondida', r.id is not null) order by u.n), '[]'::jsonb)
    into v_preg
  from unnest(v_int.preguntas_ids) with ordinality as u(pid, n)
  join preguntas p on p.id = u.pid
  left join respuestas r on r.intento_id = v_int.id and r.pregunta_id = p.id;

  return jsonb_build_object(
    'intento_id', v_int.id, 'estado', v_int.estado, 'puntaje_max', v_int.puntaje_max,
    'publicacion', jsonb_build_object('id', v_pub.id, 'modo', v_pub.modo,
        'seg_por_pregunta', v_pub.seg_por_pregunta, 'mostrar_respuestas', v_pub.mostrar_respuestas,
        'titulo', (select titulo from quizzes where id = v_pub.quiz_id)),
    'preguntas', v_preg);
end $$;

create or replace function public._responder_intento(v_int public.intentos, p_pregunta uuid, p_opciones uuid[],
  p_textos text[], p_tiempo_seg numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_pub publicaciones%rowtype; v_p preguntas%rowtype; c record; v_puntos numeric;
begin
  if v_int.estado <> 'en_curso' then raise exception 'Este intento ya terminó'; end if;
  if not (p_pregunta = any(v_int.preguntas_ids)) then raise exception 'Esa pregunta no es de este intento'; end if;
  select * into v_pub from publicaciones where id = v_int.publicacion_id;
  select * into v_p from preguntas where id = p_pregunta;

  select * into c from _calificar(p_pregunta, p_opciones, p_textos);
  v_puntos := round(v_p.puntos * c.o_fraccion, 2);

  insert into respuestas (intento_id, pregunta_id, opciones_ids, textos, es_correcta, puntos, tiempo_seg)
  values (v_int.id, p_pregunta, coalesce(p_opciones, '{}'), coalesce(p_textos, '{}'), c.o_correcta, v_puntos, p_tiempo_seg)
  on conflict (intento_id, pregunta_id) do nothing;
  if not found then raise exception 'Ya respondiste esta pregunta'; end if;

  if v_pub.modo = 'examen' then
    return jsonb_build_object('registrada', true, 'mostrar', false);
  end if;
  return jsonb_build_object('registrada', true, 'mostrar', true,
    'es_correcta', c.o_correcta, 'fraccion', c.o_fraccion, 'puntos', v_puntos,
    'correcta_texto', c.o_texto, 'explicacion', v_p.explicacion,
    'correctas_ids', (select coalesce(jsonb_agg(id), '[]'::jsonb) from opciones where pregunta_id = p_pregunta and es_correcta));
end $$;

create or replace function public._finalizar_intento(p_int public.intentos) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_int intentos%rowtype; v_pub publicaciones%rowtype; v_nota numeric; v_revision jsonb;
begin
  update intentos set estado = 'finalizado', finalizado_en = now(),
         puntaje = (select coalesce(sum(puntos), 0) from respuestas where intento_id = p_int.id)
  where id = p_int.id and estado = 'en_curso'
  returning * into v_int;
  if not found then v_int := p_int; end if;
  select * into v_pub from publicaciones where id = v_int.publicacion_id;
  v_nota := nota_vigesimal(v_int.puntaje, v_int.puntaje_max);

  if v_pub.mostrar_respuestas then
    select coalesce(jsonb_agg(jsonb_build_object(
             'enunciado', p.enunciado, 'tipo', p.tipo, 'es_correcta', r.es_correcta,
             'respondida', r.id is not null,
             'tu_respuesta', coalesce(
                 (select string_agg(coalesce(nullif(o.texto, ''), '(imagen)'), ' / ' order by o.orden)
                  from opciones o where o.id = any(r.opciones_ids)),
                 nullif(array_to_string(r.textos, ', '), '')),
             'correcta_texto', (select k.o_texto from _calificar(p.id, '{}', '{}') k),
             'explicacion', p.explicacion) order by u.n), '[]'::jsonb)
      into v_revision
    from unnest(v_int.preguntas_ids) with ordinality as u(pid, n)
    join preguntas p on p.id = u.pid
    left join respuestas r on r.intento_id = v_int.id and r.pregunta_id = p.id;
  end if;

  return jsonb_build_object(
    'puntaje', v_int.puntaje, 'puntaje_max', v_int.puntaje_max,
    'nota', v_nota, 'nota_literal', nota_literal(v_nota),
    'escala', (select escala from grupos where id = v_pub.grupo_id),
    'aciertos', (select count(*) from respuestas where intento_id = v_int.id and es_correcta),
    'total', (select count(*) from preguntas where id = any(v_int.preguntas_ids) and tipo <> 'lluvia_ideas'),
    'revision', v_revision);
end $$;

-- ---------- Alumno con cuenta (mismos nombres de siempre) ----------
create or replace function public.iniciar_intento(p_publicacion uuid, p_cantidad int default null) returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_pub publicaciones%rowtype; v_usados int; v_motivo text;
begin
  select * into v_pub from publicaciones where id = p_publicacion;
  if not found or not es_miembro_grupo(v_pub.grupo_id) then raise exception 'No tienes acceso a este quiz'; end if;
  v_motivo := _pub_motivo(v_pub);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  if v_pub.intentos_max is not null then
    select count(*) into v_usados from intentos
    where publicacion_id = v_pub.id and alumno_id = auth.uid() and estado = 'finalizado';
    if v_usados >= v_pub.intentos_max then raise exception 'Ya usaste todos tus intentos'; end if;
  end if;
  return (_crear_intento(v_pub, auth.uid(), null, null, p_cantidad)).id;
end $$;

create or replace function public.preguntas_de_intento(p_intento uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select _preguntas_intento(_intento_de(p_intento, null));
$$;

create or replace function public.responder(
  p_intento uuid, p_pregunta uuid, p_opciones uuid[] default '{}', p_textos text[] default '{}',
  p_tiempo_seg numeric default null) returns jsonb
language sql security definer set search_path = public as $$
  select _responder_intento(_intento_de(p_intento, null), p_pregunta, p_opciones, p_textos, p_tiempo_seg);
$$;

create or replace function public.finalizar_intento(p_intento uuid) returns jsonb
language sql security definer set search_path = public as $$
  select _finalizar_intento(_intento_de(p_intento, null));
$$;

-- ---------- Enlace / QR de una publicación ----------
-- Datos públicos de la publicación y qué puede hacer quien abre el enlace
create or replace function public.pub_publica(p_pub uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_pub publicaciones%rowtype; v_g grupos%rowtype; v_rol text; v_usados int := 0;
begin
  select * into v_pub from publicaciones where id = p_pub;
  if not found then raise exception 'Este enlace no es válido o la publicación fue eliminada.'; end if;
  select * into v_g from grupos where id = v_pub.grupo_id;
  select rol into v_rol from perfiles where id = auth.uid();
  if auth.uid() is not null then
    select count(*) into v_usados from intentos
    where publicacion_id = v_pub.id and alumno_id = auth.uid() and estado = 'finalizado';
  end if;
  return (select jsonb_build_object(
    'id', v_pub.id, 'modo', v_pub.modo, 'titulo', q.titulo, 'tema', q.tema,
    'grupo', v_g.nombre, 'profesor', coalesce(pf.nombre, pf.usuario), 'avatar_profesor', pf.avatar,
    'institucion', pr.institucion, 'curso', pr.curso,
    'num_preguntas', (select count(*) from preguntas p where p.quiz_id = v_pub.quiz_id),
    'cantidad_preguntas', v_pub.cantidad_preguntas, 'seg_por_pregunta', v_pub.seg_por_pregunta,
    'intentos_max', v_pub.intentos_max, 'intentos_usados', v_usados,
    'inicio', v_pub.inicio, 'fin', v_pub.fin,
    'motivo', _pub_motivo(v_pub), 'disponible', _pub_motivo(v_pub) is null,
    'permite_invitados', v_pub.permite_invitados,
    'acepta_registros', v_g.acepta_registros,
    'rol', v_rol, 'soy_miembro', coalesce(es_miembro_grupo(v_g.id), false),
    'soy_dueno', coalesce(v_g.profesor_id = auth.uid(), false))
  from quizzes q, perfiles pf left join profesores pr on pr.perfil_id = pf.id
  where q.id = v_pub.quiz_id and pf.id = v_g.profesor_id);
end $$;

-- Un alumno con cuenta que abre el enlace y aún no está en el grupo
create or replace function public.unirme_por_publicacion(p_pub uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cod text;
begin
  select g.codigo_invitacion into v_cod from publicaciones pu join grupos g on g.id = pu.grupo_id where pu.id = p_pub;
  if v_cod is null then raise exception 'Este enlace no es válido o la publicación fue eliminada.'; end if;
  return unirme_a_grupo(v_cod);
end $$;

-- Invitado sin cuenta (solo si el profesor lo permitió en la publicación)
create or replace function public.invitado_iniciar(p_pub uuid, p_alias text, p_avatar text default null,
  p_cantidad int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pub publicaciones%rowtype; v_int intentos%rowtype; v_motivo text; v_alias text;
begin
  select * into v_pub from publicaciones where id = p_pub;
  if not found then raise exception 'Este enlace no es válido o la publicación fue eliminada.'; end if;
  if not v_pub.permite_invitados then raise exception 'Este quiz es solo para los alumnos del grupo. Inicia sesión con tu cuenta.'; end if;
  v_motivo := _pub_motivo(v_pub);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  v_alias := left(trim(coalesce(p_alias, '')), 40);
  if v_alias = '' then raise exception 'Escribe tu nombre'; end if;
  v_int := _crear_intento(v_pub, null, v_alias, left(p_avatar, 500), p_cantidad);
  return jsonb_build_object('intento_id', v_int.id, 'token', v_int.token);
end $$;

create or replace function public.invitado_preguntas(p_intento uuid, p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select _preguntas_intento(_intento_de(p_intento, coalesce(p_token, '00000000-0000-0000-0000-000000000000')));
$$;

create or replace function public.invitado_responder(p_intento uuid, p_token uuid, p_pregunta uuid,
  p_opciones uuid[] default '{}', p_textos text[] default '{}', p_tiempo_seg numeric default null) returns jsonb
language sql security definer set search_path = public as $$
  select _responder_intento(_intento_de(p_intento, coalesce(p_token, '00000000-0000-0000-0000-000000000000')),
                            p_pregunta, p_opciones, p_textos, p_tiempo_seg);
$$;

create or replace function public.invitado_finalizar(p_intento uuid, p_token uuid) returns jsonb
language sql security definer set search_path = public as $$
  select _finalizar_intento(_intento_de(p_intento, coalesce(p_token, '00000000-0000-0000-0000-000000000000')));
$$;

-- publicar_quiz ahora guarda también "permite_invitados"
create or replace function public.publicar_quiz(p_quiz uuid, p_grupos uuid[], p_config jsonb default '{}') returns int
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare g uuid; n int := 0;
begin
  if not ((es_dueno_quiz(p_quiz) and esta_activo()) or es_admin()) then raise exception 'No es tu quiz'; end if;
  if not exists (select 1 from preguntas where quiz_id = p_quiz) then raise exception 'El quiz no tiene preguntas'; end if;
  foreach g in array p_grupos loop
    if not (es_dueno_grupo(g) or es_admin()) then raise exception 'Uno de los grupos no es tuyo'; end if;
    insert into publicaciones (quiz_id, grupo_id, periodo_id, modo, activo, inicio, fin, intentos_max,
      seg_por_pregunta, cantidad_preguntas, mostrar_respuestas, barajar_preguntas, barajar_opciones, peso, permite_invitados)
    values (p_quiz, g, nullif(p_config->>'periodo_id', '')::uuid,
      coalesce(p_config->>'modo', 'practica'), coalesce((p_config->>'activo')::boolean, true),
      nullif(p_config->>'inicio', '')::timestamptz, nullif(p_config->>'fin', '')::timestamptz,
      nullif(p_config->>'intentos_max', '')::int, nullif(p_config->>'seg_por_pregunta', '')::int,
      nullif(p_config->>'cantidad_preguntas', '')::int,
      coalesce((p_config->>'mostrar_respuestas')::boolean, true),
      coalesce((p_config->>'barajar_preguntas')::boolean, false),
      coalesce((p_config->>'barajar_opciones')::boolean, true),
      coalesce(nullif(p_config->>'peso', '')::numeric, 1),
      coalesce((p_config->>'permite_invitados')::boolean, false));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Resultados: incluye a los invitados (no van a la libreta)
create or replace function public.resultados_publicacion(p_pub uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_pub publicaciones%rowtype;
begin
  select * into v_pub from publicaciones where id = p_pub;
  if not found or not (es_dueno_grupo(v_pub.grupo_id) or es_admin()) then raise exception 'No es tu publicación'; end if;
  return jsonb_build_object(
    'intentos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'alumno_id', i.alumno_id, 'es_invitado', i.alumno_id is null,
        'nombre', coalesce(p.nombre, p.usuario, i.alias), 'usuario', p.usuario, 'avatar', coalesce(p.avatar, i.avatar),
        'en_vivo', i.vivo_sesion_id is not null,
        'estado', i.estado, 'puntaje', i.puntaje, 'puntaje_max', i.puntaje_max,
        'nota', nota_vigesimal(i.puntaje, i.puntaje_max), 'iniciado_en', i.iniciado_en, 'finalizado_en', i.finalizado_en,
        'intento', case when i.alumno_id is null then 1 else
                   (select count(*) from intentos i2 where i2.publicacion_id = i.publicacion_id and i2.alumno_id = i.alumno_id and i2.iniciado_en <= i.iniciado_en) end,
        'aciertos', (select count(*) from respuestas r where r.intento_id = i.id and r.es_correcta),
        'total', (select count(*) from preguntas x where x.id = any(i.preguntas_ids) and x.tipo <> 'lluvia_ideas')
      ) order by i.alumno_id is null, coalesce(p.nombre, p.usuario, i.alias), i.iniciado_en), '[]'::jsonb)
      from intentos i left join perfiles p on p.id = i.alumno_id where i.publicacion_id = p_pub),
    'sin_rendir', (select coalesce(jsonb_agg(jsonb_build_object('alumno_id', p.id, 'nombre', coalesce(p.nombre, p.usuario), 'usuario', p.usuario, 'avatar', p.avatar)
                   order by coalesce(p.nombre, p.usuario)), '[]'::jsonb)
      from alumno_grupos ag join perfiles p on p.id = ag.alumno_id
      where ag.grupo_id = v_pub.grupo_id
        and not exists (select 1 from intentos i where i.publicacion_id = p_pub and i.alumno_id = p.id and i.estado = 'finalizado'))
  );
end $$;

create or replace function public.mis_publicaciones_profesor() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(pu) || jsonb_build_object(
    'quiz_titulo', q.titulo, 'grupo_nombre', g.nombre, 'escala', g.escala, 'periodo_nombre', pe.nombre,
    'n_preguntas', (select count(*) from preguntas p where p.quiz_id = q.id),
    'n_alumnos', (select count(*) from alumno_grupos ag where ag.grupo_id = g.id),
    'rindieron', (select count(distinct i.alumno_id) from intentos i where i.publicacion_id = pu.id and i.estado = 'finalizado'),
    'invitados', (select count(*) from intentos i where i.publicacion_id = pu.id and i.alumno_id is null and i.estado = 'finalizado'),
    'promedio', (select round(avg(x.nota), 1) from (
        select max(nota_vigesimal(i.puntaje, i.puntaje_max)) as nota from intentos i
        where i.publicacion_id = pu.id and i.estado = 'finalizado' and i.alumno_id is not null group by i.alumno_id) x)
  ) order by pu.created_at desc), '[]'::jsonb)
  from publicaciones pu
  join grupos g on g.id = pu.grupo_id and g.profesor_id = auth.uid()
  join quizzes q on q.id = pu.quiz_id
  left join periodos pe on pe.id = pu.periodo_id;
$$;

-- ---------- En vivo a partir de una publicación ----------
create or replace function public.vivo_crear(p_quiz uuid, p_config jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid; v_total int; v_fijas uuid[]; v_ids uuid[]; v_pts jsonb; v_pub publicaciones%rowtype; v_grupo uuid;
begin
  v_grupo := nullif(p_config->>'grupo_id', '')::uuid;
  if nullif(p_config->>'publicacion_id', '') is not null then
    select * into v_pub from publicaciones where id = (p_config->>'publicacion_id')::uuid;
    if not found or not ((es_dueno_grupo(v_pub.grupo_id) and esta_activo()) or es_admin()) then
      raise exception 'Esa publicación no es tuya';
    end if;
    p_quiz := v_pub.quiz_id;
    v_grupo := v_pub.grupo_id;
  elsif not ((es_dueno_quiz(p_quiz) and esta_activo()) or es_admin()) then
    raise exception 'No es tu quiz';
  end if;
  v_fijas := coalesce(array(select jsonb_array_elements_text(p_config->'fijas')::uuid), '{}');
  v_pts   := coalesce(p_config->'puntos', '{}'::jsonb);   -- {"<pregunta_id>": 2, ...}
  v_total := coalesce(nullif(p_config->>'cantidad', '')::int,
                      (select count(*) from preguntas where quiz_id = p_quiz));

  v_ids := array(select id from preguntas where quiz_id = p_quiz and id = any(v_fijas) order by orden)
        || array(select id from preguntas where quiz_id = p_quiz and not (id = any(v_fijas))
                 order by case when coalesce((p_config->>'aleatorio')::boolean, true) then random() else orden::float8 end
                 limit greatest(0, v_total - cardinality(v_fijas)));
  if cardinality(v_ids) = 0 then raise exception 'El quiz no tiene preguntas'; end if;

  insert into sesiones_vivo (profesor_id, quiz_id, grupo_id, publicacion_id, registrar_notas, titulo, modo,
                             seg_por_pregunta, seg_total, puntos_velocidad, permite_invitados)
  values (auth.uid(), p_quiz, v_grupo, v_pub.id,
          coalesce((p_config->>'registrar_notas')::boolean, true),
          coalesce(nullif(trim(p_config->>'titulo'), ''), (select titulo from quizzes where id = p_quiz)),
          coalesce(p_config->>'modo', 'vivo'),
          nullif(p_config->>'seg_por_pregunta', '')::int, nullif(p_config->>'seg_total', '')::int,
          coalesce((p_config->>'puntos_velocidad')::boolean, true),
          coalesce((p_config->>'permite_invitados')::boolean, true))
  returning id into v_id;

  insert into vivo_preguntas (sesion_id, pregunta_id, puntos, es_fija, orden)
  select v_id, u.pid,
         1000 * coalesce(nullif(v_pts->>(u.pid::text), '')::numeric, (select puntos from preguntas where id = u.pid)),
         u.pid = any(v_fijas), u.n
  from unnest(v_ids) with ordinality as u(pid, n);
  return v_id;
end $$;

-- Pasa el resultado en vivo de un alumno del grupo a la publicación (un intento más, va a la libreta).
-- La nota se calcula con los puntos normales del quiz (sin el bono por velocidad).
create or replace function public._vivo_a_libreta(p_participante uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_pa vivo_participantes%rowtype; v_s sesiones_vivo%rowtype; v_pub publicaciones%rowtype;
        v_ids uuid[]; v_int uuid; v_max numeric;
begin
  select * into v_pa from vivo_participantes where id = p_participante;
  if not found or v_pa.alumno_id is null then return; end if;
  select * into v_s from sesiones_vivo where id = v_pa.sesion_id;
  if v_s.publicacion_id is null or not v_s.registrar_notas then return; end if;
  select * into v_pub from publicaciones where id = v_s.publicacion_id;
  if not exists (select 1 from alumno_grupos where alumno_id = v_pa.alumno_id and grupo_id = v_pub.grupo_id) then return; end if;
  if exists (select 1 from intentos where vivo_sesion_id = v_s.id and alumno_id = v_pa.alumno_id) then return; end if;
  -- si el alumno no respondió nada, no se registra
  if not exists (select 1 from vivo_respuestas where participante_id = v_pa.id) then return; end if;

  v_ids := array(select pregunta_id from vivo_preguntas where sesion_id = v_s.id order by orden, id);
  select coalesce(sum(puntos), 0) into v_max from preguntas where id = any(v_ids) and tipo <> 'lluvia_ideas';
  insert into intentos (publicacion_id, alumno_id, estado, preguntas_ids, puntaje_max, iniciado_en, finalizado_en, vivo_sesion_id)
  values (v_pub.id, v_pa.alumno_id, 'en_curso', v_ids, v_max, coalesce(v_pa.iniciado_en, v_pa.created_at), now(), v_s.id)
  returning id into v_int;

  insert into respuestas (intento_id, pregunta_id, opciones_ids, textos, es_correcta, puntos, tiempo_seg)
  select v_int, r.pregunta_id, r.opciones_ids, r.textos, k.o_correcta, round(p.puntos * k.o_fraccion, 2), r.tiempo_seg
  from vivo_respuestas r join preguntas p on p.id = r.pregunta_id
  cross join lateral _calificar(r.pregunta_id, r.opciones_ids, r.textos) k
  where r.participante_id = v_pa.id and r.pregunta_id = any(v_ids);

  update intentos set estado = 'finalizado',
         puntaje = (select coalesce(sum(puntos), 0) from respuestas where intento_id = v_int)
  where id = v_int;
end $$;

create or replace function public.vivo_finalizar(p_participante uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_pa vivo_participantes%rowtype; v_s sesiones_vivo%rowtype;
begin
  v_pa := _vivo_participante(p_participante, p_token);
  select * into v_s from sesiones_vivo where id = v_pa.sesion_id;
  update vivo_participantes set
    estado = 'finalizado', finalizado_en = coalesce(finalizado_en, now()),
    puntaje = (select coalesce(sum(puntos), 0) from vivo_respuestas where participante_id = v_pa.id),
    tiempo_total_seg = case when v_s.modo = 'plazo' and iniciado_en is not null
                            then round(extract(epoch from now() - iniciado_en)::numeric, 2)
                            else (select sum(tiempo_seg) from vivo_respuestas where participante_id = v_pa.id) end
  where id = v_pa.id and estado <> 'finalizado';
  -- en modo "por plazo" cada uno termina cuando quiere: su nota pasa a la publicación en ese momento
  if v_s.modo = 'plazo' then perform _vivo_a_libreta(v_pa.id); end if;
  return vivo_mi_estado(p_participante, p_token);
end $$;

create or replace function public.vivo_terminar(p_sesion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pa record;
begin
  if not (es_dueno_sesion(p_sesion) or es_admin()) then raise exception 'No es tu sesión'; end if;
  update vivo_participantes pa set
    estado = 'finalizado', finalizado_en = coalesce(pa.finalizado_en, now()),
    puntaje = (select coalesce(sum(puntos), 0) from vivo_respuestas r where r.participante_id = pa.id),
    tiempo_total_seg = coalesce(pa.tiempo_total_seg,
      case when s.modo = 'plazo' and pa.iniciado_en is not null
           then round(extract(epoch from now() - pa.iniciado_en)::numeric, 2)
           else (select sum(tiempo_seg) from vivo_respuestas r where r.participante_id = pa.id) end)
  from sesiones_vivo s
  where s.id = pa.sesion_id and pa.sesion_id = p_sesion and pa.estado <> 'finalizado';
  update sesiones_vivo set estado = 'finalizado' where id = p_sesion;
  for v_pa in select id from vivo_participantes where sesion_id = p_sesion loop
    perform _vivo_a_libreta(v_pa.id);
  end loop;
end $$;

create or replace function public.vivo_reiniciar(p_sesion uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_dueno_sesion(p_sesion) or es_admin()) then raise exception 'No es tu sesión'; end if;
  delete from intentos where vivo_sesion_id = p_sesion;   -- las notas que esta sesión pasó a la libreta
  delete from vivo_participantes where sesion_id = p_sesion;
  update sesiones_vivo set estado = 'esperando', pregunta_actual = 0 where id = p_sesion;
end $$;

create or replace function public.mis_sesiones_vivo() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'titulo', s.titulo, 'modo', s.modo, 'estado', s.estado, 'codigo', s.codigo, 'created_at', s.created_at,
    'quiz_titulo', q.titulo, 'grupo_nombre', g.nombre,
    'publicacion_id', s.publicacion_id, 'registrar_notas', s.registrar_notas,
    'publicacion_modo', pu.modo,
    'n_preguntas', (select count(*) from vivo_preguntas vp where vp.sesion_id = s.id),
    'n_participantes', (select count(*) from vivo_participantes pa where pa.sesion_id = s.id)
  ) order by s.created_at desc), '[]'::jsonb)
  from sesiones_vivo s join quizzes q on q.id = s.quiz_id left join grupos g on g.id = s.grupo_id
  left join publicaciones pu on pu.id = s.publicacion_id
  where s.profesor_id = auth.uid();
$$;

-- Las piezas internas no se llaman desde la app
revoke execute on function public._pub_motivo(public.publicaciones) from public, anon, authenticated;
revoke execute on function public._intento_de(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._crear_intento(public.publicaciones, uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public._preguntas_intento(public.intentos) from public, anon, authenticated;
revoke execute on function public._responder_intento(public.intentos, uuid, uuid[], text[], numeric) from public, anon, authenticated;
revoke execute on function public._finalizar_intento(public.intentos) from public, anon, authenticated;
revoke execute on function public._vivo_a_libreta(uuid) from public, anon, authenticated;


-- =====================================================================
-- JUEGOS CREADOS POR LOS PROFESORES, BIBLIOTECA PÚBLICA Y QUIZZES PÚBLICOS
-- =====================================================================
alter table public.quizzes add column if not exists publico boolean not null default false;

create table if not exists public.juegos (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references public.perfiles(id) on delete cascade,
  tipo        text not null check (tipo in ('ahorcado','sopa','memoria','ordena','frase','rompecabezas')),
  titulo      text not null check (length(trim(titulo)) between 1 and 120),
  tema        text,
  nivel       text,
  datos       jsonb not null default '{}'::jsonb,
  publico     boolean not null default false,
  jugadas     int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists juegos_profesor_idx on public.juegos (profesor_id);
create index if not exists juegos_publico_idx on public.juegos (tipo) where publico;

create table if not exists public.juego_publicaciones (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references public.juegos(id) on delete cascade,
  grupo_id   uuid not null references public.grupos(id) on delete cascade,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (juego_id, grupo_id)
);
create index if not exists juego_pub_grupo_idx on public.juego_publicaciones (grupo_id);

create table if not exists public.juego_resultados (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.juego_publicaciones(id) on delete cascade,
  alumno_id      uuid not null references public.perfiles(id) on delete cascade,
  puntaje        numeric(10,2) not null default 0,
  detalle        text,
  segundos       int,
  created_at     timestamptz not null default now()
);
create index if not exists juego_res_pub_idx on public.juego_resultados (publicacion_id);
create index if not exists juego_res_alumno_idx on public.juego_resultados (alumno_id);

-- Validación del contenido de cada tipo de juego
create or replace function public._validar_juego() returns trigger
language plpgsql set search_path = public as $$
declare d jsonb := new.datos; n int;
begin
  if pg_column_size(d) > 300000 then raise exception 'El juego es demasiado grande'; end if;
  new.titulo := trim(new.titulo);
  new.updated_at := now();
  if new.tipo in ('ahorcado','ordena','sopa') then
    n := jsonb_array_length(coalesce(d->'palabras', '[]'));
    if n < 1 then raise exception 'Agrega al menos una palabra'; end if;
    if n > 200 then raise exception 'Máximo 200 palabras'; end if;
  elsif new.tipo = 'memoria' then
    n := jsonb_array_length(coalesce(d->'parejas', '[]'));
    if n < 3 then raise exception 'Agrega al menos 3 parejas'; end if;
    if n > 30 then raise exception 'Máximo 30 parejas'; end if;
  elsif new.tipo = 'frase' then
    n := jsonb_array_length(coalesce(d->'frases', '[]'));
    if n < 1 then raise exception 'Agrega al menos una frase'; end if;
    if n > 40 then raise exception 'Máximo 40 frases'; end if;
  elsif new.tipo = 'rompecabezas' then
    if coalesce(d->>'imagen_url', '') !~ '^https?://' then raise exception 'Sube la imagen del rompecabezas'; end if;
  end if;
  if new.tipo = 'sopa' then
    if coalesce((d->>'filas')::int, 0) not between 6 and 25 or coalesce((d->>'columnas')::int, 0) not between 6 and 25 then
      raise exception 'La sopa debe tener entre 6 y 25 filas y columnas';
    end if;
    if jsonb_array_length(coalesce(d->'grilla', '[]')) <> (d->>'filas')::int then raise exception 'Genera la sopa antes de guardar'; end if;
  end if;
  return new;
end $$;
drop trigger if exists juegos_validar on public.juegos;
create trigger juegos_validar before insert or update on public.juegos for each row execute function public._validar_juego();

-- Permisos fila por fila
alter table public.juegos enable row level security;
alter table public.juego_publicaciones enable row level security;
alter table public.juego_resultados enable row level security;

-- ¿El juego está publicado en un grupo del usuario? (función para que la política no dependa de permisos de otra tabla)
create or replace function public.juego_en_mis_grupos(p_juego uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from juego_publicaciones jp where jp.juego_id = p_juego and jp.activo and es_miembro_grupo(jp.grupo_id));
$$;
drop policy if exists juegos_ver on public.juegos;
create policy juegos_ver on public.juegos for select using (
  publico or profesor_id = auth.uid() or es_admin() or juego_en_mis_grupos(id));
drop policy if exists juegos_crear on public.juegos;
create policy juegos_crear on public.juegos for insert with check (profesor_id = auth.uid() and puede_crear());
drop policy if exists juegos_editar on public.juegos;
create policy juegos_editar on public.juegos for update
  using ((profesor_id = auth.uid() and esta_activo()) or es_admin())
  with check ((profesor_id = auth.uid() and esta_activo()) or es_admin());
drop policy if exists juegos_borrar on public.juegos;
create policy juegos_borrar on public.juegos for delete using ((profesor_id = auth.uid() and esta_activo()) or es_admin());

drop policy if exists juego_pub_ver on public.juego_publicaciones;
create policy juego_pub_ver on public.juego_publicaciones for select using (es_dueno_grupo(grupo_id) or es_admin() or es_miembro_grupo(grupo_id));
drop policy if exists juego_pub_editar on public.juego_publicaciones;
create policy juego_pub_editar on public.juego_publicaciones for update using (es_dueno_grupo(grupo_id) or es_admin()) with check (es_dueno_grupo(grupo_id) or es_admin());
drop policy if exists juego_pub_borrar on public.juego_publicaciones;
create policy juego_pub_borrar on public.juego_publicaciones for delete using (es_dueno_grupo(grupo_id) or es_admin());

drop policy if exists juego_res_ver on public.juego_resultados;
create policy juego_res_ver on public.juego_resultados for select using (
  alumno_id = auth.uid() or es_admin()
  or exists (select 1 from juego_publicaciones jp where jp.id = publicacion_id and es_dueno_grupo(jp.grupo_id)));
drop policy if exists juego_res_borrar on public.juego_resultados;
create policy juego_res_borrar on public.juego_resultados for delete using (
  es_admin() or exists (select 1 from juego_publicaciones jp where jp.id = publicacion_id and es_dueno_grupo(jp.grupo_id)));

-- Cantidad de elementos de un juego (para las listas)
create or replace function public._juego_items(j public.juegos) returns int
language sql immutable set search_path = public as $$
  select case j.tipo
    when 'memoria' then jsonb_array_length(coalesce(j.datos->'parejas', '[]'))
    when 'frase' then jsonb_array_length(coalesce(j.datos->'frases', '[]'))
    when 'rompecabezas' then coalesce((j.datos->>'piezas')::int, 3) * coalesce((j.datos->>'piezas')::int, 3)
    else jsonb_array_length(coalesce(j.datos->'palabras', '[]')) end;
$$;

-- ---------- Biblioteca pública (la usan el portal y cualquiera sin cuenta) ----------
create or replace function public.biblioteca_libre(p_tipo text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.orden desc, x.f desc), '[]'::jsonb) from (
    select j.jugadas as orden, j.updated_at as f, jsonb_build_object(
      'id', j.id, 'tipo', j.tipo, 'titulo', j.titulo, 'tema', j.tema, 'nivel', j.nivel,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', _juego_items(j), 'jugadas', j.jugadas) as j
    from juegos j join perfiles pf on pf.id = j.profesor_id
    where j.publico and pf.estado = 'activo' and (p_tipo is null or j.tipo = p_tipo)
    union all
    select 0, q.updated_at, jsonb_build_object(
      'id', q.id, 'tipo', 'quiz', 'titulo', q.titulo, 'tema', q.tema, 'nivel', null,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', (select count(*) from preguntas p where p.quiz_id = q.id), 'jugadas', 0)
    from quizzes q join perfiles pf on pf.id = q.profesor_id
    where q.publico and pf.estado = 'activo' and (p_tipo is null or p_tipo = 'quiz')
      and exists (select 1 from preguntas p where p.quiz_id = q.id)
    limit 300
  ) x;
$$;

-- Un juego para jugarlo (público, propio o publicado en un grupo del alumno)
create or replace function public.juego_libre(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(j) || jsonb_build_object('autor', coalesce(pf.nombre, pf.usuario))
  from juegos j join perfiles pf on pf.id = j.profesor_id
  where j.id = p_id and (j.publico or j.profesor_id = auth.uid() or es_admin()
        or exists (select 1 from juego_publicaciones jp where jp.juego_id = j.id and jp.activo and es_miembro_grupo(jp.grupo_id)));
$$;

create or replace function public.juego_jugado(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update juegos set jugadas = jugadas + 1 where id = p_id and publico;
$$;

-- ---------- Quiz público: preguntas sin respuestas y corrección en el servidor ----------
create or replace function public.quiz_libre(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q quizzes%rowtype;
begin
  select * into v_q from quizzes where id = p_quiz;
  if not found or not coalesce(v_q.publico or v_q.profesor_id = auth.uid() or es_admin(), false) then
    raise exception 'Este quiz no es público';
  end if;
  return jsonb_build_object(
    'quiz', jsonb_build_object('id', v_q.id, 'titulo', v_q.titulo, 'tema', v_q.tema,
                               'autor', (select coalesce(nombre, usuario) from perfiles where id = v_q.profesor_id)),
    'preguntas', (select coalesce(jsonb_agg(_pregunta_publica(p, true) order by p.orden, p.created_at), '[]'::jsonb)
                  from preguntas p where p.quiz_id = v_q.id));
end $$;

create or replace function public.quiz_libre_calificar(p_quiz uuid, p_pregunta uuid, p_opciones uuid[] default '{}',
  p_textos text[] default '{}') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_p preguntas%rowtype; c record;
begin
  select p.* into v_p from preguntas p join quizzes q on q.id = p.quiz_id
  where p.id = p_pregunta and q.id = p_quiz and (q.publico or q.profesor_id = auth.uid() or es_admin());
  if not found then raise exception 'Pregunta no válida'; end if;
  select * into c from _calificar(p_pregunta, coalesce(p_opciones, '{}'), coalesce(p_textos, '{}'));
  return jsonb_build_object('registrada', true, 'mostrar', true,
    'es_correcta', c.o_correcta, 'fraccion', c.o_fraccion, 'puntos', round(v_p.puntos * c.o_fraccion, 2),
    'correcta_texto', c.o_texto, 'explicacion', v_p.explicacion,
    'correctas_ids', (select coalesce(jsonb_agg(id), '[]'::jsonb) from opciones where pregunta_id = p_pregunta and es_correcta));
end $$;

-- ---------- Profesor: sus juegos, publicar en grupos y resultados ----------
create or replace function public.mis_juegos_profesor() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(j) || jsonb_build_object(
    'n', _juego_items(j),
    'publicaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', jp.id, 'grupo_id', g.id, 'grupo', g.nombre, 'activo', jp.activo,
                        'jugaron', (select count(distinct r.alumno_id) from juego_resultados r where r.publicacion_id = jp.id))
                        order by g.nombre), '[]'::jsonb)
                      from juego_publicaciones jp join grupos g on g.id = jp.grupo_id where jp.juego_id = j.id)
  ) order by j.updated_at desc), '[]'::jsonb)
  from juegos j where j.profesor_id = auth.uid();
$$;

create or replace function public.publicar_juego(p_juego uuid, p_grupos uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare g uuid; n int := 0;
begin
  if not exists (select 1 from juegos where id = p_juego and ((profesor_id = auth.uid() and esta_activo()) or es_admin())) then
    raise exception 'No es tu juego';
  end if;
  foreach g in array coalesce(p_grupos, '{}') loop
    if not (es_dueno_grupo(g) or es_admin()) then raise exception 'Uno de los grupos no es tuyo'; end if;
    insert into juego_publicaciones (juego_id, grupo_id) values (p_juego, g)
    on conflict (juego_id, grupo_id) do update set activo = true;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.resultados_juego(p_juego uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from juegos where id = p_juego and (profesor_id = auth.uid() or es_admin())) then
    raise exception 'No es tu juego';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'grupo', g.nombre, 'publicacion_id', jp.id,
      'filas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'alumno_id', p.id, 'nombre', coalesce(p.nombre, p.usuario), 'avatar', p.avatar,
                  'veces', (select count(*) from juego_resultados r where r.publicacion_id = jp.id and r.alumno_id = p.id),
                  'mejor', (select max(r.puntaje) from juego_resultados r where r.publicacion_id = jp.id and r.alumno_id = p.id),
                  'ultimo', (select max(r.created_at) from juego_resultados r where r.publicacion_id = jp.id and r.alumno_id = p.id))
                  order by coalesce(p.nombre, p.usuario)), '[]'::jsonb)
                from alumno_grupos ag join perfiles p on p.id = ag.alumno_id where ag.grupo_id = jp.grupo_id)
    ) order by g.nombre), '[]'::jsonb)
    from juego_publicaciones jp join grupos g on g.id = jp.grupo_id where jp.juego_id = p_juego);
end $$;

-- ---------- Alumno: juegos asignados ----------
create or replace function public.mis_juegos_alumno() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'publicacion_id', jp.id, 'juego_id', j.id, 'tipo', j.tipo, 'titulo', j.titulo, 'tema', j.tema,
    'grupo', g.nombre, 'profesor', coalesce(pf.nombre, pf.usuario), 'n', _juego_items(j),
    'veces', (select count(*) from juego_resultados r where r.publicacion_id = jp.id and r.alumno_id = auth.uid()),
    'mejor', (select max(r.puntaje) from juego_resultados r where r.publicacion_id = jp.id and r.alumno_id = auth.uid())
  ) order by jp.created_at desc), '[]'::jsonb)
  from juego_publicaciones jp
  join alumno_grupos ag on ag.grupo_id = jp.grupo_id and ag.alumno_id = auth.uid()
  join juegos j on j.id = jp.juego_id join grupos g on g.id = jp.grupo_id join perfiles pf on pf.id = j.profesor_id
  where jp.activo;
$$;

create or replace function public.juego_de_publicacion(p_pub uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_jp juego_publicaciones%rowtype;
begin
  select * into v_jp from juego_publicaciones where id = p_pub;
  if not found or not v_jp.activo or not (es_miembro_grupo(v_jp.grupo_id) or es_dueno_grupo(v_jp.grupo_id) or es_admin()) then
    raise exception 'Este juego no está disponible para ti';
  end if;
  return juego_libre(v_jp.juego_id) || jsonb_build_object('publicacion_id', v_jp.id);
end $$;

create or replace function public.registrar_juego(p_pub uuid, p_puntaje numeric, p_detalle text default null, p_segundos int default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_jp juego_publicaciones%rowtype;
begin
  select * into v_jp from juego_publicaciones where id = p_pub;
  if not found or not v_jp.activo or not es_miembro_grupo(v_jp.grupo_id) then raise exception 'Este juego no está disponible para ti'; end if;
  insert into juego_resultados (publicacion_id, alumno_id, puntaje, detalle, segundos)
  values (p_pub, auth.uid(), greatest(0, least(coalesce(p_puntaje, 0), 100000)), left(p_detalle, 200), p_segundos);
end $$;

-- mis_quizzes ahora incluye "publico"
create or replace function public.mis_quizzes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'titulo', q.titulo, 'tema', q.tema, 'descripcion', q.descripcion, 'publico', q.publico,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'n_preguntas', (select count(*) from preguntas p where p.quiz_id = q.id),
    'puntos', (select coalesce(sum(p.puntos), 0) from preguntas p where p.quiz_id = q.id and p.tipo <> 'lluvia_ideas'),
    'n_publicaciones', (select count(*) from publicaciones pu where pu.quiz_id = q.id),
    'subtemas', (select coalesce(jsonb_agg(distinct p.subtema) filter (where p.subtema is not null), '[]'::jsonb)
                 from preguntas p where p.quiz_id = q.id)
  ) order by q.updated_at desc), '[]'::jsonb)
  from quizzes q where q.profesor_id = auth.uid();
$$;

-- Admin: todos los juegos (para quitar de la biblioteca lo que no corresponda)
create or replace function public.admin_juegos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'tipo', j.tipo, 'titulo', j.titulo, 'tema', j.tema, 'publico', j.publico,
      'jugadas', j.jugadas, 'n', _juego_items(j), 'autor', coalesce(pf.nombre, pf.usuario), 'updated_at', j.updated_at, 'clase', 'juego')
      order by j.updated_at desc), '[]'::jsonb)
    from juegos j join perfiles pf on pf.id = j.profesor_id)
    || (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'tipo', 'quiz', 'titulo', q.titulo, 'tema', q.tema, 'publico', true,
      'jugadas', 0, 'n', (select count(*) from preguntas p where p.quiz_id = q.id), 'autor', coalesce(pf.nombre, pf.usuario), 'updated_at', q.updated_at, 'clase', 'quiz')
      order by q.updated_at desc), '[]'::jsonb)
    from quizzes q join perfiles pf on pf.id = q.profesor_id where q.publico);
end $$;

revoke execute on function public._validar_juego() from public, anon, authenticated;
revoke execute on function public._juego_items(public.juegos) from public, anon, authenticated;


-- =====================================================================
-- SALAS EN LÍNEA PARA TODOS LOS JUEGOS (multijugador con PIN y cronómetro)
-- =====================================================================
alter table public.juegos add column if not exists segundos int;   -- tiempo límite sugerido por el profesor

create table if not exists public.salas_juego (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null,
  tipo        text not null,
  titulo      text not null,
  contenido   jsonb not null default '{}'::jsonb,   -- lo que juegan todos (mismas palabras, misma sopa, mismo orden)
  segundos    int check (segundos is null or segundos between 20 and 3600),
  estado      text not null default 'esperando' check (estado in ('esperando','en_curso','finalizado')),
  inicio      timestamptz,
  fin         timestamptz,
  ronda       int not null default 1,
  host_token  uuid not null default gen_random_uuid(),
  creador_id  uuid references public.perfiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists salas_juego_codigo_activo on public.salas_juego (codigo) where estado <> 'finalizado';

create table if not exists public.sala_jugadores (
  id           uuid primary key default gen_random_uuid(),
  sala_id      uuid not null references public.salas_juego(id) on delete cascade,
  alias        text not null,
  avatar       text,
  alumno_id    uuid references public.perfiles(id) on delete set null,
  es_anfitrion boolean not null default false,
  token        uuid not null default gen_random_uuid(),
  puntaje      numeric(10,2) not null default 0,
  progreso     int not null default 0,
  terminado    boolean not null default false,
  terminado_en timestamptz,
  detalle      text,
  unido_en     timestamptz not null default now()
);
create index if not exists sala_jugadores_sala_idx on public.sala_jugadores (sala_id);
alter table public.salas_juego enable row level security;     -- solo se usan con las funciones de abajo
alter table public.sala_jugadores enable row level security;

-- PIN de 6 dígitos que no choque con el modo en vivo ni con otra sala abierta
create or replace function public._nuevo_pin() returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_pin text;
begin
  loop
    v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from sesiones_vivo where codigo = v_pin and estado <> 'finalizado')
          and not exists (select 1 from salas_juego where codigo = v_pin and estado <> 'finalizado');
  end loop;
  return v_pin;
end $$;

create or replace function public._sala_host(p_sala uuid, p_host uuid) returns public.salas_juego
language plpgsql stable security definer set search_path = public as $$
declare v salas_juego%rowtype;
begin
  select * into v from salas_juego where id = p_sala and host_token = coalesce(p_host, '00000000-0000-0000-0000-000000000000');
  if not found then raise exception 'Solo quien creó la sala puede hacer esto'; end if;
  return v;
end $$;

create or replace function public._sala_jugador(p_jugador uuid, p_token uuid) returns public.sala_jugadores
language plpgsql stable security definer set search_path = public as $$
declare v sala_jugadores%rowtype;
begin
  select * into v from sala_jugadores where id = p_jugador and token = coalesce(p_token, '00000000-0000-0000-0000-000000000000');
  if not found then raise exception 'Jugador no válido'; end if;
  return v;
end $$;

-- Crear una sala (cualquiera, con o sin cuenta). Si p_juega, el anfitrión también juega.
create or replace function public.sala_crear(p_tipo text, p_titulo text, p_contenido jsonb, p_segundos int default null,
  p_alias text default null, p_avatar text default null, p_juega boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v salas_juego%rowtype; v_j sala_jugadores%rowtype; v_alias text;
begin
  if p_tipo not in ('ahorcado','sopa','memoria','ordena','frase','rompecabezas','quiz','trivia','quizpublico') then raise exception 'Juego no válido'; end if;
  if pg_column_size(p_contenido) > 400000 then raise exception 'El juego es demasiado grande para compartirlo en línea'; end if;
  delete from salas_juego where created_at < now() - interval '2 days';   -- limpieza de salas viejas
  insert into salas_juego (codigo, tipo, titulo, contenido, segundos, creador_id)
  values (_nuevo_pin(), p_tipo, left(coalesce(nullif(trim(p_titulo), ''), 'Juego'), 120), coalesce(p_contenido, '{}'),
          case when p_segundos is null or p_segundos <= 0 then null else greatest(20, least(p_segundos, 3600)) end, auth.uid())
  returning * into v;
  if p_juega then
    v_alias := left(coalesce(nullif(trim(p_alias), ''), 'Anfitrión'), 30);
    insert into sala_jugadores (sala_id, alias, avatar, alumno_id, es_anfitrion)
    values (v.id, v_alias, left(p_avatar, 500), auth.uid(), true) returning * into v_j;
  end if;
  return jsonb_build_object('sala_id', v.id, 'codigo', v.codigo, 'host_token', v.host_token,
                            'jugador_id', v_j.id, 'token', v_j.token);
end $$;

create or replace function public.sala_por_codigo(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'tipo', tipo, 'titulo', titulo, 'estado', estado)
  from salas_juego where codigo = trim(p_codigo) and estado <> 'finalizado'
  order by created_at desc limit 1;
$$;

create or replace function public.sala_unirse(p_sala uuid, p_alias text, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v salas_juego%rowtype; v_j sala_jugadores%rowtype; v_alias text;
begin
  select * into v from salas_juego where id = p_sala;
  if not found or v.estado = 'finalizado' then raise exception 'Esta sala ya cerró'; end if;
  if (select count(*) from sala_jugadores where sala_id = p_sala) >= 80 then raise exception 'La sala está llena'; end if;
  v_alias := left(trim(coalesce(p_alias, '')), 30);
  if v_alias = '' then raise exception 'Escribe tu nombre'; end if;
  if exists (select 1 from sala_jugadores where sala_id = p_sala and lower(alias) = lower(v_alias)) then
    raise exception 'Ese nombre ya está en la sala, elige otro';
  end if;
  insert into sala_jugadores (sala_id, alias, avatar, alumno_id) values (p_sala, v_alias, left(p_avatar, 500), auth.uid())
  returning * into v_j;
  return jsonb_build_object('jugador_id', v_j.id, 'token', v_j.token);
end $$;

-- Estado para todos (sala de espera, cronómetro y ranking). El contenido solo se entrega al empezar.
create or replace function public.sala_estado(p_sala uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v salas_juego%rowtype; v_estado text; v_todos boolean;
begin
  select * into v from salas_juego where id = p_sala;
  if not found then raise exception 'Sala no encontrada'; end if;
  select coalesce(bool_and(terminado), false) into v_todos from sala_jugadores where sala_id = p_sala;
  v_estado := case when v.estado = 'en_curso' and ((v.fin is not null and now() > v.fin + interval '2 seconds') or v_todos) then 'finalizado' else v.estado end;
  return jsonb_build_object(
    'id', v.id, 'codigo', v.codigo, 'tipo', v.tipo, 'titulo', v.titulo, 'estado', v_estado, 'ronda', v.ronda,
    'segundos', v.segundos, 'inicio', v.inicio, 'fin', v.fin, 'ahora', now(),
    'contenido', case when v_estado <> 'esperando' then v.contenido end,
    'jugadores', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'alias', alias, 'avatar', avatar, 'puntaje', puntaje,
                    'progreso', progreso, 'terminado', terminado, 'detalle', detalle, 'anfitrion', es_anfitrion)
                    order by puntaje desc, terminado_en nulls last, unido_en), '[]'::jsonb)
                  from sala_jugadores where sala_id = p_sala));
end $$;

create or replace function public.sala_iniciar(p_sala uuid, p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v salas_juego%rowtype;
begin
  v := _sala_host(p_sala, p_host);
  if v.estado <> 'esperando' then raise exception 'La sala ya empezó'; end if;
  if not exists (select 1 from sala_jugadores where sala_id = p_sala) then raise exception 'Todavía no hay jugadores'; end if;
  update salas_juego set estado = 'en_curso', inicio = now() + interval '4 seconds',
         fin = case when segundos is null then null else now() + interval '4 seconds' + make_interval(secs => segundos) end
  where id = p_sala;
  return sala_estado(p_sala);
end $$;

-- Cada jugador informa su puntaje mientras juega y al terminar
create or replace function public.sala_progreso(p_jugador uuid, p_token uuid, p_puntaje numeric, p_progreso int default 0,
  p_terminado boolean default false, p_detalle text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_j sala_jugadores%rowtype; v salas_juego%rowtype;
begin
  v_j := _sala_jugador(p_jugador, p_token);
  select * into v from salas_juego where id = v_j.sala_id;
  if v.estado <> 'en_curso' or v_j.terminado then return; end if;
  if v.fin is not null and now() > v.fin + interval '5 seconds' then return; end if;   -- ya se acabó el tiempo
  update sala_jugadores set puntaje = greatest(0, least(coalesce(p_puntaje, 0), 1000000)), progreso = coalesce(p_progreso, progreso),
         terminado = coalesce(p_terminado, false), terminado_en = case when p_terminado then now() end,
         detalle = coalesce(left(p_detalle, 200), detalle)
  where id = v_j.id;
end $$;

create or replace function public.sala_terminar(p_sala uuid, p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _sala_host(p_sala, p_host);
  update salas_juego set estado = 'finalizado', fin = least(coalesce(fin, now()), now()) where id = p_sala;
  return sala_estado(p_sala);
end $$;

-- Otra ronda con los mismos jugadores (el anfitrión manda el contenido nuevo)
create or replace function public.sala_otra_ronda(p_sala uuid, p_host uuid, p_contenido jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v salas_juego%rowtype;
begin
  v := _sala_host(p_sala, p_host);
  if pg_column_size(p_contenido) > 400000 then raise exception 'El juego es demasiado grande'; end if;
  update sala_jugadores set puntaje = 0, progreso = 0, terminado = false, terminado_en = null, detalle = null where sala_id = p_sala;
  if exists (select 1 from salas_juego where codigo = v.codigo and estado <> 'finalizado' and id <> p_sala) then
    update salas_juego set codigo = _nuevo_pin() where id = p_sala;
  end if;
  update salas_juego set estado = 'esperando', inicio = null, fin = null, ronda = ronda + 1, contenido = coalesce(p_contenido, contenido)
  where id = p_sala;
  return sala_estado(p_sala);
end $$;

create or replace function public.sala_salir(p_jugador uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_j sala_jugadores%rowtype;
begin
  v_j := _sala_jugador(p_jugador, p_token);
  if (select estado from salas_juego where id = v_j.sala_id) = 'esperando' then delete from sala_jugadores where id = v_j.id; end if;
end $$;

revoke execute on function public._sala_host(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._sala_jugador(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._nuevo_pin() from public, anon, authenticated;
