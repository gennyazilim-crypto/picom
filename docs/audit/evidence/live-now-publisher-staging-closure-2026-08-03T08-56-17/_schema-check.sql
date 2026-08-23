select version, version as applied_marker
from supabase_migrations.schema_migrations
where version in ('20260803130000','20260803140000','20260803141000','20260803150000')
order by 1;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'list_publisher_live_now','count_publisher_live_now','count_publisher_live_now_by_category',
    'list_upcoming_publisher_schedules','live_session_is_publisher_discovery_eligible',
    'get_own_publisher_program_state','largest_owned_active_community_stats',
    'user_can_broadcast_on_picom_live','get_publisher_application_eligibility'
  )
order by 1,2;

select c.relname, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('publisher_profiles','publisher_badges','publisher_applications','publisher_stream_schedules','community_live_screen_sessions')
order by 1;
