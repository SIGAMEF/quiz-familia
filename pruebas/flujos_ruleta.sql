-- =====================================================================
-- PRUEBAS — Ruleta al azar, ruleta de participantes y sesiones inactivas (Proyectos en grupo)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 07 y 06.
-- Todo ocurre dentro de una transacción que se deshace al final (rollback): no deja datos.
-- Si algo falla verás "FALLO: ..."; si todo va bien, "TODAS LAS PRUEBAS DE RULETA PASARON".
-- =====================================================================
begin;

create temp table t_ids (k text primary key, v uuid);
insert into t_ids select 'prof', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at limit 1;
grant all on t_ids to authenticated, anon;
create or replace function pg_temp.id_de(p text) returns uuid language sql as $$ select v from t_ids where k = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p), 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', coalesce((select v from t_ids where k = p)::text, ''), true);
$$;
grant execute on function pg_temp.id_de(text), pg_temp.como(text) to authenticated, anon;

-- Un proyecto con: 1 Unirse · 2 Unirse · 3 ruleta de nombres (6, puede repetir) · 4 ruleta de nombres (sin repetir) · 5 ruleta de participantes
do $$
declare v_p uuid := gen_random_uuid(); v_s uuid := gen_random_uuid(); h uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
begin
  if pg_temp.id_de('prof') is null then raise exception 'FALLO: no hay ningún profesor activo para probar'; end if;
  insert into public.proyectos (id, profesor_id, nombre) values (v_p, pg_temp.id_de('prof'), 'Prueba ruleta');
  insert into public.proyecto_hojas (id, proyecto_id, orden, tipo, config) values
    (h[1], v_p, 1, 'unirse', '{}'), (h[2], v_p, 2, 'unirse', '{}'),
    (h[3], v_p, 3, 'ruleta', '{"origen":"nombres","repetir":true,"lista":["Ana","Bruno","Carla","Diego","Elena","Felipe"]}'),
    (h[4], v_p, 4, 'ruleta', '{"origen":"nombres","repetir":false,"lista":["Ana","Bruno","Carla","Diego","Elena","Felipe"]}'),
    (h[5], v_p, 5, 'ruleta', '{"origen":"participantes","repetir":false}');
  insert into public.proyecto_sesiones (id, proyecto_id, profesor_id, pin, hoja_id) values (v_s, v_p, pg_temp.id_de('prof'), '987123', h[1]);
  insert into t_ids values ('proyecto', v_p), ('sesion', v_s), ('h1', h[1]), ('h2', h[2]), ('h3', h[3]), ('h4', h[4]), ('h5', h[5]);
end $$;

-- ---------- 1. 200 giros con repetición: reparto razonable ----------
set local role authenticated;
do $$
declare r jsonb; i int; cuenta jsonb := '{}'; k text; n int;
begin
  perform pg_temp.como('prof');
  for i in 1..200 loop
    r := public.ruleta_girar(pg_temp.id_de('sesion'), pg_temp.id_de('h3'));
    cuenta := jsonb_set(cuenta, array[r->>'texto'], to_jsonb(coalesce((cuenta->>(r->>'texto'))::int, 0) + 1));
  end loop;
  if (select count(*) from jsonb_object_keys(cuenta)) <> 6 then raise exception 'FALLO: en 200 giros no salieron los 6 nombres: %', cuenta; end if;
  -- lo esperado es ~33 cada uno; con azar real es casi imposible salir de 12..60
  for k, n in select key, value::int from jsonb_each_text(cuenta) loop
    if n < 12 or n > 60 then raise exception 'FALLO: reparto poco razonable (% salió % veces): %', k, n, cuenta; end if;
  end loop;
  raise notice 'Reparto de 200 giros: %', cuenta;
end $$;

-- ---------- 2. Sin repetición: no se repite nadie y el orden cambia entre reinicios ----------
do $$
declare r jsonb; i int; v int; orden text; ordenes text[] := '{}'; primeros text[] := '{}'; ok boolean := false;
begin
  perform pg_temp.como('prof');
  for v in 1..6 loop
    orden := '';
    for i in 1..6 loop
      r := public.ruleta_girar(pg_temp.id_de('sesion'), pg_temp.id_de('h4'));
      if position(r->>'texto' in orden) > 0 then raise exception 'FALLO: % salió dos veces sin repetición', r->>'texto'; end if;
      orden := orden || (r->>'texto') || ',';
      if i = 1 then primeros := primeros || (r->>'texto'); end if;
    end loop;
    begin perform public.ruleta_girar(pg_temp.id_de('sesion'), pg_temp.id_de('h4')); exception when others then ok := true; end;
    if not ok then raise exception 'FALLO: siguió girando cuando ya habían salido todos'; end if;
    ok := false;
    ordenes := ordenes || orden;
    perform public.ruleta_reiniciar(pg_temp.id_de('sesion'), pg_temp.id_de('h4'));
  end loop;
  if (select count(distinct x) from unnest(ordenes) x) < 3 then raise exception 'FALLO: los órdenes casi no cambian entre reinicios: %', ordenes; end if;
  if (select count(distinct x) from unnest(primeros) x) < 2 then raise exception 'FALLO: siempre sale primero el mismo: %', primeros; end if;
  if ordenes[1] = 'Ana,Bruno,Carla,Diego,Elena,Felipe,' and ordenes[2] = ordenes[1] then raise exception 'FALLO: sale en el orden de la lista'; end if;
  raise notice 'Órdenes después de cada reinicio: %', ordenes;
