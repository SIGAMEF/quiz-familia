-- =====================================================================
-- PASO 7 — PROYECTOS EN GRUPO (Fase 1: editor · Fase 2: sesión en vivo y Agrupar · Fase 3: Ruleta)
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
              check (tipo in ('contenido','pregunta','vf','opcion','completar','lluvia','agrupar','ruleta','juego','unirse')),
  diseno      jsonb not null default '{}'::jsonb,   -- fondo + elementos (posiciones en % del lienzo)
  config      jsonb not null default '{}'::jsonb,   -- configuración propia del tipo de hoja
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists proyecto_hojas_proyecto_idx on public.proyecto_hojas (proyecto_id, orden);
-- (si la tabla ya existía, se actualizan los tipos permitidos: "juego" es una hoja con un juego de Mis actividades
--  y "unirse" es el registro de participantes, como en Agrupar pero sin formar grupos)
alter table public.proyecto_hojas drop constraint if exists proyecto_hojas_tipo_check;
alter table public.proyecto_hojas add constraint proyecto_hojas_tipo_check
  check (tipo in ('contenido','pregunta','vf','opcion','completar','lluvia','agrupar','ruleta','juego','unirse'));

-- Permisos fila por fila: se leen y borran con la tabla; se crean y guardan con las funciones de abajo
-- Visibilidad (Mis actividades): público = en la biblioteca de la portada; destacado = en la fila "Creado por nuestros profesores"
alter table public.proyectos add column if not exists publico boolean not null default false;
alter table public.proyectos add column if not exists destacado boolean not null default false;

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
      'fondo', jsonb_build_object('tipo', 'degradado', 'valor', 'violeta'),
      'elementos', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(), 'tipo', 'texto', 'texto', left(coalesce(p_nombre, ''), 120),
        'x', 10, 'y', 36, 'w', 80, 'h', 22, 'rot', 0,
        'fuente', 'Baloo 2', 'tam', 6, 'color', '#FFFFFF', 'alinear', 'center', 'negrita', true))));
$$;

-- (la lista mis_proyectos() está en la Fase 2, más abajo, porque también muestra las sesiones)

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
    if coalesce(h->>'tipo', '') not in ('contenido','pregunta','vf','opcion','completar','lluvia','agrupar','ruleta','juego','unirse') then
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


-- =====================================================================
-- FASE 2 — SESIÓN EN VIVO (PIN/QR), PARTICIPANTES, GRUPOS Y RESPUESTAS
-- Los participantes no tocan las tablas: todo pasa por funciones que validan el PIN y el token.
-- =====================================================================
create table if not exists public.proyecto_sesiones (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyectos(id) on delete cascade,
  profesor_id         uuid not null references public.perfiles(id) on delete cascade,
  pin                 text not null check (pin ~ '^\d{6}$'),
  estado              text not null default 'activa' check (estado in ('activa','pausada','finalizada')),
  hoja_id             uuid,                 -- hoja actual (sin FK: se puede borrar en el editor)
  registro_abierto    boolean not null default true,
  tardios             boolean not null default false,   -- con el registro cerrado, ¿se aceptan tardíos?
  respuestas_abiertas boolean not null default true,
  revelar             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  finalizada_en       timestamptz
);
create unique index if not exists proyecto_sesiones_pin_activo on public.proyecto_sesiones (pin) where estado <> 'finalizada';
-- cuándo empezó la hoja actual (o se volvieron a abrir las respuestas): para el tiempo por pregunta
alter table public.proyecto_sesiones add column if not exists hoja_inicio timestamptz not null default now();
-- hojas de juego: cuándo empieza la partida para todos (null = esperando que el profesor la inicie)
alter table public.proyecto_sesiones add column if not exists juego_inicio timestamptz;
create index if not exists proyecto_sesiones_proyecto_idx on public.proyecto_sesiones (proyecto_id);

create table if not exists public.sesion_grupos (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.proyecto_sesiones(id) on delete cascade,
  hoja_id    uuid not null,
  numero     int not null,
  nombre     text not null check (length(trim(nombre)) between 1 and 40),
  color      text not null check (color ~* '^#[0-9a-f]{6}$'),
  emoji      text,
  confirmado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sesion_grupos_sesion_idx on public.sesion_grupos (sesion_id, hoja_id);

create table if not exists public.sesion_participantes (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.proyecto_sesiones(id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) between 1 and 40),
  alias      text check (alias is null or length(trim(alias)) between 1 and 30),
  avatar     text,
  foto_url   text,
  token      uuid not null default gen_random_uuid(),
  foto_clave uuid not null default gen_random_uuid(),   -- nombre secreto del archivo de su foto
  grupo_id   uuid references public.sesion_grupos(id) on delete set null,
  expulsado  boolean not null default false,
  alumno_id  uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  visto_en   timestamptz not null default now()
);
create unique index if not exists sesion_participantes_alias on public.sesion_participantes (sesion_id, lower(coalesce(alias, nombre)));
-- hoja que se mostraba cuando se unió (la ruleta de participantes toma a los de su hoja Unirse/Agrupar y a los que llegaron después)
alter table public.sesion_participantes add column if not exists hoja_registro uuid;
create index if not exists sesion_participantes_token_idx on public.sesion_participantes (token);

create table if not exists public.sesion_respuestas (
  id              uuid primary key default gen_random_uuid(),
  sesion_id       uuid not null references public.proyecto_sesiones(id) on delete cascade,
  hoja_id         uuid not null,
  participante_id uuid not null references public.sesion_participantes(id) on delete cascade,
  grupo_id        uuid references public.sesion_grupos(id) on delete set null,
  valor           jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sesion_respuestas_hoja_idx on public.sesion_respuestas (sesion_id, hoja_id);

alter table public.proyecto_sesiones enable row level security;
alter table public.sesion_grupos enable row level security;
alter table public.sesion_participantes enable row level security;
alter table public.sesion_respuestas enable row level security;

-- PIN de 6 dígitos que no choque con el modo en vivo, las salas de juego ni otra sesión de proyecto
-- (reemplaza al del 05: si vuelves a ejecutar el 05, ejecuta después este 07)
create or replace function public._nuevo_pin() returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_pin text;
begin
  loop
    v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from sesiones_vivo where codigo = v_pin and estado <> 'finalizado')
          and not exists (select 1 from salas_juego where codigo = v_pin and estado <> 'finalizado')
          and not exists (select 1 from proyecto_sesiones where pin = v_pin and estado <> 'finalizada');
  end loop;
  return v_pin;
end $$;

-- ---------- Ayudantes internos ----------
create or replace function public._sesion_profe(p_sesion uuid) returns public.proyecto_sesiones
language plpgsql stable security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  if auth.uid() is null then raise exception 'Tu sesión expiró. Vuelve a iniciar sesión.'; end if;
  select * into v from proyecto_sesiones where id = p_sesion;
  if not found then raise exception 'Esa sesión ya no existe.'; end if;
  if not (v.profesor_id = auth.uid() or es_admin()) then raise exception 'Esta sesión es de otro profesor.'; end if;
  return v;
end $$;

-- Participante válido (no expulsado) de una sesión que no terminó
create or replace function public._sesion_participante(p_pin text, p_token uuid) returns public.sesion_participantes
language plpgsql stable security definer set search_path = public as $$
declare v sesion_participantes%rowtype;
begin
  select p.* into v from sesion_participantes p join proyecto_sesiones s on s.id = p.sesion_id
  where s.pin = trim(coalesce(p_pin, '')) and s.estado <> 'finalizada'
    and p.token = coalesce(p_token, '00000000-0000-0000-0000-000000000000');
  if not found then raise exception 'Tu lugar en esta sesión ya no es válido. Vuelve a entrar con el PIN.'; end if;
  if v.expulsado then raise exception 'El profesor te retiró de esta sesión.'; end if;
  return v;
end $$;

-- Nombre visible de un participante (alias o nombre)
create or replace function public._visible(p public.sesion_participantes) returns text
language sql immutable set search_path = public as $$ select coalesce(nullif(trim(p.alias), ''), p.nombre) $$;

-- Resumen de una sesión (lista, aviso de "continuar" y barra de control)
create or replace function public._sesion_resumen(s public.proyecto_sesiones) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'pin', s.pin, 'estado', s.estado, 'hoja_id', s.hoja_id,
    'hoja_indice', (select count(*) + 1 from proyecto_hojas h, proyecto_hojas a
                    where h.id = s.hoja_id and a.proyecto_id = h.proyecto_id and (a.orden, a.created_at) < (h.orden, h.created_at)),
    'total_hojas', (select count(*) from proyecto_hojas where proyecto_id = s.proyecto_id),
    'participantes', (select count(*) from sesion_participantes where sesion_id = s.id and not expulsado),
    'registro_abierto', s.registro_abierto, 'tardios', s.tardios,
    'respuestas_abiertas', s.respuestas_abiertas, 'revelar', s.revelar, 'hoja_inicio', s.hoja_inicio, 'juego_inicio', s.juego_inicio,
    'created_at', s.created_at, 'updated_at', s.updated_at, 'finalizada_en', s.finalizada_en);
