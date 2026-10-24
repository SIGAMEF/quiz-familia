-- =====================================================================
-- PRUEBAS — Proyectos en grupo (Fase 1: proyectos y hojas; Fase 2: sesión en vivo; Fase 3: ruleta)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 07_proyectos.sql y 06_permisos.sql.
-- Todo ocurre dentro de una transacción que se deshace al final (rollback): no deja datos.
-- Necesita al menos un profesor activo. Si hay dos profesores y un admin, prueba también
-- que uno no vea los proyectos del otro y que el admin sí.
-- Si algo falla verás "FALLO: ..."; si todo va bien, "TODAS LAS PRUEBAS DE PROYECTOS PASARON".
-- =====================================================================
begin;

create temp table t_ids (k text primary key, v uuid);
insert into t_ids select 'prof1', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at limit 1;
insert into t_ids select 'prof2', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at offset 1 limit 1;
insert into t_ids select 'admin', id from public.perfiles where rol = 'admin' order by created_at limit 1;
grant all on t_ids to authenticated, anon;

create or replace function pg_temp.id_de(p text) returns uuid language sql as $$ select v from t_ids where k = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p), 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', coalesce((select v from t_ids where k = p)::text, ''), true);
$$;
grant execute on function pg_temp.id_de(text), pg_temp.como(text) to authenticated, anon;

do $$ begin
  if pg_temp.id_de('prof1') is null then raise exception 'FALLO: no hay ningún profesor activo para probar'; end if;
end $$;

