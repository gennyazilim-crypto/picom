-- Task 570: production meeting abuse prevention and server-authoritative reactions.
-- Counters and logs contain no media, message body, invite secret, provider identity, or credential.
begin;

alter table public.user_action_rate_limits drop constraint if exists user_action_rate_limits_action_key_check;
alter table public.user_action_rate_limits add constraint user_action_rate_limits_action_key_check check(action_key in(
  'message_send','attachment_metadata','reaction_write','relationship_write','feed_interaction','livekit_token',
  'meeting_schedule_write','meeting_invite_write','meeting_join_preview','meeting_signal_write',
  'meeting_waiting_request','meeting_chat_send','meeting_reaction','meeting_privileged_action'
));

create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean,retry_after_seconds integer)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare current_user_id uuid:=auth.uid();configured_maximum_requests integer;configured_window_seconds integer;current_row public.user_action_rate_limits%rowtype;current_time timestamptz:=clock_timestamp();
begin
  if current_user_id is null then return query select false,60;return;end if;
  select configured.maximum_requests,configured.window_seconds into configured_maximum_requests,configured_window_seconds
  from(values
    ('message_send',30,60),('attachment_metadata',20,300),('reaction_write',120,60),('relationship_write',30,60),('feed_interaction',120,60),
    ('livekit_token',10,60),('meeting_schedule_write',20,300),('meeting_invite_write',30,300),('meeting_join_preview',30,60),
    ('meeting_signal_write',12,60),('meeting_waiting_request',6,300),('meeting_chat_send',20,30),('meeting_reaction',8,3),('meeting_privileged_action',30,60)
  )configured(action_key,maximum_requests,window_seconds) where configured.action_key=target_action;
  if configured_maximum_requests is null then raise exception 'RATE_LIMIT_ACTION_INVALID';end if;
  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at)
  values(current_user_id,target_action,current_time,1,current_time)
  on conflict(user_id,action_key) do update set
    window_started_at=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then current_time else user_action_rate_limits.window_started_at end,
    request_count=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then 1 else user_action_rate_limits.request_count+1 end,
    updated_at=current_time returning * into current_row;
  if current_row.request_count>configured_maximum_requests then
    update public.user_action_rate_limits set denied_count=denied_count+1,last_denied_at=current_time,updated_at=current_time where user_id=current_user_id and action_key=target_action;
  end if;
  return query select current_row.request_count<=configured_maximum_requests,
    case when current_row.request_count<=configured_maximum_requests then 0 else greatest(1,ceil(extract(epoch from(current_row.window_started_at+make_interval(secs=>configured_window_seconds)-current_time)))::integer) end;
end;
$$;

create or replace function public.consume_meeting_request_limit(target_action text)
returns void language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare result_row record;
begin
  select * into result_row from public.consume_current_user_action_rate_limit(target_action);
  if not coalesce(result_row.is_allowed,false) then
    raise log 'PICOM_MEETING_ABUSE rate_limit_exceeded action=%',left(target_action,40);
    raise exception 'RATE_LIMITED' using errcode='P0001',detail='retry_after_seconds='||coalesce(result_row.retry_after_seconds,60)::text;
  end if;
end;
$$;

create table if not exists public.meeting_reaction_signals(
  id uuid primary key,
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in('thumbs_up','heart','celebrate','laugh','surprised','clap')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '5 seconds'),
  check(expires_at>=created_at and expires_at<=created_at+interval '10 seconds')
);
create index if not exists idx_meeting_reaction_signals_session_expiry on public.meeting_reaction_signals(session_id,expires_at desc);
alter table public.meeting_reaction_signals enable row level security;
revoke all on table public.meeting_reaction_signals from public,anon,authenticated;
grant select on table public.meeting_reaction_signals to authenticated;
drop policy if exists meeting_reaction_signals_participant_select on public.meeting_reaction_signals;
create policy meeting_reaction_signals_participant_select on public.meeting_reaction_signals for select to authenticated using(
  expires_at>now()-interval '30 seconds' and exists(
    select 1 from public.meeting_session_participants participant
    where participant.session_id=meeting_reaction_signals.session_id and participant.user_id=auth.uid() and participant.state in('joining','connected','reconnecting')
  )
);