$$;

-- Ruta dentro del bucket de una URL pública de foto (para borrarla)
create or replace function public._ruta_foto(p_url text) returns text
language sql immutable as $$ select nullif(substring(p_url from '/preguntas-imagenes/(proyectos/sesiones/[^?]+)$'), '') $$;

-- ---------- Sesiones inactivas ----------
-- Una sesión sin actividad durante 12 horas (el profesor no cambió de hoja ni tocó nada, nadie se unió, respondió
-- ni salió en la ruleta) se finaliza sola: al abrir la lista de proyectos o al iniciar otra sesión.
-- Mirar la pantalla (las consultas cada 1,5 s) no cuenta como actividad.
create or replace function public._sesion_inactiva(p_sesion uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_ultima timestamptz;
begin
  select greatest(s.updated_at, s.hoja_inicio, s.created_at,
           (select max(created_at) from sesion_participantes where sesion_id = s.id),
           (select max(updated_at) from sesion_respuestas where sesion_id = s.id),
           (select max(created_at) from ruleta_sorteos where sesion_id = s.id))
    into v_ultima from proyecto_sesiones s where s.id = p_sesion;
  return v_ultima is not null and v_ultima < now() - interval '12 hours';
end $$;
-- Finaliza una sesión: quita las fotos de los participantes (devuelve sus rutas para borrarlas de Storage)
create or replace function public._sesion_cerrar(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fotos jsonb;
begin
  select coalesce(jsonb_agg(_ruta_foto(foto_url)) filter (where _ruta_foto(foto_url) is not null), '[]') into v_fotos
  from sesion_participantes where sesion_id = p_sesion;
  update sesion_participantes set foto_url = null where sesion_id = p_sesion and foto_url is not null;
  update proyecto_sesiones set estado = 'finalizada', finalizada_en = coalesce(finalizada_en, now()), updated_at = now()
  where id = p_sesion and estado <> 'finalizada';
  return v_fotos;
end $$;
-- Finaliza las sesiones inactivas de mis proyectos. Devuelve { cerradas, fotos }.
create or replace function public.proyectos_cerrar_inactivas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0; v_fotos jsonb := '[]';
begin
  if auth.uid() is null then return jsonb_build_object('cerradas', 0, 'fotos', '[]'::jsonb); end if;
  for s in select ps.id from proyecto_sesiones ps join proyectos p on p.id = ps.proyecto_id
           where p.profesor_id = auth.uid() and ps.estado <> 'finalizada' loop
    if _sesion_inactiva(s.id) then v_fotos := v_fotos || _sesion_cerrar(s.id); n := n + 1; end if;
  end loop;
  return jsonb_build_object('cerradas', n, 'fotos', v_fotos);
end $$;

-- =====================================================================
-- FASE D — PROYECTO "A SU RITMO" (publicado a grupos, con enlace para invitados, o público)
-- El alumno abre el proyecto y avanza solo; se guardan sus respuestas y puntajes.
-- =====================================================================
create table if not exists public.proyecto_publicaciones (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references public.proyectos(id) on delete cascade,
  grupo_id          uuid not null references public.grupos(id) on delete cascade,
  activo            boolean not null default true,
  permite_invitados boolean not null default false,   -- con el enlace o QR lo abren también personas sin cuenta
  created_at        timestamptz not null default now(),
  unique (proyecto_id, grupo_id)
);
create table if not exists public.proyecto_intentos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  publicacion_id uuid references public.proyecto_publicaciones(id) on delete cascade,   -- null: abierto desde la biblioteca (público)
  alumno_id      uuid references public.perfiles(id) on delete cascade,
  alias          text,
  avatar         text,
  token          uuid not null default gen_random_uuid(),
  hoja_actual    int not null default 0,
  respuestas     jsonb not null default '{}'::jsonb,   -- { hoja_id: { valor, correcta } }
  juegos         jsonb not null default '{}'::jsonb,   -- { hoja_id: { puntos, veces } } (el mejor puntaje)
  completado     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists proyecto_intentos_alumno on public.proyecto_intentos (publicacion_id, alumno_id) where alumno_id is not null;
create index if not exists proyecto_intentos_proyecto_idx on public.proyecto_intentos (proyecto_id);
create index if not exists proyecto_intentos_token_idx on public.proyecto_intentos (token);
alter table public.proyecto_publicaciones enable row level security;
alter table public.proyecto_intentos enable row level security;

-- ---------- Lista del profesor (o del admin: sus propios proyectos) ----------
create or replace function public.mis_proyectos() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'nombre', p.nombre, 'created_at', p.created_at, 'updated_at', p.updated_at,
    'n_hojas', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id),
    'portada', (select case when pg_column_size(h.diseno) < 40000 then h.diseno end
                from proyecto_hojas h where h.proyecto_id = p.id order by h.orden, h.created_at limit 1),
    'sesion', (select _sesion_resumen(s) from proyecto_sesiones s where s.proyecto_id = p.id and s.estado <> 'finalizada'
               order by s.created_at desc limit 1),
    'n_sesiones', (select count(*) from proyecto_sesiones s where s.proyecto_id = p.id),
    'publico', p.publico, 'destacado', p.destacado,
    'n_publicaciones_activas', (select count(*) from proyecto_publicaciones pp where pp.proyecto_id = p.id and pp.activo),
    'n_intentos', (select count(*) from proyecto_intentos i where i.proyecto_id = p.id)
  ) order by p.updated_at desc), '[]'::jsonb)
  from proyectos p where p.profesor_id = auth.uid();
$$;

