select tgname, relname, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and c.relname in ('publisher_profiles','publisher_badges','publisher_applications','community_live_screen_sessions')
  and not t.tgisinternal
order by 2,1;

select indexname, indexdef from pg_indexes
where schemaname='public' and indexname = 'publisher_badges_one_active_uidx';
