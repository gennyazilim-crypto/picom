select column_name
from information_schema.columns
where table_schema='public' and table_name='community_live_screen_sessions'
order by ordinal_position;

select version
from supabase_migrations.schema_migrations
where version like '20260803%'
order by version;