-- ======================= PROFESOR =======================
-- Inicia una sesión en vivo (o devuelve la que ya está abierta)
create or replace function public.proyecto_iniciar_sesion(p_proyecto uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; v_fotos jsonb := '[]';
begin
  perform _proyecto_editable(p_proyecto);
  -- antes de empezar, se cierran las sesiones que quedaron abandonadas (de este y de los demás proyectos)
  v_fotos := coalesce(proyectos_cerrar_inactivas()->'fotos', '[]');
  select * into v from proyecto_sesiones where proyecto_id = p_proyecto and estado <> 'finalizada' order by created_at desc limit 1;
  if not found then
    insert into proyecto_sesiones (proyecto_id, profesor_id, pin, hoja_id)
    values (p_proyecto, auth.uid(), _nuevo_pin(),
            (select id from proyecto_hojas where proyecto_id = p_proyecto order by orden, created_at limit 1))
    returning * into v;
  end if;
  return _sesion_resumen(v) || jsonb_build_object('fotos_viejas', v_fotos);
end $$;

-- Sesión sin terminar de un proyecto (para "Tienes una sesión en curso…"); null si no hay
create or replace function public.proyecto_sesion_activa(p_proyecto uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from proyectos where id = p_proyecto and (profesor_id = auth.uid() or es_admin())) then
    raise exception 'Este proyecto pertenece a otro profesor.';
  end if;
  return (select _sesion_resumen(s) from proyecto_sesiones s where s.proyecto_id = p_proyecto and s.estado <> 'finalizada'
          order by s.created_at desc limit 1);
end $$;

create or replace function public.proyecto_ir_a_hoja(p_sesion uuid, p_hoja uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  if not exists (select 1 from proyecto_hojas where id = p_hoja and proyecto_id = v.proyecto_id) then raise exception 'Esa hoja no es de este proyecto.'; end if;
  update proyecto_sesiones set hoja_id = p_hoja, respuestas_abiertas = true, revelar = false, hoja_inicio = now(), juego_inicio = null, updated_at = now()
  where id = p_sesion returning * into v;
  return _sesion_resumen(v);
end $$;

-- Registro: abrir/cerrar y permitir tardíos (null = no cambia)
create or replace function public.proyecto_registro(p_sesion uuid, p_abierto boolean default null, p_tardios boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  v := _sesion_profe(p_sesion);
  update proyecto_sesiones set registro_abierto = coalesce(p_abierto, registro_abierto), tardios = coalesce(p_tardios, tardios), updated_at = now()
  where id = p_sesion returning * into v;
  return _sesion_resumen(v);
end $$;

-- Respuestas de la hoja actual: abrir/cerrar y revelar la correcta (null = no cambia)
create or replace function public.proyecto_respuestas(p_sesion uuid, p_abiertas boolean default null, p_revelar boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  v := _sesion_profe(p_sesion);
  -- al volver a abrir las respuestas, el tiempo de la pregunta empieza de nuevo
  update proyecto_sesiones set respuestas_abiertas = coalesce(p_abiertas, respuestas_abiertas), revelar = coalesce(p_revelar, revelar),
         hoja_inicio = case when p_abiertas and not respuestas_abiertas then now() else hoja_inicio end, updated_at = now()
  where id = p_sesion returning * into v;
  return _sesion_resumen(v);
end $$;

create or replace function public.proyecto_pausar(p_sesion uuid, p_pausar boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  update proyecto_sesiones set estado = case when p_pausar then 'pausada' else 'activa' end, updated_at = now()
  where id = p_sesion returning * into v;
  return _sesion_resumen(v);
end $$;

-- Finalizar: el PIN deja de funcionar; los resultados quedan guardados.
-- Las fotos de los participantes se quitan (vuelven a su avatar) y se devuelven sus rutas para borrarlas de Storage.
create or replace function public.proyecto_finalizar(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; v_fotos jsonb;
begin
  v := _sesion_profe(p_sesion);
  select coalesce(jsonb_agg(_ruta_foto(foto_url)) filter (where _ruta_foto(foto_url) is not null), '[]') into v_fotos
  from sesion_participantes where sesion_id = p_sesion;
  update sesion_participantes set foto_url = null where sesion_id = p_sesion and foto_url is not null;
  update proyecto_sesiones set estado = 'finalizada', finalizada_en = coalesce(finalizada_en, now()), updated_at = now()
  where id = p_sesion returning * into v;
  return _sesion_resumen(v) || jsonb_build_object('fotos', v_fotos);
end $$;

-- Reiniciar: borra participantes, respuestas, grupos y sorteos de las ruletas; PIN nuevo; vuelve a la primera hoja.
-- Devuelve las rutas de las fotos para que la app las borre del Storage.
create or replace function public.proyecto_reiniciar_sesion(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; v_fotos jsonb;
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  select coalesce(jsonb_agg(_ruta_foto(foto_url)) filter (where _ruta_foto(foto_url) is not null), '[]') into v_fotos
  from sesion_participantes where sesion_id = p_sesion;
  delete from ruleta_sorteos where sesion_id = p_sesion;
  delete from sesion_respuestas where sesion_id = p_sesion;
  delete from sesion_participantes where sesion_id = p_sesion;
  delete from sesion_grupos where sesion_id = p_sesion;
  update proyecto_sesiones set pin = _nuevo_pin(), estado = 'activa', registro_abierto = true, tardios = false,
         respuestas_abiertas = true, revelar = false, hoja_inicio = now(), juego_inicio = null, updated_at = now(),
         hoja_id = (select id from proyecto_hojas where proyecto_id = v.proyecto_id order by orden, created_at limit 1)
  where id = p_sesion returning * into v;
  return jsonb_build_object('sesion', _sesion_resumen(v), 'fotos', v_fotos);
end $$;

-- Borrar una sesión (sus resultados). Devuelve las rutas de las fotos.
create or replace function public.proyecto_borrar_sesion(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fotos jsonb;
begin
  perform _sesion_profe(p_sesion);
  select coalesce(jsonb_agg(_ruta_foto(foto_url)) filter (where _ruta_foto(foto_url) is not null), '[]') into v_fotos
  from sesion_participantes where sesion_id = p_sesion;
  delete from proyecto_sesiones where id = p_sesion;
  return jsonb_build_object('fotos', v_fotos);
end $$;

-- Eliminar el proyecto entero (hojas, sesiones y resultados). Devuelve las rutas de las fotos.
create or replace function public.proyecto_eliminar(p_proyecto uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fotos jsonb;
begin
  perform _proyecto_editable(p_proyecto);
  select coalesce(jsonb_agg(_ruta_foto(p.foto_url)) filter (where _ruta_foto(p.foto_url) is not null), '[]') into v_fotos
  from sesion_participantes p join proyecto_sesiones s on s.id = p.sesion_id where s.proyecto_id = p_proyecto;
  delete from proyectos where id = p_proyecto;
  return jsonb_build_object('fotos', v_fotos);
end $$;

create or replace function public.proyecto_expulsar(p_sesion uuid, p_participante uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _sesion_profe(p_sesion);
  update sesion_participantes set expulsado = true, grupo_id = null where id = p_participante and sesion_id = p_sesion;
  if not found then raise exception 'Ese participante no está en la sesión.'; end if;
end $$;

-- Forma grupos al azar y equilibrados (los tamaños difieren como máximo en 1).
-- p_por: 'grupos' (p_cantidad = cuántos grupos) o 'personas' (p_cantidad = personas por grupo).
-- Rehacerlo ("volver a mezclar") reemplaza los grupos de esa hoja.
create or replace function public.proyecto_formar_grupos(p_sesion uuid, p_hoja uuid, p_cantidad int, p_por text default 'grupos') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; h proyecto_hojas%rowtype; n int; k int;
  colores text[] := array['#7C6FF0','#FF9F43','#2FAE6C','#E14D72','#38BDF8','#A855F7','#F59E0B','#14B8A6','#EC4899','#6366F1','#84CC16','#EF4444'];
  emojis text[] := array['🦁','🐯','🦊','🐼','🐸','🐨','🦄','🐙','🦉','🐬','🐝','🐢'];
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  select * into h from proyecto_hojas where id = p_hoja and proyecto_id = v.proyecto_id and tipo = 'agrupar';
  if not found then raise exception 'Esa hoja no es para formar grupos.'; end if;
  select count(*) into n from sesion_participantes where sesion_id = p_sesion and not expulsado;
  if n < 2 then raise exception 'Se necesitan al menos 2 participantes para formar grupos.'; end if;
  if coalesce(p_cantidad, 0) < 1 then raise exception 'Escribe cuántos grupos (o cuántas personas por grupo).'; end if;
  k := case when p_por = 'personas' then ceil(n::numeric / p_cantidad)::int else p_cantidad end;
  k := greatest(1, least(k, n, 60));

  delete from sesion_grupos where sesion_id = p_sesion and hoja_id = p_hoja;   -- sus integrantes quedan sin grupo
  insert into sesion_grupos (sesion_id, hoja_id, numero, nombre, color, emoji)
  select p_sesion, p_hoja, i,
         left(coalesce(nullif(trim(h.config->'nombres'->>(i - 1)), ''), 'Grupo ' || i), 40),
         colores[1 + (i - 1) % array_length(colores, 1)], emojis[1 + (i - 1) % array_length(emojis, 1)]
  from generate_series(1, k) i;

  -- se barajan y se reparten por turnos
  update sesion_participantes p set grupo_id = g.id
  from (select id, (row_number() over (order by random()) - 1) % k + 1 as numero
        from sesion_participantes where sesion_id = p_sesion and not expulsado) x
  join sesion_grupos g on g.sesion_id = p_sesion and g.hoja_id = p_hoja and g.numero = x.numero
  where p.id = x.id;
  return (select jsonb_agg(to_jsonb(g) order by g.numero) from sesion_grupos g where g.sesion_id = p_sesion and g.hoja_id = p_hoja);
end $$;

create or replace function public.proyecto_confirmar_grupos(p_sesion uuid, p_hoja uuid, p_confirmar boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _sesion_profe(p_sesion);
  update sesion_grupos set confirmado = p_confirmar where sesion_id = p_sesion and hoja_id = p_hoja;
  if not found then raise exception 'Primero forma los grupos.'; end if;
end $$;

create or replace function public.proyecto_renombrar_grupo(p_grupo uuid, p_nombre text, p_color text default null, p_emoji text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_sesion uuid;
begin
  select sesion_id into v_sesion from sesion_grupos where id = p_grupo;
  if not found then raise exception 'Ese grupo ya no existe.'; end if;
  perform _sesion_profe(v_sesion);
  if p_color is not null and p_color !~* '^#[0-9a-f]{6}$' then raise exception 'Color no válido.'; end if;
  update sesion_grupos set nombre = left(coalesce(nullif(trim(p_nombre), ''), nombre), 40), color = coalesce(p_color, color),
         emoji = case when p_emoji is null then emoji else left(nullif(trim(p_emoji), ''), 16) end
  where id = p_grupo;
end $$;

-- Mover un participante a otro grupo (null = sin grupo)
create or replace function public.proyecto_mover_participante(p_participante uuid, p_grupo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_sesion uuid;
begin
  select sesion_id into v_sesion from sesion_participantes where id = p_participante;
  if not found then raise exception 'Ese participante ya no está en la sesión.'; end if;
  perform _sesion_profe(v_sesion);
  if p_grupo is not null and not exists (select 1 from sesion_grupos where id = p_grupo and sesion_id = v_sesion) then
    raise exception 'Ese grupo no es de esta sesión.';
  end if;
  update sesion_participantes set grupo_id = p_grupo where id = p_participante;
  update sesion_respuestas set grupo_id = p_grupo where participante_id = p_participante;
end $$;

-- Todo lo que necesita la pantalla del profesor (se consulta cada 1,5 s)
create or replace function public.proyecto_estado_profe(p_sesion uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; h proyecto_hojas%rowtype;
begin
  v := _sesion_profe(p_sesion);
  select * into h from proyecto_hojas where id = v.hoja_id;
  return jsonb_build_object(
    'ahora', now(),
    'sesion', _sesion_resumen(v),
    'inactiva', v.estado <> 'finalizada' and _sesion_inactiva(v.id),   -- la pantalla la finaliza y deja de consultar
    'ruleta', case when h.tipo = 'ruleta' then _ruleta_estado(v.id, h) end,
    'participantes', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'alias', _visible(p), 'nombre', p.nombre, 'avatar', p.avatar,
        'foto_url', p.foto_url, 'grupo_id', p.grupo_id, 'conectado', p.visto_en > now() - interval '12 seconds') order by p.created_at), '[]'::jsonb)
      from sesion_participantes p where p.sesion_id = p_sesion and not p.expulsado),
    'grupos', (select coalesce(jsonb_agg(to_jsonb(g) order by g.hoja_id, g.numero), '[]'::jsonb) from sesion_grupos g where g.sesion_id = p_sesion),
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('participante_id', r.participante_id, 'alias', _visible(p), 'avatar', p.avatar,
        'grupo_id', r.grupo_id, 'valor', r.valor) order by r.created_at), '[]'::jsonb)
      from sesion_respuestas r join sesion_participantes p on p.id = r.participante_id
      where r.sesion_id = p_sesion and r.hoja_id = v.hoja_id and not p.expulsado));
end $$;

-- Resultados guardados de todas las sesiones de un proyecto (las 20 más recientes)
create or replace function public.proyecto_resultados(p_proyecto uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from proyectos where id = p_proyecto and (profesor_id = auth.uid() or es_admin())) then
    raise exception 'Este proyecto pertenece a otro profesor.';
  end if;
  return (select coalesce(jsonb_agg(x.j order by x.f desc), '[]'::jsonb) from (
    select s.created_at as f, _sesion_resumen(s) || jsonb_build_object(
      'participantes_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'alias', _visible(p), 'nombre', p.nombre, 'avatar', p.avatar,
          'foto_url', p.foto_url, 'grupo_id', p.grupo_id, 'expulsado', p.expulsado) order by p.created_at), '[]'::jsonb)
        from sesion_participantes p where p.sesion_id = s.id),
      'grupos', (select coalesce(jsonb_agg(to_jsonb(g) order by g.hoja_id, g.numero), '[]'::jsonb) from sesion_grupos g where g.sesion_id = s.id),
      'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('hoja_id', r.hoja_id, 'participante_id', r.participante_id, 'alias', _visible(p),
          'avatar', p.avatar, 'grupo_id', r.grupo_id, 'valor', r.valor) order by r.created_at), '[]'::jsonb)
        from sesion_respuestas r join sesion_participantes p on p.id = r.participante_id where r.sesion_id = s.id),
      'sorteos', (select coalesce(jsonb_agg(jsonb_build_object('hoja_id', r.hoja_id, 'ronda', r.ronda, 'texto', r.elegido_texto, 'created_at', r.created_at)
          order by r.hoja_id, r.ronda), '[]'::jsonb) from ruleta_sorteos r where r.sesion_id = s.id)) as j
    from proyecto_sesiones s where s.proyecto_id = p_proyecto order by s.created_at desc limit 20) x);