end $$;

-- ---------- 3. Ruleta de participantes: los de su hoja Unirse y los que llegan tarde ----------
reset role;
do $$
declare c jsonb; h public.proyecto_hojas;
begin
  insert into public.sesion_participantes (sesion_id, nombre, hoja_registro, expulsado) values
    (pg_temp.id_de('sesion'), 'Uno', pg_temp.id_de('h1'), false), (pg_temp.id_de('sesion'), 'Dos', pg_temp.id_de('h1'), false),
    (pg_temp.id_de('sesion'), 'Expulsado', pg_temp.id_de('h1'), true),
    (pg_temp.id_de('sesion'), 'Otra hoja', pg_temp.id_de('h2'), false),
    (pg_temp.id_de('sesion'), 'Tarde', pg_temp.id_de('h5'), false);
  -- sin elegir: la hoja Unirse más cercana (la 2) y los que llegaron tarde
  select * into h from public.proyecto_hojas where id = pg_temp.id_de('h5');
  c := public._ruleta_candidatos(pg_temp.id_de('sesion'), h);
  if (select array_agg(x->>'texto' order by x->>'texto') from jsonb_array_elements(c) x) <> array['Otra hoja', 'Tarde'] then
    raise exception 'FALLO: la ruleta no tomó la hoja Unirse más cercana: %', c;
  end if;
  -- eligiendo la hoja 1: sus participantes (sin el expulsado) y el que llegó tarde
  update public.proyecto_hojas set config = config || jsonb_build_object('hoja_registro', pg_temp.id_de('h1')) where id = pg_temp.id_de('h5') returning * into h;
  c := public._ruleta_candidatos(pg_temp.id_de('sesion'), h);
  if (select array_agg(x->>'texto' order by x->>'texto') from jsonb_array_elements(c) x) <> array['Dos', 'Tarde', 'Uno'] then
    raise exception 'FALLO: la ruleta no tomó a los de la hoja elegida: %', c;
  end if;
end $$;

-- ---------- 4. Sesión inactiva 12 horas: se finaliza sola y los celulares dejan de consultar ----------
do $$
declare r jsonb; v_token uuid;
begin
  select token into v_token from public.sesion_participantes where sesion_id = pg_temp.id_de('sesion') and nombre = 'Uno';
  insert into t_ids values ('token', v_token);
  update public.proyecto_sesiones set created_at = now() - interval '13 hours', updated_at = now() - interval '13 hours', hoja_inicio = now() - interval '13 hours'
  where id = pg_temp.id_de('sesion');
  update public.sesion_participantes set created_at = now() - interval '13 hours' where sesion_id = pg_temp.id_de('sesion');
  delete from public.ruleta_sorteos where sesion_id = pg_temp.id_de('sesion');
end $$;
set local role authenticated;
do $$
declare r jsonb;
begin
  -- el celular ya no recibe la hoja: "finalizada"
  r := public.proyecto_estado('987123', pg_temp.id_de('token'));
  if r->>'estado' <> 'finalizada' or (r->>'inactiva')::boolean is not true then raise exception 'FALLO: el celular sigue en una sesión inactiva: %', r; end if;
  perform pg_temp.como('prof');
  if (public.proyecto_estado_profe(pg_temp.id_de('sesion'))->>'inactiva')::boolean is not true then raise exception 'FALLO: la pantalla del profesor no sabe que está inactiva'; end if;
  r := public.proyectos_cerrar_inactivas();
  if (r->>'cerradas')::int < 1 then raise exception 'FALLO: no se cerró la sesión inactiva: %', r; end if;
  if public.proyecto_sesion_activa(pg_temp.id_de('proyecto')) is not null then raise exception 'FALLO: la sesión sigue abierta'; end if;
  -- una sesión con actividad reciente no se cierra
  r := public.proyecto_iniciar_sesion(pg_temp.id_de('proyecto'));
  if r->>'estado' = 'finalizada' then raise exception 'FALLO: no abrió una sesión nueva'; end if;
  if (public.proyectos_cerrar_inactivas()->>'cerradas')::int <> 0 then raise exception 'FALLO: cerró una sesión con actividad reciente'; end if;
  raise notice 'TODAS LAS PRUEBAS DE RULETA PASARON';
end $$;

select 'TODAS LAS PRUEBAS DE RULETA PASARON' as resultado;
rollback;
