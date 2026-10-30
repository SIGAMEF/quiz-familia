-- =====================================================================
-- PRUEBAS — Cultos, fases 1 a 3 (canciones, plantillas, cultos, publicar para coristas y accesos remotos)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 12 y 06.
-- Todo ocurre dentro de una transacción que se deshace al final (rollback): no deja datos.
-- Necesita un profesor activo; con un segundo profesor activo también prueba "Compartir con mi iglesia"
-- (si no hay, esa parte se salta con un aviso). Si algo falla verás "FALLO: ..."; si todo va bien,
-- "TODAS LAS PRUEBAS DE CULTOS PASARON".
-- =====================================================================
begin;

create temp table t_ids (k text primary key, v uuid);
insert into t_ids select 'prof1', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at limit 1;
insert into t_ids select 'prof2', id from public.perfiles where rol = 'profesor' and estado = 'activo' order by created_at offset 1 limit 1;
-- "otro": el segundo profesor o, si no hay, un usuario cualquiera que no es dueño ni admin
insert into t_ids select 'otro', coalesce((select v from t_ids where k = 'prof2'), gen_random_uuid());
grant all on t_ids to authenticated, anon;

create or replace function pg_temp.id_de(p text) returns uuid language sql as $$ select v from t_ids where k = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p), 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', coalesce((select v from t_ids where k = p)::text, ''), true);
$$;
grant execute on function pg_temp.id_de(text), pg_temp.como(text) to authenticated, anon;

do $$ begin
  if pg_temp.id_de('prof1') is null then raise exception 'FALLO: no hay ningún profesor activo para probar'; end if;
  if pg_temp.id_de('prof2') is null then raise notice 'Solo hay un profesor activo: se salta la prueba de "Compartir con mi iglesia"'; end if;
  -- instituciones distintas al empezar (se deshace al final)
  update public.profesores set institucion = 'Iglesia Prueba Uno' where perfil_id = pg_temp.id_de('prof1');
  update public.profesores set institucion = 'Iglesia Prueba Dos' where perfil_id = pg_temp.id_de('prof2');
end $$;

