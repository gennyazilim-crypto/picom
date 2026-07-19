-- Task 534: secure meeting schedules, invitations, redemption, and join previews.
-- Raw invite secrets are never persisted; only SHA-256 hashes and short hints are stored.
begin;
alter table public.meeting_rooms
  add column if not exists cohost_user_ids uuid[] not null default '{}'::uuid[],
  add column if not exists reminder_policy jsonb not null default '{"enabled":false,"minutesBefore":[15]}'::jsonb;
alter table public.meeting_rooms drop constraint if exists meeting_rooms_cohost_assignment_check;
alter table public.meeting_rooms add constraint meeting_rooms_cohost_assignment_check check (
  not (host_user_id = any(cohost_user_ids))
  and jsonb_typeof(reminder_policy) = 'object'
  and not reminder_policy ?| array['secret','token','access_token','refresh_token','provider_key']
);
alter table public.meeting_invites
  add column if not exists session_id uuid references public.meeting_sessions(id) on delete set null,
  add column if not exists token_hint text,
  add column if not exists max_uses integer not null default 1,
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists revoked_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.meeting_invites drop constraint if exists meeting_invites_usage_check;
alter table public.meeting_invites add constraint meeting_invites_usage_check check (
  max_uses between 1 and 100
  and use_count between 0 and max_uses
  and (token_hint is null or token_hint ~ '^[0-9a-f]{4,12}$')
);
create table if not exists public.meeting_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.meeting_invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique(invite_id,user_id)
);
create index if not exists idx_meeting_rooms_schedule on public.meeting_rooms(scheduled_for,status) where archived_at is null;
create index if not exists idx_meeting_rooms_cohosts on public.meeting_rooms using gin(cohost_user_ids);
create index if not exists idx_meeting_invites_room_status_expiry on public.meeting_invites(room_id,status,expires_at);
create index if not exists idx_meeting_invites_session on public.meeting_invites(session_id) where session_id is not null;
create index if not exists idx_meeting_invite_redemptions_user on public.meeting_invite_redemptions(user_id,invite_id);
alter table public.meeting_invite_redemptions enable row level security;
revoke all on table public.meeting_invites from anon,authenticated;
revoke all on table public.meeting_invite_redemptions from anon,authenticated;
alter table public.user_action_rate_limits drop constraint if exists user_action_rate_limits_action_key_check;
alter table public.user_action_rate_limits add constraint user_action_rate_limits_action_key_check check (action_key in (
  'message_send','attachment_metadata','reaction_write','relationship_write','feed_interaction','livekit_token',
  'meeting_schedule_write','meeting_invite_write','meeting_join_preview'
));
create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean,retry_after_seconds integer)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  current_user_id uuid:=auth.uid(); configured_maximum_requests integer; configured_window_seconds integer;
  current_row public.user_action_rate_limits%rowtype; current_time timestamptz:=clock_timestamp();
begin
  if current_user_id is null then return query select false,60; return; end if;
  select configured.maximum_requests,configured.window_seconds into configured_maximum_requests,configured_window_seconds
  from (values
    ('message_send',30,60),('attachment_metadata',20,300),('reaction_write',120,60),
    ('relationship_write',30,60),('feed_interaction',120,60),('livekit_token',10,60),
    ('meeting_schedule_write',20,300),('meeting_invite_write',30,300),('meeting_join_preview',60,60)
  ) as configured(action_key,maximum_requests,window_seconds) where configured.action_key=target_action;
  if configured_maximum_requests is null then raise exception 'RATE_LIMIT_ACTION_INVALID'; end if;
  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at)
  values(current_user_id,target_action,current_time,1,current_time)
  on conflict(user_id,action_key) do update set
    window_started_at=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then current_time else user_action_rate_limits.window_started_at end,
    request_count=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then 1 else user_action_rate_limits.request_count+1 end,
    updated_at=current_time returning * into current_row;
  if current_row.request_count>configured_maximum_requests then
    update public.user_action_rate_limits set denied_count=denied_count+1,last_denied_at=current_time,updated_at=current_time
    where user_id=current_user_id and action_key=target_action;
  end if;
  return query select current_row.request_count<=configured_maximum_requests,
    case when current_row.request_count<=configured_maximum_requests then 0 else greatest(1,ceil(extract(epoch from (current_row.window_started_at+make_interval(secs=>configured_window_seconds)-current_time)))::integer) end;
