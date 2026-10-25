-- =====================================================================
-- PASO 11 — SALAS EN LÍNEA POR TURNOS (una sola partida para todos)
-- Todos ven el mismo tablero. Cuando le toca a un jugador, solo él puede mover
-- desde su dispositivo; cada jugada se guarda aquí y las demás pantallas la repiten.
-- El modo va dentro del contenido de la sala (contenido.modo = 'turnos'), así que
-- sala_crear, sala_estado y sala_otra_ronda (del 05) siguen igual.
-- Ejecutar DESPUÉS del 05 y ANTES de 06_permisos.sql. Se puede ejecutar varias veces.
-- =====================================================================

create table if not exists public.sala_jugadas (
  sala_id     uuid not null references public.salas_juego(id) on delete cascade,
  ronda       int not null,
  n           int not null,                    -- 1, 2, 3… en el orden en que se jugaron
  jugador_id  uuid references public.sala_jugadores(id) on delete set null,
  accion      jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (sala_id, ronda, n)
);
alter table public.sala_jugadas enable row level security;     -- solo se usan con las funciones de abajo

-- ¿Quién hace la jugada? El anfitrión (con su llave) o un jugador de la sala (con su token)
create or replace function public._sala_actor(p_sala uuid, p_jugador uuid, p_token uuid, p_host uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_j sala_jugadores%rowtype;
begin
  if p_host is not null and exists (select 1 from salas_juego where id = p_sala and host_token = p_host) then
    return p_jugador;   -- puede ser null si el anfitrión no juega
  end if;
  v_j := _sala_jugador(p_jugador, p_token);
  if v_j.sala_id <> p_sala then raise exception 'Jugador no válido'; end if;
  return v_j.id;
end $$;

-- Lo mismo que sala_estado, más el orden de los turnos y las jugadas nuevas (desde p_desde)
create or replace function public.sala_turnos(p_sala uuid, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v salas_juego%rowtype; e jsonb;
begin
  e := sala_estado(p_sala);
  select * into v from salas_juego where id = p_sala;
  e := e || jsonb_build_object('modo', coalesce(v.contenido->>'modo', 'carrera'));
  if e->>'estado' = 'esperando' then return e || jsonb_build_object('orden', '[]'::jsonb, 'jugadas', '[]'::jsonb); end if;
  return e || jsonb_build_object(
    -- juegan los que entraron antes de empezar; los que llegan después solo miran
    'orden', (select coalesce(jsonb_agg(id order by unido_en), '[]'::jsonb) from sala_jugadores
              where sala_id = p_sala and (v.inicio is null or unido_en <= v.inicio)),
    'jugadas', (select coalesce(jsonb_agg(jsonb_build_object('n', n, 'jugador', jugador_id, 'accion', accion) order by n), '[]'::jsonb)
                from sala_jugadas where sala_id = p_sala and ronda = v.ronda and n > coalesce(p_desde, 0)));
end $$;

-- Una jugada. p_n debe ser la siguiente (si otro jugó antes, la app vuelve a sincronizarse).
-- p_puntajes: { "<id del jugador>": puntos } para el ranking si se acaba el tiempo.
create or replace function public.sala_jugar(p_sala uuid, p_n int, p_accion jsonb, p_puntajes jsonb default null,
  p_jugador uuid default null, p_token uuid default null, p_host uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v salas_juego%rowtype; v_actor uuid; v_ult int;
begin
  v_actor := _sala_actor(p_sala, p_jugador, p_token, p_host);
  select * into v from salas_juego where id = p_sala;
  if v.estado <> 'en_curso' then raise exception 'La partida no está en curso'; end if;
  if v.fin is not null and now() > v.fin + interval '3 seconds' then raise exception 'Se acabó el tiempo'; end if;
  if pg_column_size(p_accion) > 20000 then raise exception 'Jugada demasiado grande'; end if;
  select coalesce(max(n), 0) into v_ult from sala_jugadas where sala_id = p_sala and ronda = v.ronda;
  if p_n <> v_ult + 1 then raise exception 'desfase'; end if;
  insert into sala_jugadas (sala_id, ronda, n, jugador_id, accion) values (p_sala, v.ronda, p_n, v_actor, p_accion);
  if p_puntajes is not null and jsonb_typeof(p_puntajes) = 'object' then
    update sala_jugadores set puntaje = greatest(0, least((p_puntajes->>id::text)::numeric, 1000000))
    where sala_id = p_sala and p_puntajes ? id::text and (p_puntajes->>id::text) ~ '^-?[0-9]+(\.[0-9]+)?$';
  end if;
exception when unique_violation then raise exception 'desfase';
end $$;

-- La partida por turnos terminó (cualquier jugador de la sala o el anfitrión; se puede llamar varias veces)
create or replace function public.sala_fin_turnos(p_sala uuid, p_puntajes jsonb default null,
  p_jugador uuid default null, p_token uuid default null, p_host uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _sala_actor(p_sala, p_jugador, p_token, p_host);
  if (select estado from salas_juego where id = p_sala) <> 'en_curso' then return; end if;
  if p_puntajes is not null and jsonb_typeof(p_puntajes) = 'object' then
    update sala_jugadores set puntaje = greatest(0, least((p_puntajes->>id::text)::numeric, 1000000)), terminado = true, terminado_en = now()
    where sala_id = p_sala and p_puntajes ? id::text and (p_puntajes->>id::text) ~ '^-?[0-9]+(\.[0-9]+)?$';
  end if;
  update salas_juego set estado = 'finalizado', fin = least(coalesce(fin, now()), now()) where id = p_sala;
end $$;

revoke execute on function public._sala_actor(uuid, uuid, uuid, uuid) from public, anon, authenticated;
