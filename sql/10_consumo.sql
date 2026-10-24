-- =====================================================================
-- PASO 10 — CONSUMO DE SUPABASE (visor del panel, solo admin)
-- Lo que se puede medir desde la base: tamaño de la base de datos, Storage, usuarios activos del mes
-- y las sesiones en vivo abiertas (son las que consultan al servidor cada pocos segundos).
-- La transferencia (egress) y los mensajes de Realtime solo se ven en el panel de Supabase → Usage.
-- Ejecutar DESPUÉS de 09 y ANTES de 06_permisos.sql. Se puede ejecutar varias veces.
-- =====================================================================

create or replace function public.consumo_supabase() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador puede ver el consumo.'; end if;
  return jsonb_build_object(
    'ahora', now(),
    'db_bytes', pg_database_size(current_database()),
    -- las tablas más grandes (datos + índices)
    'tablas', (select coalesce(jsonb_agg(t order by (t->>'bytes')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object('tabla', c.relname, 'bytes', pg_total_relation_size(c.oid), 'filas', greatest(c.reltuples, 0)::bigint) t
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 10) x),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'storage_archivos', (select count(*) from storage.objects),
    'buckets', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', b, 'archivos', n) order by b desc), '[]'::jsonb) from (
        select bucket_id, coalesce(sum((metadata->>'size')::bigint), 0) b, count(*) n from storage.objects group by bucket_id) x),
    'usuarios', (select count(*) from auth.users),
    'usuarios_mes', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'por_rol', (select coalesce(jsonb_object_agg(rol, n), '{}'::jsonb) from (select rol, count(*) n from perfiles group by rol) x),
    -- sesiones abiertas: quiz en vivo, salas de juego y proyectos en vivo (con su última actividad)
    'vivo_quiz', (select count(*) from sesiones_vivo where estado <> 'finalizado'),
    'vivo_salas', (select count(*) from salas_juego where estado <> 'finalizado'),
    'vivo_proyectos', (select count(*) from proyecto_sesiones where estado <> 'finalizada'),
    'proyectos_participantes', (select count(*) from sesion_participantes pp join proyecto_sesiones s on s.id = pp.sesion_id where s.estado <> 'finalizada')
  );
end $$;

revoke all on function public.consumo_supabase() from public, anon;
grant execute on function public.consumo_supabase() to authenticated;
