-- =====================================================================
-- PASO 12 — CULTOS (Fase 1: biblioteca de canciones)
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

-- Verificación
select 'canciones' as tabla, count(*) as filas from public.canciones
union all select 'plantillas_culto', count(*) from public.plantillas_culto;
