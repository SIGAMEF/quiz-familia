-- =====================================================================
-- PASO 7 — PROYECTOS EN GRUPO (Fase 1: proyectos, hojas y editor)
-- Presentaciones hechas de hojas que el profesor diseña en el editor.
-- Se puede ejecutar varias veces. Después ejecuta otra vez 06_permisos.sql.
-- =====================================================================

create table if not exists public.proyectos (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references public.perfiles(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) between 1 and 120),
  tema        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists proyectos_profesor_idx on public.proyectos (profesor_id);

create table if not exists public.proyecto_hojas (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  orden       int not null default 0,
  tipo        text not null default 'contenido'
              check (tipo in ('contenido','pregunta','vf','opcion','completar','lluvia','agrupar','ruleta')),
  diseno      jsonb not null default '{}'::jsonb,   -- fondo + elementos (posiciones en % del lienzo)
  config      jsonb not null default '{}'::jsonb,   -- configuración propia del tipo de hoja
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists proyecto_hojas_proyecto_idx on public.proyecto_hojas (proyecto_id, orden);

-- Permisos fila por fila: se leen y borran con la tabla; se crean y guardan con las funciones de abajo
alter table public.proyectos enable row level security;
alter table public.proyecto_hojas enable row level security;

create or replace function public.es_dueno_proyecto(p_proyecto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from proyectos where id = p_proyecto and profesor_id = auth.uid());
$$;

drop policy if exists proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos for select using (profesor_id = auth.uid() or es_admin());
drop policy if exists proyectos_borrar on public.proyectos;
create policy proyectos_borrar on public.proyectos for delete using ((profesor_id = auth.uid() and esta_activo()) or es_admin());

drop policy if exists proyecto_hojas_ver on public.proyecto_hojas;
create policy proyecto_hojas_ver on public.proyecto_hojas for select using (es_dueno_proyecto(proyecto_id) or es_admin());

-- ¿Puede modificar el proyecto? (dueño activo o admin)
create or replace function public._proyecto_editable(p_proyecto uuid) returns public.proyectos
language plpgsql stable security definer set search_path = public as $$
declare v proyectos%rowtype;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  select * into v from proyectos where id = p_proyecto;
  if not found then raise exception 'Ese proyecto ya no existe.'; end if;
  if not ((v.profesor_id = auth.uid() and esta_activo()) or es_admin()) then raise exception 'Este proyecto pertenece a otro profesor.'; end if;
  return v;
end $$;

-- Hoja nueva de contenido (la primera de cada proyecto)
create or replace function public._proyecto_hoja_inicial(p_nombre text) returns jsonb
language sql volatile set search_path = public as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'contenido', 'config', jsonb_build_object('celular', 'mirar'),
    'diseno', jsonb_build_object(
      'fondo', jsonb_build_object('tipo', 'degradado', 'valor', 'linear-gradient(135deg, #8B7EF7 0%, #6C5CE7 100%)'),
      'elementos', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(), 'tipo', 'texto', 'texto', left(coalesce(p_nombre, ''), 120),
        'x', 10, 'y', 36, 'w', 80, 'h', 22, 'rot', 0,
        'fuente', 'Baloo 2', 'tam', 6, 'color', '#FFFFFF', 'alinear', 'center', 'negrita', true))));
$$;

-- ---------- Lista del profesor (o del admin: sus propios proyectos) ----------
create or replace function public.mis_proyectos() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'nombre', p.nombre, 'created_at', p.created_at, 'updated_at', p.updated_at,
    'n_hojas', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id),
    'portada', (select case when pg_column_size(h.diseno) < 40000 then h.diseno end
                from proyecto_hojas h where h.proyecto_id = p.id order by h.orden, h.created_at limit 1)
  ) order by p.updated_at desc), '[]'::jsonb)
  from proyectos p where p.profesor_id = auth.uid();
$$;

