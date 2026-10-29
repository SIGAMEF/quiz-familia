-- =====================================================================
-- PASO 6 — PERMISOS de las tablas para la app
-- Los proyectos nuevos de Supabase ya no dan permisos automáticos a las
-- tablas creadas por SQL. Este script los da de forma explícita.
-- La seguridad fila por fila (RLS) sigue igual: cada usuario solo ve lo suyo.
-- Se puede ejecutar varias veces.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

-- service_role (uso interno de Supabase): todo
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Partimos de cero para anon y authenticated
revoke all on all tables in schema public from anon, authenticated;

-- ---------- Usuarios con sesión (authenticated) ----------
grant select on public.perfiles to authenticated;
grant update (nombre, avatar) on public.perfiles to authenticated;

grant select on public.profesores to authenticated;
grant update (institucion, curso) on public.profesores to authenticated;

grant select, insert, update, delete on public.periodos      to authenticated;  -- RLS: solo el admin modifica
grant select, insert, update, delete on public.grupos        to authenticated;
grant select, delete                  on public.alumno_grupos to authenticated;  -- altas y cambios por funciones
grant select, insert, update, delete on public.quizzes       to authenticated;
grant select, insert, update, delete on public.preguntas     to authenticated;
grant select, insert, update, delete on public.opciones      to authenticated;
grant select, insert, update, delete on public.publicaciones to authenticated;
grant delete                          on public.intentos      to authenticated;  -- se crean por funciones
-- intentos: se ven todas las columnas menos el token secreto de los invitados
grant select (id, publicacion_id, alumno_id, estado, preguntas_ids, puntaje, puntaje_max, iniciado_en, finalizado_en,
              alias, avatar, vivo_sesion_id) on public.intentos to authenticated;
grant select                          on public.respuestas    to authenticated;
grant select, insert, update, delete on public.sesiones_vivo  to authenticated;
grant select, insert, update, delete on public.vivo_preguntas to authenticated;
grant delete                          on public.vivo_participantes to authenticated;
grant select                          on public.vivo_respuestas to authenticated;
grant select, insert, update, delete on public.juegos         to authenticated;  -- RLS: cada profesor lo suyo; todos ven los públicos
grant select, update, delete         on public.juego_publicaciones to authenticated;  -- se crean con publicar_juego
grant select, delete                 on public.juego_resultados    to authenticated;  -- se crean con registrar_juego
grant select, delete                 on public.proyectos      to authenticated;  -- se crean, guardan y duplican con funciones (07)
grant select                         on public.proyecto_hojas to authenticated;  -- RLS: solo el dueño o el admin
grant select, insert, update, delete on public.canciones      to authenticated;  -- RLS: cada profesor lo suyo; se leen las compartidas de su institución (12)
grant select, insert, update, delete on public.plantillas_culto to authenticated;  -- RLS: cada profesor las suyas (12)

-- Participantes en vivo: todos ven el ranking, nadie ve el token
grant select (id, sesion_id, alumno_id, alias, avatar, estado, puntaje, tiempo_total_seg, iniciado_en, finalizado_en, created_at)
  on public.vivo_participantes to anon, authenticated;

-- ---------- Invitados sin cuenta (anon): solo lo necesario para el modo en vivo ----------
grant select on public.sesiones_vivo  to anon;
grant select on public.vivo_preguntas to anon;
grant select on public.juegos         to anon;   -- solo los públicos (RLS)

-- ---------- Funciones ----------
grant execute on all functions in schema public to anon, authenticated;
-- las internas (empiezan con _) no se pueden llamar desde la app, salvo dos utilitarias
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '\_%'
      and p.proname not in ('_generar_codigo', '_normalizar')   -- se usan en triggers y son inofensivas
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

-- Verificación: permisos efectivos de un usuario con sesión
select c.relname as tabla,
       has_table_privilege('authenticated', c.oid, 'select') as leer,
       has_table_privilege('authenticated', c.oid, 'insert') as crear,
       has_table_privilege('authenticated', c.oid, 'delete') as borrar
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
