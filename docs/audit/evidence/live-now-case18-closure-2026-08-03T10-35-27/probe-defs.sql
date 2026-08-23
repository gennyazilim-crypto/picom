select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       left(pg_get_functiondef(p.oid), 12000) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'list_publisher_live_now',
    'count_publisher_live_now',
    'count_publisher_live_now_by_category',
    'list_upcoming_publisher_schedules',
    'live_session_is_publisher_discovery_eligible',
    'user_can_broadcast_on_picom_live',
    'user_has_active_publisher_badge',
    'publisher_profile_is_active_account'
  )
order by 1;
