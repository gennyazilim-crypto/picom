-- Enable Realtime for safe device-session metadata so Account settings can refresh live.
alter table public.user_device_sessions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_device_sessions'
  ) then
    alter publication supabase_realtime add table public.user_device_sessions;
  end if;
exception
  when duplicate_object or undefined_object then null;
end $$;

comment on table public.user_device_sessions is 'Safe device metadata only. session_hash is a one-way hash of the JWT session_id; raw access/refresh tokens are never stored. Realtime updates power Account session list refresh.';
