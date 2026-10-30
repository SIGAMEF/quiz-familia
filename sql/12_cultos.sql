-- =====================================================================
-- PASO 12 — CULTOS (Fase 1: biblioteca de canciones · Fase 2: cultos)
-- Canciones con su letra dividida en bloques (estrofas, coro, puente…), orden de canto
-- y opciones de división en pantallas. Cada profesor ve las suyas y las que otros
-- profesores de su misma institución marcaron "Compartir con mi iglesia".
-- Se puede ejecutar varias veces. Después ejecuta otra vez 06_permisos.sql.
-- =====================================================================

create table if not exists public.canciones (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  titulo      text not null,
  autor       text not null default '',
  tono        text not null default '',
  etiquetas   text[] not null default '{}',
  bloques     jsonb not null default '[]'::jsonb,   -- [{tipo:'estrofa'|'coro'|'precoro'|'puente'|'intro'|'final', texto}]
  orden_canto jsonb,                                -- ['E1','C','E2','C'] o null = el orden de la letra
  opciones    jsonb not null default '{}'::jsonb,   -- {lineas: 2|4|6, repeticiones: 'expandir'|'marcar'}
  compartida  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists canciones_profesor_idx on public.canciones (profesor_id);

-- Reglas (se vuelven a crear para que una versión nueva del script las actualice)
alter table public.canciones drop constraint if exists canciones_titulo_check;
alter table public.canciones add constraint canciones_titulo_check check (length(trim(titulo)) between 1 and 150);
alter table public.canciones drop constraint if exists canciones_textos_check;
alter table public.canciones add constraint canciones_textos_check check (length(autor) <= 150 and length(tono) <= 20);
alter table public.canciones drop constraint if exists canciones_etiquetas_check;
alter table public.canciones add constraint canciones_etiquetas_check check (cardinality(etiquetas) <= 15);
alter table public.canciones drop constraint if exists canciones_bloques_check;
alter table public.canciones add constraint canciones_bloques_check
  check (jsonb_typeof(bloques) = 'array' and jsonb_array_length(bloques) <= 60 and pg_column_size(bloques) < 100000);
alter table public.canciones drop constraint if exists canciones_orden_check;
alter table public.canciones add constraint canciones_orden_check
  check (orden_canto is null or (jsonb_typeof(orden_canto) = 'array' and jsonb_array_length(orden_canto) <= 80));
alter table public.canciones drop constraint if exists canciones_opciones_check;
alter table public.canciones add constraint canciones_opciones_check check (jsonb_typeof(opciones) = 'object' and pg_column_size(opciones) < 2000);
-- Palabras resaltadas (ancladas al texto: estrofa, línea y palabra) y detalles de cada pantalla
-- (objetos, emojis, imágenes o textos extra de una pantalla concreta: { "C1-2-1": { el: [...], fondo } })
alter table public.canciones add column if not exists resaltados jsonb not null default '[]'::jsonb;
alter table public.canciones add column if not exists detalles jsonb not null default '{}'::jsonb;
alter table public.canciones drop constraint if exists canciones_resaltados_check;
alter table public.canciones add constraint canciones_resaltados_check
  check (jsonb_typeof(resaltados) = 'array' and jsonb_array_length(resaltados) <= 300 and pg_column_size(resaltados) < 100000);
alter table public.canciones drop constraint if exists canciones_detalles_check;
alter table public.canciones add constraint canciones_detalles_check check (jsonb_typeof(detalles) = 'object' and pg_column_size(detalles) < 400000);

-- Al guardar: fecha de cambio, el dueño no se cambia y las etiquetas quedan limpias (minúsculas, sin repetir)
create or replace function public.canciones_al_guardar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.titulo := trim(new.titulo);
  new.autor := trim(coalesce(new.autor, ''));
  new.tono := trim(coalesce(new.tono, ''));
  new.etiquetas := coalesce((select array_agg(e order by e) from (
    select distinct left(lower(trim(x)), 30) as e from unnest(coalesce(new.etiquetas, '{}')) x where trim(x) <> '') t), '{}');
  if tg_op = 'UPDATE' then
    new.profesor_id := old.profesor_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists canciones_al_guardar on public.canciones;
create trigger canciones_al_guardar before insert or update on public.canciones
  for each row execute function public.canciones_al_guardar();

-- ¿Ese profesor es de mi misma institución? (la institución la escribe cada profesor; se compara sin tildes ni mayúsculas)
create or replace function public.misma_institucion(p_profesor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from profesores yo join profesores otro on otro.perfil_id = p_profesor
    where yo.perfil_id = auth.uid() and coalesce(trim(yo.institucion), '') <> ''
      and _normalizar(yo.institucion) = _normalizar(otro.institucion));
$$;

-- Permisos fila por fila: cada profesor lo suyo (el admin todo) y, para leer, las compartidas de su institución
alter table public.canciones enable row level security;
drop policy if exists canciones_ver on public.canciones;
create policy canciones_ver on public.canciones for select
  using (profesor_id = auth.uid() or es_admin() or (compartida and misma_institucion(profesor_id)));
drop policy if exists canciones_crear on public.canciones;
create policy canciones_crear on public.canciones for insert with check (profesor_id = auth.uid() and puede_crear());
drop policy if exists canciones_editar on public.canciones;
create policy canciones_editar on public.canciones for update
  using ((profesor_id = auth.uid() and esta_activo()) or es_admin())
  with check ((profesor_id = auth.uid() and esta_activo()) or es_admin());
drop policy if exists canciones_borrar on public.canciones;
create policy canciones_borrar on public.canciones for delete using ((profesor_id = auth.uid() and esta_activo()) or es_admin());

-- Biblioteca: mis canciones + las compartidas de mi institución (con el nombre de quien la compartió)
create or replace function public.mis_canciones() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'autor', c.autor, 'tono', c.tono, 'etiquetas', to_jsonb(c.etiquetas),
      'bloques', c.bloques, 'orden_canto', c.orden_canto, 'opciones', c.opciones, 'compartida', c.compartida,
      'resaltados', c.resaltados, 'detalles', c.detalles,
      'created_at', c.created_at, 'updated_at', c.updated_at,
      'mia', c.profesor_id = auth.uid(),
      'profesor', case when c.profesor_id = auth.uid() then null else coalesce(nullif(trim(pf.nombre), ''), pf.usuario) end)
    order by lower(c.titulo), c.created_at), '[]'::jsonb)
  from canciones c join perfiles pf on pf.id = c.profesor_id
  where auth.uid() is not null
    and (c.profesor_id = auth.uid() or (c.compartida and misma_institucion(c.profesor_id)));
