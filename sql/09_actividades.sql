-- =====================================================================
-- PASO 9 — MIS ACTIVIDADES (quizzes, juegos y proyectos juntos)
-- A. Trivia y Quiz relámpago como juegos que crea el profesor
-- B. Visibilidad de cada actividad: privado, grupos, público y destacado en la portada
-- Ejecutar DESPUÉS de 05, 07 y 08, y ANTES de 06_permisos.sql. Se puede ejecutar varias veces.
-- (Si vuelves a ejecutar el 05, ejecuta otra vez este 09: reemplaza dos funciones de los juegos.)
-- =====================================================================

-- ======================= A. TRIVIA Y QUIZ RELÁMPAGO =======================
-- datos: { preguntas: [{ enunciado, opciones: [correcta, incorrecta, ...] }] }  (la primera opción es la correcta)
alter table public.juegos drop constraint if exists juegos_tipo_check;
alter table public.juegos add constraint juegos_tipo_check
  check (tipo in ('ahorcado','sopa','memoria','ordena','frase','rompecabezas','trivia','relampago'));

-- Validación del contenido de cada tipo de juego (la del 05 más Trivia y Quiz relámpago)
create or replace function public._validar_juego() returns trigger
language plpgsql set search_path = public as $$
declare d jsonb := new.datos; n int; p jsonb;
begin
  if pg_column_size(d) > 300000 then raise exception 'El juego es demasiado grande'; end if;
  new.titulo := trim(new.titulo);
  new.updated_at := now();
  if new.tipo in ('ahorcado','ordena','sopa') then
    n := jsonb_array_length(coalesce(d->'palabras', '[]'));
    if n < 1 then raise exception 'Agrega al menos una palabra'; end if;
    if n > 60 then raise exception 'Máximo 60 palabras'; end if;
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
  elsif new.tipo in ('trivia','relampago') then
    n := jsonb_array_length(coalesce(d->'preguntas', '[]'));
    if n < 1 then raise exception 'Agrega al menos una pregunta'; end if;
    if n > 60 then raise exception 'Máximo 60 preguntas'; end if;
    for p in select * from jsonb_array_elements(d->'preguntas') loop
      if length(trim(coalesce(p->>'enunciado', ''))) = 0 then raise exception 'Hay una pregunta sin enunciado'; end if;
      if jsonb_typeof(p->'opciones') is distinct from 'array' or jsonb_array_length(p->'opciones') not between 2 and 4 then
        raise exception 'Cada pregunta necesita la respuesta correcta y de 1 a 3 incorrectas';
      end if;
    end loop;
  end if;
  if new.tipo = 'sopa' then
    if coalesce((d->>'filas')::int, 0) not between 6 and 25 or coalesce((d->>'columnas')::int, 0) not between 6 and 25 then
      raise exception 'La sopa debe tener entre 6 y 25 filas y columnas';
    end if;
    if jsonb_array_length(coalesce(d->'grilla', '[]')) <> (d->>'filas')::int then raise exception 'Genera la sopa antes de guardar'; end if;
  end if;
  return new;
end $$;

-- Cantidad de elementos de un juego (para las listas)
create or replace function public._juego_items(j public.juegos) returns int
language sql immutable set search_path = public as $$
  select case
    when j.tipo = 'memoria' then jsonb_array_length(coalesce(j.datos->'parejas', '[]'))
    when j.tipo = 'frase' then jsonb_array_length(coalesce(j.datos->'frases', '[]'))
    when j.tipo in ('trivia','relampago') then jsonb_array_length(coalesce(j.datos->'preguntas', '[]'))
    when j.tipo = 'rompecabezas' then coalesce((j.datos->>'piezas')::int, 3) * coalesce((j.datos->>'piezas')::int, 3)
    else jsonb_array_length(coalesce(j.datos->'palabras', '[]')) end;
$$;

-- ======================= B. VISIBILIDAD =======================
-- 🔒 privado: solo el profesor · 👥 grupos: publicado a sus grupos o alumnos
-- 🌐 público: en la biblioteca de la portada · ⭐ destacado: además, en la fila "Creado por nuestros profesores"
alter table public.quizzes add column if not exists destacado boolean not null default false;
alter table public.juegos add column if not exists destacado boolean not null default false;

-- mis_quizzes con "destacado" y cuántas publicaciones siguen activas
create or replace function public.mis_quizzes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'titulo', q.titulo, 'tema', q.tema, 'descripcion', q.descripcion, 'publico', q.publico, 'destacado', q.destacado,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'n_preguntas', (select count(*) from preguntas p where p.quiz_id = q.id),
    'puntos', (select coalesce(sum(p.puntos), 0) from preguntas p where p.quiz_id = q.id and p.tipo <> 'lluvia_ideas'),
    'n_publicaciones', (select count(*) from publicaciones pu where pu.quiz_id = q.id),
    'n_publicaciones_activas', (select count(*) from publicaciones pu where pu.quiz_id = q.id and pu.activo),
    'subtemas', (select coalesce(jsonb_agg(distinct p.subtema) filter (where p.subtema is not null), '[]'::jsonb)
                 from preguntas p where p.quiz_id = q.id)
  ) order by q.updated_at desc), '[]'::jsonb)
  from quizzes q where q.profesor_id = auth.uid();
$$;

