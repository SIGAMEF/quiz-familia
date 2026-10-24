-- =====================================================================
-- PRUEBAS — Mis actividades: A (Trivia y Quiz relámpago), B (visibilidad y portada),
-- C (hojas de juego en vivo) y D (proyecto a su ritmo)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 07, 08, 09 y 06.
-- Todo ocurre dentro de una transacción que se deshace al final (rollback): no deja datos.
-- Necesita un profesor activo (y, si hay, un segundo profesor, un admin y un alumno).
-- Si algo falla verás "FALLO: ..."; si todo va bien, "TODAS LAS PRUEBAS DE ACTIVIDADES PASARON".
-- =====================================================================
begin;

create temp table t_ids (k text primary key, v uuid);
insert into t_ids select 'prof1', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at limit 1;
insert into t_ids select 'prof2', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at offset 1 limit 1;
insert into t_ids select 'admin', id from public.perfiles where rol = 'admin' order by created_at limit 1;
-- un alumno que todavía no esté en ningún grupo del profesor de prueba (un alumno solo puede estar en un grupo de cada profesor)
insert into t_ids select 'alumno', p.id from public.perfiles p where p.rol = 'alumno' and p.estado = 'activo'
  and not exists (select 1 from public.alumno_grupos ag join public.grupos g on g.id = ag.grupo_id
                  where ag.alumno_id = p.id and g.profesor_id = (select v from t_ids where k = 'prof1'))
  order by p.created_at limit 1;
create temp table t_txt (k text primary key, v text);
grant all on t_ids, t_txt to authenticated, anon;

create or replace function pg_temp.id_de(p text) returns uuid language sql as $$ select v from t_ids where k = p $$;
create or replace function pg_temp.txt(p text) returns text language sql as $$ select v from t_txt where k = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p), 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', coalesce((select v from t_ids where k = p)::text, ''), true);
$$;
create or replace function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true); select set_config('request.jwt.claim.sub', '', true);
$$;
grant execute on function pg_temp.id_de(text), pg_temp.txt(text), pg_temp.como(text), pg_temp.anon() to authenticated, anon;

do $$ begin
  if pg_temp.id_de('prof1') is null then raise exception 'FALLO: no hay ningún profesor activo para probar'; end if;
  -- un grupo del profesor (con el alumno, si hay) para publicar
  insert into public.grupos (profesor_id, nombre) values (pg_temp.id_de('prof1'), 'Grupo de prueba de actividades');
  insert into t_ids select 'grupo', id from public.grupos where profesor_id = pg_temp.id_de('prof1') and nombre = 'Grupo de prueba de actividades';
  if pg_temp.id_de('alumno') is not null then
    begin
      insert into public.alumno_grupos (alumno_id, grupo_id) values (pg_temp.id_de('alumno'), pg_temp.id_de('grupo'));
    exception when others then
      raise notice 'No se pudo poner al alumno en el grupo de prueba (%); se omite la parte del alumno con cuenta.', sqlerrm;
    end;
    -- si no quedó en el grupo, la parte del alumno con cuenta no se prueba (el resto sí)
    if not exists (select 1 from public.alumno_grupos where alumno_id = pg_temp.id_de('alumno') and grupo_id = pg_temp.id_de('grupo')) then
      delete from t_ids where k = 'alumno';
    end if;
  else
    raise notice 'No hay un alumno libre para probar la parte del alumno con cuenta; se omite.';
  end if;
end $$;