end $$;

-- ======================= PARTICIPANTE (con o sin cuenta) =======================
create or replace function public.proyecto_por_pin(p_pin text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('sesion_id', s.id, 'proyecto', p.nombre, 'estado', s.estado,
    'registro_abierto', s.registro_abierto, 'puede_unirse', s.registro_abierto or s.tardios)
  from proyecto_sesiones s join proyectos p on p.id = s.proyecto_id
  where s.pin = trim(coalesce(p_pin, '')) and s.estado <> 'finalizada'
  order by s.created_at desc limit 1;
$$;

create or replace function public.proyecto_unirse(p_pin text, p_nombre text, p_alias text default null, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; v_p sesion_participantes%rowtype; v_nombre text; v_alias text; v_grupo uuid;
begin
  select * into v from proyecto_sesiones where pin = trim(coalesce(p_pin, '')) and estado <> 'finalizada' order by created_at desc limit 1;
  if not found then raise exception 'No hay ninguna sesión abierta con ese PIN.'; end if;
  if not (v.registro_abierto or v.tardios) then raise exception 'El registro está cerrado. Pídele al profesor que lo abra.'; end if;
  v_nombre := left(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), 40);
  v_alias := nullif(left(regexp_replace(trim(coalesce(p_alias, '')), '\s+', ' ', 'g'), 30), '');
  if v_nombre = '' then raise exception 'Escribe tu nombre.'; end if;
  if exists (select 1 from sesion_participantes p where p.sesion_id = v.id
             and (lower(_visible(p)) in (lower(v_nombre), lower(coalesce(v_alias, v_nombre))) or lower(p.nombre) = lower(v_nombre))) then
    raise exception 'Ese nombre ya está en uso en esta sesión. Elige otro (o agrega tu apellido).';
  end if;
  if (select count(*) from sesion_participantes where sesion_id = v.id) >= 300 then raise exception 'La sesión está llena.'; end if;
  -- si ya hay grupos confirmados, el que llega tarde entra al grupo con menos integrantes
  select g.id into v_grupo from sesion_grupos g
  where g.sesion_id = v.id and g.confirmado
    and g.hoja_id = (select hoja_id from sesion_grupos where sesion_id = v.id and confirmado order by created_at desc limit 1)
  order by (select count(*) from sesion_participantes p where p.grupo_id = g.id and not p.expulsado), g.numero limit 1;
  insert into sesion_participantes (sesion_id, nombre, alias, avatar, grupo_id, alumno_id, hoja_registro)
  values (v.id, v_nombre, v_alias, left(nullif(trim(coalesce(p_avatar, '')), ''), 16), v_grupo, auth.uid(), v.hoja_id)
  returning * into v_p;
  return jsonb_build_object('sesion_id', v.id, 'participante_id', v_p.id, 'token', v_p.token, 'foto_clave', v_p.foto_clave);
end $$;

-- ¿Puede subirse este archivo como foto de participante? Ruta: proyectos/sesiones/<sesion>/<participante>/<foto_clave>.jpg
create or replace function public.puede_subir_foto_sesion(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_nombre ~ '^proyectos/sesiones/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp|png)$', false)
     and exists (select 1 from sesion_participantes p join proyecto_sesiones s on s.id = p.sesion_id
                 where p.sesion_id::text = split_part(p_nombre, '/', 3) and p.id::text = split_part(p_nombre, '/', 4)
                   and p.foto_clave::text = split_part(split_part(p_nombre, '/', 5), '.', 1)
                   and not p.expulsado and p.foto_url is null and s.estado <> 'finalizada');
$$;

-- ¿Es del profesor la sesión de esta ruta? (para borrar las fotos al reiniciar)
create or replace function public.es_dueno_ruta_sesion(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_nombre ~ '^proyectos/sesiones/[0-9a-f-]{36}/', false)
     and exists (select 1 from proyecto_sesiones s where s.id::text = split_part(p_nombre, '/', 3) and (s.profesor_id = auth.uid() or es_admin()));
$$;

create or replace function public.proyecto_foto(p_pin text, p_token uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p sesion_participantes%rowtype;
begin
  v_p := _sesion_participante(p_pin, p_token);
  if coalesce(_ruta_foto(p_url), '') !~ ('^proyectos/sesiones/' || v_p.sesion_id || '/' || v_p.id || '/' || v_p.foto_clave || '\.(jpg|webp|png)$')
     or p_url !~ '^https://' then
    raise exception 'Foto no válida.';
  end if;
  update sesion_participantes set foto_url = p_url where id = v_p.id;
end $$;

-- Configuración que ve el participante: sin las respuestas correctas hasta que el profesor las revele
create or replace function public._config_publica(h public.proyecto_hojas, p_revelar boolean) returns jsonb
language sql immutable as $$
  select case when p_revelar then h.config else h.config - 'correcta' - 'correctas' - 'aceptadas' - 'nombres' end;
$$;

-- Estado para el celular del participante (se consulta cada 1,5 s).
-- La hoja (diseño y configuración) solo se envía cuando cambia (p_version).
create or replace function public.proyecto_estado(p_pin text, p_token uuid, p_version text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p sesion_participantes%rowtype; v proyecto_sesiones%rowtype; h proyecto_hojas%rowtype; v_version text; v_grupo jsonb; v_rev boolean;
begin
  select p.* into v_p from sesion_participantes p join proyecto_sesiones s on s.id = p.sesion_id
  where s.pin = trim(coalesce(p_pin, '')) and p.token = coalesce(p_token, '00000000-0000-0000-0000-000000000000')
  order by s.created_at desc limit 1;
  if not found then return jsonb_build_object('estado', 'desconocido'); end if;
  select * into v from proyecto_sesiones where id = v_p.sesion_id;
  if v_p.expulsado then return jsonb_build_object('estado', 'expulsado'); end if;
  if v.estado = 'finalizada' then return jsonb_build_object('estado', 'finalizada', 'proyecto', (select nombre from proyectos where id = v.proyecto_id)); end if;
  -- abandonada (12 horas sin actividad): el celular deja de consultar
  if _sesion_inactiva(v.id) then return jsonb_build_object('estado', 'finalizada', 'inactiva', true, 'proyecto', (select nombre from proyectos where id = v.proyecto_id)); end if;
  if v_p.visto_en < now() - interval '5 seconds' then update sesion_participantes set visto_en = now() where id = v_p.id; end if;

  select * into h from proyecto_hojas where id = v.hoja_id;
  v_rev := v.revelar and h.tipo in ('vf','opcion','completar');
  v_version := coalesce(h.id::text || ':' || extract(epoch from h.updated_at)::text || ':' || v_rev::text, 'sin-hoja');
  select jsonb_build_object('id', g.id, 'numero', g.numero, 'nombre', g.nombre, 'color', g.color, 'emoji', g.emoji,
    'companeros', (select coalesce(jsonb_agg(jsonb_build_object('alias', _visible(o), 'avatar', o.avatar, 'foto_url', o.foto_url, 'yo', o.id = v_p.id) order by o.created_at), '[]'::jsonb)
                   from sesion_participantes o where o.grupo_id = g.id and not o.expulsado))
    into v_grupo from sesion_grupos g where g.id = v_p.grupo_id and g.confirmado;

  return jsonb_build_object(
    'estado', v.estado, 'proyecto', (select nombre from proyectos where id = v.proyecto_id), 'pin', v.pin, 'ahora', now(),
    'ruleta', case when h.tipo = 'ruleta' then _ruleta_estado(v.id, h) end,
    -- hoja de juego: mi lugar en el ranking (como en las salas)
    'juego', case when h.tipo = 'juego' then (select jsonb_build_object('total', count(*),
               'pos', 1 + count(*) filter (where (r.valor->>'puntos')::numeric >
                                             coalesce((select (m.valor->>'puntos')::numeric from sesion_respuestas m
                                                       where m.sesion_id = v.id and m.hoja_id = h.id and m.participante_id = v_p.id), -1)))
             from sesion_respuestas r where r.sesion_id = v.id and r.hoja_id = h.id) end,
    'sesion', jsonb_build_object('hoja_id', v.hoja_id, 'abiertas', v.respuestas_abiertas, 'revelar', v_rev, 'hoja_inicio', v.hoja_inicio, 'juego_inicio', v.juego_inicio,
                                 'registro_abierto', v.registro_abierto),
    'version', v_version,
    'hoja', case when h.id is null or v_version = p_version then null
                 else jsonb_build_object('id', h.id, 'tipo', h.tipo, 'config', _config_publica(h, v_rev), 'diseno', h.diseno) end,
    'yo', jsonb_build_object('id', v_p.id, 'alias', _visible(v_p), 'nombre', v_p.nombre, 'avatar', v_p.avatar, 'foto_url', v_p.foto_url,
                             'foto_clave', v_p.foto_clave, 'sesion_id', v_p.sesion_id, 'grupo', v_grupo),
    -- mis respuestas a la hoja actual (en modo "por grupo", las de mi grupo)
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('valor', r.valor, 'alias', _visible(o), 'mia', r.participante_id = v_p.id) order by r.created_at), '[]'::jsonb)
                   from sesion_respuestas r join sesion_participantes o on o.id = r.participante_id
                   where r.sesion_id = v.id and r.hoja_id = v.hoja_id
                     and (r.participante_id = v_p.id or (h.config->>'modo' = 'grupo' and v_p.grupo_id is not null and r.grupo_id = v_p.grupo_id))));
