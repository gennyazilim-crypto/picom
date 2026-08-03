-- Fix Go Live start: community_live_screen_sessions.metadata referenced by
-- start_community_live_screen_broadcast but missing from base table.

begin;

alter table public.community_live_screen_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_live_screen_sessions_metadata_object_check'
  ) then
    alter table public.community_live_screen_sessions
      add constraint community_live_screen_sessions_metadata_object_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;

comment on column public.community_live_screen_sessions.metadata is
  'Opaque Go Live metadata (schedule linkage, client hints). Object-only JSON.';

commit;