-- ---------- A. Trivia y Quiz relámpago ----------
set local role authenticated;
do $$
declare ok boolean := false; v_id uuid; n int;
begin
  perform pg_temp.como('prof1');
  insert into public.juegos (profesor_id, tipo, titulo, datos) values (auth.uid(), 'trivia', 'Trivia de prueba',
    '{"preguntas":[{"enunciado":"¿2+2?","opciones":["4","5","3"]},{"enunciado":"¿Capital del Perú?","opciones":["Lima","Cusco"]}]}') returning id into v_id;
  insert into t_ids values ('trivia', v_id);
  insert into public.juegos (profesor_id, tipo, titulo, datos) values (auth.uid(), 'relampago', 'Relámpago de prueba',
    '{"preguntas":[{"enunciado":"¿Color del cielo?","opciones":["Azul","Verde","Rojo","Negro"]}]}') returning id into v_id;
  insert into t_ids values ('relampago', v_id);
  select (j->>'n')::int into n from jsonb_array_elements(public.mis_juegos_profesor()) j where (j->>'id')::uuid = pg_temp.id_de('trivia');
  if n <> 2 then raise exception 'FALLO: la trivia debía contar 2 preguntas, cuenta %', n; end if;
  begin insert into public.juegos (profesor_id, tipo, titulo, datos) values (auth.uid(), 'trivia', 'Mala', '{"preguntas":[{"enunciado":"¿Sola?","opciones":["sí"]}]}');
  exception when others then ok := sqlerrm like '%correcta%'; end;
  if not ok then raise exception 'FALLO: se aceptó una pregunta con una sola opción'; end if;
  ok := false;
  begin insert into public.juegos (profesor_id, tipo, titulo, datos) values (auth.uid(), 'quiz', 'Tipo no válido', '{}'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un tipo de juego no válido'; end if;
end $$;

-- ---------- B. Visibilidad: privado, grupos, público, destacado ----------
do $$
declare v jsonb; ok boolean := false; v_proy uuid;
begin
  perform pg_temp.como('prof1');
  v_proy := public.proyecto_crear('Proyecto de actividades');
  insert into t_ids values ('proy', v_proy);
  perform public.publicar_juego(pg_temp.id_de('trivia'), array[pg_temp.id_de('grupo')]);
  v := public.actividad_visibilidad('juego', pg_temp.id_de('trivia'), 'destacado');
  if (v->>'publico')::boolean is not true or (v->>'destacado')::boolean is not true then raise exception 'FALLO: destacar: %', v; end if;
  perform public.actividad_visibilidad('proyecto', v_proy, 'publico');
  if not exists (select 1 from jsonb_array_elements(public.biblioteca_libre()) x where x->>'tipo' = 'proyecto' and (x->>'id')::uuid = v_proy) then
    raise exception 'FALLO: el proyecto público no aparece en la biblioteca';
  end if;
  begin perform public.actividad_visibilidad('juego', pg_temp.id_de('trivia'), 'secreto'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un nivel no válido'; end if;
  if pg_temp.id_de('prof2') is not null then
    perform pg_temp.como('prof2');
    ok := false;
    begin perform public.actividad_visibilidad('juego', pg_temp.id_de('trivia'), 'privado'); exception when others then ok := true; end;
    if not ok then raise exception 'FALLO: otro profesor cambió la visibilidad de mi juego'; end if;
  end if;
end $$;
-- la portada (sin cuenta) ve lo destacado
reset role;
set local role anon;
do $$ begin
  perform pg_temp.anon();
  if not exists (select 1 from jsonb_array_elements(public.portada_destacados()) x where (x->>'id')::uuid = pg_temp.id_de('trivia')) then
    raise exception 'FALLO: lo destacado no sale en la portada';
  end if;
  if exists (select 1 from jsonb_array_elements(public.portada_destacados()) x where (x->>'id')::uuid = pg_temp.id_de('proy')) then
    raise exception 'FALLO: un proyecto solo público salió como destacado';
  end if;
end $$;
-- el admin quita el destacado; el dueño lo hace privado y se apagan sus publicaciones
reset role;
set local role authenticated;
do $$ begin
  if pg_temp.id_de('admin') is not null then
    perform pg_temp.como('admin');
    perform public.actividad_visibilidad('juego', pg_temp.id_de('trivia'), 'publico');
    perform pg_temp.como('prof1');
    if (select (j->>'destacado')::boolean from jsonb_array_elements(public.mis_juegos_profesor()) j where (j->>'id')::uuid = pg_temp.id_de('trivia')) then
      raise exception 'FALLO: el admin no pudo quitar el destacado';
    end if;
  end if;
  perform pg_temp.como('prof1');
  perform public.actividad_visibilidad('juego', pg_temp.id_de('trivia'), 'privado');
  if exists (select 1 from jsonb_array_elements(public.mis_juegos_profesor()) j, jsonb_array_elements(j->'publicaciones') p
             where (j->>'id')::uuid = pg_temp.id_de('trivia') and (p->>'activo')::boolean) then
    raise exception 'FALLO: al hacerlo privado siguió publicado en el grupo';
  end if;
end $$;

-- ---------- C. Hoja de juego en vivo ----------
do $$
declare v jsonb; id uuid; a uuid := gen_random_uuid(); j uuid := gen_random_uuid();
begin
  perform pg_temp.como('prof1');
  id := public.proyecto_crear('Proyecto con juego', jsonb_build_array(
    jsonb_build_object('id', a, 'tipo', 'contenido', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', j, 'tipo', 'juego', 'diseno', '{"elementos":[]}'::jsonb,
      'config', jsonb_build_object('modo', 'persona', 'juego', jsonb_build_object('tipo', 'trivia', 'titulo', 'Trivia de prueba', 'segundos', 60, 'contenido', '{}'::jsonb)))));
  insert into t_ids values ('proy_juego', id), ('h_juego', j);
  v := public.proyecto_iniciar_sesion(id);
  insert into t_ids values ('ses', (v->>'id')::uuid);
  insert into t_txt values ('pin', v->>'pin');
end $$;
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_unirse(pg_temp.txt('pin'), 'Jugadora');
  insert into t_txt values ('tok', v->>'token');
end $$;
reset role;
set local role authenticated;
do $$
declare ok boolean := false;
begin
  perform pg_temp.como('prof1');
  begin perform public.proyecto_juego(pg_temp.id_de('ses'), 'iniciar'); exception when others then ok := sqlerrm like '%no es un juego%'; end;
  if not ok then raise exception 'FALLO: se inició un juego en una hoja que no es de juego'; end if;
  perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses'), pg_temp.id_de('h_juego'));
end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  perform pg_temp.anon();
  begin perform public.proyecto_responder(pg_temp.txt('pin'), pg_temp.txt('tok')::uuid, pg_temp.id_de('h_juego'), '{"puntos":10}'::jsonb);
  exception when others then ok := sqlerrm like '%todavía no empieza%'; end;
  if not ok then raise exception 'FALLO: se guardó un puntaje antes de empezar'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  v := public.proyecto_juego(pg_temp.id_de('ses'), 'iniciar');
  if v->>'juego_inicio' is null then raise exception 'FALLO: iniciar no puso la hora de inicio'; end if;
end $$;
-- (dentro de la prueba la hora no avanza: se adelanta el inicio para simular que ya empezó)
reset role;
do $$ begin update public.proyecto_sesiones set juego_inicio = now() - interval '10 seconds' where id = pg_temp.id_de('ses'); end $$;
set local role anon;
do $$
declare v jsonb; ok boolean := false; pin text := pg_temp.txt('pin'); t uuid := pg_temp.txt('tok')::uuid; h uuid := pg_temp.id_de('h_juego');
begin
  perform pg_temp.anon();
  perform public.proyecto_responder(pin, t, h, '{"puntos":100}'::jsonb);
  perform public.proyecto_responder(pin, t, h, '{"puntos":250}'::jsonb);
  v := public.proyecto_estado(pin, t);
  if (v->'juego'->>'pos')::int <> 1 or (v->'juego'->>'total')::int <> 1 then raise exception 'FALLO: lugar en el ranking: %', v->'juego'; end if;
  if v->'sesion'->>'juego_inicio' is null then raise exception 'FALLO: el celular no recibe la hora de inicio'; end if;
  perform public.proyecto_responder(pin, t, h, '{"puntos":300,"terminado":true,"detalle":"¡Ganó!"}'::jsonb);
  begin perform public.proyecto_responder(pin, t, h, '{"puntos":999}'::jsonb); exception when others then ok := sqlerrm like '%Ya terminaste%'; end;
  if not ok then raise exception 'FALLO: se cambió el puntaje después de terminar'; end if;
  ok := false;
  begin perform public.proyecto_responder(pin, t, h, '{"puntos":-5}'::jsonb); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un puntaje negativo'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  v := public.proyecto_estado_profe(pg_temp.id_de('ses'));
  if jsonb_array_length(v->'respuestas') <> 1 or (v->'respuestas'->0->'valor'->>'puntos')::int <> 300 then raise exception 'FALLO: ranking del profesor: %', v->'respuestas'; end if;
  v := public.proyecto_juego(pg_temp.id_de('ses'), 'reiniciar');
  if v->>'juego_inicio' is not null or jsonb_array_length(public.proyecto_estado_profe(pg_temp.id_de('ses'))->'respuestas') <> 0 then
    raise exception 'FALLO: "jugar otra vez" no borró los puntajes';
  end if;
end $$;
-- pasado el tiempo del juego (60 s + 5 de margen) ya no se aceptan puntajes
reset role;
do $$ begin update public.proyecto_sesiones set juego_inicio = now() - interval '2 minutes' where id = pg_temp.id_de('ses'); end $$;
set local role anon;
do $$
declare ok boolean := false;
begin
  perform pg_temp.anon();
  begin perform public.proyecto_responder(pg_temp.txt('pin'), pg_temp.txt('tok')::uuid, pg_temp.id_de('h_juego'), '{"puntos":50}'::jsonb);
  exception when others then ok := sqlerrm like '%tiempo%'; end;
  if not ok then raise exception 'FALLO: se aceptó un puntaje fuera de tiempo'; end if;
end $$;

-- ---------- D. A su ritmo ----------
reset role;
set local role authenticated;
do $$
declare id uuid; vf uuid := gen_random_uuid(); ag uuid := gen_random_uuid(); jg uuid := gen_random_uuid(); n int; ok boolean := false; v jsonb;
begin
  perform pg_temp.como('prof1');
  id := public.proyecto_crear('Proyecto a su ritmo', jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'unirse', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', vf, 'tipo', 'vf', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"enunciado":"El Sol es una estrella","correcta":true}'::jsonb),
    jsonb_build_object('id', ag, 'tipo', 'agrupar', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', jg, 'tipo', 'juego', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"juego":{"tipo":"trivia","titulo":"T","segundos":0,"contenido":{}}}'::jsonb)));
  insert into t_ids values ('ritmo', id), ('h_vf', vf), ('h_jg', jg);
  n := public.publicar_proyecto(id, array[pg_temp.id_de('grupo')]);
  if n <> 1 then raise exception 'FALLO: publicar_proyecto devolvió %', n; end if;
  v := public.publicaciones_proyecto(id);
  insert into t_ids values ('pub', (v->0->>'id')::uuid);
  if pg_temp.id_de('prof2') is not null then
    perform pg_temp.como('prof2');
    begin perform public.publicar_proyecto(id, array[pg_temp.id_de('grupo')]); exception when others then ok := true; end;
    if not ok then raise exception 'FALLO: otro profesor publicó mi proyecto'; end if;
  end if;
