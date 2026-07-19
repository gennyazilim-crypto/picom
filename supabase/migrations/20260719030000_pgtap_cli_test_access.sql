-- Allow Supabase CLI's dedicated database-test role to resolve pgTAP helpers.
-- No renderer/API role receives additional access from this migration.
create extension if not exists pgtap with schema extensions;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cli_login_postgres') then
    grant usage on schema extensions to cli_login_postgres;
  end if;
end;
$$;