create or replace function public.send_meeting_reaction(target_room_id uuid,target_session_id uuid,target_event_id uuid,target_kind text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid();room_record public.meeting_rooms%rowtype;session_record public.meeting_sessions%rowtype;signal_record public.meeting_reaction_signals%rowtype;
begin
  if actor_id is null then raise exception 'MEETING_ACTION_DENIED' using errcode='42501';end if;
  if target_event_id is null or target_kind not in('thumbs_up','heart','celebrate','laugh','surprised','clap') then raise exception 'MEETING_REACTION_INVALID' using errcode='22023';end if;
  perform public.consume_meeting_request_limit('meeting_reaction');
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in('preparing','live','reconnecting');
  if room_record.id is null or session_record.id is null or public.meeting_user_is_restricted(target_room_id,actor_id)
    or not public.meeting_capability_enabled(room_record.capabilities,'canReact',true)
    or not exists(select 1 from public.meeting_session_participants participant where participant.session_id=target_session_id and participant.user_id=actor_id and participant.state in('joining','connected','reconnecting'))
  then raise exception 'MEETING_ACTION_DENIED' using errcode='42501';end if;
  delete from public.meeting_reaction_signals where expires_at<now()-interval '1 minute';
  insert into public.meeting_reaction_signals(id,room_id,session_id,user_id,kind,created_at,expires_at)
  values(target_event_id,target_room_id,target_session_id,actor_id,target_kind,now(),now()+interval '5 seconds')
  on conflict(id) do nothing;
  select * into signal_record from public.meeting_reaction_signals where id=target_event_id and room_id=target_room_id and session_id=target_session_id and user_id=actor_id;
  if signal_record.id is null then raise exception 'MEETING_REACTION_CONFLICT' using errcode='23505';end if;
  return jsonb_build_object('schemaVersion',1,'eventId',signal_record.id,'roomId',signal_record.room_id,'sessionId',signal_record.session_id,'kind',signal_record.kind,'senderIdentity',signal_record.user_id,'sentAt',signal_record.created_at,'expiresAt',signal_record.expires_at);
end;
$$;

create or replace function public.enforce_meeting_waiting_abuse_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then return new;end if;
  if new.user_id<>auth.uid() or octet_length(coalesce(new.request_message,''))>1120 or public.meeting_user_is_restricted(new.room_id,auth.uid()) then raise exception 'MEETING_ACTION_DENIED' using errcode='42501';end if;
  perform public.consume_meeting_request_limit('meeting_waiting_request');
  return new;
end;
$$;
drop trigger if exists meeting_waiting_insert_abuse_guard on public.meeting_waiting_entries;
create trigger meeting_waiting_insert_abuse_guard before insert on public.meeting_waiting_entries for each row execute function public.enforce_meeting_waiting_abuse_guard();

create or replace function public.enforce_meeting_chat_abuse_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or exists(select 1 from public.meeting_chat_message_links link where link.message_id=new.message_id) then return new;end if;
  if new.linked_by_user_id<>auth.uid() or public.meeting_user_is_restricted(new.room_id,auth.uid()) or not public.can_access_meeting_chat(new.room_id,new.session_id,true) then raise exception 'MEETING_ACTION_DENIED' using errcode='42501';end if;
  perform public.consume_meeting_request_limit('meeting_chat_send');
  return new;
end;
$$;
drop trigger if exists meeting_chat_link_abuse_guard on public.meeting_chat_message_links;
create trigger meeting_chat_link_abuse_guard before insert on public.meeting_chat_message_links for each row execute function public.enforce_meeting_chat_abuse_guard();

create or replace function public.enforce_meeting_privileged_abuse_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or new.meeting_room_id is null then return new;end if;
  if new.action_type in('meeting_control','meeting_role','meeting_moderation','meeting_media','meeting_caption') or (new.action_type='moderation_action' and new.target_type='meeting_participant') then
    perform public.consume_meeting_request_limit('meeting_privileged_action');
  end if;
  return new;
end;
$$;
drop trigger if exists meeting_privileged_action_abuse_guard on public.audit_log;
create trigger meeting_privileged_action_abuse_guard before insert on public.audit_log for each row execute function public.enforce_meeting_privileged_abuse_guard();

do $$ begin
  alter publication supabase_realtime add table public.meeting_reaction_signals;
exception when duplicate_object then null; when undefined_object then null;
end $$;

revoke all on function public.send_meeting_reaction(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.send_meeting_reaction(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.enforce_meeting_waiting_abuse_guard(),public.enforce_meeting_chat_abuse_guard(),public.enforce_meeting_privileged_abuse_guard() from public,anon,authenticated;

comment on table public.meeting_reaction_signals is 'Short-lived server-authoritative meeting reactions. No custom payload, message text, provider identity, media, or credential is stored.';
comment on function public.consume_meeting_request_limit(text) is 'Raises a content-free server log marker and a generic rate-limit error; never logs room, user, invite, message, media, token, or provider data.';
commit;
