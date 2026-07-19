-- Supabase API roles need PostgreSQL privileges in addition to RLS policies.
-- Keep anonymous/authenticated access limited to tables that already have RLS
-- enabled; RLS remains the authoritative row-level access boundary.

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all routines in schema public to service_role;
do $$
declare
  target_table record;
begin
  for target_table in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  loop
    execute format(
      'grant select on table %I.%I to anon',
      target_table.schema_name,
      target_table.table_name
    );
    execute format(
      'grant select, insert, update, delete on table %I.%I to authenticated',
      target_table.schema_name,
      target_table.table_name
    );
  end loop;
end
$$;
-- Future migrations must enable RLS before granting anon/authenticated table
-- privileges. Service-role defaults are safe because that role is server-only.
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on routines to service_role;
