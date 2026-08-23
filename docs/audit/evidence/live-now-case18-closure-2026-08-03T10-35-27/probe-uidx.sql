select indexname, indexdef from pg_indexes
where schemaname='public'
  and (indexname like '%badge%' or indexname like '%live_screen%active%' or tablename in ('publisher_badges','community_live_screen_sessions'))
order by 1;
select pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='user_has_active_publisher_badge';