end $$;

-- ---------- Hojas de juego (sopa, ahorcado, memorama…) ----------
-- El profesor inicia la partida para todos (con 4 s de cuenta atrás), la termina o la vuelve a jugar.
create or replace function public.proyecto_juego(p_sesion uuid, p_accion text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype;
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  if not exists (select 1 from proyecto_hojas where id = v.hoja_id and tipo = 'juego') then raise exception 'La hoja actual no es un juego.'; end if;
  if p_accion = 'iniciar' then
    update proyecto_sesiones set juego_inicio = now() + interval '4 seconds', respuestas_abiertas = true, updated_at = now() where id = p_sesion returning * into v;
  elsif p_accion = 'terminar' then
    update proyecto_sesiones set respuestas_abiertas = false, updated_at = now() where id = p_sesion returning * into v;
  elsif p_accion = 'reiniciar' then
    delete from sesion_respuestas where sesion_id = p_sesion and hoja_id = v.hoja_id;
    update proyecto_sesiones set juego_inicio = null, respuestas_abiertas = true, updated_at = now() where id = p_sesion returning * into v;
  else raise exception 'Acción no válida';
  end if;
  return _sesion_resumen(v);
end $$;

-- Puntaje de un participante en la hoja de juego: { puntos, terminado, detalle }. Se actualiza mientras juega.
create or replace function public._proyecto_puntaje_juego(v public.proyecto_sesiones, v_p public.sesion_participantes, h public.proyecto_hojas, p_valor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_seg int := coalesce((h.config->'juego'->>'segundos')::int, 0); v_id uuid; v_prev jsonb; v_valor jsonb;
begin
  if v.juego_inicio is null or now() < v.juego_inicio - interval '2 seconds' then raise exception 'El juego todavía no empieza.'; end if;
  if v_seg > 0 and now() > v.juego_inicio + make_interval(secs => v_seg + 5) then raise exception 'Se acabó el tiempo del juego.'; end if;
  if jsonb_typeof(p_valor->'puntos') is distinct from 'number' or (p_valor->>'puntos')::numeric not between 0 and 10000000 then raise exception 'Puntaje no válido.'; end if;
  v_valor := jsonb_build_object('puntos', round((p_valor->>'puntos')::numeric), 'terminado', coalesce((p_valor->>'terminado')::boolean, false),
                                'detalle', left(coalesce(p_valor->>'detalle', ''), 200), 'segundos', round(extract(epoch from now() - v.juego_inicio)));
  select id, valor into v_id, v_prev from sesion_respuestas where sesion_id = v.id and hoja_id = h.id and participante_id = v_p.id;
  if v_id is null then
    insert into sesion_respuestas (sesion_id, hoja_id, participante_id, grupo_id, valor) values (v.id, h.id, v_p.id, v_p.grupo_id, v_valor);
  elsif coalesce((v_prev->>'terminado')::boolean, false) then
    raise exception 'Ya terminaste este juego.';
  else
    update sesion_respuestas set valor = v_valor, grupo_id = v_p.grupo_id, updated_at = now() where id = v_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public._proyecto_puntaje_juego(public.proyecto_sesiones, public.sesion_participantes, public.proyecto_hojas, jsonb) from public, anon, authenticated;

create or replace function public.proyecto_responder(p_pin text, p_token uuid, p_hoja uuid, p_valor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p sesion_participantes%rowtype; v proyecto_sesiones%rowtype; h proyecto_hojas%rowtype; v_grupo uuid; v_n int; v_lim int; v_id uuid;
begin
  v_p := _sesion_participante(p_pin, p_token);
  select * into v from proyecto_sesiones where id = v_p.sesion_id;
  if v.estado = 'pausada' then raise exception 'La sesión está en pausa. Espera al profesor.'; end if;
  if v.hoja_id is distinct from p_hoja then raise exception 'Esa pregunta ya pasó.'; end if;
  if not v.respuestas_abiertas then raise exception 'Las respuestas están cerradas.'; end if;
  select * into h from proyecto_hojas where id = p_hoja;
  if found and h.tipo = 'juego' then return _proyecto_puntaje_juego(v, v_p, h, p_valor); end if;
  if not found or h.tipo not in ('pregunta','vf','opcion','completar','lluvia') then raise exception 'Esta hoja no tiene pregunta.'; end if;
  -- tiempo por pregunta (con 2 s de margen por la demora de la red)
  if coalesce((h.config->>'tiempo')::int, 0) > 0
     and now() > v.hoja_inicio + make_interval(secs => (h.config->>'tiempo')::int + 2) then
    raise exception 'Se acabó el tiempo para responder.';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object' or pg_column_size(p_valor) > 4000 then raise exception 'Respuesta no válida.'; end if;

  -- validación según el tipo
  if h.tipo = 'vf' and jsonb_typeof(p_valor->'valor') <> 'boolean' then raise exception 'Elige verdadero o falso.'; end if;
  if h.tipo = 'opcion' and not exists (select 1 from jsonb_array_elements(coalesce(h.config->'opciones', '[]')) o where o->>'id' = p_valor->>'opcion') then
    raise exception 'Elige una de las opciones.';
  end if;
  if h.tipo in ('pregunta','lluvia') then
    v_lim := case when h.tipo = 'lluvia' then 60 else least(500, greatest(10, coalesce((h.config->>'limite')::int, 140))) end;
    if length(trim(coalesce(p_valor->>'texto', ''))) = 0 then raise exception 'Escribe tu respuesta.'; end if;
    if length(p_valor->>'texto') > v_lim then raise exception 'Tu respuesta es muy larga (máximo % letras).', v_lim; end if;
    p_valor := jsonb_build_object('texto', trim(p_valor->>'texto'));
  end if;
  if h.tipo = 'completar' then
    select count(*) into v_n from regexp_matches(coalesce(h.config->>'frase', ''), '_{3,}', 'g');
    if jsonb_typeof(p_valor->'textos') <> 'array' or jsonb_array_length(p_valor->'textos') <> greatest(v_n, 1)
       or exists (select 1 from jsonb_array_elements_text(p_valor->'textos') t where length(t) > 60) then
      raise exception 'Completa todos los espacios.';
    end if;
    p_valor := jsonb_build_object('textos', p_valor->'textos');
  end if;
  if h.tipo = 'vf' then p_valor := jsonb_build_object('valor', p_valor->'valor'); end if;
  if h.tipo = 'opcion' then p_valor := jsonb_build_object('opcion', p_valor->>'opcion'); end if;

  if h.config->>'modo' = 'grupo' then
    select g.id into v_grupo from sesion_grupos g where g.id = v_p.grupo_id and g.confirmado;
    if v_grupo is null then raise exception 'Todavía no tienes grupo. Espera a que el profesor forme los grupos.'; end if;
  else
    v_grupo := v_p.grupo_id;
  end if;

  if h.tipo = 'lluvia' then
    select count(*) into v_n from sesion_respuestas where sesion_id = v.id and hoja_id = p_hoja
      and (case when h.config->>'modo' = 'grupo' then grupo_id = v_grupo else participante_id = v_p.id end);
    if v_n >= least(10, greatest(1, coalesce((h.config->>'max')::int, 3))) then raise exception 'Ya enviaste todas tus ideas.'; end if;
    insert into sesion_respuestas (sesion_id, hoja_id, participante_id, grupo_id, valor) values (v.id, p_hoja, v_p.id, v_grupo, p_valor);
  else
    -- una respuesta por persona (o por grupo); se puede cambiar mientras estén abiertas
    select id into v_id from sesion_respuestas where sesion_id = v.id and hoja_id = p_hoja
      and (case when h.config->>'modo' = 'grupo' then grupo_id = v_grupo else participante_id = v_p.id end) limit 1;
    if v_id is null then
      insert into sesion_respuestas (sesion_id, hoja_id, participante_id, grupo_id, valor) values (v.id, p_hoja, v_p.id, v_grupo, p_valor);
    else
      update sesion_respuestas set valor = p_valor, participante_id = v_p.id, updated_at = now() where id = v_id;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Salir de la sesión (el participante lo pide); libera su nombre si nadie respondió aún
create or replace function public.proyecto_salir(p_pin text, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p sesion_participantes%rowtype;
begin
  v_p := _sesion_participante(p_pin, p_token);
  if exists (select 1 from sesion_respuestas where participante_id = v_p.id) then
    update sesion_participantes set expulsado = true, grupo_id = null where id = v_p.id;
  else
    delete from sesion_participantes where id = v_p.id;
  end if;
end $$;

revoke execute on function public._sesion_profe(uuid) from public, anon, authenticated;
revoke execute on function public._sesion_participante(text, uuid) from public, anon, authenticated;
revoke execute on function public._visible(public.sesion_participantes) from public, anon, authenticated;
revoke execute on function public._sesion_resumen(public.proyecto_sesiones) from public, anon, authenticated;
revoke execute on function public._ruta_foto(text) from public, anon, authenticated;
revoke execute on function public._config_publica(public.proyecto_hojas, boolean) from public, anon, authenticated;
revoke execute on function public._nuevo_pin() from public, anon, authenticated;

-- ---------- Storage: fotos de los participantes ----------
-- Solo en su propia carpeta y con el nombre secreto (foto_clave) que recibe al unirse; una sola foto.
-- El profesor puede verlas y borrarlas (al reiniciar o borrar la sesión).
do $$
begin
  execute 'drop policy if exists proyectos_fotos_subir on storage.objects';
  execute $p$create policy proyectos_fotos_subir on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'preguntas-imagenes' and public.puede_subir_foto_sesion(name))$p$;
  execute 'drop policy if exists proyectos_fotos_ver on storage.objects';
  execute $p$create policy proyectos_fotos_ver on storage.objects for select to authenticated
    using (bucket_id = 'preguntas-imagenes' and public.es_dueno_ruta_sesion(name))$p$;
  execute 'drop policy if exists proyectos_fotos_borrar on storage.objects';
  execute $p$create policy proyectos_fotos_borrar on storage.objects for delete to authenticated
    using (bucket_id = 'preguntas-imagenes' and public.es_dueno_ruta_sesion(name))$p$;
exception when others then
  raise notice 'No se pudieron crear las políticas de Storage para las fotos de participantes: %', sqlerrm;
end $$;

-- =====================================================================
-- FASE 3 — RULETA
-- El servidor decide quién sale (ruleta_girar) y lo guarda: la animación de la pantalla
-- y de los celulares solo "aterriza" en el gajo ya elegido, así todos ven lo mismo.
-- config de la hoja: origen ('nombres' | 'grupos' | 'participantes'), lista (nombres escritos a mano),
--   hoja_grupos (hoja Agrupar de donde salen los grupos; si no, los grupos más recientes),
--   repetir (¿el elegido puede volver a salir?), duracion, sonido, paleta.
-- =====================================================================
create table if not exists public.ruleta_sorteos (
  id               uuid primary key default gen_random_uuid(),
  sesion_id        uuid not null references public.proyecto_sesiones(id) on delete cascade,
  hoja_id          uuid not null,
  ronda            int not null,
  clave            text not null,        -- id del grupo o del participante, o el nombre escrito
  elegido_texto    text not null,
  elegido_grupo_id uuid references public.sesion_grupos(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (sesion_id, hoja_id, ronda)
);
alter table public.ruleta_sorteos enable row level security;

-- Gajos de la ruleta, en el orden en que se dibujan: [{clave, texto, color?, emoji?, avatar?, foto_url?}]
create or replace function public._ruleta_candidatos(p_sesion uuid, h public.proyecto_hojas) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_origen text := coalesce(h.config->>'origen', 'nombres'); v_hoja uuid;
begin
  if v_origen = 'grupos' then
    begin v_hoja := nullif(h.config->>'hoja_grupos', '')::uuid; exception when others then v_hoja := null; end;
    if v_hoja is null or not exists (select 1 from sesion_grupos where sesion_id = p_sesion and hoja_id = v_hoja) then
      select hoja_id into v_hoja from sesion_grupos where sesion_id = p_sesion order by confirmado desc, created_at desc limit 1;
    end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('clave', g.id, 'texto', g.nombre, 'color', g.color, 'emoji', g.emoji) order by g.numero), '[]'::jsonb)
            from sesion_grupos g where g.sesion_id = p_sesion and g.hoja_id = v_hoja);
  elsif v_origen = 'participantes' then
    -- los registrados en la hoja Unirse/Agrupar elegida (si no, la más cercana antes de la ruleta) y los que llegaron
    -- tarde; no entran los expulsados ni los que se registraron en otra hoja Unirse/Agrupar
    begin v_hoja := nullif(h.config->>'hoja_registro', '')::uuid; exception when others then v_hoja := null; end;
    if v_hoja is null or not exists (select 1 from proyecto_hojas where id = v_hoja and proyecto_id = h.proyecto_id and tipo in ('unirse', 'agrupar') and orden < h.orden) then
      select id into v_hoja from proyecto_hojas where proyecto_id = h.proyecto_id and tipo in ('unirse', 'agrupar') and orden < h.orden order by orden desc limit 1;
    end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('clave', p.id, 'texto', _visible(p), 'avatar', p.avatar, 'foto_url', p.foto_url) order by p.created_at), '[]'::jsonb)
            from sesion_participantes p where p.sesion_id = p_sesion and not p.expulsado
              and (v_hoja is null or p.hoja_registro is null or p.hoja_registro = v_hoja
                   or not exists (select 1 from proyecto_hojas x where x.id = p.hoja_registro and x.tipo in ('unirse', 'agrupar'))));
  end if;
  -- nombres escritos a mano: sin vacíos ni repetidos, máximo 200
  return (select coalesce(jsonb_agg(jsonb_build_object('clave', t, 'texto', t) order by o), '[]'::jsonb) from (
    select t, o from (
      select distinct on (lower(t)) t, o from (
        select left(trim(x), 60) as t, o from jsonb_array_elements_text(
          case when jsonb_typeof(h.config->'lista') = 'array' then h.config->'lista' else '[]'::jsonb end) with ordinality as e(x, o)) y
      where t <> '' order by lower(t), o) z
    order by o limit 200) w);
