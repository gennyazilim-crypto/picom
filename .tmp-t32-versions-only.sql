select version
from supabase_migrations.schema_migrations
where version like '202608083%'
order by version;
