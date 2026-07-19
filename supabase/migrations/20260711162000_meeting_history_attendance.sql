-- Task 568: permission-bounded meeting history and verified attendance projections.
-- No raw media, recording, transcript text, provider identity, or token is exposed here.
begin;
alter table public.meeting_sessions add column if not exists duration_seconds integer;
alter table public.meeting_sessions add column if not exists outcome_code text;
alter table public.meeting_sessions add column if not exists outcome_source text;
alter table public.meeting_sessions add column if not exists outcome_verified_at timestamptz;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='meeting_sessions_duration_nonnegative') then alter table public.meeting_sessions add constraint meeting_sessions_duration_nonnegative check(duration_seconds is null or duration_seconds>=0); end if;
  if not exists(select 1 from pg_constraint where conname='meeting_sessions_outcome_code_safe') then alter table public.meeting_sessions add constraint meeting_sessions_outcome_code_safe check(outcome_code is null or outcome_code in ('provider_ended','host_ended','failed','cancelled','unknown')); end if;
  if not exists(select 1 from pg_constraint where conname='meeting_sessions_outcome_source_safe') then alter table public.meeting_sessions add constraint meeting_sessions_outcome_source_safe check(outcome_source is null or outcome_source in ('verified_livekit_webhook','backend_control','provider_failure','unknown')); end if;
end $$;
create index if not exists idx_meeting_sessions_history_time on public.meeting_sessions(coalesce(ended_at,started_at,created_at) desc,id desc) where status in ('live','reconnecting','ended','failed');
create or replace function public.sync_verified_meeting_history_outcome()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.event_source='livekit' and new.event_type='room_finished' and new.session_id is not null then
    update public.meeting_sessions
    set duration_seconds=case when started_at is null then 0 else greatest(0,extract(epoch from (coalesce(ended_at,new.occurred_at)-started_at))::integer) end,
        outcome_code='provider_ended',outcome_source='verified_livekit_webhook',outcome_verified_at=new.occurred_at,updated_at=now()
    where id=new.session_id;
  end if;
  return new;
end;
$$;
drop trigger if exists meeting_history_verified_outcome on public.meeting_events;
create trigger meeting_history_verified_outcome after insert on public.meeting_events for each row execute function public.sync_verified_meeting_history_outcome();
with verified as (
  select distinct on(event.session_id) event.session_id,event.occurred_at
  from public.meeting_events event
  where event.event_source='livekit' and event.event_type='room_finished' and event.session_id is not null
  order by event.session_id,event.occurred_at desc,event.id desc
)
update public.meeting_sessions session
set duration_seconds=case when session.started_at is null then 0 else greatest(0,extract(epoch from (coalesce(session.ended_at,verified.occurred_at)-session.started_at))::integer) end,
    outcome_code='provider_ended',outcome_source='verified_livekit_webhook',outcome_verified_at=verified.occurred_at,updated_at=now()
