-- Pre-migration publisher schema snapshot (safe metadata + counts only)
select 'publisher_tables' as section, c.relname as name, 'table' as kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'publisher_%'
order by 2;

select 'publisher_functions' as section, p.proname as name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like '%publisher%'
    or p.proname = 'start_community_live_screen_broadcast'
    or p.proname = 'authorize_live_broadcast_livekit'
    or p.proname = 'can_start_picom_live_stream'
    or p.proname = 'user_can_broadcast_on_picom_live'
  )
order by 2, 3;

select 'start_broadcast_overloads' as section,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'start_community_live_screen_broadcast';

select 'live_session_count' as section, count(*)::text as value
from public.community_live_screen_sessions;

select 'schema_migrations_tail' as section, version
from supabase_migrations.schema_migrations
order by version desc
limit 8;