end $$;
-- un invitado sin cuenta: sin permiso, pide cuenta; con permiso, entra con su nombre
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_ritmo_abrir(pg_temp.id_de('pub'));
  if v->>'necesita' <> 'cuenta' then raise exception 'FALLO: un invitado entró sin que el profesor lo permitiera: %', v; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin perform pg_temp.como('prof1'); perform public.proyecto_publicacion_invitados(pg_temp.id_de('pub'), true); end $$;
reset role;
set local role anon;
do $$
declare v jsonb; r jsonb; ok boolean := false; i uuid; t uuid;
begin
  perform pg_temp.anon();
  if public.proyecto_ritmo_abrir(pg_temp.id_de('pub'))->>'necesita' <> 'nombre' then raise exception 'FALLO: debía pedir el nombre del invitado'; end if;
  v := public.proyecto_ritmo_abrir(pg_temp.id_de('pub'), null, null, 'Invitada', '🦊');
  i := (v->'intento'->>'id')::uuid; t := (v->'intento'->>'token')::uuid;
  insert into t_txt values ('int', i::text), ('tok_r', t::text);
  if jsonb_array_length(v->'hojas') <> 2 then raise exception 'FALLO: las hojas en vivo (Unirse y Agrupar) no debían ir: %', jsonb_array_length(v->'hojas'); end if;
  if v->'hojas'->0->'config' ? 'correcta' then raise exception 'FALLO: la respuesta correcta se mandó antes de responder'; end if;
  -- con el token vuelve al mismo intento
  if (public.proyecto_ritmo_abrir(pg_temp.id_de('pub'), null, t)->'intento'->>'id')::uuid <> i then raise exception 'FALLO: con el token no volvió a su avance'; end if;
  r := public.proyecto_ritmo_responder(i, t, pg_temp.id_de('h_vf'), '{"valor":false}'::jsonb);
  if (r->>'correcta')::boolean is not false or r->>'correcta_texto' <> 'Verdadero' then raise exception 'FALLO: corrección de V/F: %', r; end if;
  begin perform public.proyecto_ritmo_responder(i, t, pg_temp.id_de('h_vf'), '{"valor":true}'::jsonb); exception when others then ok := sqlerrm like '%Ya respondiste%'; end;
  if not ok then raise exception 'FALLO: se respondió dos veces'; end if;
  perform public.proyecto_ritmo_responder(i, t, pg_temp.id_de('h_jg'), '{"puntos":400}'::jsonb);
  r := public.proyecto_ritmo_responder(i, t, pg_temp.id_de('h_jg'), '{"puntos":150}'::jsonb);
  if (r->>'mejor')::int <> 400 then raise exception 'FALLO: debía quedar el mejor puntaje (400): %', r; end if;
  ok := false;
  begin perform public.proyecto_ritmo_responder(i, gen_random_uuid(), pg_temp.id_de('h_vf'), '{"valor":true}'::jsonb); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un token inventado sirvió'; end if;
  perform public.proyecto_ritmo_avanzar(i, t, 1, true);