end;
$$;
create or replace function public.consume_meeting_request_limit(target_action text)
returns void language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare result_row record;
begin
  select * into result_row from public.consume_current_user_action_rate_limit(target_action);
  if not coalesce(result_row.is_allowed,false) then
    raise exception 'RATE_LIMITED' using errcode='P0001',detail='retry_after_seconds='||coalesce(result_row.retry_after_seconds,60)::text;
  end if;
end;
$$;
create or replace function public.meeting_invite_grants_user(target_invite_id uuid,target_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.meeting_invites invite
    where invite.id=target_invite_id
      and invite.status in ('active','accepted')
      and invite.revoked_at is null
      and (invite.expires_at is null or invite.expires_at>now())
      and (
        (invite.invited_user_id=target_user_id and invite.status='active' and invite.use_count<invite.max_uses)
        or exists(select 1 from public.meeting_invite_redemptions redemption where redemption.invite_id=invite.id and redemption.user_id=target_user_id)
      )
  );
$$;
create or replace function public.meeting_role_for_user(target_room_id uuid,target_user_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; system_role text; participant_role text; invite_role text;
begin
  if target_user_id is null then return 'guest'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then return 'guest'; end if;
  if target_room.host_user_id=target_user_id or exists(select 1 from public.communities where id=target_room.community_id and owner_id=target_user_id) then return 'host'; end if;
  if target_user_id=any(target_room.cohost_user_ids) then return 'cohost'; end if;
  select participant.role into participant_role from public.meeting_session_participants participant
  join public.meeting_sessions session on session.id=participant.session_id
  where session.room_id=target_room_id and participant.user_id=target_user_id and participant.state in ('joining','connected','reconnecting')
  order by public.meeting_role_rank(participant.role) desc,participant.created_at desc limit 1;
  if participant_role is not null then return participant_role; end if;
  select role.system_key into system_role from public.community_members member
  join public.roles role on role.community_id=member.community_id and (role.id=member.role_id or role.id in(select link.role_id from public.community_member_roles link where link.member_id=member.id))
  where member.community_id=target_room.community_id and member.user_id=target_user_id order by role.level desc limit 1;
  if system_role='admin' then return 'cohost'; end if;
  if system_role='moderator' then return 'speaker'; end if;
  select invite.role into invite_role from public.meeting_invites invite
  where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,target_user_id)
  order by public.meeting_role_rank(invite.role) desc,invite.created_at desc limit 1;
  if invite_role is not null then return invite_role; end if;
  if system_role is not null then return target_room.default_role; end if;
  return 'guest';
end;
$$;
create or replace function public.can_view_meeting_room(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; channel_private boolean:=false; invite_access boolean:=false;
begin
  if auth.uid() is null then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null or public.meeting_user_is_restricted(target_room_id,auth.uid()) then return false; end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_community.id is null then return false; end if;
  if target_room.channel_id is not null then select is_private into channel_private from public.channels where id=target_room.channel_id; end if;
  select exists(select 1 from public.meeting_invites invite where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,auth.uid())) into invite_access;
  if invite_access then return true; end if;
  if public.is_community_member(target_room.community_id) then
    return public.effective_community_permission(target_room.community_id,'joinMeeting','channel',target_room.channel_id)
      or public.effective_community_permission(target_room.community_id,'viewMeetingHistory',null,null)
      or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null);
  end if;
  return target_community.visibility='public' and target_community.public_read_enabled and target_room.join_policy='open' and not coalesce(channel_private,false);
