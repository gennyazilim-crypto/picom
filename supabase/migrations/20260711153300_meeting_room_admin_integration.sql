-- Task 533: type-aware Community Admin room lifecycle with active-session and audit safeguards.
begin;

alter table public.meeting_rooms add column if not exists audience_mode boolean not null default false;
alter table public.meeting_rooms add column if not exists moderation_policy jsonb not null default '{}'::jsonb;
alter table public.meeting_rooms add column if not exists position integer not null default 0;
alter table public.meeting_rooms add column if not exists archived_at timestamptz;
alter table public.meeting_rooms add column if not exists archived_by_user_id uuid references public.profiles(id) on delete set null;

do $$ begin alter table public.meeting_rooms add constraint meeting_rooms_position_range check(position between 0 and 10000); exception when duplicate_object then null; end $$;
do $$ begin alter table public.meeting_rooms add constraint meeting_rooms_audience_mode check(not audience_mode or mode='stage'); exception when duplicate_object then null; end $$;
do $$ begin alter table public.meeting_rooms add constraint meeting_rooms_moderation_policy_object check(jsonb_typeof(moderation_policy)='object' and not moderation_policy ?| array['raw_audio','raw_video','raw_screen','recording','access_token','livekit_token']); exception when duplicate_object then null; end $$;

create index if not exists idx_meeting_rooms_community_position on public.meeting_rooms(community_id,position,id) where archived_at is null;
create index if not exists idx_meeting_rooms_archived on public.meeting_rooms(community_id,archived_at) where archived_at is not null;

drop policy if exists meeting_rooms_select_accessible on public.meeting_rooms;
create policy meeting_rooms_select_accessible on public.meeting_rooms for select to authenticated using(archived_at is null and public.can_view_meeting_room(id));

create or replace function public.assert_meeting_room_admin(target_room_id uuid,target_permission text default 'manageMeeting')
returns public.meeting_rooms language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype;
begin
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  if target_room.id is null or auth.uid() is null or not public.effective_community_permission(target_room.community_id,target_permission,null,null) then raise exception 'MEETING_ADMIN_FORBIDDEN' using errcode='42501'; end if;
  return target_room;
end;
$$;

create or replace function public.sanitize_meeting_capabilities(target_mode text,input_capabilities jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'canPublishAudio',case when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canPublishAudio')='boolean' then (input_capabilities->>'canPublishAudio')::boolean else true end,
    'canPublishVideo',case when target_mode='voice' then false when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canPublishVideo')='boolean' then (input_capabilities->>'canPublishVideo')::boolean else true end,
    'canShareScreen',case when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canShareScreen')='boolean' then (input_capabilities->>'canShareScreen')::boolean else target_mode<>'voice' end,
    'canSendChat',case when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canSendChat')='boolean' then (input_capabilities->>'canSendChat')::boolean else true end,
    'canReact',case when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canReact')='boolean' then (input_capabilities->>'canReact')::boolean else true end,
    'canRaiseHand',case when jsonb_typeof(coalesce(input_capabilities,'{}'::jsonb)->'canRaiseHand')='boolean' then (input_capabilities->>'canRaiseHand')::boolean else true end
  );
$$;

create or replace function public.list_community_meeting_rooms(target_community_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_community_member(target_community_id) then raise exception 'MEETING_LIST_FORBIDDEN' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(room)||jsonb_build_object(
    'active_session_count',(select count(*) from public.meeting_sessions session where session.room_id=room.id and session.status in ('preparing','live','reconnecting')),
    'workspace',case room.mode when 'voice' then 'voice_lounge' when 'stage' then 'stage' else 'meeting' end
  ) order by room.position,room.id),'[]'::jsonb) into result
  from public.meeting_rooms room where room.community_id=target_community_id and room.archived_at is null and public.can_view_meeting_room(room.id);
  return result;
end;
$$;