end $$;

-- Lo que necesitan la pantalla y los celulares para dibujar la ruleta de la hoja actual
create or replace function public._ruleta_estado(p_sesion uuid, h public.proyecto_hojas) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('hoja_id', h.id, 'candidatos', _ruleta_candidatos(p_sesion, h),
    'sorteos', (select coalesce(jsonb_agg(jsonb_build_object('ronda', r.ronda, 'clave', r.clave, 'texto', r.elegido_texto, 'created_at', r.created_at)
                  order by r.ronda), '[]'::jsonb)
                from ruleta_sorteos r where r.sesion_id = p_sesion and r.hoja_id = h.id));
$$;

-- GIRAR: elige al azar entre los gajos (sin los que ya salieron, si no se repite) y lo guarda
create or replace function public.ruleta_girar(p_sesion uuid, p_hoja uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_sesiones%rowtype; h proyecto_hojas%rowtype; c jsonb; x jsonb; v_ronda int; r ruleta_sorteos%rowtype;
begin
  v := _sesion_profe(p_sesion);
  if v.estado = 'finalizada' then raise exception 'La sesión ya terminó.'; end if;
  perform 1 from proyecto_sesiones where id = p_sesion for update;   -- dos clics seguidos no sacan la misma ronda
  select * into h from proyecto_hojas where id = p_hoja and proyecto_id = v.proyecto_id and tipo = 'ruleta';
  if not found then raise exception 'Esa hoja no es una ruleta.'; end if;
  c := _ruleta_candidatos(p_sesion, h);
  if jsonb_array_length(c) = 0 then
    raise exception '%', case coalesce(h.config->>'origen', 'nombres')
      when 'grupos' then 'Todavía no hay grupos. Fórmalos primero en una hoja Agrupar.'
      when 'participantes' then 'Todavía no hay participantes en la sesión.'
      else 'La ruleta no tiene nombres. Escríbelos en el editor.' end;
  end if;
  -- al azar, solo entre los que siguen en la ruleta (gen_random_uuid: cada fila recibe un valor nuevo y distinto)
  with quedan as materialized (
    select e from jsonb_array_elements(c) e
    where coalesce((h.config->>'repetir')::boolean, false)
       or not exists (select 1 from ruleta_sorteos s where s.sesion_id = p_sesion and s.hoja_id = p_hoja and s.clave = e->>'clave'))
  select e into x from quedan order by gen_random_uuid() limit 1;
  if x is null then raise exception '¡Todos han salido! Reinicia la ruleta para volver a empezar.'; end if;
  select coalesce(max(ronda), 0) + 1 into v_ronda from ruleta_sorteos where sesion_id = p_sesion and hoja_id = p_hoja;
  insert into ruleta_sorteos (sesion_id, hoja_id, ronda, clave, elegido_texto, elegido_grupo_id)
  values (p_sesion, p_hoja, v_ronda, x->>'clave', left(x->>'texto', 60),
          case when h.config->>'origen' = 'grupos' then (x->>'clave')::uuid end)
  returning * into r;
  return jsonb_build_object('ronda', r.ronda, 'clave', r.clave, 'texto', r.elegido_texto, 'created_at', r.created_at);
end $$;

-- Reiniciar la ruleta: todos vuelven a la ruleta y se borra el historial de esa hoja
create or replace function public.ruleta_reiniciar(p_sesion uuid, p_hoja uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _sesion_profe(p_sesion);
  delete from ruleta_sorteos where sesion_id = p_sesion and hoja_id = p_hoja;
end $$;

revoke execute on function public._ruleta_candidatos(uuid, public.proyecto_hojas) from public, anon, authenticated;
revoke execute on function public._ruleta_estado(uuid, public.proyecto_hojas) from public, anon, authenticated;

-- ======================= FASE D — A SU RITMO: funciones =======================
-- ---------- Profesor: publicar en grupos ----------
create or replace function public.publicar_proyecto(p_proyecto uuid, p_grupos uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare g uuid; n int := 0;
begin
  perform _proyecto_editable(p_proyecto);
  foreach g in array coalesce(p_grupos, '{}') loop
    if not (es_dueno_grupo(g) or es_admin()) then raise exception 'Uno de los grupos no es tuyo'; end if;
    insert into proyecto_publicaciones (proyecto_id, grupo_id) values (p_proyecto, g)
    on conflict (proyecto_id, grupo_id) do update set activo = true;
    n := n + 1;
  end loop;
  -- los grupos que no vienen quedan apagados (sus resultados se conservan)
  update proyecto_publicaciones set activo = false where proyecto_id = p_proyecto and not (grupo_id = any(coalesce(p_grupos, '{}')));
  return n;
end $$;

create or replace function public.proyecto_publicacion_invitados(p_pub uuid, p_permite boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from proyecto_publicaciones where id = p_pub;
  if not found then raise exception 'Esa publicación ya no existe.'; end if;
  perform _proyecto_editable(v_proy);
  update proyecto_publicaciones set permite_invitados = p_permite where id = p_pub;
end $$;

create or replace function public.publicaciones_proyecto(p_proyecto uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform _proyecto_editable(p_proyecto);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', pp.id, 'grupo_id', g.id, 'grupo', g.nombre, 'activo', pp.activo,
      'permite_invitados', pp.permite_invitados,
      'intentos', (select count(*) from proyecto_intentos i where i.publicacion_id = pp.id),
      'completados', (select count(*) from proyecto_intentos i where i.publicacion_id = pp.id and i.completado)) order by g.nombre), '[]'::jsonb)
    from proyecto_publicaciones pp join grupos g on g.id = pp.grupo_id where pp.proyecto_id = p_proyecto);
end $$;

-- ---------- Calificación (en el servidor: las respuestas correctas no se mandan antes de responder) ----------
create or replace function public._ritmo_calificar(h public.proyecto_hojas, v jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare c jsonb := h.config; ok boolean; n int; i int; v_txt text;
begin
  if h.tipo = 'vf' then
    if c->'correcta' is null or jsonb_typeof(c->'correcta') <> 'boolean' then return jsonb_build_object('correcta', null); end if;
    return jsonb_build_object('correcta', (v->'valor') = (c->'correcta'), 'correcta_texto', case when (c->>'correcta')::boolean then 'Verdadero' else 'Falso' end,
                              'config', jsonb_build_object('correcta', c->'correcta'));
  elsif h.tipo = 'opcion' then
    if jsonb_array_length(coalesce(c->'correctas', '[]')) = 0 then return jsonb_build_object('correcta', null); end if;
    select string_agg(o->>'texto', ' / ') into v_txt from jsonb_array_elements(c->'opciones') o where (c->'correctas') ? (o->>'id');
    return jsonb_build_object('correcta', (c->'correctas') ? (v->>'opcion'), 'correcta_texto', v_txt, 'config', jsonb_build_object('correctas', c->'correctas'));
  elsif h.tipo = 'completar' then
    n := greatest(1, (select count(*) from regexp_matches(coalesce(c->>'frase', ''), '_{3,}', 'g')));
    ok := true;
    for i in 0 .. n - 1 loop
      if not exists (select 1 from jsonb_array_elements_text(coalesce(c->'aceptadas'->i, '[]')) a
                     where _normalizar(a) = _normalizar(coalesce(v->'textos'->>i, ''))) then ok := false; end if;
    end loop;
    select string_agg(coalesce(c->'aceptadas'->x->>0, ''), ' · ') into v_txt from generate_series(0, n - 1) x;
    return jsonb_build_object('correcta', ok, 'correcta_texto', v_txt, 'config', jsonb_build_object('aceptadas', c->'aceptadas'));
  end if;
  return jsonb_build_object('correcta', null);   -- pregunta abierta y lluvia de ideas: sin respuesta correcta
end $$;

-- ---------- Alumno o invitado ----------
-- Intento de quien llama: alumno con su cuenta, o invitado con su token
create or replace function public._ritmo_intento(p_intento uuid, p_token uuid) returns public.proyecto_intentos
language plpgsql stable security definer set search_path = public as $$
declare v proyecto_intentos%rowtype;
begin
  select * into v from proyecto_intentos where id = p_intento
    and ((alumno_id is not null and alumno_id = auth.uid()) or (alumno_id is null and token = p_token));
  if not found then raise exception 'Tu avance ya no es válido. Vuelve a abrir el proyecto.'; end if;
  return v;
end $$;

-- Abre el proyecto: con p_pub (publicado a un grupo) o p_proyecto (público, desde la biblioteca).
-- Alumno del grupo: su intento (se crea la primera vez). Invitado: con su token, o se crea con su nombre.
create or replace function public.proyecto_ritmo_abrir(p_pub uuid default null, p_proyecto uuid default null, p_token uuid default null,
  p_alias text default null, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pub proyecto_publicaciones%rowtype; v_proy proyectos%rowtype; v_int proyecto_intentos%rowtype; v_miembro boolean := false;
begin
  if p_pub is not null then
    select * into v_pub from proyecto_publicaciones where id = p_pub and activo;
    if not found then raise exception 'Este proyecto ya no está publicado.'; end if;
    select * into v_proy from proyectos where id = v_pub.proyecto_id;
    v_miembro := auth.uid() is not null and es_miembro_grupo(v_pub.grupo_id);
  else
    select * into v_proy from proyectos where id = p_proyecto and publico;
    if not found then raise exception 'Este proyecto no es público.'; end if;
  end if;
  if v_miembro then
    select * into v_int from proyecto_intentos where publicacion_id = p_pub and alumno_id = auth.uid();
    if not found then
      insert into proyecto_intentos (proyecto_id, publicacion_id, alumno_id, alias, avatar)
      select v_proy.id, p_pub, auth.uid(), coalesce(nullif(pf.nombre, ''), pf.usuario), pf.avatar from perfiles pf where pf.id = auth.uid()
      returning * into v_int;
    end if;
  else
    if p_pub is not null and not v_pub.permite_invitados then
      return jsonb_build_object('necesita', 'cuenta', 'proyecto', v_proy.nombre);
    end if;
    if p_token is not null then
      select * into v_int from proyecto_intentos where token = p_token and alumno_id is null and proyecto_id = v_proy.id
        and publicacion_id is not distinct from p_pub;
    end if;
    if v_int.id is null then
      if length(trim(coalesce(p_alias, ''))) = 0 then return jsonb_build_object('necesita', 'nombre', 'proyecto', v_proy.nombre); end if;
      insert into proyecto_intentos (proyecto_id, publicacion_id, alias, avatar)
      values (v_proy.id, p_pub, left(trim(p_alias), 30), left(nullif(trim(coalesce(p_avatar, '')), ''), 16))
      returning * into v_int;
    end if;
  end if;
  return jsonb_build_object(
    'proyecto', jsonb_build_object('id', v_proy.id, 'nombre', v_proy.nombre),
    'intento', jsonb_build_object('id', v_int.id, 'token', case when v_int.alumno_id is null then v_int.token end, 'alias', v_int.alias, 'avatar', v_int.avatar,
                                  'hoja_actual', v_int.hoja_actual, 'respuestas', v_int.respuestas, 'juegos', v_int.juegos, 'completado', v_int.completado),
    -- las hojas en vivo (Unirse, Agrupar y Ruleta) no van; las respuestas correctas, solo las ya respondidas
    'hojas', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'tipo', h.tipo, 'diseno', h.diseno,
                'config', case when v_int.respuestas ? h.id::text then h.config else _config_publica(h, false) end)
              order by h.orden, h.created_at), '[]'::jsonb)
              from proyecto_hojas h where h.proyecto_id = v_proy.id and h.tipo not in ('agrupar','ruleta','unirse')));