-- Cambiar la visibilidad. p_clase: 'quiz' | 'juego' | 'proyecto'; p_nivel: 'privado' | 'grupos' | 'publico' | 'destacado'.
-- "privado" (lo pide el dueño) también apaga sus publicaciones en grupos. El admin puede bajar el nivel de cualquiera.
create or replace function public.actividad_visibilidad(p_clase text, p_id uuid, p_nivel text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_dueno uuid; v_pub boolean; v_dest boolean;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  if p_nivel not in ('privado','grupos','publico','destacado') then raise exception 'Visibilidad no válida'; end if;
  v_dueno := case p_clase when 'quiz' then (select profesor_id from quizzes where id = p_id)
                          when 'juego' then (select profesor_id from juegos where id = p_id)
                          when 'proyecto' then (select profesor_id from proyectos where id = p_id) end;
  if v_dueno is null then raise exception 'Esa actividad ya no existe.'; end if;
  if not ((v_dueno = auth.uid() and esta_activo()) or es_admin()) then raise exception 'Esta actividad es de otro profesor.'; end if;
  v_pub := p_nivel in ('publico','destacado');
  v_dest := p_nivel = 'destacado';
  if p_clase = 'quiz' then
    if v_pub and not exists (select 1 from preguntas where quiz_id = p_id) then raise exception 'Agrega preguntas antes de hacerlo público.'; end if;
    update quizzes set publico = v_pub, destacado = v_dest where id = p_id;
    if p_nivel = 'privado' and v_dueno = auth.uid() then update publicaciones set activo = false where quiz_id = p_id; end if;
  elsif p_clase = 'juego' then
    update juegos set publico = v_pub, destacado = v_dest where id = p_id;
    if p_nivel = 'privado' and v_dueno = auth.uid() then update juego_publicaciones set activo = false where juego_id = p_id; end if;
  elsif p_clase = 'proyecto' then
    update proyectos set publico = v_pub, destacado = v_dest where id = p_id;
    if p_nivel = 'privado' and v_dueno = auth.uid() then update proyecto_publicaciones set activo = false where proyecto_id = p_id; end if;
  else raise exception 'Tipo de actividad no válido';
  end if;
  return jsonb_build_object('publico', v_pub, 'destacado', v_dest);
end $$;

-- ---------- Portada ----------
-- Fila "Creado por nuestros profesores": lo destacado (quizzes, juegos y proyectos)
create or replace function public.portada_destacados() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.f desc), '[]'::jsonb) from (
    select j.updated_at as f, jsonb_build_object('clase', 'juego', 'id', j.id, 'tipo', j.tipo, 'titulo', j.titulo, 'tema', j.tema,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', _juego_items(j)) as j
    from juegos j join perfiles pf on pf.id = j.profesor_id
    where j.destacado and j.publico and pf.estado = 'activo'
    union all
    select q.updated_at, jsonb_build_object('clase', 'quiz', 'id', q.id, 'tipo', 'quiz', 'titulo', q.titulo, 'tema', q.tema,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', (select count(*) from preguntas p where p.quiz_id = q.id))
    from quizzes q join perfiles pf on pf.id = q.profesor_id
    where q.destacado and q.publico and pf.estado = 'activo' and exists (select 1 from preguntas p where p.quiz_id = q.id)
    union all
    select p.updated_at, jsonb_build_object('clase', 'proyecto', 'id', p.id, 'tipo', 'proyecto', 'titulo', p.nombre, 'tema', null,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id))
    from proyectos p join perfiles pf on pf.id = p.profesor_id
    where p.destacado and p.publico and pf.estado = 'activo'
    order by 1 desc limit 24
  ) x;
$$;

-- Biblioteca pública: juegos, quizzes y (ahora) proyectos públicos
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
    union all
    select 0, p.updated_at, jsonb_build_object(
      'id', p.id, 'tipo', 'proyecto', 'titulo', p.nombre, 'tema', null, 'nivel', null,
      'autor', coalesce(pf.nombre, pf.usuario), 'n', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id), 'jugadas', 0)
    from proyectos p join perfiles pf on pf.id = p.profesor_id
    where p.publico and pf.estado = 'activo' and (p_tipo is null or p_tipo = 'proyecto')
    limit 300
  ) x;
$$;

-- Admin (moderación): todo lo público, con su marca de destacado
create or replace function public.admin_juegos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'tipo', j.tipo, 'titulo', j.titulo, 'tema', j.tema, 'publico', j.publico,
      'destacado', j.destacado, 'jugadas', j.jugadas, 'n', _juego_items(j), 'autor', coalesce(pf.nombre, pf.usuario), 'updated_at', j.updated_at, 'clase', 'juego')
      order by j.destacado desc, j.updated_at desc), '[]'::jsonb)
    from juegos j join perfiles pf on pf.id = j.profesor_id where j.publico)
    || (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'tipo', 'quiz', 'titulo', q.titulo, 'tema', q.tema, 'publico', true,
      'destacado', q.destacado, 'jugadas', 0, 'n', (select count(*) from preguntas p where p.quiz_id = q.id), 'autor', coalesce(pf.nombre, pf.usuario),
      'updated_at', q.updated_at, 'clase', 'quiz') order by q.destacado desc, q.updated_at desc), '[]'::jsonb)
    from quizzes q join perfiles pf on pf.id = q.profesor_id where q.publico)
    || (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'tipo', 'proyecto', 'titulo', p.nombre, 'tema', null, 'publico', true,
      'destacado', p.destacado, 'jugadas', 0, 'n', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id), 'autor', coalesce(pf.nombre, pf.usuario),
      'updated_at', p.updated_at, 'clase', 'proyecto') order by p.destacado desc, p.updated_at desc), '[]'::jsonb)
    from proyectos p join perfiles pf on pf.id = p.profesor_id where p.publico);
end $$;