$$;

-- ---------- Plantillas propias ----------
-- Las 18 plantillas prediseñadas, los fondos animados y los objetos están en el código (js/cultos/).
-- Aquí solo se guardan las que crea o personaliza cada profesor: una hoja del lienzo de Proyectos
-- (fondo + elementos). Sus imágenes van por "Mis archivos" (08_archivos.sql revisa dónde se usan).
create table if not exists public.plantillas_culto (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre      text not null,
  categoria   text not null default 'Mis plantillas',
  base        text,                                 -- plantilla prediseñada de la que salió (o null)
  diseno      jsonb not null default '{}'::jsonb,   -- { fondo, elementos }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plantillas_culto_profesor_idx on public.plantillas_culto (profesor_id);
alter table public.plantillas_culto drop constraint if exists plantillas_culto_nombre_check;
alter table public.plantillas_culto add constraint plantillas_culto_nombre_check check (length(trim(nombre)) between 1 and 80 and length(categoria) <= 40 and length(coalesce(base, '')) <= 40);
alter table public.plantillas_culto drop constraint if exists plantillas_culto_diseno_check;
alter table public.plantillas_culto add constraint plantillas_culto_diseno_check
  check (jsonb_typeof(diseno) = 'object' and jsonb_typeof(coalesce(diseno->'elementos', '[]')) = 'array'
         and jsonb_array_length(coalesce(diseno->'elementos', '[]')) <= 80 and pg_column_size(diseno) < 300000);

create or replace function public.plantillas_culto_al_guardar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nombre := trim(new.nombre);
  new.categoria := coalesce(nullif(trim(new.categoria), ''), 'Mis plantillas');
  if tg_op = 'UPDATE' then
    new.profesor_id := old.profesor_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists plantillas_culto_al_guardar on public.plantillas_culto;
create trigger plantillas_culto_al_guardar before insert or update on public.plantillas_culto
  for each row execute function public.plantillas_culto_al_guardar();

alter table public.plantillas_culto enable row level security;
drop policy if exists plantillas_culto_ver on public.plantillas_culto;
create policy plantillas_culto_ver on public.plantillas_culto for select using (profesor_id = auth.uid() or es_admin());
drop policy if exists plantillas_culto_crear on public.plantillas_culto;
create policy plantillas_culto_crear on public.plantillas_culto for insert with check (profesor_id = auth.uid() and puede_crear());
drop policy if exists plantillas_culto_editar on public.plantillas_culto;
create policy plantillas_culto_editar on public.plantillas_culto for update
  using ((profesor_id = auth.uid() and esta_activo()) or es_admin())
  with check ((profesor_id = auth.uid() and esta_activo()) or es_admin());
drop policy if exists plantillas_culto_borrar on public.plantillas_culto;
create policy plantillas_culto_borrar on public.plantillas_culto for delete using ((profesor_id = auth.uid() and esta_activo()) or es_admin());

-- ---------- Cultos (Fase 2) ----------
-- Un culto es una lista ordenada de elementos (items): canciones, versículos, textos, anuncios, videos y
-- cuentas regresivas. Cada elemento puede tener su plantilla; si no, usa la plantilla base del culto.
-- Las columnas de "publicar" y los códigos de acceso remoto se usan en la Fase 3.
create table if not exists public.cultos (
  id               uuid primary key default gen_random_uuid(),
  profesor_id      uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre           text not null,
  fecha            date,
  plantilla_base   text not null default 'adoracion',
  items            jsonb not null default '[]'::jsonb,   -- [{ id, tipo: 'cancion'|'versiculo'|'texto'|'anuncio'|'video'|'regresiva', plantilla?, ... }]
  publicado        jsonb,                                -- copia fija para los coristas (Fase 3)
  publicado_en     timestamptz,
  codigo_coristas  text,
  codigo_control   text,
  codigo_pantalla  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cultos_profesor_idx on public.cultos (profesor_id, fecha desc);
alter table public.cultos drop constraint if exists cultos_nombre_check;
alter table public.cultos add constraint cultos_nombre_check check (length(trim(nombre)) between 1 and 120 and length(plantilla_base) <= 60);
alter table public.cultos drop constraint if exists cultos_items_check;
alter table public.cultos add constraint cultos_items_check
  check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 120 and pg_column_size(items) < 200000);
alter table public.cultos drop constraint if exists cultos_publicado_check;
alter table public.cultos add constraint cultos_publicado_check check (publicado is null or pg_column_size(publicado) < 600000);

create or replace function public.cultos_al_guardar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nombre := trim(new.nombre);
  new.plantilla_base := coalesce(nullif(trim(new.plantilla_base), ''), 'adoracion');
  if tg_op = 'UPDATE' then
    new.profesor_id := old.profesor_id;
    new.created_at := old.created_at;
    -- lo que está en pantalla (vivo) no es un cambio del culto
    if current_setting('cultos.vivo', true) = 'si' then return new; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists cultos_al_guardar on public.cultos;
create trigger cultos_al_guardar before insert or update on public.cultos
  for each row execute function public.cultos_al_guardar();

alter table public.cultos enable row level security;
drop policy if exists cultos_ver on public.cultos;
create policy cultos_ver on public.cultos for select using (profesor_id = auth.uid() or es_admin());
drop policy if exists cultos_crear on public.cultos;
create policy cultos_crear on public.cultos for insert with check (profesor_id = auth.uid() and puede_crear());
drop policy if exists cultos_editar on public.cultos;
create policy cultos_editar on public.cultos for update
  using ((profesor_id = auth.uid() and esta_activo()) or es_admin())
  with check ((profesor_id = auth.uid() and esta_activo()) or es_admin());
drop policy if exists cultos_borrar on public.cultos;
create policy cultos_borrar on public.cultos for delete using ((profesor_id = auth.uid() and esta_activo()) or es_admin());

-- ---------- Cultos (Fase 3): publicar para coristas y accesos remotos ----------
-- Códigos largos y secretos (32 caracteres, ~128 bits): quien tiene el enlace entra; no son PIN.
-- El control remoto y la pantalla en otro equipo usan canales de Realtime (broadcast) cuyo nombre sale del código.
create or replace function public._codigo_secreto() returns text
language sql volatile set search_path = public as $$
  select left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 32);
