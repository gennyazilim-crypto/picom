-- Task 446: atomic listener presence and Radio Realtime publication.

create or replace function public.join_current_user_radio_listener(target_session_id uuid)
returns setof public.radio_listeners
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare current_user_id uuid := auth.uid(); target_session public.radio_sessions%rowtype; listener_row public.radio_listeners%rowtype;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into target_session from public.radio_sessions session where session.id=target_session_id;
  if target_session.id is null or target_session.status <> 'live' or not public.can_view_radio_session(target_session_id) then raise exception 'RADIO_SESSION_NOT_LIVE' using errcode='55000'; end if;
  if not public.can_manage_community_kind(target_session.community_id,'radio'::public.community_kind,'listenRadio') then raise exception 'RADIO_LISTEN_PERMISSION_DENIED' using errcode='42501'; end if;
  insert into public.radio_listeners(radio_session_id,user_id,last_heartbeat_at)
  values(target_session_id,current_user_id,now())
  on conflict(radio_session_id,user_id) where left_at is null
  do update set last_heartbeat_at=excluded.last_heartbeat_at
  returning * into listener_row;
  return next listener_row;
end
$$;

create or replace function public.leave_current_user_radio_listener(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare changed_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  update public.radio_listeners set left_at=now(),last_heartbeat_at=now()
  where radio_session_id=target_session_id and user_id=auth.uid() and left_at is null;
  get diagnostics changed_count=row_count;
  return changed_count > 0;
end
$$;

revoke all on function public.join_current_user_radio_listener(uuid) from public,anon;
revoke all on function public.leave_current_user_radio_listener(uuid) from public,anon;
grant execute on function public.join_current_user_radio_listener(uuid) to authenticated;
grant execute on function public.leave_current_user_radio_listener(uuid) to authenticated;

do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['radio_sessions','radio_listeners','radio_session_reactions','radio_program_schedules','radio_program_hosts','radio_session_hosts']
    loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end
$$;

comment on function public.join_current_user_radio_listener(uuid) is 'Idempotent self-listen transition for a visible live Radio session. Partial uniqueness prevents duplicate active listener rows.';
comment on function public.leave_current_user_radio_listener(uuid) is 'Idempotent self-leave transition; listener history remains private under RLS.';;