-- ---------- 1. Crear, limpiar al guardar y listar ----------
set local role authenticated;
do $$
declare v jsonb; c record; ok boolean := false;
begin
  perform pg_temp.como('prof1');
  insert into public.canciones (profesor_id, titulo, autor, etiquetas, bloques, orden_canto, opciones)
  values (pg_temp.id_de('prof1'), '  Santo, santo, santo  ', ' Reginald Heber ', array['Adoración', 'adoración ', '', 'Himno'],
          '[{"tipo":"estrofa","texto":"Santo, santo, santo\nSeñor omnipotente"},{"tipo":"coro","texto":"//Santo//"}]',
          '["E1","C","C"]', '{"lineas":4,"repeticiones":"expandir"}')
  returning * into c;
  insert into t_ids values ('c1', c.id);
  if c.titulo <> 'Santo, santo, santo' or c.autor <> 'Reginald Heber' then raise exception 'FALLO: no recortó título/autor: % / %', c.titulo, c.autor; end if;
  if c.etiquetas <> array['adoración', 'himno'] then raise exception 'FALLO: etiquetas: %', c.etiquetas; end if;
  v := public.mis_canciones();
  if jsonb_array_length(v) < 1 or not exists (select 1 from jsonb_array_elements(v) e where e->>'id' = c.id::text and (e->>'mia')::boolean) then
    raise exception 'FALLO: mis_canciones no trae la canción: %', v;
  end if;
  -- no se puede crear a nombre de otro
  begin
    insert into public.canciones (profesor_id, titulo) values (pg_temp.id_de('otro'), 'Ajena');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: creó una canción a nombre de otro profesor'; end if;
  -- reglas
  ok := false;
  begin insert into public.canciones (profesor_id, titulo) values (pg_temp.id_de('prof1'), '   '); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó un título vacío'; end if;
  ok := false;
  begin insert into public.canciones (profesor_id, titulo, bloques) values (pg_temp.id_de('prof1'), 'X', '{"no":"lista"}'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó bloques que no son una lista'; end if;
  ok := false;
  begin insert into public.canciones (profesor_id, titulo, resaltados) values (pg_temp.id_de('prof1'), 'X', '{"no":"lista"}'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó resaltados que no son una lista'; end if;
  ok := false;
  begin insert into public.canciones (profesor_id, titulo, detalles) values (pg_temp.id_de('prof1'), 'X', '[1]'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó detalles que no son un objeto'; end if;
  -- resaltados y detalles se guardan y vuelven en mis_canciones
  update public.canciones set resaltados = '[{"id":"r1","b":1,"l":0,"p":0,"n":1,"texto":"Santo","estilo":{"efecto":"latido"}}]',
    detalles = '{"C1-1-1":{"el":[{"id":"e1","tipo":"emoji","emoji":"🔥"}]}}' where id = c.id;
  if not exists (select 1 from jsonb_array_elements(public.mis_canciones()) e
                 where e->>'id' = c.id::text and jsonb_array_length(e->'resaltados') = 1 and e->'detalles' ? 'C1-1-1') then
    raise exception 'FALLO: mis_canciones no devuelve resaltados y detalles';
  end if;
  -- editar lo propio (el dueño no cambia aunque se intente)
  update public.canciones set tono = 'G', profesor_id = pg_temp.id_de('otro') where id = c.id;
  select * into c from public.canciones where id = c.id;
  if c.tono <> 'G' or c.profesor_id <> pg_temp.id_de('prof1') then raise exception 'FALLO: editar lo propio: % %', c.tono, c.profesor_id; end if;
end $$;

-- ---------- 2. Otro profesor de otra institución no la ve ni la toca ----------
do $$
declare n int;
begin
  perform pg_temp.como('otro');
  if exists (select 1 from public.canciones where id = pg_temp.id_de('c1')) then raise exception 'FALLO: otro profesor ve una canción privada'; end if;
  update public.canciones set titulo = 'Hackeada' where id = pg_temp.id_de('c1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor editó la canción'; end if;
  delete from public.canciones where id = pg_temp.id_de('c1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor borró la canción'; end if;
  perform pg_temp.como('prof1');
  update public.canciones set compartida = true where id = pg_temp.id_de('c1');
  perform pg_temp.como('otro');
  if exists (select 1 from jsonb_array_elements(public.mis_canciones()) e where e->>'id' = pg_temp.id_de('c1')::text) then
    raise exception 'FALLO: ve una canción compartida de otra institución';
  end if;
end $$;

-- ---------- 3. Compartida en la misma institución: se ve, pero no se edita ----------
reset role;
update public.profesores set institucion = '  iglesia prueba UNO ' where perfil_id = pg_temp.id_de('prof2');   -- misma, escrita distinto
set local role authenticated;
do $$
declare v jsonb; e jsonb; n int;
begin
  if pg_temp.id_de('prof2') is null then return; end if;
  perform pg_temp.como('prof2');
  v := public.mis_canciones();
  select x into e from jsonb_array_elements(v) x where x->>'id' = pg_temp.id_de('c1')::text;
  if e is null then raise exception 'FALLO: no ve la canción compartida de su institución: %', v; end if;
  if (e->>'mia')::boolean or coalesce(e->>'profesor', '') = '' then raise exception 'FALLO: datos de la compartida: %', e; end if;
  if not exists (select 1 from public.canciones where id = pg_temp.id_de('c1')) then raise exception 'FALLO: la tabla no deja leer la compartida'; end if;
  update public.canciones set titulo = 'Hackeada' where id = pg_temp.id_de('c1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: editó una canción compartida ajena'; end if;
  -- copiarla a sus canciones
  insert into public.canciones (profesor_id, titulo, bloques)
  select pg_temp.id_de('prof2'), titulo, bloques from public.canciones where id = pg_temp.id_de('c1');
  if (select count(*) from jsonb_array_elements(public.mis_canciones()) x where (x->>'mia')::boolean) < 1 then raise exception 'FALLO: no se copió'; end if;
  -- si deja de compartirla, ya no la ve
  perform pg_temp.como('prof1');
  update public.canciones set compartida = false where id = pg_temp.id_de('c1');
  perform pg_temp.como('prof2');
  if exists (select 1 from public.canciones where id = pg_temp.id_de('c1')) then raise exception 'FALLO: sigue viendo la canción que se dejó de compartir'; end if;
end $$;

-- ---------- 3b. Plantillas propias: solo las ve y cambia su dueño ----------
do $$
declare t record; n int; ok boolean := false;
begin
  perform pg_temp.como('prof1');
  insert into public.plantillas_culto (profesor_id, nombre, categoria, base, diseno)
  values (pg_temp.id_de('prof1'), '  Mi adoración ', '', 'adoracion',
          '{"fondo":{"tipo":"animado","valor":"rayos"},"elementos":[{"id":"z","tipo":"texto","vinculo":"letra","en":"letra"}]}')
  returning * into t;
  insert into t_ids values ('t1', t.id);
  if t.nombre <> 'Mi adoración' or t.categoria <> 'Mis plantillas' then raise exception 'FALLO: plantilla al guardar: % / %', t.nombre, t.categoria; end if;
  begin
    insert into public.plantillas_culto (profesor_id, nombre, diseno) values (pg_temp.id_de('prof1'), 'X', '{"elementos":"no"}');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó una plantilla con elementos que no son una lista'; end if;
  update public.plantillas_culto set nombre = 'Renombrada', profesor_id = pg_temp.id_de('otro') where id = t.id;
  select * into t from public.plantillas_culto where id = t.id;
  if t.nombre <> 'Renombrada' or t.profesor_id <> pg_temp.id_de('prof1') then raise exception 'FALLO: editar la plantilla propia'; end if;
  perform pg_temp.como('otro');
  if exists (select 1 from public.plantillas_culto where id = pg_temp.id_de('t1')) then raise exception 'FALLO: otro profesor ve una plantilla ajena'; end if;
  update public.plantillas_culto set nombre = 'Hackeada' where id = pg_temp.id_de('t1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor editó la plantilla'; end if;
  delete from public.plantillas_culto where id = pg_temp.id_de('t1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor borró la plantilla'; end if;
  perform pg_temp.como('prof1');
  delete from public.plantillas_culto where id = pg_temp.id_de('t1');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: el dueño no pudo borrar su plantilla'; end if;
end $$;

-- ---------- 3b. Cultos: crear, limpiar al guardar, privacidad y límites ----------
do $$
declare k record; n int; ok boolean := false;
begin
  perform pg_temp.como('prof1');
  insert into public.cultos (profesor_id, nombre, fecha, plantilla_base, items)
  values (pg_temp.id_de('prof1'), '  Culto dominical  ', current_date + 3, '  ',
          jsonb_build_array(jsonb_build_object('id', 'a1', 'tipo', 'cancion', 'cancion', pg_temp.id_de('c1')),
                            jsonb_build_object('id', 'a2', 'tipo', 'regresiva', 'minutos', 5, 'texto', 'El culto empieza en')))
  returning * into k;
  insert into t_ids values ('k1', k.id);
  if k.nombre <> 'Culto dominical' then raise exception 'FALLO: el nombre del culto no se limpió (%)', k.nombre; end if;
  if k.plantilla_base <> 'adoracion' then raise exception 'FALLO: la plantilla base vacía no tomó la de defecto (%)', k.plantilla_base; end if;
  if jsonb_array_length(k.items) <> 2 then raise exception 'FALLO: no se guardaron los elementos del culto'; end if;

  -- el dueño no se puede cambiar al editar
  update public.cultos set nombre = 'Culto de jóvenes', profesor_id = pg_temp.id_de('otro') where id = k.id returning * into k;
  if k.profesor_id <> pg_temp.id_de('prof1') then raise exception 'FALLO: se cambió el dueño del culto'; end if;
  if k.nombre <> 'Culto de jóvenes' then raise exception 'FALLO: el dueño no pudo editar su culto'; end if;

  -- items debe ser una lista
  begin
    update public.cultos set items = '{"a":1}'::jsonb where id = k.id;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLO: se aceptó un culto con items que no son una lista'; end if;
  ok := false;
  begin
    insert into public.cultos (profesor_id, nombre) values (pg_temp.id_de('prof1'), '   ');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLO: se aceptó un culto sin nombre'; end if;

  -- otro profesor no lo ve, no lo edita ni lo borra
  perform pg_temp.como('otro');
  if exists (select 1 from public.cultos where id = pg_temp.id_de('k1')) then raise exception 'FALLO: otro profesor ve un culto ajeno'; end if;
  update public.cultos set nombre = 'Hackeado' where id = pg_temp.id_de('k1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor editó el culto'; end if;
  delete from public.cultos where id = pg_temp.id_de('k1');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: otro profesor borró el culto'; end if;
  begin
    insert into public.cultos (profesor_id, nombre) values (pg_temp.id_de('prof1'), 'Culto ajeno');
    raise exception 'FALLO: otro profesor creó un culto a nombre de prof1';
  exception when insufficient_privilege then null;
  end;

  -- sin sesión no se ve
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if exists (select 1 from public.cultos where id = pg_temp.id_de('k1')) then raise exception 'FALLO: sin sesión se ve un culto'; end if;

  perform pg_temp.como('prof1');
  delete from public.cultos where id = pg_temp.id_de('k1');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: el dueño no pudo borrar su culto'; end if;
end $$;

-- ---------- 3c. Publicar para coristas y accesos remotos ----------
do $$
declare k uuid; r jsonb; cod text; acc jsonb; acc2 jsonb; ok boolean := false;
begin
  perform pg_temp.como('prof1');
  insert into public.cultos (profesor_id, nombre, items, codigo_coristas, publicado)
  values (pg_temp.id_de('prof1'), 'Culto para publicar', '[]', 'codigo-que-yo-invento-123456789', '[]') returning id into k;
  if (select codigo_coristas from public.cultos where id = k) is not null then raise exception 'FALLO: se pudo crear un culto con un código escrito a mano'; end if;

  r := public.culto_publicar(k, jsonb_build_array(jsonb_build_object('tipo', 'cancion', 'titulo', 'Santo', 'bloques', '[]'::jsonb)));
  cod := r->>'codigo';
  if length(cod) < 24 then raise exception 'FALLO: el código de coristas es corto (%)', cod; end if;
  -- publicar cambios conserva el enlace
  r := public.culto_publicar(k, '[]'::jsonb);
  if r->>'codigo' <> cod then raise exception 'FALLO: publicar cambios cambió el enlace de coristas'; end if;
  -- el código no se cambia escribiendo en la tabla
  update public.cultos set codigo_coristas = 'abc', publicado = null where id = k;
  if (select codigo_coristas from public.cultos where id = k) <> cod or (select publicado from public.cultos where id = k) is null then
    raise exception 'FALLO: se pudo cambiar el código o lo publicado sin las funciones';
  end if;

  -- el corista sin sesión lo ve con el código; con otro código, no
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if public.culto_letras(cod) is null then raise exception 'FALLO: el corista no ve el culto publicado'; end if;
  if public.culto_letras('x') is not null or public.culto_letras(left(cod, 31) || 'z') is not null then raise exception 'FALLO: se ve un culto con un código equivocado'; end if;
  begin
    perform public.culto_publicar(k, '[]'::jsonb);
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLO: sin sesión se pudo publicar'; end if;

  -- otro profesor no lo publica ni ve sus accesos
  perform pg_temp.como('otro');
  ok := false;
  begin
    perform public.culto_accesos(k, 'ver');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLO: otro profesor vio los accesos remotos'; end if;

  -- accesos: se crean, se mantienen, se regeneran y se cierran
  perform pg_temp.como('prof1');
  acc := public.culto_accesos(k, 'ver');
  if length(acc->>'control') < 24 or length(acc->>'pantalla') < 24 or acc->>'control' = acc->>'pantalla' then raise exception 'FALLO: códigos remotos inválidos %', acc; end if;
  if public.culto_accesos(k, 'ver') <> acc then raise exception 'FALLO: "ver" cambió los códigos remotos'; end if;
  acc2 := public.culto_accesos(k, 'regenerar');
  if acc2->>'control' = acc->>'control' then raise exception 'FALLO: regenerar no cambió el código de control'; end if;
  acc2 := public.culto_accesos(k, 'cerrar');
  if acc2->>'control' is not null or acc2->>'pantalla' is not null then raise exception 'FALLO: cerrar no quitó los accesos remotos'; end if;

  -- respaldo del tiempo real: la pantalla remota lee la hoja; con la misma versión, "sin cambios"
  acc := public.culto_accesos(k, 'ver');
  perform public.culto_vivo_poner(k, '{"t":"mostrar","hoja":{"id":"a1-0"},"id":"a1"}'::jsonb);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  r := public.culto_vivo(acc->>'pantalla', 0);
  if r->'estado'->'hoja'->>'id' <> 'a1-0' then raise exception 'FALLO: la pantalla remota no lee lo que está en vivo (%)', r; end if;
  if (public.culto_vivo(acc->>'pantalla', (r->>'version')::bigint)->>'sin_cambios') is null then raise exception 'FALLO: sin cambios no responde corto'; end if;
  if public.culto_vivo(left(cod, 31) || 'z', 0) is not null then raise exception 'FALLO: culto_vivo respondió a un código equivocado'; end if;
  r := public.culto_vivo(cod, 0);
  if r->'estado'->>'id' <> 'a1' or r->'estado' ? 'hoja' then raise exception 'FALLO: el corista debe ver solo el elemento en pantalla (%)', r; end if;
  if public.culto_vivo('x', 0) is not null then raise exception 'FALLO: culto_vivo con un código corto'; end if;
  perform pg_temp.como('prof1');

  -- despublicar apaga el enlace
  perform public.culto_despublicar(k);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  if public.culto_letras(cod) is not null then raise exception 'FALLO: el enlace sigue funcionando después de despublicar'; end if;
  perform pg_temp.como('prof1');
  delete from public.cultos where id = k;
end $$;

-- ---------- 4. Sin sesión no se ve nada; el dueño la borra ----------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if jsonb_array_length(public.mis_canciones()) <> 0 then raise exception 'FALLO: sin sesión se ven canciones'; end if;
  perform pg_temp.como('prof1');
  delete from public.canciones where id = pg_temp.id_de('c1');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: el dueño no pudo borrar su canción'; end if;
  raise notice 'TODAS LAS PRUEBAS DE CULTOS PASARON';
end $$;

select 'TODAS LAS PRUEBAS DE CULTOS PASARON' as resultado;
rollback;
