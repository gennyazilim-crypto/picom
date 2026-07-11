-- Task 537: privileged waiting-room workflow with RLS-safe Realtime projections.
begin;

alter table public.meeting_waiting_entries
  add column if not exists request_message text not null default '',
  add column if not exists invite_id uuid references public.meeting_invites(id) on delete set null,
  add column if not exists invited_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists decision_note text,
  add column if not exists decision_metadata jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz not null default (now()+interval '15 minutes'),
  add column if not exists cancelled_at timestamptz,
  add column if not exists host_notified_at timestamptz;

alter table public.meeting_waiting_entries drop constraint if exists meeting_waiting_entry_metadata_check;
alter table public.meeting_waiting_entries add constraint meeting_waiting_entry_metadata_check check (
  char_length(request_message)<=280
  and (decision_note is null or char_length(decision_note)<=500)
  and jsonb_typeof(decision_metadata)='object'
  and not decision_metadata ?| array['secret','token','access_token','refresh_token','authorization','raw_payload']
  and expires_at>requested_at
);

create index if not exists idx_meeting_waiting_expiry on public.meeting_waiting_entries(status,expires_at) where status='waiting';
create index if not exists idx_meeting_waiting_session_status on public.meeting_waiting_entries(session_id,status,requested_at) where session_id is not null;
alter table public.meeting_waiting_entries replica identity full;

create or replace function public.can_manage_meeting_waiting(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; actor_role text;
begin
  if auth.uid() is null then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null or public.meeting_user_is_restricted(target_room_id,auth.uid()) then return false; end if;
  actor_role:=public.meeting_role_for_user(target_room_id,auth.uid());
  return actor_role in ('host','cohost')
    or public.effective_community_permission(target_room.community_id,'admitGuests',null,null)
    or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null);
end;
$$;

create or replace function public.meeting_waiting_entry_projection(target_entry public.meeting_waiting_entries)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'id',target_entry.id,'roomId',target_entry.room_id,'sessionId',target_entry.session_id,'userId',target_entry.user_id,
    'displayName',target_entry.display_name,'requestedRole',target_entry.requested_role,'status',target_entry.status,
    'requestMessage',target_entry.request_message,'inviteId',target_entry.invite_id,'invitedByUserId',target_entry.invited_by_user_id,
    'requestedAt',target_entry.requested_at,'expiresAt',target_entry.expires_at,'resolvedAt',target_entry.resolved_at,
    'resolvedByUserId',target_entry.resolved_by_user_id,'denialReasonCode',target_entry.denial_reason_code,
    'decisionNote',target_entry.decision_note,'decisionMetadata',target_entry.decision_metadata,
    'cancelledAt',target_entry.cancelled_at,'hostNotifiedAt',target_entry.host_notified_at,'updatedAt',target_entry.updated_at
  );
$$;

create or replace function public.notify_meeting_waiting_hosts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; recipient_id uuid;
begin
  if new.status<>'waiting' then return new; end if;
  select * into target_room from public.meeting_rooms where id=new.room_id;
  select * into target_community from public.communities where id=target_room.community_id;
  for recipient_id in select distinct candidate from unnest(array_append(coalesce(target_room.cohost_user_ids,'{}'::uuid[]),target_room.host_user_id)) candidate where candidate<>new.user_id and exists(select 1 from public.profiles where id=candidate)
  loop
    insert into public.notifications(recipient_id,actor_id,category,title,preview,context_kind,context_label,community_id,channel_id,user_id,source_event_id)
    values(recipient_id,new.user_id,'event','Meeting join request',left(new.display_name||' is waiting to join.',500),'community',coalesce(target_community.name,'Meeting'),target_room.community_id,target_room.channel_id,new.user_id,'meeting-waiting-request:'||new.id::text||':'||recipient_id::text)
    on conflict(recipient_id,source_event_id) where source_event_id is not null do nothing;
  end loop;
  update public.meeting_waiting_entries set host_notified_at=coalesce(host_notified_at,now()),updated_at=now() where id=new.id;
  return new;