$$;

create or replace function public._culto_mio(p_culto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cultos where id = p_culto and ((profesor_id = auth.uid() and esta_activo()) or es_admin()));
$$;

-- "📤 Publicar" / "Publicar cambios": guarda la copia fija para los coristas. El enlace no cambia.
create or replace function public.culto_publicar(p_culto uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k cultos;
begin
  if not _culto_mio(p_culto) then raise exception 'No puedes publicar este culto.'; end if;
  if jsonb_typeof(p_datos) <> 'array' or jsonb_array_length(p_datos) > 120 then raise exception 'Los datos publicados no son válidos.'; end if;
  perform set_config('cultos.funcion', 'si', true);
  update cultos set publicado = p_datos, publicado_en = now(), codigo_coristas = coalesce(codigo_coristas, _codigo_secreto())
  where id = p_culto returning * into k;
  perform set_config('cultos.funcion', '', true);
  return jsonb_build_object('codigo', k.codigo_coristas, 'publicado_en', k.publicado_en);
end $$;

-- "Despublicar": el enlace deja de funcionar (si se vuelve a publicar, el enlace es otro)
create or replace function public.culto_despublicar(p_culto uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _culto_mio(p_culto) then raise exception 'No puedes cambiar este culto.'; end if;
  perform set_config('cultos.funcion', 'si', true);
  update cultos set publicado = null, publicado_en = null, codigo_coristas = null where id = p_culto;
  perform set_config('cultos.funcion', '', true);
end $$;

-- Lo que ve el corista (sin sesión): solo lo publicado, con el código correcto
create or replace function public.culto_letras(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nombre', nombre, 'fecha', fecha, 'publicado_en', publicado_en, 'items', publicado)
  from cultos where length(coalesce(p_codigo, '')) >= 24 and codigo_coristas = p_codigo and publicado is not null;
$$;

-- Accesos remotos: 'ver' (los crea si faltan), 'regenerar' (los anteriores dejan de servir) o 'cerrar' (sin acceso remoto)
create or replace function public.culto_accesos(p_culto uuid, p_accion text default 'ver') returns jsonb
language plpgsql security definer set search_path = public as $$
declare k cultos;
begin
  if not _culto_mio(p_culto) then raise exception 'No puedes cambiar este culto.'; end if;
  perform set_config('cultos.funcion', 'si', true);
  if p_accion = 'cerrar' then
    update cultos set codigo_control = null, codigo_pantalla = null where id = p_culto returning * into k;
  elsif p_accion = 'regenerar' then
    update cultos set codigo_control = _codigo_secreto(), codigo_pantalla = _codigo_secreto() where id = p_culto returning * into k;
  else
    update cultos set codigo_control = coalesce(codigo_control, _codigo_secreto()), codigo_pantalla = coalesce(codigo_pantalla, _codigo_secreto())
    where id = p_culto returning * into k;
  end if;
  perform set_config('cultos.funcion', '', true);
  return jsonb_build_object('control', k.codigo_control, 'pantalla', k.codigo_pantalla);
end $$;

-- Los códigos no se escriben a mano: solo con las funciones de arriba
create or replace function public.cultos_codigos_fijos() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('cultos.funcion', true) is distinct from 'si' then
    if tg_op = 'INSERT' then
      new.codigo_coristas := null; new.codigo_control := null; new.codigo_pantalla := null; new.publicado := null; new.publicado_en := null;
    else
      new.codigo_coristas := old.codigo_coristas; new.codigo_control := old.codigo_control; new.codigo_pantalla := old.codigo_pantalla;
      new.publicado := old.publicado; new.publicado_en := old.publicado_en;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cultos_codigos_fijos on public.cultos;
create trigger cultos_codigos_fijos before insert or update on public.cultos
  for each row execute function public.cultos_codigos_fijos();

revoke execute on function public._codigo_secreto() from public, anon, authenticated;
revoke execute on function public._culto_mio(uuid) from public, anon, authenticated;
revoke execute on function public.culto_publicar(uuid, jsonb) from public, anon;
revoke execute on function public.culto_despublicar(uuid) from public, anon;
revoke execute on function public.culto_accesos(uuid, text) from public, anon;
grant execute on function public.culto_publicar(uuid, jsonb), public.culto_despublicar(uuid), public.culto_accesos(uuid, text) to authenticated;
grant execute on function public.culto_letras(text) to anon, authenticated;

-- ---------- Respaldo si Realtime falla: sondeo con versión ----------
-- La consola guarda lo que está en pantalla (vivo) solo si el culto tiene pantalla remota o está publicado.
-- La pantalla remota y los coristas preguntan cada pocos segundos SOLO si Realtime no conecta; si nada cambió,
-- la respuesta es mínima ("sin cambios").
alter table public.cultos add column if not exists vivo jsonb;
alter table public.cultos add column if not exists vivo_version bigint not null default 0;
alter table public.cultos drop constraint if exists cultos_vivo_check;
alter table public.cultos add constraint cultos_vivo_check check (vivo is null or pg_column_size(vivo) < 300000);

create or replace function public.culto_vivo_poner(p_culto uuid, p_estado jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if not _culto_mio(p_culto) then raise exception 'No puedes cambiar este culto.'; end if;
  perform set_config('cultos.vivo', 'si', true);
  update cultos set vivo = p_estado, vivo_version = vivo_version + 1 where id = p_culto returning vivo_version into v;
  perform set_config('cultos.vivo', '', true);
  return v;
end $$;

-- p_codigo: el de la pantalla (devuelve la hoja) o el de coristas (solo el elemento en pantalla)
create or replace function public.culto_vivo(p_codigo text, p_version bigint default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when k.vivo_version = coalesce(p_version, -1) then jsonb_build_object('version', k.vivo_version, 'sin_cambios', true)
    when k.codigo_pantalla = p_codigo then jsonb_build_object('version', k.vivo_version, 'estado', k.vivo - 'id')
    else jsonb_build_object('version', k.vivo_version, 'estado', jsonb_build_object('id', k.vivo->'id')) end
  from cultos k
  where length(coalesce(p_codigo, '')) >= 24
    and (k.codigo_pantalla = p_codigo or (k.codigo_coristas = p_codigo and k.publicado is not null));
$$;
grant execute on function public.culto_vivo(text, bigint) to anon, authenticated;

-- Verificación
select 'canciones' as tabla, count(*) as filas from public.canciones
union all select 'plantillas_culto', count(*) from public.plantillas_culto
union all select 'cultos', count(*) from public.cultos;
