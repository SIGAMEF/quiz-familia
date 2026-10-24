-- =====================================================================
-- PRUEBAS — Mis archivos (registro, sin duplicados, usos, no usados, eliminar y límite de espacio)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 07, 08 y 06.
-- Todo ocurre dentro de una transacción que se deshace al final (rollback): no deja datos.
-- (No sube archivos de verdad a Storage: prueba el registro y las reglas.)
-- Si algo falla verás "FALLO: ..."; si todo va bien, "TODAS LAS PRUEBAS DE ARCHIVOS PASARON".
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
create or replace function pg_temp.ruta(p text, n text) returns text language sql as $$ select 'proyectos/' || pg_temp.id_de(p) || '/' || n $$;
grant execute on function pg_temp.id_de(text), pg_temp.como(text), pg_temp.ruta(text, text) to authenticated, anon;

do $$ begin
  if pg_temp.id_de('prof1') is null then raise exception 'FALLO: no hay ningún profesor activo para probar'; end if;
  -- el profesor de prueba empieza sin archivos registrados ni límite propio (se deshace al final)
  delete from public.archivos where profesor_id = pg_temp.id_de('prof1');
  delete from public.archivos_limites where profesor_id = pg_temp.id_de('prof1');
end $$;

-- ---------- 1. Registrar, sin duplicados ----------
set local role authenticated;
do $$
declare v jsonb; a jsonb; ok boolean := false; h1 text := repeat('a', 64); h2 text := repeat('b', 64);
begin
  perform pg_temp.como('prof1');
  v := public.archivos_espacio();
  if (v->>'usado')::bigint <> 0 or (v->>'limite')::bigint <> 200 * 1048576 then raise exception 'FALLO: espacio inicial: %', v; end if;
  if public.archivo_antes_de_subir(h1, 1000)->'existente' <> 'null'::jsonb then raise exception 'FALLO: encontró un archivo que no existe'; end if;
  a := public.archivo_registrar(pg_temp.ruta('prof1', 'uno.webp'), 'imagen', 'gato.png', 1000000, 800, 600, h1, 'image/webp');
  if a->>'nombre' <> 'gato.png' or (a->>'ancho')::int <> 800 or a->>'url' not like '%/preguntas-imagenes/proyectos/%' then raise exception 'FALLO: registro: %', a; end if;
  insert into t_ids values ('a1', (a->>'id')::uuid);
  -- el mismo archivo otra vez: se reutiliza
  v := public.archivo_antes_de_subir(h1, 1000000);
  if v->'existente'->>'id' <> a->>'id' then raise exception 'FALLO: no reutilizó el archivo con el mismo hash: %', v; end if;
  v := public.archivo_registrar(pg_temp.ruta('prof1', 'otra-copia.webp'), 'imagen', 'gato.png', 1000000, null, null, h1);
  if (v->>'duplicado')::boolean is not true or v->>'id' <> a->>'id' then raise exception 'FALLO: registró un duplicado: %', v; end if;
  a := public.archivo_registrar(pg_temp.ruta('prof1', 'dos.mp4'), 'video', 'clase.mp4', 3000000, null, null, h2, 'video/mp4');
  insert into t_ids values ('a2', (a->>'id')::uuid);
  if jsonb_array_length(public.mis_archivos()) <> 2 then raise exception 'FALLO: mis_archivos: %', public.mis_archivos(); end if;
  if (public.archivos_espacio()->>'usado')::bigint <> 4000000 then raise exception 'FALLO: espacio usado: %', public.archivos_espacio(); end if;
  -- rutas no válidas
  begin perform public.archivo_registrar('proyectos/' || gen_random_uuid() || '/x.jpg', 'imagen', 'x', 10); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: registró un archivo en la carpeta de otro'; end if;
  ok := false;
  begin perform public.archivo_registrar('proyectos/sesiones/x/y.jpg', 'imagen', 'x', 10); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: registró una foto de participante'; end if;
  ok := false;
  begin perform public.archivo_registrar(pg_temp.ruta('prof1', '../x.jpg'), 'imagen', 'x', 10); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: aceptó una ruta con ..'; end if;
  -- la tabla no se puede escribir directamente
  ok := false;
  begin insert into public.archivos (profesor_id, ruta, url, tipo) values (auth.uid(), 'proyectos/x', 'x', 'imagen'); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: se pudo insertar en archivos sin pasar por las funciones'; end if;
end $$;