end;
$$;

create or replace function public.notify_meeting_waiting_resolution()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; notification_title text; notification_preview text;
begin
  if new.status is not distinct from old.status or new.status='waiting' then return new; end if;
  select * into target_room from public.meeting_rooms where id=new.room_id;
  select * into target_community from public.communities where id=target_room.community_id;
  notification_title:=case new.status when 'admitted' then 'You can join the meeting' when 'denied' then 'Meeting join request denied' when 'expired' then 'Meeting join request expired' else 'Meeting join request cancelled' end;
  notification_preview:=case new.status when 'admitted' then 'The host admitted you. Reconnect to enter the meeting.' when 'denied' then 'The host did not admit this request.' when 'expired' then 'The waiting request is no longer active.' else 'The waiting request was cancelled.' end;
  insert into public.notifications(recipient_id,actor_id,category,title,preview,context_kind,context_label,community_id,channel_id,source_event_id)
  values(new.user_id,new.resolved_by_user_id,'event',notification_title,left(notification_preview,500),'community',coalesce(target_community.name,'Meeting'),target_room.community_id,target_room.channel_id,'meeting-waiting-result:'||new.id::text||':'||new.status)
  on conflict(recipient_id,source_event_id) where source_event_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.record_meeting_waiting_transition()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_session_id uuid; next_sequence bigint:=0; actor_id uuid;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select * into target_room from public.meeting_rooms where id=new.room_id;
  target_session_id:=new.session_id;
  if target_session_id is null then select id into target_session_id from public.meeting_sessions where room_id=new.room_id and status in ('preparing','live','reconnecting') order by created_at desc limit 1; end if;
  actor_id:=coalesce(new.resolved_by_user_id,case when tg_op='INSERT' then new.user_id else null end);
  if target_session_id is not null then update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=target_session_id returning last_event_sequence into next_sequence; end if;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
  values(new.room_id,target_session_id,actor_id,'waiting_room_changed','backend','waiting-transition:'||new.id::text||':'||new.status,next_sequence,jsonb_build_object('entryId',new.id,'status',new.status,'denialReasonCode',new.denial_reason_code),coalesce(new.resolved_at,new.requested_at,now()))
  on conflict(event_source,idempotency_key) do nothing;
  if tg_op='UPDATE' and new.status is distinct from old.status and new.status<>'waiting' then
    insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
    values(target_room.community_id,new.resolved_by_user_id,'moderation_action','meeting_waiting_entry',new.id,'Waiting request changed from '||old.status||' to '||new.status,new.room_id,target_session_id);
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_waiting_notify_hosts on public.meeting_waiting_entries;
create trigger meeting_waiting_notify_hosts after insert on public.meeting_waiting_entries for each row execute function public.notify_meeting_waiting_hosts();
drop trigger if exists meeting_waiting_notify_resolution on public.meeting_waiting_entries;
create trigger meeting_waiting_notify_resolution after update of status on public.meeting_waiting_entries for each row execute function public.notify_meeting_waiting_resolution();
drop trigger if exists meeting_waiting_record_transition on public.meeting_waiting_entries;
create trigger meeting_waiting_record_transition after insert or update of status on public.meeting_waiting_entries for each row execute function public.record_meeting_waiting_transition();

