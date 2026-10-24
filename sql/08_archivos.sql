-- =====================================================================
-- PASO 8 — MIS ARCHIVOS (imágenes y videos que sube cada profesor en el editor de proyectos)
-- Cada archivo de Storage en proyectos/<profesor_id>/ queda registrado aquí, con su hash
-- para no subir dos veces el mismo. Solo se borran desde "Mis archivos" o "Limpiar no usados".
-- Las fotos de los participantes en vivo (proyectos/sesiones/...) NO van aquí.
-- Ejecutar DESPUÉS de 07_proyectos.sql y ANTES de 06_permisos.sql. Se puede ejecutar varias veces.
-- =====================================================================

create table if not exists public.archivos (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references public.perfiles(id) on delete cascade,
  ruta        text not null unique,              -- dentro del bucket preguntas-imagenes
  url         text not null,
  tipo        text not null check (tipo in ('imagen','video')),
  nombre      text not null default '',
  tamano      bigint not null default 0,         -- bytes
  ancho       int,
  alto        int,
  hash        text,                              -- SHA-256 del archivo original (para no duplicar)
  mime        text,
  created_at  timestamptz not null default now()
);
create index if not exists archivos_profesor_idx on public.archivos (profesor_id, created_at desc);
create unique index if not exists archivos_hash_idx on public.archivos (profesor_id, hash) where hash is not null;

-- Límite de espacio por profesor (MB). Sin fila: 200 MB (el admin, sin límite).
create table if not exists public.archivos_limites (
  profesor_id uuid primary key references public.perfiles(id) on delete cascade,
  limite_mb   int not null check (limite_mb between 0 and 100000),
  updated_at  timestamptz not null default now()
);

alter table public.archivos enable row level security;
alter table public.archivos_limites enable row level security;
drop policy if exists archivos_ver on public.archivos;
create policy archivos_ver on public.archivos for select using (profesor_id = auth.uid() or es_admin());

-- ---------- Ayudantes ----------
create or replace function public._archivos_limite(p_profesor uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select case
    when l.limite_mb is not null then l.limite_mb::bigint * 1024 * 1024
    when (select rol from perfiles where id = p_profesor) = 'admin' then null
    else 200::bigint * 1024 * 1024 end
  from (select 1) x left join archivos_limites l on l.profesor_id = p_profesor;
$$;

create or replace function public._archivos_usado(p_profesor uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(tamano), 0)::bigint from archivos where profesor_id = p_profesor;
$$;

create or replace function public._archivo_url(p_ruta text) returns text
language sql immutable as $$
  select 'https://qiawcxkmszgwvxlbbcdw.supabase.co/storage/v1/object/public/preguntas-imagenes/' || p_ruta;
$$;

create or replace function public._archivo_json(a public.archivos) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', a.id, 'url', a.url, 'ruta', a.ruta, 'tipo', a.tipo, 'nombre', a.nombre, 'tamano', a.tamano,
    'ancho', a.ancho, 'alto', a.alto, 'created_at', a.created_at);
$$;

-- Dónde se usa un archivo: proyectos (con el número de hoja), juegos y preguntas/opciones de quizzes
create or replace function public._archivo_usos(p_ruta text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := '[]'::jsonb; x jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('donde', 'proyecto', 'id', p.id, 'hoja', h.n, 'propio', p.profesor_id = auth.uid(),
           'nombre', case when p.profesor_id = auth.uid() or es_admin() then p.nombre else 'Un proyecto de otro profesor' end)
         order by p.nombre, h.n), '[]'::jsonb) into x
  from (select proyecto_id, diseno, config, row_number() over (partition by proyecto_id order by orden, created_at) as n from proyecto_hojas) h
  join proyectos p on p.id = h.proyecto_id
  where strpos(h.diseno::text, p_ruta) > 0 or strpos(h.config::text, p_ruta) > 0;
  v := v || x;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('donde', 'juego', 'id', j.id, 'propio', j.profesor_id = auth.uid(),
             'nombre', case when j.profesor_id = auth.uid() or es_admin() then j.titulo else 'Un juego de otro profesor' end)), '[]'::jsonb) into x
    from juegos j where strpos(j.datos::text, p_ruta) > 0;
    v := v || x;
  exception when others then null;   -- si la tabla no existe o cambió, no se revisa
  end;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('donde', 'pregunta', 'id', q.id, 'propio', q.profesor_id = auth.uid(),
             'nombre', case when q.profesor_id = auth.uid() or es_admin() then q.titulo else 'Un quiz de otro profesor' end)), '[]'::jsonb) into x
    from quizzes q where exists (select 1 from preguntas pr where pr.quiz_id = q.id
                                   and (strpos(coalesce(pr.imagen_url, ''), p_ruta) > 0
                                        or exists (select 1 from opciones o where o.pregunta_id = pr.id and strpos(coalesce(o.imagen_url, ''), p_ruta) > 0)));
    v := v || x;
  exception when others then null;
  end;
  return v;