-- ---------- 1. El profesor crea, lista, abre y guarda ----------
set local role authenticated;
do $$
declare v_id uuid; v jsonb; v_hojas jsonb; v_base text; h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid(); ok boolean;
begin
  perform pg_temp.como('prof1');

  v_id := public.proyecto_crear('  Prueba de proyecto  ');
  insert into t_ids values ('proy1', v_id);
  v := public.proyecto_editor(v_id);
  if v->'proyecto'->>'nombre' <> 'Prueba de proyecto' then raise exception 'FALLO: el nombre no se recortó: %', v->'proyecto'->>'nombre'; end if;
  if jsonb_array_length(v->'hojas') <> 1 then raise exception 'FALLO: la primera hoja no se creó sola'; end if;
  if v->'hojas'->0->>'tipo' <> 'contenido' then raise exception 'FALLO: la primera hoja no es de contenido'; end if;
  if (v->'proyecto'->>'editable')::boolean is not true then raise exception 'FALLO: el dueño no puede editar'; end if;
  if not exists (select 1 from jsonb_array_elements(public.mis_proyectos()) x where (x->>'id')::uuid = v_id and (x->>'n_hojas')::int = 1)
    then raise exception 'FALLO: el proyecto no aparece en mis_proyectos'; end if;

  -- guardar dos hojas en otro orden: la primera hoja original desaparece
  v_base := v->'proyecto'->>'updated_at';
  v_hojas := jsonb_build_array(
    jsonb_build_object('id', h2, 'tipo', 'contenido', 'diseno', '{"fondo":{"tipo":"color","valor":"#fff"},"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', h1, 'tipo', 'contenido', 'diseno', '{"fondo":{"tipo":"color","valor":"#000"},"elementos":[]}'::jsonb, 'config', '{}'::jsonb));
  v := public.proyecto_guardar(v_id, 'Renombrado', null, v_hojas, v_base::timestamptz);
  v := public.proyecto_editor(v_id);
  if v->'proyecto'->>'nombre' <> 'Renombrado' then raise exception 'FALLO: no se renombró'; end if;
  if jsonb_array_length(v->'hojas') <> 2 then raise exception 'FALLO: debían quedar 2 hojas, hay %', jsonb_array_length(v->'hojas'); end if;
  if (v->'hojas'->0->>'id')::uuid <> h2 or (v->'hojas'->1->>'id')::uuid <> h1 then raise exception 'FALLO: el orden de las hojas no se respetó'; end if;

  -- guardar con una versión vieja (otra pestaña) debe fallar
  ok := false;
  begin perform public.proyecto_guardar(v_id, null, null, v_hojas, v_base::timestamptz);
  exception when others then ok := sqlerrm like '%otra pestaña%'; end;
  if not ok then raise exception 'FALLO: se sobrescribió una versión más nueva'; end if;

  -- validaciones
  ok := false;
  begin perform public.proyecto_guardar(v_id, null, null, '[]'::jsonb, null); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un proyecto sin hojas'; end if;
  ok := false;
  begin perform public.proyecto_guardar(v_id, null, null, jsonb_build_array(jsonb_build_object('id', h1, 'tipo', 'otro')), null);
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un tipo de hoja no válido'; end if;
  ok := false;
  begin perform public.proyecto_guardar(v_id, null, null, jsonb_build_array(jsonb_build_object('id', h1, 'tipo', 'contenido'), jsonb_build_object('id', h1, 'tipo', 'contenido')), null);
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó una hoja repetida'; end if;
  ok := false;
  begin perform public.proyecto_crear('   '); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se creó un proyecto sin nombre'; end if;

  -- duplicar copia las hojas con ids nuevos
  insert into t_ids values ('copia1', public.proyecto_duplicar(v_id));
  v := public.proyecto_editor(pg_temp.id_de('copia1'));
  if v->'proyecto'->>'nombre' <> 'Renombrado (copia)' then raise exception 'FALLO: nombre de la copia: %', v->'proyecto'->>'nombre'; end if;
  if jsonb_array_length(v->'hojas') <> 2 or (v->'hojas'->0->>'id')::uuid in (h1, h2) then raise exception 'FALLO: la copia no tiene sus propias hojas'; end if;
  if v->'hojas'->0->'diseno'->'fondo'->>'valor' <> '#fff' then raise exception 'FALLO: la copia no respetó el orden'; end if;

  -- las tablas no se pueden escribir directamente (solo con las funciones)
  ok := false;
  begin insert into public.proyectos (profesor_id, nombre) values (auth.uid(), 'directo'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se pudo insertar en proyectos sin pasar por las funciones'; end if;
  ok := false;
  begin update public.proyecto_hojas set tipo = 'vf' where proyecto_id = v_id; exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se pudo modificar proyecto_hojas directamente'; end if;
end $$;

-- ---------- 2. Otro profesor no ve ni toca el proyecto ----------
do $$
declare ok boolean; n int;
begin
  if pg_temp.id_de('prof2') is null then raise notice 'Aviso: solo hay un profesor, se omite la prueba entre profesores'; return; end if;
  perform pg_temp.como('prof2');
  select count(*) into n from public.proyectos where id = pg_temp.id_de('proy1');
  if n <> 0 then raise exception 'FALLO: otro profesor ve el proyecto en la tabla'; end if;
  select count(*) into n from public.proyecto_hojas where proyecto_id = pg_temp.id_de('proy1');
  if n <> 0 then raise exception 'FALLO: otro profesor ve las hojas'; end if;
  if exists (select 1 from jsonb_array_elements(public.mis_proyectos()) x where (x->>'id')::uuid = pg_temp.id_de('proy1'))
    then raise exception 'FALLO: el proyecto aparece en la lista de otro profesor'; end if;
  ok := false;
  begin perform public.proyecto_editor(pg_temp.id_de('proy1')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: otro profesor abrió el proyecto'; end if;
  ok := false;
  begin perform public.proyecto_guardar(pg_temp.id_de('proy1'), 'hack', null, jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'contenido')), null);
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: otro profesor guardó el proyecto'; end if;
  ok := false;
  begin perform public.proyecto_duplicar(pg_temp.id_de('proy1')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: otro profesor duplicó el proyecto'; end if;
  delete from public.proyectos where id = pg_temp.id_de('proy1');
  perform pg_temp.como('prof1');
  if not exists (select 1 from public.proyectos where id = pg_temp.id_de('proy1')) then raise exception 'FALLO: otro profesor borró el proyecto'; end if;

  -- proyecto propio del profesor 2, para la prueba siguiente
  perform pg_temp.como('prof2');
  insert into t_ids values ('proy2', public.proyecto_crear('Proyecto del profesor 2'));
end $$;

-- no puede robar una hoja ajena metiendo su id en su propio proyecto
reset role;
do $$
declare v_hoja uuid; ok boolean := false;
begin
  if pg_temp.id_de('proy2') is null then return; end if;
  select id into v_hoja from public.proyecto_hojas where proyecto_id = pg_temp.id_de('proy1') limit 1;
  perform pg_temp.como('prof2');
  set local role authenticated;
  begin perform public.proyecto_guardar(pg_temp.id_de('proy2'), null, null, jsonb_build_array(jsonb_build_object('id', v_hoja, 'tipo', 'contenido')), null);
  exception when others then ok := sqlerrm like '%otro proyecto%'; end;
  reset role;
  if not ok then raise exception 'FALLO: se pudo mover una hoja de otro profesor a un proyecto propio'; end if;
  if not exists (select 1 from public.proyecto_hojas where id = v_hoja and proyecto_id = pg_temp.id_de('proy1')) then
    raise exception 'FALLO: la hoja del otro profesor cambió de proyecto';
  end if;
end $$;

-- ---------- 3. El admin ve y modifica proyectos ajenos, pero su lista solo tiene los suyos ----------
set local role authenticated;
do $$
declare v jsonb;
begin
  if pg_temp.id_de('admin') is null then raise notice 'Aviso: no hay admin, se omite la prueba del admin'; return; end if;
  perform pg_temp.como('admin');
  v := public.proyecto_editor(pg_temp.id_de('proy1'));
  if (v->'proyecto'->>'editable')::boolean is not true then raise exception 'FALLO: el admin no puede editar'; end if;
  if exists (select 1 from jsonb_array_elements(public.mis_proyectos()) x where (x->>'id')::uuid = pg_temp.id_de('proy1'))
    then raise exception 'FALLO: mis_proyectos del admin muestra proyectos ajenos'; end if;
  if not exists (select 1 from public.proyectos where id = pg_temp.id_de('proy1')) then raise exception 'FALLO: el admin no ve la tabla'; end if;
  insert into t_ids values ('copia_admin', public.proyecto_duplicar(pg_temp.id_de('proy1')));
  if (select profesor_id from public.proyectos where id = pg_temp.id_de('copia_admin')) <> auth.uid() then
    raise exception 'FALLO: la copia del admin no quedó a su nombre';
  end if;
end $$;

-- ---------- 4. Sin sesión (anon) no hay acceso ----------
reset role;
set local role anon;
do $$
declare ok boolean := false; n int;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.proyecto_crear('anónimo'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un anónimo creó un proyecto'; end if;
  ok := false;
  begin perform public.proyecto_editor(pg_temp.id_de('proy1')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un anónimo abrió un proyecto'; end if;
  ok := false;
  begin select count(*) into n from public.proyectos; exception when others then ok := true; end;
  if not ok and n > 0 then raise exception 'FALLO: un anónimo ve proyectos'; end if;
  if jsonb_array_length(public.mis_proyectos()) <> 0 then raise exception 'FALLO: mis_proyectos devuelve algo sin sesión'; end if;
end $$;

-- ---------- 6. Sesión en vivo: PIN, unirse, grupos, respuestas, expulsar, reiniciar y finalizar (Fase 2) ----------
reset role;
create temp table t_txt (k text primary key, v text);
grant all on t_txt to authenticated, anon;
create or replace function pg_temp.txt(p text) returns text language sql as $$ select v from t_txt where k = p $$;
create or replace function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true); select set_config('request.jwt.claim.sub', '', true);
$$;
grant execute on function pg_temp.txt(text), pg_temp.anon() to authenticated, anon;

set local role authenticated;
do $$
declare v jsonb; c uuid := gen_random_uuid(); a uuid := gen_random_uuid(); o uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  opA uuid := gen_random_uuid(); opB uuid := gen_random_uuid(); id uuid;
begin
  perform pg_temp.como('prof1');
  id := public.proyecto_crear('Proyecto en vivo', jsonb_build_array(
    jsonb_build_object('id', c, 'tipo', 'contenido', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', a, 'tipo', 'agrupar', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"nombres":["Leones"]}'::jsonb),
    jsonb_build_object('id', o, 'tipo', 'opcion', 'diseno', '{"elementos":[]}'::jsonb, 'config', jsonb_build_object('modo', 'grupo', 'enunciado', '¿2+2?',
      'opciones', jsonb_build_array(jsonb_build_object('id', opA, 'texto', '4'), jsonb_build_object('id', opB, 'texto', '5')), 'correctas', jsonb_build_array(opA))),
    jsonb_build_object('id', l, 'tipo', 'lluvia', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"max":2}'::jsonb)));
  insert into t_ids values ('vivo', id), ('h_c', c), ('h_a', a), ('h_o', o), ('h_l', l), ('opA', opA);
  v := public.proyecto_iniciar_sesion(id);
  if v->>'pin' !~ '^\d{6}$' then raise exception 'FALLO: PIN no válido: %', v->>'pin'; end if;
  if (v->>'hoja_id')::uuid <> c then raise exception 'FALLO: la sesión no empieza en la primera hoja'; end if;
  insert into t_ids values ('ses', (v->>'id')::uuid);
  insert into t_txt values ('pin', v->>'pin');
  if (public.proyecto_iniciar_sesion(id)->>'id')::uuid <> (v->>'id')::uuid then raise exception 'FALLO: se abrió una segunda sesión en vez de continuar'; end if;
  if (public.proyecto_sesion_activa(id)->>'id')::uuid <> (v->>'id')::uuid then raise exception 'FALLO: proyecto_sesion_activa'; end if;
  if (select (x->'sesion'->>'id')::uuid from jsonb_array_elements(public.mis_proyectos()) x where (x->>'id')::uuid = id) <> (v->>'id')::uuid then
    raise exception 'FALLO: la lista no muestra la sesión en curso';
  end if;
end $$;

-- participantes sin cuenta
reset role;
set local role anon;
do $$
declare v jsonb; ok boolean := false; pin text := pg_temp.txt('pin');
begin
  perform pg_temp.anon();
  if public.proyecto_por_pin(pin)->>'proyecto' <> 'Proyecto en vivo' then raise exception 'FALLO: proyecto_por_pin'; end if;
  if public.proyecto_por_pin('000000x') is not null then raise exception 'FALLO: un PIN inventado encontró algo'; end if;
  foreach v in array array[public.proyecto_unirse(pin, 'Ana Pérez', 'Ana', '🦊'), public.proyecto_unirse(pin, 'Luis', null, '🐼'), public.proyecto_unirse(pin, 'Sofía', null, '🐸')] loop
    insert into t_txt values ('tok_' || (select count(*) from t_txt where k like 'tok_%'), v->>'token');
    insert into t_txt values ('clave_' || (select count(*) from t_txt where k like 'clave_%'), (v->>'participante_id') || '/' || (v->>'foto_clave'));
  end loop;
  begin perform public.proyecto_unirse(pin, 'Otra', 'ANA'); exception when others then ok := sqlerrm like '%en uso%'; end;
  if not ok then raise exception 'FALLO: se aceptó un alias repetido'; end if;
  ok := false;
  begin perform public.proyecto_unirse(pin, '   '); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó un nombre vacío'; end if;
  v := public.proyecto_estado(pin, pg_temp.txt('tok_0')::uuid);
  if v->>'estado' <> 'activa' or v->'yo'->>'alias' <> 'Ana' or v->'hoja'->>'tipo' <> 'contenido' then raise exception 'FALLO: estado del participante: %', v; end if;
  if public.proyecto_estado(pin, pg_temp.txt('tok_0')::uuid, v->>'version')->'hoja' <> 'null'::jsonb then raise exception 'FALLO: la hoja se reenvía aunque no cambió'; end if;
  if public.proyecto_estado(pin, gen_random_uuid())->>'estado' <> 'desconocido' then raise exception 'FALLO: un token inventado es válido'; end if;
  -- las tablas no se pueden leer directamente
  ok := false;
  begin perform count(*) from public.sesion_participantes; exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un anónimo puede leer sesion_participantes'; end if;
  ok := false;
  begin perform public.proyecto_estado_profe(pg_temp.id_de('ses')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un anónimo vio el estado del profesor'; end if;
end $$;

-- el profesor pasa a la pregunta "por grupo": sin grupos no se puede responder
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses'), pg_temp.id_de('h_o'));
  v := public.proyecto_estado_profe(pg_temp.id_de('ses'));
  if jsonb_array_length(v->'participantes') <> 3 then raise exception 'FALLO: participantes en la pantalla: %', jsonb_array_length(v->'participantes'); end if;
  if (v->'sesion'->>'hoja_indice')::int <> 3 or (v->'sesion'->>'total_hojas')::int <> 4 then raise exception 'FALLO: hoja 3 de 4: %', v->'sesion'; end if;
end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false; v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_estado(pg_temp.txt('pin'), pg_temp.txt('tok_0')::uuid);
  if v->'hoja'->'config' ? 'correctas' then raise exception 'FALLO: el participante ve la respuesta correcta antes de revelarla'; end if;
  begin perform public.proyecto_responder(pg_temp.txt('pin'), pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_o'), jsonb_build_object('opcion', pg_temp.id_de('opA')));
  exception when others then ok := sqlerrm like '%grupo%'; end;
  if not ok then raise exception 'FALLO: se respondió "por grupo" sin tener grupo'; end if;
end $$;

-- formar grupos (2 grupos para 3 personas: 2 y 1) y confirmarlos
reset role;
set local role authenticated;
do $$
declare v jsonb; ok boolean := false;
begin
  perform pg_temp.como('prof2');
  begin perform public.proyecto_formar_grupos(pg_temp.id_de('ses'), pg_temp.id_de('h_a'), 2); exception when others then ok := true; end;
  if not ok and pg_temp.id_de('prof2') is not null then raise exception 'FALLO: otro profesor formó grupos en mi sesión'; end if;
  perform pg_temp.como('prof1');
  ok := false;
  begin perform public.proyecto_formar_grupos(pg_temp.id_de('ses'), pg_temp.id_de('h_o'), 2); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se formaron grupos en una hoja que no es Agrupar'; end if;
  v := public.proyecto_formar_grupos(pg_temp.id_de('ses'), pg_temp.id_de('h_a'), 2);
  if jsonb_array_length(v) <> 2 or v->0->>'nombre' <> 'Leones' or v->1->>'nombre' <> 'Grupo 2' then raise exception 'FALLO: grupos formados: %', v; end if;
  v := public.proyecto_formar_grupos(pg_temp.id_de('ses'), pg_temp.id_de('h_a'), 2);   -- volver a mezclar
  v := public.proyecto_estado_profe(pg_temp.id_de('ses'));
  if (select array_agg(n order by n) from (select count(*) n from jsonb_array_elements(v->'participantes') p group by p->>'grupo_id') x) <> array[1, 2]::bigint[] then
    raise exception 'FALLO: los grupos no quedaron equilibrados';
  end if;
  if jsonb_array_length(v->'grupos') <> 2 then raise exception 'FALLO: al volver a mezclar quedaron grupos viejos'; end if;
  perform public.proyecto_renombrar_grupo((v->'grupos'->1->>'id')::uuid, 'Los Cóndores', '#E14D72', '🦅');
  perform public.proyecto_confirmar_grupos(pg_temp.id_de('ses'), pg_temp.id_de('h_a'));
end $$;

-- responder por grupo: una respuesta por grupo; cerrar; revelar; lluvia con máximo de ideas
reset role;
set local role anon;
do $$
declare v jsonb; ok boolean := false; pin text := pg_temp.txt('pin');
begin
  perform pg_temp.anon();
  v := public.proyecto_estado(pin, pg_temp.txt('tok_0')::uuid);
  if v->'yo'->'grupo' is null or v->'yo'->'grupo' = 'null'::jsonb then raise exception 'FALLO: el participante no ve su grupo'; end if;
  if jsonb_array_length(v->'yo'->'grupo'->'companeros') < 1 then raise exception 'FALLO: no ve a sus compañeros'; end if;
  perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_o'), jsonb_build_object('opcion', pg_temp.id_de('opA')));
  perform public.proyecto_responder(pin, pg_temp.txt('tok_1')::uuid, pg_temp.id_de('h_o'), jsonb_build_object('opcion', pg_temp.id_de('opA')));
  perform public.proyecto_responder(pin, pg_temp.txt('tok_2')::uuid, pg_temp.id_de('h_o'), jsonb_build_object('opcion', pg_temp.id_de('opA')));
  ok := false;
  begin perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_o'), '{"opcion":"no-existe"}'::jsonb); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó una opción que no existe'; end if;
  ok := false;
  begin perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_l'), '{"texto":"hola"}'::jsonb); exception when others then ok := sqlerrm like '%ya pasó%'; end;
  if not ok then raise exception 'FALLO: se respondió una hoja que no es la actual'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  v := public.proyecto_estado_profe(pg_temp.id_de('ses'));
  if jsonb_array_length(v->'respuestas') <> 2 then raise exception 'FALLO: "por grupo" debía dejar 2 respuestas (una por grupo), hay %', jsonb_array_length(v->'respuestas'); end if;
  perform public.proyecto_respuestas(pg_temp.id_de('ses'), false, true);   -- cerrar y revelar
end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false; v jsonb;
begin
  perform pg_temp.anon();
  begin perform public.proyecto_responder(pg_temp.txt('pin'), pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_o'), jsonb_build_object('opcion', pg_temp.id_de('opA')));
  exception when others then ok := sqlerrm like '%cerradas%'; end;
  if not ok then raise exception 'FALLO: se respondió con las respuestas cerradas'; end if;
  v := public.proyecto_estado(pg_temp.txt('pin'), pg_temp.txt('tok_0')::uuid);
  if not (v->'hoja'->'config' ? 'correctas') or (v->'sesion'->>'revelar')::boolean is not true then raise exception 'FALLO: al revelar, el participante no recibe la correcta'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin perform pg_temp.como('prof1'); perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses'), pg_temp.id_de('h_l')); end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false; pin text := pg_temp.txt('pin');
begin
  perform pg_temp.anon();
  perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_l'), '{"texto":"amor"}'::jsonb);
  perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_l'), '{"texto":"paz"}'::jsonb);
  begin perform public.proyecto_responder(pin, pg_temp.txt('tok_0')::uuid, pg_temp.id_de('h_l'), '{"texto":"otra"}'::jsonb); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptaron más ideas que el máximo'; end if;
  -- foto: solo en su carpeta, con su clave secreta
  if not public.puede_subir_foto_sesion('proyectos/sesiones/' || pg_temp.id_de('ses') || '/' || pg_temp.txt('clave_0') || '.jpg') then raise exception 'FALLO: no puede subir su foto'; end if;
  if public.puede_subir_foto_sesion('proyectos/sesiones/' || pg_temp.id_de('ses') || '/' || split_part(pg_temp.txt('clave_0'), '/', 1) || '/' || gen_random_uuid() || '.jpg') then
    raise exception 'FALLO: se puede subir una foto sin la clave';
  end if;
  if public.puede_subir_foto_sesion('proyectos/otra-cosa/x.jpg') then raise exception 'FALLO: ruta libre en el bucket'; end if;
  perform public.proyecto_foto(pin, pg_temp.txt('tok_0')::uuid, 'https://x.supabase.co/storage/v1/object/public/preguntas-imagenes/proyectos/sesiones/' || pg_temp.id_de('ses') || '/' || pg_temp.txt('clave_0') || '.jpg');
  ok := false;
  begin perform public.proyecto_foto(pin, pg_temp.txt('tok_1')::uuid, 'https://malo.com/foto.jpg'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se aceptó una foto de otra ruta'; end if;
end $$;

-- expulsar, registro cerrado, tardíos (entran al grupo más chico), resultados, reiniciar y finalizar
reset role;
set local role authenticated;
do $$
declare v jsonb; ok boolean := false; id_sofia uuid;
begin
  perform pg_temp.como('prof1');
  select (p->>'id')::uuid into id_sofia from jsonb_array_elements(public.proyecto_estado_profe(pg_temp.id_de('ses'))->'participantes') p where p->>'alias' = 'Sofía';
  perform public.proyecto_expulsar(pg_temp.id_de('ses'), id_sofia);
  perform public.proyecto_registro(pg_temp.id_de('ses'), false, false);
end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false; v jsonb;
begin
  perform pg_temp.anon();
  if public.proyecto_estado(pg_temp.txt('pin'), pg_temp.txt('tok_2')::uuid)->>'estado' <> 'expulsado' then raise exception 'FALLO: el expulsado no se entera'; end if;
  begin perform public.proyecto_unirse(pg_temp.txt('pin'), 'Bruno'); exception when others then ok := sqlerrm like '%cerrado%'; end;
  if not ok then raise exception 'FALLO: se unió alguien con el registro cerrado'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin perform pg_temp.como('prof1'); perform public.proyecto_registro(pg_temp.id_de('ses'), null, true); end $$;
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_unirse(pg_temp.txt('pin'), 'Bruno');
  if public.proyecto_estado(pg_temp.txt('pin'), (v->>'token')::uuid)->'yo'->'grupo' = 'null'::jsonb then raise exception 'FALLO: el tardío no entró a un grupo'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare r jsonb; pin_viejo text := pg_temp.txt('pin');
begin
  perform pg_temp.como('prof1');
  r := public.proyecto_resultados(pg_temp.id_de('vivo'));
  if jsonb_array_length(r) <> 1 or jsonb_array_length(r->0->'respuestas') < 4 then raise exception 'FALLO: resultados: %', r; end if;
  r := public.proyecto_reiniciar_sesion(pg_temp.id_de('ses'));
  if r->'sesion'->>'pin' = pin_viejo then raise exception 'FALLO: al reiniciar no cambió el PIN'; end if;
  if (r->'sesion'->>'participantes')::int <> 0 then raise exception 'FALLO: al reiniciar quedaron participantes'; end if;
  if jsonb_array_length(r->'fotos') <> 1 then raise exception 'FALLO: reiniciar debía devolver 1 foto para borrar: %', r->'fotos'; end if;
  if (select count(*) from jsonb_array_elements(public.proyecto_estado_profe(pg_temp.id_de('ses'))->'grupos')) <> 0 then raise exception 'FALLO: al reiniciar quedaron grupos'; end if;
  update t_txt set v = r->'sesion'->>'pin' where k = 'pin';
  perform public.proyecto_finalizar(pg_temp.id_de('ses'));
  if public.proyecto_sesion_activa(pg_temp.id_de('vivo')) is not null then raise exception 'FALLO: la sesión sigue activa tras finalizar'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
  perform pg_temp.anon();
  if public.proyecto_por_pin(pg_temp.txt('pin')) is not null then raise exception 'FALLO: el PIN sigue funcionando tras finalizar'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  v := public.proyecto_eliminar(pg_temp.id_de('vivo'));
  if exists (select 1 from public.proyectos where id = pg_temp.id_de('vivo')) then raise exception 'FALLO: proyecto_eliminar'; end if;
end $$;

-- ---------- 7. Ruleta: nombres, grupos y participantes; con y sin repetir; reiniciar (Fase 3) ----------
reset role;
set local role authenticated;
do $$
declare v jsonb; ok boolean := false; id uuid; a uuid := gen_random_uuid(); r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid(); r3 uuid := gen_random_uuid();
  x1 jsonb; x2 jsonb; ses jsonb;
begin
  perform pg_temp.como('prof1');
  id := public.proyecto_crear('Proyecto ruleta', jsonb_build_array(
    jsonb_build_object('id', a, 'tipo', 'agrupar', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', r1, 'tipo', 'ruleta', 'diseno', '{"elementos":[]}'::jsonb,
      'config', '{"origen":"nombres","lista":["Ana","ana","  ","Beto"],"repetir":false}'::jsonb),
    jsonb_build_object('id', r2, 'tipo', 'ruleta', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"origen":"grupos"}'::jsonb),
    jsonb_build_object('id', r3, 'tipo', 'ruleta', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{"origen":"participantes","repetir":true}'::jsonb)));
  insert into t_ids values ('rul', id), ('r_a', a), ('r1', r1), ('r2', r2), ('r3', r3);
  ses := public.proyecto_iniciar_sesion(id);
  insert into t_ids values ('ses2', (ses->>'id')::uuid);
  update t_txt set v = ses->>'pin' where k = 'pin';

  -- nombres sin repetir: "ana" repetido y el vacío no cuentan; salen los 2 y luego ya no queda nadie
  perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses2'), r1);
  v := public.proyecto_estado_profe(pg_temp.id_de('ses2'));
  if jsonb_array_length(v->'ruleta'->'candidatos') <> 2 then raise exception 'FALLO: gajos de la ruleta de nombres: %', v->'ruleta'->'candidatos'; end if;
  x1 := public.ruleta_girar(pg_temp.id_de('ses2'), r1);
  x2 := public.ruleta_girar(pg_temp.id_de('ses2'), r1);
  if x1->>'texto' = x2->>'texto' then raise exception 'FALLO: sin repetir salió dos veces %', x1->>'texto'; end if;
  if (x2->>'ronda')::int <> 2 then raise exception 'FALLO: ronda del segundo sorteo: %', x2; end if;
  begin perform public.ruleta_girar(pg_temp.id_de('ses2'), r1); exception when others then ok := sqlerrm like '%Todos han salido%'; end;
  if not ok then raise exception 'FALLO: se giró sin nadie en la ruleta'; end if;
  if jsonb_array_length(public.proyecto_estado_profe(pg_temp.id_de('ses2'))->'ruleta'->'sorteos') <> 2 then raise exception 'FALLO: historial de la ruleta'; end if;
  perform public.ruleta_reiniciar(pg_temp.id_de('ses2'), r1);
  if jsonb_array_length(public.proyecto_estado_profe(pg_temp.id_de('ses2'))->'ruleta'->'sorteos') <> 0 then raise exception 'FALLO: reiniciar la ruleta no borró el historial'; end if;
  if (public.ruleta_girar(pg_temp.id_de('ses2'), r1)->>'ronda')::int <> 1 then raise exception 'FALLO: tras reiniciar la ruleta no volvió a la ronda 1'; end if;

  -- otras hojas y otros profesores
  ok := false;
  begin perform public.ruleta_girar(pg_temp.id_de('ses2'), a); exception when others then ok := sqlerrm like '%no es una ruleta%'; end;
  if not ok then raise exception 'FALLO: se giró una hoja que no es ruleta'; end if;
  ok := false;
  begin perform public.ruleta_girar(pg_temp.id_de('ses2'), r2); exception when others then ok := sqlerrm like '%grupos%'; end;
  if not ok then raise exception 'FALLO: se giró la ruleta de grupos sin grupos'; end if;
  ok := false;
  begin perform public.ruleta_girar(pg_temp.id_de('ses2'), r3); exception when others then ok := sqlerrm like '%participantes%'; end;
  if not ok then raise exception 'FALLO: se giró la ruleta de participantes sin participantes'; end if;
  if pg_temp.id_de('prof2') is not null then
    perform pg_temp.como('prof2');
    ok := false;
    begin perform public.ruleta_girar(pg_temp.id_de('ses2'), r1); exception when others then ok := true; end;
    if not ok then raise exception 'FALLO: otro profesor giró mi ruleta'; end if;
    ok := false;
    begin perform public.ruleta_reiniciar(pg_temp.id_de('ses2'), r1); exception when others then ok := true; end;
    if not ok then raise exception 'FALLO: otro profesor reinició mi ruleta'; end if;
  end if;
end $$;

-- llegan 3 participantes; no pueden girar
reset role;
set local role anon;
do $$
declare v jsonb; ok boolean := false; pin text := pg_temp.txt('pin');
begin
  perform pg_temp.anon();
  foreach v in array array[public.proyecto_unirse(pin, 'Rita'), public.proyecto_unirse(pin, 'Raúl'), public.proyecto_unirse(pin, 'Rosa')] loop
    insert into t_txt values ('rtok_' || (select count(*) from t_txt where k like 'rtok_%'), v->>'token');
  end loop;
  begin perform public.ruleta_girar(pg_temp.id_de('ses2'), pg_temp.id_de('r1')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un participante giró la ruleta'; end if;
end $$;

-- grupos y participantes; con repetición pueden salir más veces que gajos
reset role;
set local role authenticated;
do $$
declare v jsonb; x jsonb; i int;
begin
  perform pg_temp.como('prof1');
  perform public.proyecto_formar_grupos(pg_temp.id_de('ses2'), pg_temp.id_de('r_a'), 2);
  perform public.proyecto_confirmar_grupos(pg_temp.id_de('ses2'), pg_temp.id_de('r_a'));
  perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses2'), pg_temp.id_de('r2'));
  v := public.proyecto_estado_profe(pg_temp.id_de('ses2'));
  if jsonb_array_length(v->'ruleta'->'candidatos') <> 2 or v->'ruleta'->'candidatos'->0->>'color' is null then raise exception 'FALLO: gajos de la ruleta de grupos: %', v->'ruleta'; end if;
  x := public.ruleta_girar(pg_temp.id_de('ses2'), pg_temp.id_de('r2'));
  if not exists (select 1 from jsonb_array_elements(v->'grupos') g where g->>'id' = x->>'clave') then raise exception 'FALLO: salió algo que no es un grupo: %', x; end if;
  insert into t_txt values ('r2_clave', x->>'clave');
  for i in 1..5 loop perform public.ruleta_girar(pg_temp.id_de('ses2'), pg_temp.id_de('r3')); end loop;
  perform public.proyecto_ir_a_hoja(pg_temp.id_de('ses2'), pg_temp.id_de('r3'));
end $$;

-- el participante ve la ruleta de la hoja actual con su historial (sin el token de nadie)
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  perform pg_temp.anon();
  v := public.proyecto_estado(pg_temp.txt('pin'), pg_temp.txt('rtok_0')::uuid);
  if v->'hoja'->>'tipo' <> 'ruleta' or v->'ruleta'->>'hoja_id' <> pg_temp.id_de('r3')::text then raise exception 'FALLO: el participante no recibe la ruleta: %', v->'ruleta'; end if;
  if jsonb_array_length(v->'ruleta'->'candidatos') <> 3 or jsonb_array_length(v->'ruleta'->'sorteos') <> 5 then raise exception 'FALLO: ruleta del participante: %', v->'ruleta'; end if;
  if (v->'ruleta')::text like '%token%' then raise exception 'FALLO: la ruleta muestra tokens'; end if;
  if v->>'ahora' is null then raise exception 'FALLO: falta la hora del servidor'; end if;
end $$;

-- el sorteo guardó el grupo elegido (se mira la tabla como dueño de la base: la app no puede leerla)
reset role;
do $$ begin
  if not exists (select 1 from public.ruleta_sorteos where sesion_id = pg_temp.id_de('ses2') and hoja_id = pg_temp.id_de('r2')
                 and elegido_grupo_id::text = pg_temp.txt('r2_clave')) then raise exception 'FALLO: el sorteo no guardó el grupo elegido'; end if;
end $$;

-- resultados, reiniciar la sesión (borra los sorteos) y limpiar
reset role;
set local role authenticated;
do $$
declare r jsonb;
begin
  perform pg_temp.como('prof1');
  r := public.proyecto_resultados(pg_temp.id_de('rul'));
  if jsonb_array_length(r->0->'sorteos') <> 7 then raise exception 'FALLO: los resultados debían tener 7 sorteos: %', jsonb_array_length(r->0->'sorteos'); end if;
  perform public.proyecto_reiniciar_sesion(pg_temp.id_de('ses2'));
  if jsonb_array_length(public.proyecto_resultados(pg_temp.id_de('rul'))->0->'sorteos') <> 0 then raise exception 'FALLO: al reiniciar la sesión quedaron sorteos'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.ruleta_sorteos where elegido_grupo_id::text = pg_temp.txt('r2_clave')) <> 0 then raise exception 'FALLO: quedó el sorteo del grupo tras reiniciar'; end if;
end $$;
set local role authenticated;
do $$ begin perform pg_temp.como('prof1'); perform public.proyecto_eliminar(pg_temp.id_de('rul')); end $$;

-- ---------- 5. Borrar el proyecto borra sus hojas ----------
reset role;
set local role authenticated;
do $$
begin
  perform pg_temp.como('prof1');
  delete from public.proyectos where id = pg_temp.id_de('proy1');
  if exists (select 1 from public.proyectos where id = pg_temp.id_de('proy1')) then raise exception 'FALLO: el dueño no pudo borrar'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.proyecto_hojas where proyecto_id = pg_temp.id_de('proy1')) then raise exception 'FALLO: quedaron hojas huérfanas'; end if;
  raise notice 'TODAS LAS PRUEBAS DE PROYECTOS PASARON';
end $$;

select 'TODAS LAS PRUEBAS DE PROYECTOS PASARON' as resultado;
rollback;