end $$;
-- el alumno del grupo entra con su cuenta y ve el proyecto en su panel
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  if pg_temp.id_de('alumno') is null then return; end if;
  perform pg_temp.como('alumno');
  if not exists (select 1 from jsonb_array_elements(public.mis_proyectos_alumno()) x where (x->>'publicacion_id')::uuid = pg_temp.id_de('pub')) then
    raise exception 'FALLO: el proyecto no aparece en el panel del alumno';
  end if;
  v := public.proyecto_ritmo_abrir(pg_temp.id_de('pub'));
  if v->'intento'->>'token' is not null then raise exception 'FALLO: el alumno con cuenta no debía recibir token'; end if;
  perform public.proyecto_ritmo_responder((v->'intento'->>'id')::uuid, null, pg_temp.id_de('h_vf'), '{"valor":true}'::jsonb);
end $$;
-- el profesor ve los resultados por alumno; un proyecto público se abre desde la biblioteca
do $$
declare v jsonb; n int;
begin
  perform pg_temp.como('prof1');
  v := public.proyecto_ritmo_resultados(pg_temp.id_de('ritmo'));
  n := case when pg_temp.id_de('alumno') is null then 1 else 2 end;
  if jsonb_array_length(v) <> n then raise exception 'FALLO: resultados a su ritmo: % (esperaba %)', jsonb_array_length(v), n; end if;
  if not exists (select 1 from jsonb_array_elements(v) x where x->>'alias' = 'Invitada' and (x->>'completado')::boolean
                 and (x->'juegos'->pg_temp.id_de('h_jg')::text->>'puntos')::int = 400) then
    raise exception 'FALLO: no se guardó el avance de la invitada: %', v;
  end if;
  if (select (x->>'n_intentos')::int from jsonb_array_elements(public.mis_proyectos()) x where (x->>'id')::uuid = pg_temp.id_de('ritmo')) <> n then
    raise exception 'FALLO: la lista no cuenta los intentos';
  end if;
  perform public.actividad_visibilidad('proyecto', pg_temp.id_de('ritmo'), 'publico');
end $$;
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_ritmo_abrir(null, pg_temp.id_de('ritmo'), null, 'Visitante');
  if v->'intento'->>'token' is null then raise exception 'FALLO: no se pudo abrir el proyecto público'; end if;
  raise notice 'TODAS LAS PRUEBAS DE ACTIVIDADES PASARON';
end $$;

select 'TODAS LAS PRUEBAS DE ACTIVIDADES PASARON' as resultado;
rollback;