end;
$$;
create or replace function public.can_join_meeting_room(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; channel_private boolean:=false; invite_access boolean:=false; member_access boolean:=false; manager_access boolean:=false;
begin
  if auth.uid() is null then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null or target_room.status not in ('open','live') or public.meeting_user_is_restricted(target_room_id,auth.uid()) then return false; end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_community.id is null then return false; end if;
  if target_room.channel_id is not null then select is_private into channel_private from public.channels where id=target_room.channel_id; end if;
  select exists(select 1 from public.meeting_invites invite where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,auth.uid())) into invite_access;
  manager_access:=public.is_community_member(target_room.community_id) and public.effective_community_permission(target_room.community_id,'manageMeeting',null,null);
  member_access:=public.is_community_member(target_room.community_id) and public.effective_community_permission(target_room.community_id,'joinMeeting','channel',target_room.channel_id);
  if manager_access or invite_access then return true; end if;
  if target_room.join_policy='invite_only' then return false; end if;
  if member_access then return true; end if;
  return target_room.join_policy='open' and target_community.visibility='public' and target_community.public_read_enabled and not coalesce(channel_private,false);
end;
$$;
create or replace function public.authorize_meeting_action(target_room_id uuid,target_action text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; actor_role text; member boolean; allowed boolean:=false; required_permission text; invite_access boolean:=false;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then raise exception 'MEETING_NOT_FOUND' using errcode='22023'; end if;
  actor_role:=public.meeting_role_for_user(target_room_id,auth.uid()); member:=public.is_community_member(target_room.community_id);
  select exists(select 1 from public.meeting_invites invite where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,auth.uid())) into invite_access;
  required_permission:=case target_action
    when 'create' then 'createMeeting' when 'manage' then 'manageMeeting' when 'join' then 'joinMeeting'
    when 'publish_audio' then 'publishAudio' when 'publish_video' then 'publishVideo' when 'share_screen' then 'shareScreen'
    when 'admit' then 'admitGuests' when 'manage_participants' then 'manageParticipants' when 'manage_stage' then 'manageStage'
    when 'view_history' then 'viewMeetingHistory' when 'enable_captions' then 'enableCaptions' else null end;
  if required_permission is null then raise exception 'MEETING_ACTION_INVALID' using errcode='22023'; end if;
  if target_action='join' then allowed:=public.can_join_meeting_room(target_room_id);
  elsif member then allowed:=public.effective_community_permission(target_room.community_id,required_permission,case when target_action in ('join','publish_audio','publish_video','share_screen') then 'channel' else null end,case when target_action in ('join','publish_audio','publish_video','share_screen') then target_room.channel_id else null end);
  elsif invite_access then allowed:=case target_action when 'publish_audio' then actor_role in ('host','cohost','speaker','participant') when 'publish_video' then actor_role in ('host','cohost','speaker','participant') when 'share_screen' then actor_role in ('host','cohost','speaker') else false end;
  end if;
  if not allowed or public.meeting_user_is_restricted(target_room_id,auth.uid()) then raise exception 'MEETING_ACTION_FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('roomId',target_room_id,'role',actor_role,'action',target_action,'authorized',true,'joinDisposition',case when target_action='join' then public.meeting_join_disposition(target_room_id) else null end);
