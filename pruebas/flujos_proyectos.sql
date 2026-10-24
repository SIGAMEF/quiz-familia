-- =====================================================================
-- PRUEBAS — Proyectos en grupo (Fase 1)
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