-- ---------- 2. Usos: un proyecto usa la imagen; el video no se usa ----------
do $$
declare v jsonb; id uuid;
begin
  perform pg_temp.como('prof1');
  id := public.proyecto_crear('Proyecto con imagen', jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'contenido', 'diseno', '{"elementos":[]}'::jsonb, 'config', '{}'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'contenido', 'config', '{}'::jsonb, 'diseno', jsonb_build_object('elementos', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'tipo', 'imagen',
        'url', (select a->>'url' from jsonb_array_elements(public.mis_archivos()) a where a->>'id' = pg_temp.id_de('a1')::text)))))));
  insert into t_ids values ('proy', id);
  v := public.archivo_usos(pg_temp.id_de('a1'));
  if jsonb_array_length(v) <> 1 or v->0->>'nombre' <> 'Proyecto con imagen' or (v->0->>'hoja')::int <> 2 then raise exception 'FALLO: usos de la imagen: %', v; end if;
  if jsonb_array_length(public.archivo_usos(pg_temp.id_de('a2'))) <> 0 then raise exception 'FALLO: el video aparece usado'; end if;
  v := public.archivos_no_usados();
  if jsonb_array_length(v) <> 1 or v->0->>'id' <> pg_temp.id_de('a2')::text then raise exception 'FALLO: no usados: %', v; end if;
  -- duplicar o borrar el proyecto no borra archivos
  perform public.proyecto_duplicar(id);
  perform public.proyecto_eliminar(id);
  if jsonb_array_length(public.mis_archivos()) <> 2 then raise exception 'FALLO: borrar o duplicar un proyecto borró archivos'; end if;
  -- la copia sigue usando la imagen
  if jsonb_array_length(public.archivo_usos(pg_temp.id_de('a1'))) <> 1 then raise exception 'FALLO: la copia del proyecto no cuenta como uso'; end if;
end $$;

-- ---------- 3. Otro profesor no ve ni borra mis archivos ----------
do $$
declare ok boolean := false; v jsonb;
begin
  if pg_temp.id_de('prof2') is null then return; end if;
  perform pg_temp.como('prof2');
  if exists (select 1 from jsonb_array_elements(public.mis_archivos()) a where a->>'id' = pg_temp.id_de('a1')::text) then raise exception 'FALLO: otro profesor ve mis archivos'; end if;
  begin
    if exists (select 1 from public.archivos where profesor_id = pg_temp.id_de('prof1')) then raise exception 'FALLO: otro profesor lee la tabla'; end if;
  exception when insufficient_privilege then null;   -- sin permiso sobre la tabla: mejor aún
  end;
  begin perform public.archivo_usos(pg_temp.id_de('a1')); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: otro profesor vio los usos de mi archivo'; end if;
  v := public.archivos_eliminar(array[pg_temp.id_de('a1')]);
  if jsonb_array_length(v->'rutas') <> 0 then raise exception 'FALLO: otro profesor borró mi archivo'; end if;
  if public.es_carpeta_propia(pg_temp.ruta('prof1', 'uno.webp')) then raise exception 'FALLO: otro profesor puede ver/borrar en mi carpeta de Storage'; end if;
  if public.puede_subir_archivo(pg_temp.ruta('prof1', 'nuevo.jpg')) then raise exception 'FALLO: otro profesor puede subir a mi carpeta'; end if;
end $$;

-- ---------- 4. Límite de espacio (lo cambia el admin) ----------
do $$
declare ok boolean := false; v jsonb;
begin
  perform pg_temp.como('prof1');
  if not public.puede_subir_archivo(pg_temp.ruta('prof1', 'nuevo.jpg')) then raise exception 'FALLO: no puede subir a su carpeta'; end if;
  begin perform public.admin_limite_archivos(pg_temp.id_de('prof1'), 1); exception when others then ok := true; end;
  if not ok then raise exception 'FALLO: un profesor cambió su propio límite'; end if;
  if pg_temp.id_de('admin') is null then return; end if;
  perform pg_temp.como('admin');
  v := public.admin_limite_archivos(pg_temp.id_de('prof1'), 3);   -- 3 MB y ya usa ~3,8 MB
  if (v->>'limite')::bigint <> 3 * 1048576 or (v->>'personalizado')::boolean is not true then raise exception 'FALLO: admin_limite_archivos: %', v; end if;
  perform pg_temp.como('prof1');
  ok := false;
  begin perform public.archivo_antes_de_subir(repeat('c', 64), 1000); exception when others then ok := sqlerrm like '%límite%'; end;
  if not ok then raise exception 'FALLO: dejó subir pasando el límite'; end if;
  if public.puede_subir_archivo(pg_temp.ruta('prof1', 'nuevo.jpg')) then raise exception 'FALLO: Storage deja subir pasando el límite'; end if;
  -- lo que ya tiene sí se reutiliza aunque esté en el límite
  if public.archivo_antes_de_subir(repeat('a', 64), 1000)->'existente' is null then raise exception 'FALLO: no reutiliza en el límite'; end if;
  perform pg_temp.como('admin');
  v := public.admin_limite_archivos(pg_temp.id_de('prof1'), null);
  if (v->>'limite')::bigint <> 200 * 1048576 then raise exception 'FALLO: volver al límite predeterminado: %', v; end if;
end $$;

-- ---------- 5. Eliminar ----------
do $$
declare v jsonb;
begin
  perform pg_temp.como('prof1');
  v := public.archivos_eliminar(array[pg_temp.id_de('a1'), pg_temp.id_de('a2')]);
  if jsonb_array_length(v->'rutas') <> 2 then raise exception 'FALLO: eliminar devolvió %', v; end if;
  if jsonb_array_length(public.mis_archivos()) <> 0 then raise exception 'FALLO: quedaron archivos en el registro'; end if;
  if (public.archivos_espacio()->>'usado')::bigint <> 0 then raise exception 'FALLO: el espacio no se liberó'; end if;
  raise notice 'TODAS LAS PRUEBAS DE ARCHIVOS PASARON';
end $$;

select 'TODAS LAS PRUEBAS DE ARCHIVOS PASARON' as resultado;
rollback;