end;
$$;
create or replace function public.schedule_meeting_room(
  target_room_id uuid,target_scheduled_for timestamptz,target_scheduled_end_at timestamptz,
  target_host_user_id uuid default null,target_cohost_user_ids uuid[] default '{}'::uuid[],
  target_event_id uuid default null,target_reminder_policy jsonb default '{"enabled":false,"minutesBefore":[15]}'::jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; linked_event public.community_events%rowtype; next_host uuid; normalized_cohosts uuid[]; limit_row record;
begin
  perform public.consume_meeting_request_limit('meeting_schedule_write');
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null for update;
  if target_room.id is null then raise exception 'MEETING_NOT_FOUND' using errcode='22023'; end if;
  perform public.authorize_meeting_action(target_room_id,'manage');
  if target_scheduled_for<now()-interval '5 minutes' or target_scheduled_end_at<=target_scheduled_for or target_scheduled_end_at>target_scheduled_for+interval '24 hours' then raise exception 'MEETING_SCHEDULE_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(target_reminder_policy)<>'object' or target_reminder_policy ?| array['secret','token','access_token','refresh_token','provider_key'] then raise exception 'MEETING_REMINDER_POLICY_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.meeting_sessions where room_id=target_room_id and status in ('preparing','live','reconnecting')) then raise exception 'MEETING_ACTIVE_SESSION_CONFLICT' using errcode='55000'; end if;
  next_host:=coalesce(target_host_user_id,target_room.host_user_id);
  if not exists(select 1 from public.community_members where community_id=target_room.community_id and user_id=next_host) and not exists(select 1 from public.communities where id=target_room.community_id and owner_id=next_host) then raise exception 'MEETING_HOST_NOT_MEMBER' using errcode='42501'; end if;
  if public.meeting_user_is_restricted(target_room_id,next_host) then raise exception 'MEETING_HOST_RESTRICTED' using errcode='42501'; end if;
  select coalesce(array_agg(distinct item.user_id),'{}'::uuid[]) into normalized_cohosts from unnest(coalesce(target_cohost_user_ids,'{}'::uuid[])) item(user_id) where item.user_id<>next_host;
  if exists(select 1 from unnest(normalized_cohosts) item(user_id) where public.meeting_user_is_restricted(target_room_id,item.user_id) or (not public.is_community_member(target_room.community_id,item.user_id) and not exists(select 1 from public.communities where id=target_room.community_id and owner_id=item.user_id))) then raise exception 'MEETING_COHOST_INVALID' using errcode='42501'; end if;
  if target_event_id is null then
    insert into public.community_events(community_id,channel_id,title,description,starts_at,ends_at,event_type,created_by)
    values(target_room.community_id,target_room.channel_id,target_room.title,target_room.description,target_scheduled_for,target_scheduled_end_at,'meeting',auth.uid()) returning * into linked_event;
  else
    select * into linked_event from public.community_events where id=target_event_id and community_id=target_room.community_id for update;
    if linked_event.id is null then raise exception 'MEETING_EVENT_INVALID' using errcode='23503'; end if;
    update public.community_events set channel_id=coalesce(target_room.channel_id,channel_id),title=target_room.title,description=target_room.description,starts_at=target_scheduled_for,ends_at=target_scheduled_end_at,event_type='meeting',cancelled_at=null,updated_at=now() where id=linked_event.id returning * into linked_event;
  end if;
  update public.meeting_rooms set source_kind='scheduled_event',event_id=linked_event.id,scheduled_for=target_scheduled_for,scheduled_end_at=target_scheduled_end_at,host_user_id=next_host,cohost_user_ids=normalized_cohosts,reminder_policy=target_reminder_policy,status='scheduled',updated_at=now() where id=target_room_id returning * into target_room;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id)
  values(target_room.community_id,auth.uid(),'community_update','meeting_schedule',target_room.id,'Meeting schedule and host assignments updated',target_room.id);
  return jsonb_build_object('roomId',target_room.id,'eventId',linked_event.id,'communityId',target_room.community_id,'scheduledFor',target_room.scheduled_for,'scheduledEndAt',target_room.scheduled_end_at,'hostUserId',target_room.host_user_id,'cohostUserIds',target_room.cohost_user_ids,'reminderPolicy',target_room.reminder_policy);