end $$;

-- Responder una hoja (una vez) o guardar el puntaje de un juego (se queda el mejor). Devuelve la corrección.
create or replace function public.proyecto_ritmo_responder(p_intento uuid, p_token uuid, p_hoja uuid, p_valor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v proyecto_intentos%rowtype; h proyecto_hojas%rowtype; r jsonb; v_prev jsonb; v_pts numeric;
begin
  v := _ritmo_intento(p_intento, p_token);
  select * into h from proyecto_hojas where id = p_hoja and proyecto_id = v.proyecto_id;
  if not found then raise exception 'Esa hoja ya no está en el proyecto.'; end if;
  if jsonb_typeof(p_valor) is distinct from 'object' or pg_column_size(p_valor) > 4000 then raise exception 'Respuesta no válida.'; end if;
  if h.tipo = 'juego' then
    if jsonb_typeof(p_valor->'puntos') is distinct from 'number' or (p_valor->>'puntos')::numeric not between 0 and 10000000 then raise exception 'Puntaje no válido.'; end if;
    v_pts := round((p_valor->>'puntos')::numeric);
    v_prev := v.juegos->p_hoja::text;
    update proyecto_intentos set juegos = juegos || jsonb_build_object(p_hoja::text, jsonb_build_object(
        'puntos', greatest(v_pts, coalesce((v_prev->>'puntos')::numeric, 0)), 'veces', coalesce((v_prev->>'veces')::int, 0) + 1)), updated_at = now()
    where id = v.id;
    return jsonb_build_object('mejor', greatest(v_pts, coalesce((v_prev->>'puntos')::numeric, 0)));
  end if;
  if h.tipo not in ('pregunta','vf','opcion','completar','lluvia') then raise exception 'Esta hoja no tiene pregunta.'; end if;
  if v.respuestas ? p_hoja::text and h.tipo <> 'lluvia' then raise exception 'Ya respondiste esta pregunta.'; end if;
  if h.tipo in ('pregunta','lluvia') and length(trim(coalesce(p_valor->>'texto', ''))) = 0 then raise exception 'Escribe tu respuesta.'; end if;
  r := _ritmo_calificar(h, p_valor);
  update proyecto_intentos set respuestas = respuestas || jsonb_build_object(p_hoja::text,
      case when h.tipo = 'lluvia' then jsonb_build_object('valores', coalesce(respuestas->p_hoja::text->'valores', '[]'::jsonb) || jsonb_build_array(p_valor), 'correcta', null)
           else jsonb_build_object('valor', p_valor, 'correcta', r->'correcta') end), updated_at = now()
  where id = v.id;
  return r;
end $$;

create or replace function public.proyecto_ritmo_avanzar(p_intento uuid, p_token uuid, p_hoja int, p_completado boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare v proyecto_intentos%rowtype;
begin
  v := _ritmo_intento(p_intento, p_token);
  update proyecto_intentos set hoja_actual = greatest(0, least(coalesce(p_hoja, 0), 200)), completado = completado or coalesce(p_completado, false), updated_at = now()
  where id = v.id;
end $$;

-- Proyectos publicados en los grupos del alumno (para su panel)
create or replace function public.mis_proyectos_alumno() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('publicacion_id', pp.id, 'titulo', p.nombre, 'grupo', g.nombre,
      'profesor', coalesce(pf.nombre, pf.usuario),
      'hojas', (select count(*) from proyecto_hojas h where h.proyecto_id = p.id and h.tipo not in ('agrupar','ruleta','unirse')),
      'hoja_actual', i.hoja_actual, 'completado', coalesce(i.completado, false), 'empezado', i.id is not null)
    order by i.completado nulls first, pp.created_at desc), '[]'::jsonb)
  from proyecto_publicaciones pp join proyectos p on p.id = pp.proyecto_id join grupos g on g.id = pp.grupo_id
  join perfiles pf on pf.id = p.profesor_id
  left join proyecto_intentos i on i.publicacion_id = pp.id and i.alumno_id = auth.uid()
  where pp.activo and es_miembro_grupo(pp.grupo_id);