-- ---------- Guardar todo el proyecto (autoguardado del editor) ----------
-- p_hojas: [{id, tipo, diseno, config}, ...] en el orden en que se verán.
-- Las hojas que ya no vienen se borran. p_base es el updated_at que tenía el editor:
-- si el proyecto cambió después (otra pestaña), no se sobrescribe.
create or replace function public.proyecto_guardar(p_proyecto uuid, p_nombre text, p_tema jsonb, p_hojas jsonb,
  p_base timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v proyectos%rowtype; h jsonb; i int; n int; v_id uuid; v_ids uuid[] := '{}';
begin
  perform _proyecto_editable(p_proyecto);
  select * into v from proyectos where id = p_proyecto for update;
  if p_base is not null and v.updated_at is distinct from p_base then
    raise exception 'El proyecto se modificó en otra pestaña o dispositivo. Recarga la página para ver la última versión.';
  end if;
  if jsonb_typeof(p_hojas) is distinct from 'array' then raise exception 'Faltan las hojas del proyecto'; end if;
  n := jsonb_array_length(p_hojas);
  if n < 1 then raise exception 'El proyecto debe tener al menos una hoja'; end if;
  if n > 100 then raise exception 'Máximo 100 hojas por proyecto'; end if;
  if pg_column_size(p_hojas) > 3000000 then raise exception 'El proyecto es demasiado grande'; end if;
  if p_tema is not null and jsonb_typeof(p_tema) <> 'object' then raise exception 'Tema no válido'; end if;

  for h, i in select e, o::int from jsonb_array_elements(p_hojas) with ordinality as x(e, o) loop
    begin v_id := (h->>'id')::uuid;
    exception when others then raise exception 'La hoja % no tiene un id válido', i; end;
    if v_id is null then raise exception 'La hoja % no tiene id', i; end if;
    if v_id = any(v_ids) then raise exception 'La hoja % está repetida', i; end if;
    if coalesce(h->>'tipo', '') not in ('contenido','pregunta','vf','opcion','completar','lluvia','agrupar','ruleta') then
      raise exception 'La hoja % tiene un tipo no válido', i;
    end if;
    if jsonb_typeof(coalesce(h->'diseno', '{}')) <> 'object' or jsonb_typeof(coalesce(h->'config', '{}')) <> 'object' then
      raise exception 'La hoja % no es válida', i;
    end if;
    if pg_column_size(h) > 300000 then raise exception 'La hoja % es demasiado grande', i; end if;
    v_ids := v_ids || v_id;

    insert into proyecto_hojas (id, proyecto_id, orden, tipo, diseno, config)
    values (v_id, p_proyecto, i, h->>'tipo', coalesce(h->'diseno', '{}'), coalesce(h->'config', '{}'))
    on conflict (id) do update
      set orden = excluded.orden, tipo = excluded.tipo, diseno = excluded.diseno, config = excluded.config,
          updated_at = case when proyecto_hojas.diseno is distinct from excluded.diseno
                              or proyecto_hojas.config is distinct from excluded.config
                              or proyecto_hojas.tipo <> excluded.tipo then now() else proyecto_hojas.updated_at end
      where proyecto_hojas.proyecto_id = p_proyecto;
    if not found then raise exception 'La hoja % pertenece a otro proyecto', i; end if;
  end loop;

  delete from proyecto_hojas where proyecto_id = p_proyecto and not (id = any(v_ids));
  update proyectos set nombre = coalesce(left(nullif(trim(p_nombre), ''), 120), nombre),
         tema = coalesce(p_tema, tema), updated_at = clock_timestamp()
  where id = p_proyecto returning * into v;
  return jsonb_build_object('updated_at', v.updated_at, 'nombre', v.nombre);
end $$;

-- ---------- Crear (con su primera hoja) ----------
create or replace function public.proyecto_crear(p_nombre text, p_hojas jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nombre text := left(trim(coalesce(p_nombre, '')), 120);
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  if not (puede_crear() or es_admin()) then raise exception 'Tu cuenta no puede crear proyectos.'; end if;
  if v_nombre = '' then raise exception 'Escribe un nombre para el proyecto'; end if;
  if (select count(*) from proyectos where profesor_id = auth.uid()) >= 300 then raise exception 'Llegaste al máximo de 300 proyectos'; end if;
  insert into proyectos (profesor_id, nombre) values (auth.uid(), v_nombre) returning id into v_id;
  perform proyecto_guardar(v_id, null, null, coalesce(p_hojas, jsonb_build_array(_proyecto_hoja_inicial(v_nombre))), null);
  return v_id;
end $$;

-- ---------- Abrir en el editor o en la presentación ----------
create or replace function public.proyecto_editor(p_proyecto uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v proyectos%rowtype;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  select * into v from proyectos where id = p_proyecto;
  if not found then raise exception 'Ese proyecto ya no existe.'; end if;
  if not (v.profesor_id = auth.uid() or es_admin()) then raise exception 'Este proyecto pertenece a otro profesor.'; end if;
  return jsonb_build_object(
    'proyecto', jsonb_build_object('id', v.id, 'nombre', v.nombre, 'tema', v.tema, 'profesor_id', v.profesor_id,
                                   'created_at', v.created_at, 'updated_at', v.updated_at,
                                   'editable', (v.profesor_id = auth.uid() and esta_activo()) or es_admin()),
    'hojas', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'tipo', h.tipo, 'diseno', h.diseno, 'config', h.config)
                order by h.orden, h.created_at), '[]'::jsonb)
              from proyecto_hojas h where h.proyecto_id = v.id));
end $$;

-- ---------- Duplicar (la copia queda a nombre de quien duplica) ----------
create or replace function public.proyecto_duplicar(p_proyecto uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v proyectos%rowtype; v_id uuid;
begin
  v := _proyecto_editable(p_proyecto);
  if not (puede_crear() or es_admin()) then raise exception 'Tu cuenta no puede crear proyectos.'; end if;
  if (select count(*) from proyectos where profesor_id = auth.uid()) >= 300 then raise exception 'Llegaste al máximo de 300 proyectos'; end if;
  insert into proyectos (profesor_id, nombre, tema)
  values (auth.uid(), left(v.nombre, 111) || ' (copia)', v.tema) returning id into v_id;
  insert into proyecto_hojas (proyecto_id, orden, tipo, diseno, config)
  select v_id, h.orden, h.tipo, h.diseno, h.config from proyecto_hojas h where h.proyecto_id = p_proyecto;
  return v_id;
end $$;

revoke execute on function public._proyecto_editable(uuid) from public, anon, authenticated;
revoke execute on function public._proyecto_hoja_inicial(text) from public, anon, authenticated;

-- ---------- Imágenes y videos del editor: bucket preguntas-imagenes, carpeta proyectos/<profesor_id>/ ----------
-- Se suma a las políticas que ya tiene el bucket (no las cambia). Si tu proyecto no permite crear
-- políticas de Storage desde el SQL Editor, solo verás un aviso y el resto del script sigue igual.
do $$
begin
  execute 'drop policy if exists proyectos_subir on storage.objects';
  execute $p$create policy proyectos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'preguntas-imagenes' and (storage.foldername(name))[1] = 'proyectos'
                and (storage.foldername(name))[2] = auth.uid()::text)$p$;
exception when others then
  raise notice 'No se pudo crear la política de Storage para proyectos: %', sqlerrm;
end $$;