end;
$$;
create or replace function public.create_meeting_invite(
  target_room_id uuid,target_token_hash text,target_token_hint text,target_role text default 'participant',
  target_invited_user_id uuid default null,target_session_id uuid default null,target_expires_at timestamptz default null,target_max_uses integer default 1
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; created_invite public.meeting_invites%rowtype; actor_role text;
begin
  perform public.consume_meeting_request_limit('meeting_invite_write');
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then raise exception 'MEETING_NOT_FOUND' using errcode='22023'; end if;
  actor_role:=public.meeting_role_for_user(target_room_id,auth.uid());
  if not (actor_role in ('host','cohost') or public.effective_community_permission(target_room.community_id,'inviteParticipants',null,null) or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null)) then raise exception 'MEETING_INVITE_FORBIDDEN' using errcode='42501'; end if;
  if target_token_hash is null or target_token_hash!~'^[0-9a-f]{64}$' or target_token_hint is null or target_token_hint!~'^[0-9a-f]{4,12}$' then raise exception 'MEETING_INVITE_SECRET_INVALID' using errcode='22023'; end if;
  if target_role not in ('host','cohost','speaker','participant','viewer','guest') or (target_role='host' and actor_role<>'host') then raise exception 'MEETING_INVITE_ROLE_INVALID' using errcode='42501'; end if;
  if target_max_uses not between 1 and 100 then raise exception 'MEETING_INVITE_USAGE_INVALID' using errcode='22023'; end if;
  if target_expires_at is null or target_expires_at<=now()+interval '5 minutes' or target_expires_at>now()+interval '30 days' then raise exception 'MEETING_INVITE_EXPIRY_INVALID' using errcode='22023'; end if;
  if target_session_id is not null and not exists(select 1 from public.meeting_sessions where id=target_session_id and room_id=target_room_id) then raise exception 'MEETING_INVITE_SESSION_INVALID' using errcode='23503'; end if;
  if target_invited_user_id is not null and (public.meeting_user_is_restricted(target_room_id,target_invited_user_id) or public.users_are_blocked(auth.uid(),target_invited_user_id)) then raise exception 'MEETING_INVITEE_RESTRICTED' using errcode='42501'; end if;
  insert into public.meeting_invites(room_id,session_id,invited_user_id,invited_by_user_id,role,status,token_hash,token_hint,max_uses,use_count,expires_at)
  values(target_room_id,target_session_id,target_invited_user_id,auth.uid(),target_role,'active',target_token_hash,target_token_hint,target_max_uses,0,target_expires_at) returning * into created_invite;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
  values(target_room.community_id,auth.uid(),'invite_create','meeting_invite',created_invite.id,'Meeting invitation created; secret omitted',target_room.id,target_session_id);
  return jsonb_build_object('id',created_invite.id,'roomId',created_invite.room_id,'sessionId',created_invite.session_id,'invitedUserId',created_invite.invited_user_id,'invitedByUserId',created_invite.invited_by_user_id,'role',created_invite.role,'status',created_invite.status,'tokenHint',created_invite.token_hint,'maxUses',created_invite.max_uses,'useCount',created_invite.use_count,'createdAt',created_invite.created_at,'expiresAt',created_invite.expires_at,'revokedAt',created_invite.revoked_at);
end;
$$;
create or replace function public.revoke_meeting_invite(target_invite_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_invite public.meeting_invites%rowtype; target_room public.meeting_rooms%rowtype; actor_role text;
begin
  perform public.consume_meeting_request_limit('meeting_invite_write');
  select * into target_invite from public.meeting_invites where id=target_invite_id for update;
  if target_invite.id is null then raise exception 'MEETING_INVITE_NOT_FOUND' using errcode='22023'; end if;
  select * into target_room from public.meeting_rooms where id=target_invite.room_id;
  actor_role:=public.meeting_role_for_user(target_room.id,auth.uid());
  if auth.uid()<>target_invite.invited_by_user_id and not (actor_role in ('host','cohost') or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null)) then raise exception 'MEETING_INVITE_REVOKE_FORBIDDEN' using errcode='42501'; end if;
  if target_invite.revoked_at is null then
    update public.meeting_invites set status='revoked',revoked_at=now(),revoked_by_user_id=auth.uid() where id=target_invite_id returning * into target_invite;
    insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
    values(target_room.community_id,auth.uid(),'invite_revoke','meeting_invite',target_invite.id,'Meeting invitation revoked; secret omitted',target_room.id,target_invite.session_id);
  end if;
  return jsonb_build_object('id',target_invite.id,'roomId',target_invite.room_id,'status',target_invite.status,'tokenHint',target_invite.token_hint,'useCount',target_invite.use_count,'maxUses',target_invite.max_uses,'expiresAt',target_invite.expires_at,'revokedAt',target_invite.revoked_at);
