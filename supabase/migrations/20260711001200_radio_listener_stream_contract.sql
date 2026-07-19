alter table public.radio_sessions
  add column if not exists stream_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'radio_sessions_listener_safe_stream_url_check') then
    alter table public.radio_sessions
      add constraint radio_sessions_listener_safe_stream_url_check
      check (
        stream_url is null
        or (
          stream_url ~ '^https://'
          and position('?' in stream_url) = 0
          and position('#' in stream_url) = 0
          and position('@' in stream_url) = 0
        )
      );
  end if;
end
$$;

create or replace function public.heartbeat_current_user_radio_listener(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.radio_sessions session
    where session.id = target_session_id
      and session.status = 'live'
      and public.can_view_radio_session(session.id)
  ) then raise exception 'RADIO_SESSION_NOT_LIVE' using errcode = '55000'; end if;

  update public.radio_listeners listener
  set last_heartbeat_at = now()
  where listener.radio_session_id = target_session_id
    and listener.user_id = auth.uid()
    and listener.left_at is null;
  return found;
end;
$$;

create or replace function public.close_radio_listeners_on_terminal_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('ended', 'cancelled') and new.status is distinct from old.status then
    update public.radio_listeners listener
    set left_at = coalesce(listener.left_at, now()), last_heartbeat_at = now()
    where listener.radio_session_id = new.id and listener.left_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists radio_session_listener_cleanup on public.radio_sessions;
create trigger radio_session_listener_cleanup
after update of status on public.radio_sessions
for each row execute function public.close_radio_listeners_on_terminal_status();

drop trigger if exists radio_session_management_audit on public.radio_sessions;
create trigger radio_session_management_audit
after update of title, description, starts_at, scheduled_end_at, cover_storage_path, program_id, stream_url, status on public.radio_sessions
for each row execute function public.audit_radio_session_change();

revoke all on function public.heartbeat_current_user_radio_listener(uuid) from public, anon;
grant execute on function public.heartbeat_current_user_radio_listener(uuid) to authenticated;

comment on column public.radio_sessions.stream_url is 'Listener-safe HTTPS media endpoint only. Provider credentials and signed query tokens must not be stored here.';
comment on function public.heartbeat_current_user_radio_listener(uuid) is 'Refreshes only the authenticated listener active-row heartbeat for a visible live Radio session.';;
