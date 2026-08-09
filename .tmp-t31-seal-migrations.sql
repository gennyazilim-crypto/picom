insert into supabase_migrations.schema_migrations (version)
values
  ('20260808300000'),
  ('20260808310000'),
  ('20260808320000'),
  ('20260808330000')
on conflict do nothing;

select version
from supabase_migrations.schema_migrations
where version like '202608083%'
order by version;