create or replace function public.expire_meeting_waiting_entries(target_room_id uuid default null)
returns integer language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare item record; next_status text; next_reason text; affected integer:=0; host_available boolean;
begin
  if auth.uid() is null and coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  for item in
    select entry.*,room.status room_status from public.meeting_waiting_entries entry join public.meeting_rooms room on room.id=entry.room_id
    where entry.status='waiting' and (target_room_id is null or entry.room_id=target_room_id) for update of entry
  loop
    next_status:=null; next_reason:=null;
    if item.room_status='locked' then next_status:='denied';next_reason:='room_locked';
    elsif item.room_status in ('ended','cancelled') or item.expires_at<=now() then next_status:='expired';next_reason:='policy';
    elsif item.session_id is not null and item.requested_at<=now()-interval '2 minutes' then
      select exists(select 1 from public.meeting_session_participants participant where participant.session_id=item.session_id and participant.role in ('host','cohost') and participant.state in ('joining','connected','reconnecting')) into host_available;
      if not host_available then next_status:='denied';next_reason:='host_denied'; end if;
    end if;
    if next_status is not null then
      update public.meeting_waiting_entries set status=next_status,denial_reason_code=next_reason,resolved_at=now(),resolved_by_user_id=null,decision_note=case when next_status='expired' then 'Request expired automatically.' when next_reason='room_locked' then 'Room locked before admission.' else 'No host remained available.' end,decision_metadata=jsonb_build_object('source','system','reason',next_reason),updated_at=now() where id=item.id;
      affected:=affected+1;
    end if;
  end loop;
  return affected;
end;
$$;