end;
$$;
create or replace function public.validate_meeting_invite(target_token_hash text,target_room_id uuid default null,consume_use boolean default false)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_invite public.meeting_invites%rowtype; target_room public.meeting_rooms%rowtype; already_redeemed boolean:=false; next_use_count integer;
begin
  perform public.consume_meeting_request_limit('meeting_join_preview');
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if target_token_hash is null or target_token_hash!~'^[0-9a-f]{64}$' then return jsonb_build_object('valid',false,'code','INVITE_INVALID'); end if;
  select * into target_invite from public.meeting_invites where token_hash=target_token_hash for update;
  if target_invite.id is null or (target_room_id is not null and target_invite.room_id<>target_room_id) then return jsonb_build_object('valid',false,'code','INVITE_INVALID'); end if;
  select * into target_room from public.meeting_rooms where id=target_invite.room_id and archived_at is null;
  if target_room.id is null then return jsonb_build_object('valid',false,'code','ROOM_UNAVAILABLE'); end if;
  select exists(select 1 from public.meeting_invite_redemptions where invite_id=target_invite.id and user_id=auth.uid()) into already_redeemed;
  if target_invite.revoked_at is not null or target_invite.status='revoked' then return jsonb_build_object('valid',false,'code','INVITE_REVOKED'); end if;
  if target_invite.expires_at is not null and target_invite.expires_at<=now() then update public.meeting_invites set status='expired' where id=target_invite.id and status='active'; return jsonb_build_object('valid',false,'code','INVITE_EXPIRED'); end if;
  if target_invite.invited_user_id is not null and target_invite.invited_user_id<>auth.uid() then return jsonb_build_object('valid',false,'code','INVITE_NOT_INTENDED'); end if;
  if public.meeting_user_is_restricted(target_invite.room_id,auth.uid()) or public.users_are_blocked(auth.uid(),target_invite.invited_by_user_id) then return jsonb_build_object('valid',false,'code','JOIN_BLOCKED'); end if;
  if not already_redeemed and (target_invite.status<>'active' or target_invite.use_count>=target_invite.max_uses) then return jsonb_build_object('valid',false,'code','INVITE_EXHAUSTED'); end if;
  if consume_use and target_room.status not in ('open','live') then return jsonb_build_object('valid',false,'code','ROOM_NOT_OPEN'); end if;
  if consume_use and not already_redeemed then
    insert into public.meeting_invite_redemptions(invite_id,user_id) values(target_invite.id,auth.uid()) on conflict(invite_id,user_id) do nothing;
    next_use_count:=target_invite.use_count+1;
    update public.meeting_invites set use_count=next_use_count,last_used_at=now(),responded_at=coalesce(responded_at,now()),status=case when next_use_count>=max_uses then 'accepted' else 'active' end where id=target_invite.id returning * into target_invite;
    insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
    values(target_room.community_id,auth.uid(),'invite_accept','meeting_invite',target_invite.id,'Meeting invitation redeemed; secret omitted',target_room.id,target_invite.session_id);
    already_redeemed:=true;
  end if;
  return jsonb_build_object('valid',true,'code','INVITE_VALID','inviteId',target_invite.id,'roomId',target_invite.room_id,'sessionId',target_invite.session_id,'role',target_invite.role,'expiresAt',target_invite.expires_at,'alreadyRedeemed',already_redeemed,'usesRemaining',greatest(target_invite.max_uses-target_invite.use_count,0));
