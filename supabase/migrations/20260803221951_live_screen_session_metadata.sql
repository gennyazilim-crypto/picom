-- Exact reconstruction of production hosted migration 20260803221951
-- Source: supabase_migrations.schema_migrations.statements on cqnsetsmcduraryemhbi (read-only)
-- Name: live_screen_session_metadata
-- History mutation: none. Hosted apply: none.

alter table public.community_live_screen_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'community_live_screen_sessions_metadata_object_check'
  ) then
    alter table public.community_live_screen_sessions
      add constraint community_live_screen_sessions_metadata_object_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;