create or replace function public.request_meeting_waiting_admission(target_room_id uuid,target_session_id uuid,target_request_message text default '',target_idempotency_key text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_session public.meeting_sessions%rowtype; profile_record public.profiles%rowtype; existing_entry public.meeting_waiting_entries%rowtype; created_entry public.meeting_waiting_entries%rowtype; invite_record public.meeting_invites%rowtype; expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  perform public.consume_meeting_request_limit('meeting_join_preview');
  if target_idempotency_key is null or char_length(target_idempotency_key) not between 8 and 160 or target_idempotency_key!~'^[A-Za-z0-9._:-]+$' then raise exception 'MEETING_WAITING_IDEMPOTENCY_INVALID' using errcode='22023'; end if;
  if char_length(coalesce(target_request_message,''))>280 then raise exception 'MEETING_WAITING_MESSAGE_INVALID' using errcode='22023'; end if;
  perform public.expire_meeting_waiting_entries(target_room_id);
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  select * into target_session from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in ('preparing','live','reconnecting');
  if target_room.id is null or target_session.id is null or target_room.status not in ('open','live') then raise exception 'MEETING_WAITING_ROOM_UNAVAILABLE' using errcode='42501'; end if;
  if public.meeting_user_is_restricted(target_room_id,auth.uid()) or not public.can_join_meeting_room(target_room_id) then raise exception 'MEETING_WAITING_FORBIDDEN' using errcode='42501'; end if;
  if public.can_manage_meeting_waiting(target_room_id) then return jsonb_build_object('disposition','direct','entry',null); end if;
  if public.meeting_join_disposition(target_room_id)<>'waiting' then return jsonb_build_object('disposition','direct','entry',null); end if;
  select * into profile_record from public.profiles where id=auth.uid();
  select * into existing_entry from public.meeting_waiting_entries where room_id=target_room_id and user_id=auth.uid() and (session_id=target_session_id or session_id is null) and status in ('waiting','admitted') order by requested_at desc limit 1 for update;
  if existing_entry.id is not null then return jsonb_build_object('disposition',case when existing_entry.status='admitted' then 'admitted' else 'waiting' end,'entry',public.meeting_waiting_entry_projection(existing_entry)); end if;
  if exists(select 1 from public.meeting_waiting_entries where room_id=target_room_id and user_id=auth.uid() and status='denied' and resolved_at>now()-interval '5 minutes') then raise exception 'MEETING_WAITING_RETRY_COOLDOWN' using errcode='42501'; end if;
  select invite.* into invite_record from public.meeting_invites invite where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,auth.uid()) order by invite.created_at desc limit 1;
  expiry:=greatest(now()+interval '1 minute',least(now()+interval '15 minutes',coalesce(target_room.scheduled_end_at,now()+interval '15 minutes')));
  insert into public.meeting_waiting_entries(room_id,session_id,user_id,display_name,requested_role,status,idempotency_key,request_message,invite_id,invited_by_user_id,requested_at,expires_at)
  values(target_room_id,target_session_id,auth.uid(),left(coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom participant'),120),public.meeting_role_for_user(target_room_id,auth.uid()),'waiting',target_idempotency_key,btrim(coalesce(target_request_message,'')),invite_record.id,invite_record.invited_by_user_id,now(),expiry)
  on conflict(room_id,idempotency_key) do update set updated_at=now() where meeting_waiting_entries.user_id=auth.uid()
  returning * into created_entry;
  if created_entry.id is null then select * into created_entry from public.meeting_waiting_entries where room_id=target_room_id and idempotency_key=target_idempotency_key and user_id=auth.uid(); end if;
  if created_entry.id is null then raise exception 'MEETING_WAITING_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  return jsonb_build_object('disposition','waiting','entry',public.meeting_waiting_entry_projection(created_entry));
end;
$$;

create or replace function public.apply_meeting_waiting_decision(target_entry_id uuid,target_decision text,target_decision_note text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_entry public.meeting_waiting_entries%rowtype; target_room public.meeting_rooms%rowtype;
begin
  if target_decision not in ('admit','deny') or char_length(coalesce(target_decision_note,''))>500 then raise exception 'MEETING_WAITING_DECISION_INVALID' using errcode='22023'; end if;
  select * into target_entry from public.meeting_waiting_entries where id=target_entry_id for update;
  if target_entry.id is null then raise exception 'MEETING_WAITING_ENTRY_NOT_FOUND' using errcode='22023'; end if;
  if not public.can_manage_meeting_waiting(target_entry.room_id) or target_entry.user_id=auth.uid() then raise exception 'MEETING_WAITING_SELF_ESCALATION_FORBIDDEN' using errcode='42501'; end if;
  if target_entry.status<>'waiting' then return public.meeting_waiting_entry_projection(target_entry); end if;
  select * into target_room from public.meeting_rooms where id=target_entry.room_id;
  if target_decision='admit' and (target_room.status not in ('open','live') or public.meeting_user_is_restricted(target_entry.room_id,target_entry.user_id)) then raise exception 'MEETING_WAITING_ADMISSION_FORBIDDEN' using errcode='42501'; end if;
  update public.meeting_waiting_entries set status=case when target_decision='admit' then 'admitted' else 'denied' end,resolved_at=now(),resolved_by_user_id=auth.uid(),denial_reason_code=case when target_decision='deny' then 'host_denied' else null end,decision_note=nullif(btrim(coalesce(target_decision_note,'')),''),decision_metadata=jsonb_build_object('source','host','actorRole',public.meeting_role_for_user(target_entry.room_id,auth.uid())) ,updated_at=now() where id=target_entry.id returning * into target_entry;
  return public.meeting_waiting_entry_projection(target_entry);
end;
$$;

create or replace function public.resolve_meeting_waiting_entry(target_entry_id uuid,target_decision text,target_decision_note text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin perform public.consume_meeting_request_limit('meeting_invite_write'); return public.apply_meeting_waiting_decision(target_entry_id,target_decision,target_decision_note); end;
$$;

create or replace function public.resolve_all_meeting_waiting(target_room_id uuid,target_decision text,target_decision_note text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare item record; results jsonb:='[]'::jsonb; affected integer:=0;
begin
  perform public.consume_meeting_request_limit('meeting_invite_write');
  if not public.can_manage_meeting_waiting(target_room_id) then raise exception 'MEETING_WAITING_MANAGE_FORBIDDEN' using errcode='42501'; end if;
  perform public.expire_meeting_waiting_entries(target_room_id);
  for item in select id from public.meeting_waiting_entries where room_id=target_room_id and status='waiting' order by requested_at for update
  loop results:=results||jsonb_build_array(public.apply_meeting_waiting_decision(item.id,target_decision,target_decision_note));affected:=affected+1; end loop;
  return jsonb_build_object('affected',affected,'entries',results);
end;
$$;

create or replace function public.cancel_meeting_waiting_request(target_entry_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_entry public.meeting_waiting_entries%rowtype;
begin
  perform public.consume_meeting_request_limit('meeting_join_preview');
  select * into target_entry from public.meeting_waiting_entries where id=target_entry_id for update;
  if target_entry.id is null or target_entry.user_id<>auth.uid() then raise exception 'MEETING_WAITING_CANCEL_FORBIDDEN' using errcode='42501'; end if;
  if target_entry.status='waiting' then update public.meeting_waiting_entries set status='cancelled',cancelled_at=now(),resolved_at=now(),resolved_by_user_id=auth.uid(),decision_note='Cancelled by requester.',decision_metadata=jsonb_build_object('source','requester'),updated_at=now() where id=target_entry.id returning * into target_entry; end if;
  return public.meeting_waiting_entry_projection(target_entry);
end;
$$;

create or replace function public.list_meeting_waiting_entries(target_room_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.can_manage_meeting_waiting(target_room_id) then raise exception 'MEETING_WAITING_LIST_FORBIDDEN' using errcode='42501'; end if;
  perform public.expire_meeting_waiting_entries(target_room_id);
  return coalesce((select jsonb_agg(public.meeting_waiting_entry_projection(entry) order by case entry.status when 'waiting' then 0 else 1 end,entry.requested_at) from public.meeting_waiting_entries entry where entry.room_id=target_room_id and entry.status in ('waiting','admitted','denied','expired','cancelled') and entry.requested_at>now()-interval '24 hours'),'[]'::jsonb);
end;
$$;

create or replace function public.get_my_meeting_waiting_entry(target_room_id uuid,target_session_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_entry public.meeting_waiting_entries%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  perform public.expire_meeting_waiting_entries(target_room_id);
  select * into target_entry from public.meeting_waiting_entries where room_id=target_room_id and user_id=auth.uid() and (target_session_id is null or session_id=target_session_id) order by requested_at desc limit 1;
  return case when target_entry.id is null then null else public.meeting_waiting_entry_projection(target_entry) end;
end;
$$;

drop policy if exists meeting_waiting_select_self_or_manager on public.meeting_waiting_entries;
create policy meeting_waiting_select_self_or_manager on public.meeting_waiting_entries for select to authenticated using(user_id=auth.uid() or public.can_manage_meeting_waiting(room_id));
drop policy if exists meeting_waiting_insert_self on public.meeting_waiting_entries;
drop policy if exists meeting_waiting_update_manager on public.meeting_waiting_entries;
drop policy if exists meeting_waiting_delete_self_or_manager on public.meeting_waiting_entries;
revoke insert,update,delete on public.meeting_waiting_entries from authenticated;
grant select on public.meeting_waiting_entries to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='meeting_waiting_entries') then alter publication supabase_realtime add table public.meeting_waiting_entries; end if;
end $$;

revoke all on function public.can_manage_meeting_waiting(uuid),public.meeting_waiting_entry_projection(public.meeting_waiting_entries),public.notify_meeting_waiting_hosts(),public.notify_meeting_waiting_resolution(),public.record_meeting_waiting_transition(),public.apply_meeting_waiting_decision(uuid,text,text) from public,anon,authenticated;
revoke all on function public.expire_meeting_waiting_entries(uuid),public.request_meeting_waiting_admission(uuid,uuid,text,text),public.resolve_meeting_waiting_entry(uuid,text,text),public.resolve_all_meeting_waiting(uuid,text,text),public.cancel_meeting_waiting_request(uuid),public.list_meeting_waiting_entries(uuid),public.get_my_meeting_waiting_entry(uuid,uuid) from public,anon;
grant execute on function public.expire_meeting_waiting_entries(uuid),public.request_meeting_waiting_admission(uuid,uuid,text,text),public.resolve_meeting_waiting_entry(uuid,text,text),public.resolve_all_meeting_waiting(uuid,text,text),public.cancel_meeting_waiting_request(uuid),public.list_meeting_waiting_entries(uuid),public.get_my_meeting_waiting_entry(uuid,uuid) to authenticated;

comment on table public.meeting_waiting_entries is 'Private waiting/admission state. Requesters see only self; authorized hosts/cohosts see their room through RLS and RPCs.';
commit;