end;
$$;
create or replace function public.get_meeting_join_preview(target_room_id uuid,target_token_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; invite_result jsonb:=jsonb_build_object('valid',false); invite_valid boolean:=false; base_join boolean:=false; can_join boolean:=false; disposition text:='denied'; reason text:='policy'; member_access boolean:=false;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if target_token_hash is null then perform public.consume_meeting_request_limit('meeting_join_preview'); end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then return jsonb_build_object('roomId',target_room_id,'canJoin',false,'reason','not_available'); end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  member_access:=public.is_community_member(target_room.community_id);
  if target_token_hash is not null then invite_result:=public.validate_meeting_invite(target_token_hash,target_room_id,false); invite_valid:=coalesce((invite_result->>'valid')::boolean,false); end if;
  if target_community.id is null or (target_community.visibility='private' and not member_access and not invite_valid) then return jsonb_build_object('roomId',target_room_id,'canJoin',false,'reason','not_available'); end if;
  base_join:=public.can_join_meeting_room(target_room_id);
  can_join:=target_room.status in ('open','live') and not public.meeting_user_is_restricted(target_room_id,auth.uid()) and (base_join or invite_valid);
  if can_join then disposition:=case when target_room.waiting_room_enabled or target_room.join_policy='approval_required' then 'waiting' else 'direct' end; reason:='allowed';
  elsif target_room.status='scheduled' then reason:='not_started';
  elsif target_room.status in ('ended','cancelled') then reason:='ended';
  elsif target_room.status='locked' then reason:='locked';
  elsif target_token_hash is not null and not invite_valid then reason:=coalesce(invite_result->>'code','invite_invalid');
  elsif target_room.join_policy='invite_only' then reason:='invite_required';
  elsif target_room.join_policy='members' and not member_access then reason:='membership_required';
  else reason:='policy'; end if;
  return jsonb_build_object('roomId',target_room.id,'communityId',target_community.id,'communityName',target_community.name,'roomTitle',target_room.title,'mode',target_room.mode,'status',target_room.status,'joinPolicy',target_room.join_policy,'waitingRoomEnabled',target_room.waiting_room_enabled,'scheduledFor',target_room.scheduled_for,'scheduledEndAt',target_room.scheduled_end_at,'canJoin',can_join,'disposition',disposition,'reason',reason,'invite',invite_result-'inviteId');
end;
$$;
create or replace function public.list_meeting_invites(target_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype;
begin
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null then raise exception 'MEETING_NOT_FOUND' using errcode='22023'; end if;
  if not (public.meeting_role_for_user(target_room_id,auth.uid()) in ('host','cohost') or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null)) then raise exception 'MEETING_INVITE_LIST_FORBIDDEN' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',invite.id,'roomId',invite.room_id,'sessionId',invite.session_id,'invitedUserId',invite.invited_user_id,'invitedByUserId',invite.invited_by_user_id,'role',invite.role,'status',case when invite.revoked_at is not null then 'revoked' when invite.expires_at<=now() then 'expired' else invite.status end,'tokenHint',invite.token_hint,'maxUses',invite.max_uses,'useCount',invite.use_count,'createdAt',invite.created_at,'expiresAt',invite.expires_at,'lastUsedAt',invite.last_used_at,'revokedAt',invite.revoked_at) order by invite.created_at desc) from public.meeting_invites invite where invite.room_id=target_room_id),'[]'::jsonb);
end;
$$;
revoke all on function public.consume_meeting_request_limit(text),public.meeting_invite_grants_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.schedule_meeting_room(uuid,timestamptz,timestamptz,uuid,uuid[],uuid,jsonb),public.create_meeting_invite(uuid,text,text,text,uuid,uuid,timestamptz,integer),public.revoke_meeting_invite(uuid),public.validate_meeting_invite(text,uuid,boolean),public.get_meeting_join_preview(uuid,text),public.list_meeting_invites(uuid) from public,anon;
grant execute on function public.schedule_meeting_room(uuid,timestamptz,timestamptz,uuid,uuid[],uuid,jsonb),public.create_meeting_invite(uuid,text,text,text,uuid,uuid,timestamptz,integer),public.revoke_meeting_invite(uuid),public.validate_meeting_invite(text,uuid,boolean),public.get_meeting_join_preview(uuid,text),public.list_meeting_invites(uuid) to authenticated;
comment on table public.meeting_invite_redemptions is 'Per-user meeting invite redemption. No raw invite secret is stored.';
comment on column public.meeting_invites.token_hash is 'SHA-256 lowercase hex digest only. Raw invite secret must never be persisted or logged.';
comment on function public.get_meeting_join_preview(uuid,text) is 'Returns a privacy-safe join decision; never returns invite hashes or raw secrets.';
commit;