end $$;

-- ---------- Profesor ----------
create or replace function public.archivos_espacio() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  return jsonb_build_object('usado', _archivos_usado(auth.uid()), 'limite', _archivos_limite(auth.uid()));
end $$;

-- Registra los archivos que ya están en proyectos/<mi id>/ (los subidos antes de "Mis archivos")
-- y quita del registro los que ya no existen en Storage. Devuelve cuántos agregó.
create or replace function public.archivos_sincronizar() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_pref text;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  v_pref := 'proyectos/' || auth.uid() || '/';
  begin
    insert into archivos (profesor_id, ruta, url, tipo, nombre, tamano, mime, created_at)
    select auth.uid(), o.name, _archivo_url(o.name),
           case when coalesce(o.metadata->>'mimetype', '') like 'video/%' or o.name ~* '\.(mp4|webm)$' then 'video' else 'imagen' end,
           regexp_replace(o.name, '^.*/', ''), coalesce((o.metadata->>'size')::bigint, 0), o.metadata->>'mimetype', coalesce(o.created_at, now())
    from storage.objects o
    where o.bucket_id = 'preguntas-imagenes' and left(o.name, length(v_pref)) = v_pref
      and o.name !~ '/\.emptyFolderPlaceholder$'
    on conflict (ruta) do nothing;
    get diagnostics v_n = row_count;
    delete from archivos a where a.profesor_id = auth.uid()
      and not exists (select 1 from storage.objects o where o.bucket_id = 'preguntas-imagenes' and o.name = a.ruta);
  exception when insufficient_privilege then
    raise notice 'No se pudo leer storage.objects: %', sqlerrm;
  end;
  return v_n;
end $$;

create or replace function public.mis_archivos() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(_archivo_json(a) order by a.created_at desc), '[]'::jsonb) from archivos a where a.profesor_id = auth.uid();
$$;