$$;

-- ---------- Profesor: resultados por alumno ----------
create or replace function public.proyecto_ritmo_resultados(p_proyecto uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from proyectos where id = p_proyecto and (profesor_id = auth.uid() or es_admin())) then
    raise exception 'Este proyecto pertenece a otro profesor.';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'grupo', coalesce(g.nombre, '🌐 Biblioteca (público)'),
      'publicacion_id', i.publicacion_id, 'alumno', i.alumno_id is not null, 'alias', i.alias, 'avatar', i.avatar,
      'hoja_actual', i.hoja_actual, 'completado', i.completado, 'updated_at', i.updated_at,
      'respuestas', i.respuestas, 'juegos', i.juegos) order by g.nombre nulls last, i.alias), '[]'::jsonb)
    from proyecto_intentos i left join proyecto_publicaciones pp on pp.id = i.publicacion_id left join grupos g on g.id = pp.grupo_id
    where i.proyecto_id = p_proyecto);
end $$;

create or replace function public.proyecto_ritmo_borrar(p_intento uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from proyecto_intentos where id = p_intento;
  if not found then return; end if;
  perform _proyecto_editable(v_proy);
  delete from proyecto_intentos where id = p_intento;
end $$;

revoke execute on function public._ritmo_calificar(public.proyecto_hojas, jsonb) from public, anon, authenticated;
revoke execute on function public._ritmo_intento(uuid, uuid) from public, anon, authenticated;
