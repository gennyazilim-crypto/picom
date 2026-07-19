begin;
create or replace function public.regenerate_meeting_invite(
  target_invite_id uuid,target_token_hash text,target_token_hint text,target_role text default 'participant',
  target_invited_user_id uuid default null,target_session_id uuid default null,target_expires_at timestamptz default null,target_max_uses integer default 1
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare previous_invite public.meeting_invites%rowtype; replacement jsonb;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into previous_invite from public.meeting_invites where id=target_invite_id for update;
  if previous_invite.id is null or previous_invite.revoked_at is not null then raise exception 'MEETING_INVITE_NOT_FOUND' using errcode='22023'; end if;
  if not (public.meeting_role_for_user(previous_invite.room_id,auth.uid()) in ('host','cohost') or exists(select 1 from public.meeting_rooms room where room.id=previous_invite.room_id and public.effective_community_permission(room.community_id,'manageMeeting',null,null))) then raise exception 'MEETING_INVITE_FORBIDDEN' using errcode='42501'; end if;
  update public.meeting_invites set status='revoked',revoked_at=now(),updated_at=now() where id=previous_invite.id;
  replacement:=public.create_meeting_invite(previous_invite.room_id,target_token_hash,target_token_hint,target_role,target_invited_user_id,target_session_id,target_expires_at,target_max_uses);
  return replacement;
end;
$$;
create or replace function public.get_meeting_join_preview(target_room_id uuid,target_token_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; invite_result jsonb:=jsonb_build_object('valid',false); invite_valid boolean:=false; base_join boolean:=false; can_join boolean:=false; disposition text:='denied'; reason text:='policy'; member_access boolean:=false; restricted boolean:=false; host_name text; active_session_id uuid;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if target_token_hash is null then perform public.consume_meeting_request_limit('meeting_join_preview'); end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then return jsonb_build_object('roomId',target_room_id,'canJoin',false,'reason','not_available'); end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  select profile.display_name into host_name from public.profiles profile where profile.id=target_room.host_user_id;
  select session.id into active_session_id from public.meeting_sessions session where session.room_id=target_room.id and session.status in('preparing','live','reconnecting') order by session.created_at desc limit 1;
  member_access:=public.is_community_member(target_room.community_id);
  restricted:=public.meeting_user_is_restricted(target_room_id,auth.uid());
  if target_token_hash is not null then invite_result:=public.validate_meeting_invite(target_token_hash,target_room_id,false); invite_valid:=coalesce((invite_result->>'valid')::boolean,false); end if;
  if target_community.id is null or (target_community.visibility='private' and not member_access and not invite_valid) then return jsonb_build_object('roomId',target_room_id,'canJoin',false,'reason','not_available'); end if;
  base_join:=public.can_join_meeting_room(target_room_id);
  can_join:=target_room.status in ('open','live') and not restricted and (base_join or invite_valid);
  if can_join then disposition:=case when target_room.waiting_room_enabled or target_room.join_policy='approval_required' then 'waiting' else 'direct' end; reason:='allowed';
  elsif restricted then reason:='blocked';
  elsif target_room.status='scheduled' then reason:='not_started';
  elsif target_room.status in ('ended','cancelled') then reason:='ended';
  elsif target_room.status='locked' then reason:='locked';
  elsif target_token_hash is not null and not invite_valid then reason:=coalesce(invite_result->>'code','invite_invalid');
  elsif target_room.join_policy='invite_only' then reason:='invite_required';
  elsif target_room.join_policy='members' and not member_access then reason:='membership_required';
  else reason:='policy'; end if;
  return jsonb_build_object('roomId',target_room.id,'sessionId',active_session_id,'communityId',target_community.id,'communityName',target_community.name,'roomTitle',target_room.title,'hostName',coalesce(host_name,'Meeting host'),'mode',target_room.mode,'status',target_room.status,'joinPolicy',target_room.join_policy,'waitingRoomEnabled',target_room.waiting_room_enabled,'capabilities',target_room.capabilities,'scheduledFor',target_room.scheduled_for,'scheduledEndAt',target_room.scheduled_end_at,'canJoin',can_join,'disposition',disposition,'reason',reason,'invite',invite_result-'inviteId');
end;
$$;
revoke all on function public.regenerate_meeting_invite(uuid,text,text,text,uuid,uuid,timestamptz,integer) from public,anon;
grant execute on function public.regenerate_meeting_invite(uuid,text,text,text,uuid,uuid,timestamptz,integer) to authenticated;
comment on function public.regenerate_meeting_invite(uuid,text,text,text,uuid,uuid,timestamptz,integer) is 'Atomically revokes an existing invite and returns replacement metadata. Raw invite secrets are never accepted or stored.';
comment on function public.get_meeting_join_preview(uuid,text) is 'Returns privacy-safe meeting, host, schedule, capability and admission data without invite hashes or raw secrets.';
commit;