-- Antes de subir: si ya tengo ese archivo (mismo hash) lo devuelve; si no hay espacio, avisa
create or replace function public.archivo_antes_de_subir(p_hash text, p_tamano bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a archivos%rowtype; v_lim bigint; v_uso bigint;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  if not (esta_activo() or es_admin()) then raise exception 'Tu cuenta no puede subir archivos.'; end if;
  select * into a from archivos where profesor_id = auth.uid() and hash = p_hash;
  if found then return jsonb_build_object('existente', _archivo_json(a)); end if;
  v_lim := _archivos_limite(auth.uid()); v_uso := _archivos_usado(auth.uid());
  if v_lim is not null and v_uso + coalesce(p_tamano, 0) > v_lim then
    raise exception 'Llegaste al límite de espacio (usas % MB de % MB). Borra archivos en “Mis archivos” o usa “Limpiar no usados”.',
      round(v_uso / 1048576.0, 1), round(v_lim / 1048576.0);
  end if;
  return jsonb_build_object('existente', null, 'usado', v_uso, 'limite', v_lim);
end $$;

-- Después de subir: registra el archivo. Si otro igual (mismo hash) se registró antes, devuelve ese
-- con duplicado = true, para que la app borre la copia que acaba de subir.
create or replace function public.archivo_registrar(p_ruta text, p_tipo text, p_nombre text, p_tamano bigint,
  p_ancho int default null, p_alto int default null, p_hash text default null, p_mime text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a archivos%rowtype; v_tam bigint := coalesce(p_tamano, 0); v_real bigint; v_lim bigint;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  if left(coalesce(p_ruta, ''), length('proyectos/' || auth.uid() || '/')) <> 'proyectos/' || auth.uid() || '/' or p_ruta ~ '\.\.' then
    raise exception 'Ruta de archivo no válida.';
  end if;
  if p_tipo not in ('imagen','video') then raise exception 'Tipo de archivo no válido.'; end if;
  if p_hash is not null and p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Hash no válido.'; end if;
  select * into a from archivos where profesor_id = auth.uid() and hash = p_hash;
  if found then return _archivo_json(a) || jsonb_build_object('duplicado', true); end if;
  -- el tamaño real lo dice Storage (si se puede leer)
  begin
    select (metadata->>'size')::bigint into v_real from storage.objects where bucket_id = 'preguntas-imagenes' and name = p_ruta;
    v_tam := coalesce(v_real, v_tam);
  exception when others then null;
  end;
  v_lim := _archivos_limite(auth.uid());
  if v_lim is not null and _archivos_usado(auth.uid()) + v_tam > v_lim then
    raise exception 'Llegaste al límite de espacio. Borra archivos en “Mis archivos” o usa “Limpiar no usados”.';
  end if;
  insert into archivos (profesor_id, ruta, url, tipo, nombre, tamano, ancho, alto, hash, mime)
  values (auth.uid(), p_ruta, _archivo_url(p_ruta), p_tipo, left(coalesce(nullif(trim(p_nombre), ''), regexp_replace(p_ruta, '^.*/', '')), 120),
          v_tam, p_ancho, p_alto, p_hash, left(p_mime, 60))
  on conflict (ruta) do update set hash = coalesce(archivos.hash, excluded.hash), ancho = coalesce(archivos.ancho, excluded.ancho),
         alto = coalesce(archivos.alto, excluded.alto), nombre = excluded.nombre
  returning * into a;
  return _archivo_json(a);
end $$;

-- Ancho y alto de los archivos registrados sin medidas (los que se subieron antes)
create or replace function public.archivo_medidas(p_id uuid, p_ancho int, p_alto int) returns void
language sql security definer set search_path = public as $$
  update archivos set ancho = p_ancho, alto = p_alto where id = p_id and profesor_id = auth.uid() and ancho is null;
$$;

create or replace function public.archivo_usos(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a archivos%rowtype;
begin
  select * into a from archivos where id = p_id and (profesor_id = auth.uid() or es_admin());
  if not found then raise exception 'Ese archivo ya no existe.'; end if;
  return _archivo_usos(a.ruta);
end $$;

-- Archivos que no se usan en ningún proyecto, juego ni pregunta
create or replace function public.archivos_no_usados() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(_archivo_json(a) order by a.created_at desc), '[]'::jsonb)
  from archivos a where a.profesor_id = auth.uid() and jsonb_array_length(_archivo_usos(a.ruta)) = 0;
$$;

-- Elimina del registro y devuelve las rutas para que la app las borre de Storage
create or replace function public.archivos_eliminar(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rutas jsonb;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  with b as (delete from archivos where id = any(p_ids) and profesor_id = auth.uid() returning ruta)
  select coalesce(jsonb_agg(ruta), '[]'::jsonb) into v_rutas from b;
  return jsonb_build_object('rutas', v_rutas);
end $$;

-- ---------- Admin: espacio y límite de cada profesor ----------
create or replace function public.admin_archivos_profesor(p_profesor uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el admin.'; end if;
  return jsonb_build_object('usado', _archivos_usado(p_profesor), 'limite', _archivos_limite(p_profesor),
    'archivos', (select count(*) from archivos where profesor_id = p_profesor),
    'personalizado', exists (select 1 from archivos_limites where profesor_id = p_profesor));
end $$;

-- p_mb null = volver al límite predeterminado (200 MB)
create or replace function public.admin_limite_archivos(p_profesor uuid, p_mb int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el admin.'; end if;
  if p_mb is null then delete from archivos_limites where profesor_id = p_profesor;
  else
    if p_mb < 0 or p_mb > 100000 then raise exception 'El límite debe estar entre 0 y 100000 MB.'; end if;
    insert into archivos_limites (profesor_id, limite_mb) values (p_profesor, p_mb)
    on conflict (profesor_id) do update set limite_mb = excluded.limite_mb, updated_at = now();
  end if;
  return admin_archivos_profesor(p_profesor);
end $$;

revoke execute on function public._archivos_limite(uuid) from public, anon, authenticated;
revoke execute on function public._archivos_usado(uuid) from public, anon, authenticated;
revoke execute on function public._archivo_url(text) from public, anon, authenticated;
revoke execute on function public._archivo_json(public.archivos) from public, anon, authenticated;
revoke execute on function public._archivo_usos(text) from public, anon, authenticated;

-- ---------- Storage: cada profesor sube, ve y borra solo en su carpeta proyectos/<su id>/ ----------
-- Subir: además, mientras no haya llegado a su límite de espacio. (Reemplaza la política del 07.)
create or replace function public.puede_subir_archivo(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (storage.foldername(p_nombre))[1] = 'proyectos' and (storage.foldername(p_nombre))[2] = auth.uid()::text
     and (_archivos_limite(auth.uid()) is null or _archivos_usado(auth.uid()) < _archivos_limite(auth.uid()));
$$;
create or replace function public.es_carpeta_propia(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (storage.foldername(p_nombre))[1] = 'proyectos'
     and ((storage.foldername(p_nombre))[2] = auth.uid()::text or ((storage.foldername(p_nombre))[2] <> 'sesiones' and es_admin()));
$$;

do $$
begin
  execute 'drop policy if exists proyectos_subir on storage.objects';
  execute $p$create policy proyectos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'preguntas-imagenes' and public.puede_subir_archivo(name))$p$;
  execute 'drop policy if exists proyectos_ver_propios on storage.objects';
  execute $p$create policy proyectos_ver_propios on storage.objects for select to authenticated
    using (bucket_id = 'preguntas-imagenes' and public.es_carpeta_propia(name))$p$;
  execute 'drop policy if exists proyectos_borrar_propios on storage.objects';
  execute $p$create policy proyectos_borrar_propios on storage.objects for delete to authenticated
    using (bucket_id = 'preguntas-imagenes' and public.es_carpeta_propia(name))$p$;
exception when others then
  raise notice 'No se pudieron crear las políticas de Storage de Mis archivos: %', sqlerrm;
end $$;

-- ---------- Registrar ya los archivos que estaban subidos (de todos los profesores) ----------
do $$
declare n int;
begin
  insert into public.archivos (profesor_id, ruta, url, tipo, nombre, tamano, mime, created_at)
  select p.id, o.name, public._archivo_url(o.name),
         case when coalesce(o.metadata->>'mimetype', '') like 'video/%' or o.name ~* '\.(mp4|webm)$' then 'video' else 'imagen' end,
         regexp_replace(o.name, '^.*/', ''), coalesce((o.metadata->>'size')::bigint, 0), o.metadata->>'mimetype', coalesce(o.created_at, now())
  from storage.objects o join public.perfiles p on p.id::text = split_part(o.name, '/', 2)
  where o.bucket_id = 'preguntas-imagenes' and split_part(o.name, '/', 1) = 'proyectos' and o.name !~ '/\.emptyFolderPlaceholder$'
  on conflict (ruta) do nothing;
  get diagnostics n = row_count;
  raise notice 'Archivos registrados ahora: %', n;
exception when others then
  raise notice 'No se pudieron registrar los archivos anteriores (se registrarán al abrir “Mis archivos”): %', sqlerrm;
end $$;

-- Revisión: otras políticas del bucket que podrían dejar ver o borrar archivos ajenos.
-- Si alguna dice "delete" o "select" para todo el bucket sin filtrar por carpeta, conviene ajustarla en Storage → Policies.
select policyname as politica, cmd as accion, roles, coalesce(qual, with_check) as condicion
from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
