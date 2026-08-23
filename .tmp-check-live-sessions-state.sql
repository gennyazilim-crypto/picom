select version from supabase_migrations.schema_migrations where version in ('20260803100000','20260803130000','20260803140000') order by version;

select to_regclass('public.community_live_screen_sessions') as community_live_screen_sessions;

select c.relkind::text as relkind,
       c.relrowsecurity as rls,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='community_live_screen_sessions';
