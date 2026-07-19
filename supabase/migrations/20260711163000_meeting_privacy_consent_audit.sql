-- Task 569: meeting privacy, consent evidence, append-only audit, and retention boundaries.
begin;
alter table public.audit_log alter column actor_id drop not null;
alter table public.audit_log add column if not exists actor_kind text not null default 'user';
alter table public.audit_log add column if not exists event_source text not null default 'backend';
alter table public.audit_log add column if not exists meeting_event_id uuid references public.meeting_events(id) on delete set null;
alter table public.audit_log add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.audit_log add column if not exists retention_until timestamptz not null default (now()+interval '730 days');
alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check(action_type in(
  'community_update','channel_create','channel_update','channel_delete','role_change','member_change','moderation_action',
  'invite_create','invite_revoke','invite_accept','webhook_create','webhook_revoke','webhook_message','discovery_review',
  'meeting_room_create','meeting_room_update','meeting_room_archive','meeting_room_delete','meeting_control',
  'meeting_lifecycle','meeting_admission','meeting_role','meeting_moderation','meeting_media','meeting_caption'
));
do $$ begin
  if not exists(select 1 from pg_constraint where conname='audit_log_actor_kind_check') then alter table public.audit_log add constraint audit_log_actor_kind_check check((actor_kind='user' and actor_id is not null) or (actor_kind='system' and actor_id is null)); end if;
  if not exists(select 1 from pg_constraint where conname='audit_log_event_source_check') then alter table public.audit_log add constraint audit_log_event_source_check check(event_source in('backend','livekit','client','caption_service','system')); end if;
  if not exists(select 1 from pg_constraint where conname='audit_log_safe_metadata_check') then alter table public.audit_log add constraint audit_log_safe_metadata_check check(jsonb_typeof(metadata)='object' and not metadata ?| array['message_body','request_message','raw_audio','raw_video','raw_screen','recording','transcript','access_token','refresh_token','livekit_token','provider_identity']); end if;
  if not exists(select 1 from pg_constraint where conname='audit_log_retention_window_check') then alter table public.audit_log add constraint audit_log_retention_window_check check(retention_until>=created_at); end if;
end $$;
create unique index if not exists audit_log_meeting_event_unique on public.audit_log(meeting_event_id) where meeting_event_id is not null;
alter table public.meeting_attendance add column if not exists retention_until timestamptz not null default (now()+interval '365 days');
alter table public.meeting_events add column if not exists retention_until timestamptz not null default (now()+interval '730 days');
alter table public.meeting_waiting_entries add column if not exists retention_until timestamptz not null default (now()+interval '90 days');
update public.meeting_attendance set retention_until=greatest(retention_until,joined_at+interval '365 days');
update public.meeting_events set retention_until=greatest(retention_until,occurred_at+interval '730 days');
update public.meeting_waiting_entries set retention_until=greatest(retention_until,requested_at+interval '90 days');
do $$ begin
  if not exists(select 1 from pg_constraint where conname='meeting_attendance_retention_check') then alter table public.meeting_attendance add constraint meeting_attendance_retention_check check(retention_until>=joined_at); end if;
  if not exists(select 1 from pg_constraint where conname='meeting_events_retention_check') then alter table public.meeting_events add constraint meeting_events_retention_check check(retention_until>=occurred_at); end if;
  if not exists(select 1 from pg_constraint where conname='meeting_waiting_retention_check') then alter table public.meeting_waiting_entries add constraint meeting_waiting_retention_check check(retention_until>=requested_at); end if;