from verified where session.id=verified.session_id;
create or replace function public.get_meeting_history(target_community_id uuid,target_scope text default 'community',result_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  is_member boolean:=false;
  can_view_all_attendance boolean:=false;
  has_own_history boolean:=false;
  safe_limit integer:=least(greatest(coalesce(result_limit,20),1),50);
  history_items jsonb:='[]'::jsonb;
  upcoming_items jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or target_community_id is null or target_scope not in ('community','mine') then raise exception 'MEETING_HISTORY_REQUEST_INVALID' using errcode='22023'; end if;
  is_member:=public.is_community_member(target_community_id);
  can_view_all_attendance:=is_member and public.effective_community_permission(target_community_id,'viewMeetingHistory',null,null);
  select exists(select 1 from public.meeting_attendance attendance join public.meeting_sessions session on session.id=attendance.session_id join public.meeting_rooms room on room.id=session.room_id where room.community_id=target_community_id and attendance.user_id=auth.uid()) into has_own_history;
  if target_scope='community' and not is_member then raise exception 'MEETING_HISTORY_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if target_scope='mine' and not (is_member or has_own_history) then raise exception 'MEETING_HISTORY_ACCESS_FORBIDDEN' using errcode='42501'; end if;

  select coalesce(jsonb_agg(page.item order by page.sort_time desc,page.session_id desc),'[]'::jsonb) into history_items
  from (
    select session.id session_id,coalesce(session.ended_at,session.started_at,session.created_at) sort_time,
      jsonb_strip_nulls(jsonb_build_object(
        'roomId',room.id,'sessionId',session.id,'communityId',room.community_id,'channelId',room.channel_id,
        'title',room.title,'mode',room.mode,'status',case when session.status in ('live','reconnecting') then 'live' else session.status end,
        'scheduledFor',room.scheduled_for,'startedAt',session.started_at,'endedAt',session.ended_at,
        'durationSeconds',coalesce(session.duration_seconds,case when session.started_at is null then null else greatest(0,extract(epoch from (coalesce(session.ended_at,now())-session.started_at))::integer) end),
        'hostUserId',room.host_user_id,'hostName',coalesce(host.display_name,'Picom host'),
        'attendanceCount',(select count(*) from public.meeting_attendance attendance where attendance.session_id=session.id),
        'myAttendance',(select jsonb_build_object('role',mine.role,'joinedAt',mine.joined_at,'leftAt',mine.left_at,'durationSeconds',mine.duration_seconds,'reconnectCount',mine.reconnect_count,'finalState',mine.final_state) from public.meeting_attendance mine where mine.session_id=session.id and mine.user_id=auth.uid() order by mine.joined_at desc limit 1),
        'outcomeCode',coalesce(session.outcome_code,case when session.status='failed' then 'failed' when session.status='ended' then 'unknown' else null end),
        'outcomeVerified',session.outcome_source='verified_livekit_webhook','outcomeVerifiedAt',session.outcome_verified_at,
        'hasDurableChat',room.linked_chat_channel_id is not null,
        'captionsUsed',exists(select 1 from public.meeting_caption_sessions caption where caption.session_id=session.id),
        'transcriptRetained',false,'recordingAvailable',false
      )) item
    from public.meeting_sessions session
    join public.meeting_rooms room on room.id=session.room_id
    left join public.profiles host on host.id=room.host_user_id
    where room.community_id=target_community_id and session.status in ('live','reconnecting','ended','failed')
      and (target_scope='community' or exists(select 1 from public.meeting_attendance mine where mine.session_id=session.id and mine.user_id=auth.uid()))
      and public.can_view_meeting_room(room.id)
    order by coalesce(session.ended_at,session.started_at,session.created_at) desc,session.id desc
    limit safe_limit
  ) page;

  if is_member then
    select coalesce(jsonb_agg(page.item order by page.scheduled_for,page.room_id),'[]'::jsonb) into upcoming_items
    from (
      select room.id room_id,room.scheduled_for,
        jsonb_strip_nulls(jsonb_build_object('roomId',room.id,'sessionId',null,'communityId',room.community_id,'channelId',room.channel_id,'title',room.title,'mode',room.mode,'status','upcoming','scheduledFor',room.scheduled_for,'startedAt',null,'endedAt',null,'durationSeconds',null,'hostUserId',room.host_user_id,'hostName',coalesce(host.display_name,'Picom host'),'attendanceCount',0,'outcomeCode',null,'outcomeVerified',false,'hasDurableChat',room.linked_chat_channel_id is not null,'captionsUsed',false,'transcriptRetained',false,'recordingAvailable',false)) item
      from public.meeting_rooms room left join public.profiles host on host.id=room.host_user_id
      where room.community_id=target_community_id and room.status in ('scheduled','open') and room.scheduled_for is not null and room.scheduled_for>=now()-interval '1 hour' and public.can_view_meeting_room(room.id)
        and not exists(select 1 from public.meeting_sessions session where session.room_id=room.id and session.status in ('live','reconnecting'))
      order by room.scheduled_for,room.id limit least(safe_limit,20)
    ) page;
  end if;

  return jsonb_build_object('items',history_items,'upcoming',upcoming_items,'scope',target_scope,'canViewAttendance',can_view_all_attendance,'transcriptRetention','ephemeral_none');
end;
$$;
create or replace function public.get_meeting_attendance_history(target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  target_community_id uuid;
  can_view_all boolean:=false;
  has_own boolean:=false;
  attendance_items jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or target_session_id is null then raise exception 'MEETING_ATTENDANCE_REQUEST_INVALID' using errcode='22023'; end if;
  select room.community_id into target_community_id from public.meeting_sessions session join public.meeting_rooms room on room.id=session.room_id where session.id=target_session_id;
  if target_community_id is null then raise exception 'MEETING_ATTENDANCE_NOT_FOUND' using errcode='P0002'; end if;
  can_view_all:=public.is_community_member(target_community_id) and public.effective_community_permission(target_community_id,'viewMeetingHistory',null,null);
  select exists(select 1 from public.meeting_attendance attendance where attendance.session_id=target_session_id and attendance.user_id=auth.uid()) into has_own;
  if not (can_view_all or has_own) then raise exception 'MEETING_ATTENDANCE_ACCESS_FORBIDDEN' using errcode='42501'; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('userId',attendance.user_id,'displayName',case when attendance.user_id is null then 'Guest participant' else coalesce(profile.display_name,'Deleted user') end,'avatarUrl',case when attendance.user_id is null then null else profile.avatar_url end,'role',attendance.role,'joinedAt',attendance.joined_at,'leftAt',attendance.left_at,'durationSeconds',attendance.duration_seconds,'reconnectCount',attendance.reconnect_count,'finalState',attendance.final_state)) order by attendance.joined_at,attendance.id),'[]'::jsonb) into attendance_items
  from public.meeting_attendance attendance left join public.profiles profile on profile.id=attendance.user_id
  where attendance.session_id=target_session_id and (can_view_all or attendance.user_id=auth.uid());
  return jsonb_build_object('sessionId',target_session_id,'canViewAll',can_view_all,'items',attendance_items);
end;
$$;
revoke all on function public.get_meeting_history(uuid,text,integer),public.get_meeting_attendance_history(uuid) from public,anon;
grant execute on function public.get_meeting_history(uuid,text,integer),public.get_meeting_attendance_history(uuid) to authenticated;
comment on function public.get_meeting_history(uuid,text,integer) is 'Privacy-bounded meeting history projection. Recording and transcript availability are always false for Full MVP.';
comment on function public.get_meeting_attendance_history(uuid) is 'Returns all safe attendance only to viewMeetingHistory roles; other participants receive only their own row.';
commit;