create or replace function public.create_community_meeting_room(
  target_community_id uuid,target_category_id uuid,room_name text,room_description text,room_mode text,
  room_capabilities jsonb,room_waiting_enabled boolean,room_audience_mode boolean,room_join_policy text,
  room_participant_limit integer,room_chat_channel_id uuid,room_moderation_policy jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare created_channel public.channels%rowtype; created_room public.meeting_rooms%rowtype; clean_name text; clean_description text; next_position integer; safe_capabilities jsonb; safe_moderation jsonb;
begin
  if auth.uid() is null or not public.effective_community_permission(target_community_id,'createMeeting',null,null) or not public.effective_community_permission(target_community_id,'manageChannels',null,null) then raise exception 'MEETING_CREATE_FORBIDDEN' using errcode='42501'; end if;
  clean_name:=left(btrim(room_name),120); clean_description:=left(coalesce(btrim(room_description),''),2000);
  if char_length(clean_name)=0 or room_mode not in ('voice','meeting','stage') or room_join_policy not in ('open','members','invite_only','approval_required') or room_participant_limit not between 2 and 1000 then raise exception 'MEETING_CONFIGURATION_INVALID' using errcode='22023'; end if;
  if room_audience_mode and room_mode<>'stage' then raise exception 'MEETING_AUDIENCE_MODE_INVALID' using errcode='22023'; end if;
  safe_capabilities:=public.sanitize_meeting_capabilities(room_mode,coalesce(room_capabilities,'{}'::jsonb));
  safe_moderation:=jsonb_build_object(
    'allowParticipantMute',coalesce((room_moderation_policy->>'allowParticipantMute')::boolean,false),
    'allowParticipantRemove',coalesce((room_moderation_policy->>'allowParticipantRemove')::boolean,false),
    'raiseHandRequired',coalesce((room_moderation_policy->>'raiseHandRequired')::boolean,room_mode='stage')
  );
  select * into created_channel from public.create_managed_text_channel(target_community_id,target_category_id,clean_name,'voice',clean_description,false,false);
  select coalesce(max(position),-1)+1 into next_position from public.meeting_rooms where community_id=target_community_id and archived_at is null;
  insert into public.meeting_rooms(community_id,channel_id,linked_chat_channel_id,source_kind,mode,title,description,status,join_policy,default_role,host_user_id,created_by,capabilities,waiting_room_enabled,max_participants,audience_mode,moderation_policy,position)
  values(target_community_id,created_channel.id,room_chat_channel_id,'community_channel',room_mode,clean_name,clean_description,'open',room_join_policy,case when room_mode='stage' then 'viewer' else 'participant' end,auth.uid(),auth.uid(),safe_capabilities,room_waiting_enabled or room_join_policy='approval_required',room_participant_limit,room_audience_mode,safe_moderation,next_position)
  returning * into created_room;
  return to_jsonb(created_room)||jsonb_build_object('active_session_count',0,'workspace',case room_mode when 'voice' then 'voice_lounge' when 'stage' then 'stage' else 'meeting' end);
end;
$$;

create or replace function public.update_community_meeting_room(
  target_room_id uuid,room_name text,room_description text,room_mode text,room_capabilities jsonb,
  room_waiting_enabled boolean,room_audience_mode boolean,room_join_policy text,room_participant_limit integer,
  room_chat_channel_id uuid,room_moderation_policy jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; updated_room public.meeting_rooms%rowtype; active_count integer; safe_capabilities jsonb; safe_moderation jsonb;
begin
  target_room:=public.assert_meeting_room_admin(target_room_id,'manageMeeting');
  if room_mode not in ('voice','meeting','stage') or room_join_policy not in ('open','members','invite_only','approval_required') or room_participant_limit not between 2 and 1000 or (room_audience_mode and room_mode<>'stage') then raise exception 'MEETING_CONFIGURATION_INVALID' using errcode='22023'; end if;
  select count(*) into active_count from public.meeting_sessions where room_id=target_room_id and status in ('preparing','live','reconnecting');
  if active_count>0 and (room_mode<>target_room.mode or room_join_policy<>target_room.join_policy or room_participant_limit<>target_room.max_participants or room_waiting_enabled<>target_room.waiting_room_enabled or room_audience_mode<>target_room.audience_mode or room_capabilities is distinct from target_room.capabilities) then raise exception 'MEETING_ACTIVE_CONFIGURATION_LOCKED' using errcode='55000'; end if;
  safe_capabilities:=public.sanitize_meeting_capabilities(room_mode,coalesce(room_capabilities,'{}'::jsonb));
  safe_moderation:=jsonb_build_object(
    'allowParticipantMute',coalesce((room_moderation_policy->>'allowParticipantMute')::boolean,false),
    'allowParticipantRemove',coalesce((room_moderation_policy->>'allowParticipantRemove')::boolean,false),
    'raiseHandRequired',coalesce((room_moderation_policy->>'raiseHandRequired')::boolean,room_mode='stage')
  );
  update public.meeting_rooms set title=left(btrim(room_name),120),description=left(coalesce(btrim(room_description),''),2000),mode=room_mode,capabilities=safe_capabilities,waiting_room_enabled=room_waiting_enabled or room_join_policy='approval_required',audience_mode=room_audience_mode,join_policy=room_join_policy,default_role=case when room_mode='stage' then 'viewer' else 'participant' end,max_participants=room_participant_limit,linked_chat_channel_id=room_chat_channel_id,moderation_policy=safe_moderation,updated_at=now() where id=target_room_id returning * into updated_room;
  update public.channels set name=left(regexp_replace(lower(btrim(room_name)),'[^a-z0-9_-]+','-','g'),80),topic=left(coalesce(btrim(room_description),''),300),updated_at=now() where id=updated_room.channel_id;
  return to_jsonb(updated_room)||jsonb_build_object('active_session_count',active_count,'workspace',case room_mode when 'voice' then 'voice_lounge' when 'stage' then 'stage' else 'meeting' end);
end;
$$;

create or replace function public.archive_community_meeting_room(target_room_id uuid,confirmation_title text,active_policy text default 'deny',replacement_room_id uuid default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; replacement public.meeting_rooms%rowtype; active_count integer; source_channel uuid;
begin
  target_room:=public.assert_meeting_room_admin(target_room_id,'manageMeeting');
  if btrim(confirmation_title)<>target_room.title or active_policy not in ('deny','end','transfer') then raise exception 'MEETING_ARCHIVE_CONFIRMATION_INVALID' using errcode='22023'; end if;
  select count(*) into active_count from public.meeting_sessions where room_id=target_room_id and status in ('preparing','live','reconnecting');
  if active_count>0 and active_policy='deny' then raise exception 'MEETING_ACTIVE_SESSION_EXISTS' using errcode='55000'; end if;
  if active_count>0 and active_policy='transfer' then
    select * into replacement from public.meeting_rooms where id=replacement_room_id and community_id=target_room.community_id and archived_at is null and id<>target_room_id;
    if replacement.id is null then raise exception 'MEETING_TRANSFER_TARGET_INVALID' using errcode='22023'; end if;
    update public.meeting_sessions set room_id=replacement.id,updated_at=now() where room_id=target_room_id and status in ('preparing','live','reconnecting');
  elsif active_count>0 and active_policy='end' then
    update public.meeting_sessions set status='ended',connection_state='ending',ended_at=now(),ended_by_user_id=auth.uid(),updated_at=now() where room_id=target_room_id and status in ('preparing','live','reconnecting');
  end if;
  source_channel:=target_room.channel_id;
  update public.meeting_rooms set status=case when status='cancelled' then status else 'ended' end,ended_at=coalesce(ended_at,now()),ended_by_user_id=coalesce(ended_by_user_id,auth.uid()),archived_at=now(),archived_by_user_id=auth.uid(),source_kind='ad_hoc',approved_by_user_id=coalesce(approved_by_user_id,auth.uid()),channel_id=null,event_id=null,updated_at=now() where id=target_room_id;
  if source_channel is not null then delete from public.channels where id=source_channel and not exists(select 1 from public.messages where channel_id=source_channel); end if;
  return true;
end;
$$;

create or replace function public.move_community_meeting_room(target_room_id uuid,move_direction text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; adjacent public.meeting_rooms%rowtype; old_position integer;
begin
  target_room:=public.assert_meeting_room_admin(target_room_id,'manageMeeting');
  if move_direction not in ('up','down') then raise exception 'MEETING_MOVE_INVALID' using errcode='22023'; end if;
  select * into adjacent from public.meeting_rooms where community_id=target_room.community_id and archived_at is null and id<>target_room.id and (case when move_direction='up' then position<target_room.position else position>target_room.position end) order by (case when move_direction='up' then position end) desc,(case when move_direction='down' then position end) asc limit 1;
  if adjacent.id is null then return false; end if;
  old_position:=target_room.position;
  update public.meeting_rooms set position=adjacent.position,updated_at=now() where id=target_room.id;
  update public.meeting_rooms set position=old_position,updated_at=now() where id=adjacent.id;
  return true;
end;
$$;

create or replace function public.guard_active_meeting_room_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' and exists(select 1 from public.meeting_sessions where room_id=old.id and status in ('preparing','live','reconnecting')) then raise exception 'MEETING_ACTIVE_SESSION_EXISTS' using errcode='55000'; end if;
  if tg_op='UPDATE' and old.archived_at is null and new.archived_at is not null and exists(select 1 from public.meeting_sessions where room_id=old.id and status in ('preparing','live','reconnecting')) then raise exception 'MEETING_ACTIVE_SESSION_EXISTS' using errcode='55000'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
drop trigger if exists trg_guard_active_meeting_room_mutation on public.meeting_rooms;
create trigger trg_guard_active_meeting_room_mutation before update of archived_at or delete on public.meeting_rooms for each row execute function public.guard_active_meeting_room_mutation();

create or replace function public.audit_meeting_room_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.meeting_rooms%rowtype; action_name text; actor uuid;
begin
  row_value:=case when tg_op='DELETE' then old else new end;
  actor:=coalesce(auth.uid(),row_value.created_by);
  action_name:=case when tg_op='INSERT' then 'meeting_room_create' when tg_op='DELETE' then 'meeting_room_delete' when old.archived_at is null and new.archived_at is not null then 'meeting_room_archive' else 'meeting_room_update' end;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id)
  values(row_value.community_id,actor,action_name,'meeting_room',row_value.id,action_name,row_value.id);
  return row_value;
end;
$$;
drop trigger if exists trg_audit_meeting_room_mutation on public.meeting_rooms;
create trigger trg_audit_meeting_room_mutation after insert or update or delete on public.meeting_rooms for each row execute function public.audit_meeting_room_mutation();

revoke all on function public.assert_meeting_room_admin(uuid,text),public.list_community_meeting_rooms(uuid),public.create_community_meeting_room(uuid,uuid,text,text,text,jsonb,boolean,boolean,text,integer,uuid,jsonb),public.update_community_meeting_room(uuid,text,text,text,jsonb,boolean,boolean,text,integer,uuid,jsonb),public.archive_community_meeting_room(uuid,text,text,uuid),public.move_community_meeting_room(uuid,text) from public,anon;
grant execute on function public.list_community_meeting_rooms(uuid),public.create_community_meeting_room(uuid,uuid,text,text,text,jsonb,boolean,boolean,text,integer,uuid,jsonb),public.update_community_meeting_room(uuid,text,text,text,jsonb,boolean,boolean,text,integer,uuid,jsonb),public.archive_community_meeting_room(uuid,text,text,uuid),public.move_community_meeting_room(uuid,text) to authenticated;

comment on function public.archive_community_meeting_room(uuid,text,text,uuid) is 'Archives metadata and requires explicit deny/end/transfer policy for active sessions; audit history remains.';
commit;