end $$;
create or replace function public.prevent_meeting_event_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'MEETING_EVENT_APPEND_ONLY' using errcode='P0001'; end;
$$;
drop trigger if exists meeting_events_append_only on public.meeting_events;
create trigger meeting_events_append_only before update or delete on public.meeting_events for each row execute function public.prevent_meeting_event_mutation();
revoke update,delete,truncate on table public.meeting_events from public,anon,authenticated;
create or replace function public.audit_meeting_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_community_id uuid; mapped_action text; safe_reason text;
begin
  mapped_action:=case
    when new.event_type in('room_started','room_finished','session_started','session_ended','room_status_changed') then 'meeting_lifecycle'
    when new.event_type='waiting_room_changed' then 'meeting_admission'
    when new.event_type in('participant_role_changed','host_transferred') then 'meeting_role'
    when new.event_type in('participant_muted','participant_removed') then 'meeting_moderation'
    when new.event_type='participant_screen_policy_changed' then 'meeting_media'
    when new.event_type in('captions_requested','captions_starting','captions_activated','captions_stopped','captions_failed') then 'meeting_caption'
    when new.event_type in('track_published','track_unpublished') and new.payload->>'trackSource' in('screen_share','screen_share_audio') then 'meeting_media'
    else null end;
  if mapped_action is null then return new; end if;
  select room.community_id into target_community_id from public.meeting_rooms room where room.id=new.room_id;
  if target_community_id is null then return new; end if;
  safe_reason:='Meeting audit event: '||left(new.event_type,80);
  insert into public.audit_log(community_id,actor_id,actor_kind,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id,meeting_event_id,event_source,metadata,retention_until)
  values(target_community_id,new.actor_user_id,case when new.actor_user_id is null then 'system' else 'user' end,mapped_action,'meeting_event',new.id,safe_reason,new.room_id,new.session_id,new.id,case when new.event_source='livekit' then 'livekit' when new.event_source='client' then 'client' else 'backend' end,jsonb_build_object('eventType',new.event_type,'sequence',new.sequence),new.occurred_at+interval '730 days')
  on conflict(meeting_event_id) where meeting_event_id is not null do nothing;
  return new;
end;
$$;
drop trigger if exists meeting_event_to_restricted_audit on public.meeting_events;
create trigger meeting_event_to_restricted_audit after insert on public.meeting_events for each row execute function public.audit_meeting_event();
create or replace function public.audit_meeting_caption_lifecycle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare event_name text; next_sequence bigint;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  event_name:=case when tg_op='INSERT' or new.status='awaiting_consent' then 'captions_requested' when new.status='starting' then 'captions_starting' when new.status='active' then 'captions_activated' when new.status in('stopping','stopped') then 'captions_stopped' when new.status='failed' then 'captions_failed' else null end;
  if event_name is null then return new; end if;
  update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=new.session_id returning last_event_sequence into next_sequence;
  if next_sequence is null then return new; end if;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at,retention_until)
  values(new.room_id,new.session_id,new.requested_by_user_id,event_name,'backend','caption-lifecycle:'||new.id::text||':'||new.consent_round::text||':'||new.status,next_sequence,jsonb_build_object('captionSessionId',new.id,'status',new.status,'language',new.language,'retentionMode','ephemeral'),now(),now()+interval '730 days')
  on conflict(event_source,idempotency_key) do nothing;
  return new;
end;
$$;
drop trigger if exists meeting_caption_lifecycle_audit on public.meeting_caption_sessions;
create trigger meeting_caption_lifecycle_audit after insert or update of status on public.meeting_caption_sessions for each row execute function public.audit_meeting_caption_lifecycle();
create or replace function public.record_livekit_meeting_moderation(target_room_id uuid,target_session_id uuid,target_participant_id uuid,target_action text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare audit_id uuid;target_community_id uuid;
begin
  perform 1 from public.authorize_livekit_meeting_moderation(target_room_id,target_session_id,target_participant_id,target_action);
  select community_id into target_community_id from public.meeting_rooms where id=target_room_id;
  insert into public.audit_log(community_id,actor_id,actor_kind,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id,event_source,metadata)
  values(target_community_id,auth.uid(),'user','moderation_action','meeting_participant',target_participant_id,left('meeting_'||target_action,500),target_room_id,target_session_id,'backend',jsonb_build_object('action',target_action)) returning id into audit_id;
  return audit_id;
end;
$$;
revoke all on function public.prevent_meeting_event_mutation(),public.audit_meeting_event(),public.audit_meeting_caption_lifecycle() from public,anon,authenticated;
comment on table public.meeting_events is 'Append-only safe meeting events. Raw media, transcript text, provider identity, credentials, and message content are forbidden.';
comment on column public.meeting_attendance.retention_until is 'Technical 365-day floor pending authorized legal retention and legal-hold approval; no automatic purge is enabled.';
comment on column public.meeting_waiting_entries.retention_until is 'Technical 90-day floor pending authorized legal retention and legal-hold approval; no automatic purge is enabled.';
comment on column public.audit_log.retention_until is 'Technical 730-day audit floor. Normal application flows cannot delete or mutate audit evidence.';
commit;
