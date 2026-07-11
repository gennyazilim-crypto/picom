-- Task 541: durable, idempotent meeting notifications and reminders.
-- Native delivery remains a renderer concern so local DND and quiet-hour policy is authoritative.
begin;

alter table public.notifications
  add column if not exists meeting_room_id uuid references public.meeting_rooms(id) on delete set null,
  add column if not exists meeting_session_id uuid references public.meeting_sessions(id) on delete set null,
  add column if not exists meeting_starts_at timestamptz,
  add column if not exists deep_link text;

do $$ begin
  alter table public.notifications add constraint notifications_meeting_deep_link_safe check (
    deep_link is null or (char_length(deep_link) <= 2048 and deep_link ~ '^picom://meeting/[A-Za-z0-9_-]+/')
  );
exception when duplicate_object then null; end $$;

create index if not exists notifications_recipient_meeting_idx
  on public.notifications(recipient_id,meeting_room_id,created_at desc)
  where meeting_room_id is not null and deleted_at is null;

create table if not exists public.meeting_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  session_id uuid references public.meeting_sessions(id) on delete set null,
  event_kind text not null check (event_kind in (
    'reminder','started','schedule_changed','cancelled','invite_received',
    'waiting_request','admission_result','cohost_assigned','stage_request'
  )),
  event_key text not null check (char_length(event_key) between 8 and 220 and event_key ~ '^[A-Za-z0-9._:-]+$'),
  title text not null check (char_length(title) between 1 and 160),
  preview text not null default '' check (char_length(preview) <= 500),
  context_label text not null default 'Meeting' check (char_length(context_label) <= 160),
  deep_link text not null check (char_length(deep_link) <= 2048 and deep_link ~ '^picom://meeting/[A-Za-z0-9_-]+/'),
  meeting_starts_at timestamptz,
  available_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recipient_id,event_key)
);

create index if not exists meeting_notification_jobs_due_idx
  on public.meeting_notification_jobs(available_at,created_at)
  where processed_at is null;

alter table public.meeting_notification_jobs enable row level security;
revoke all on public.meeting_notification_jobs from anon,authenticated;

create or replace function public.meeting_notification_deep_link(target_room_id uuid,target_session_id uuid default null)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; result text;
begin
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null then raise exception 'MEETING_NOTIFICATION_ROOM_NOT_FOUND' using errcode='22023'; end if;
  result:='picom://meeting/'||target_room.community_id::text;
  if target_room.channel_id is not null then result:=result||'/channel/'||target_room.channel_id::text; end if;
  result:=result||'/room/'||target_room.id::text;
  if target_session_id is not null then result:=result||'/session/'||target_session_id::text; end if;
  return result;
end;
$$;

create or replace function public.meeting_notification_recipient_ids(target_room_id uuid)
returns table(user_id uuid) language sql stable security definer set search_path=public,pg_temp as $$
  select distinct candidates.user_id from (
    select room.host_user_id user_id from public.meeting_rooms room where room.id=target_room_id
    union all
    select unnest(room.cohost_user_ids) from public.meeting_rooms room where room.id=target_room_id
    union all
    select invite.invited_user_id from public.meeting_invites invite
      where invite.room_id=target_room_id and invite.invited_user_id is not null
        and invite.status in('active','accepted') and invite.revoked_at is null
        and (invite.expires_at is null or invite.expires_at>now())
    union all
    select redemption.user_id from public.meeting_invite_redemptions redemption
      join public.meeting_invites invite on invite.id=redemption.invite_id where invite.room_id=target_room_id
    union all
    select participant.user_id from public.meeting_session_participants participant
      join public.meeting_sessions session on session.id=participant.session_id
      where session.room_id=target_room_id and participant.user_id is not null
        and participant.state in('invited','waiting','joining','connected','reconnecting')
  ) candidates
  where candidates.user_id is not null and exists(select 1 from public.profiles profile where profile.id=candidates.user_id);
$$;

create or replace function public.deliver_meeting_notification_job(target_job_id uuid)
returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare job public.meeting_notification_jobs%rowtype; target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype;
begin
  select * into job from public.meeting_notification_jobs where id=target_job_id for update;
  if job.id is null or job.processed_at is not null then return false; end if;
  if job.expires_at<=now() or job.attempt_count>=job.max_attempts then
    update public.meeting_notification_jobs set processed_at=now(),last_error_code=coalesce(last_error_code,'EXPIRED'),updated_at=now() where id=job.id;
    return false;
  end if;
  select * into target_room from public.meeting_rooms where id=job.room_id and archived_at is null;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_room.id is null or target_community.id is null or not exists(select 1 from public.profiles where id=job.recipient_id) then
    update public.meeting_notification_jobs set processed_at=now(),last_error_code='TARGET_UNAVAILABLE',updated_at=now() where id=job.id;
    return false;
  end if;
  begin
    insert into public.notifications(
      recipient_id,actor_id,category,title,preview,context_kind,context_label,community_id,channel_id,
      source_event_id,meeting_room_id,meeting_session_id,meeting_starts_at,deep_link
    ) values(
      job.recipient_id,job.actor_id,'event',job.title,job.preview,'community',job.context_label,
      target_room.community_id,target_room.channel_id,job.event_key,job.room_id,job.session_id,job.meeting_starts_at,job.deep_link
    ) on conflict(recipient_id,source_event_id) where source_event_id is not null do nothing;
    update public.meeting_notification_jobs set processed_at=now(),last_error_code=null,updated_at=now() where id=job.id;
    return true;
  exception when others then
    update public.meeting_notification_jobs set attempt_count=attempt_count+1,
      available_at=now()+make_interval(secs=>least(3600,30*(2^least(attempt_count,6)))),
      last_error_code=sqlstate,updated_at=now() where id=job.id;
    return false;
  end;
end;
$$;

create or replace function public.enqueue_meeting_notification(
  target_recipient_id uuid,target_actor_id uuid,target_room_id uuid,target_session_id uuid,
  target_event_kind text,target_event_key text,target_title text,target_preview text,
  target_meeting_starts_at timestamptz default null,target_available_at timestamptz default now()
) returns uuid language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; job_id uuid;
begin
  if target_event_kind not in('reminder','started','schedule_changed','cancelled','invite_received','waiting_request','admission_result','cohost_assigned','stage_request') then raise exception 'MEETING_NOTIFICATION_KIND_INVALID' using errcode='22023'; end if;
  if target_event_key is null or char_length(target_event_key) not between 8 and 220 or target_event_key!~'^[A-Za-z0-9._:-]+$' then raise exception 'MEETING_NOTIFICATION_KEY_INVALID' using errcode='22023'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id and archived_at is null;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_room.id is null or target_community.id is null or not exists(select 1 from public.profiles where id=target_recipient_id) then return null; end if;
  insert into public.meeting_notification_jobs(
    recipient_id,actor_id,room_id,session_id,event_kind,event_key,title,preview,context_label,deep_link,meeting_starts_at,available_at
  ) values(
    target_recipient_id,target_actor_id,target_room_id,target_session_id,target_event_kind,target_event_key,
    left(target_title,160),left(coalesce(target_preview,''),500),left(target_community.name||' / '||target_room.title,160),
    public.meeting_notification_deep_link(target_room_id,target_session_id),target_meeting_starts_at,coalesce(target_available_at,now())
  ) on conflict(recipient_id,event_key) do update set updated_at=now() returning id into job_id;
  perform public.deliver_meeting_notification_job(job_id);
  return job_id;
end;
$$;

create or replace function public.dispatch_due_meeting_notifications(target_limit integer default 100)
returns integer language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare item record; delivered integer:=0;
begin
  if coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in('postgres','supabase_admin') then raise exception 'MEETING_NOTIFICATION_WORKER_REQUIRED' using errcode='42501'; end if;
  for item in select id from public.meeting_notification_jobs
    where processed_at is null and available_at<=now() and expires_at>now() and attempt_count<max_attempts
    order by available_at,created_at for update skip locked limit least(greatest(target_limit,1),500)
  loop if public.deliver_meeting_notification_job(item.id) then delivered:=delivered+1; end if; end loop;
  return delivered;
end;
$$;

create or replace function public.enqueue_due_meeting_reminders(target_now timestamptz default now(),target_limit integer default 500)
returns integer language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare room_record public.meeting_rooms%rowtype; minute_record record; recipient_record record; queued integer:=0; reminder_at timestamptz;
begin
  if coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in('postgres','supabase_admin') then raise exception 'MEETING_NOTIFICATION_WORKER_REQUIRED' using errcode='42501'; end if;
  for room_record in select * from public.meeting_rooms where status='scheduled' and archived_at is null
    and scheduled_for>target_now and coalesce((reminder_policy->>'enabled')::boolean,false)
    and jsonb_typeof(reminder_policy->'minutesBefore')='array' order by scheduled_for limit 500
  loop
    for minute_record in select value::integer minutes_before from jsonb_array_elements_text(room_record.reminder_policy->'minutesBefore') value
      where value~'^[0-9]{1,4}$' and value::integer between 0 and 1440
    loop
      reminder_at:=room_record.scheduled_for-make_interval(mins=>minute_record.minutes_before);
      if reminder_at<=target_now then
        for recipient_record in select user_id from public.meeting_notification_recipient_ids(room_record.id)
        loop
          perform public.enqueue_meeting_notification(
            recipient_record.user_id,null,room_record.id,null,'reminder',
            'meeting-reminder:'||room_record.id::text||':'||extract(epoch from room_record.scheduled_for)::bigint::text||':'||minute_record.minutes_before::text||':'||recipient_record.user_id::text,
            'Meeting starts soon',room_record.title||' is scheduled to begin soon.',room_record.scheduled_for,target_now
          );
          queued:=queued+1; if queued>=least(greatest(target_limit,1),2000) then return queued; end if;
        end loop;
      end if;
    end loop;
  end loop;
  return queued;
end;
$$;

create or replace function public.process_meeting_notification_jobs(target_now timestamptz default now(),target_limit integer default 500)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare reminders integer; delivered integer;
begin
  reminders:=public.enqueue_due_meeting_reminders(target_now,target_limit);
  delivered:=public.dispatch_due_meeting_notifications(target_limit);
  return jsonb_build_object('remindersClaimed',reminders,'retriesDelivered',delivered,'processedAt',target_now);
end;
$$;

create or replace function public.notify_meeting_schedule_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient record; kind text; title_text text; preview_text text; event_key text;
begin
  if new.status='cancelled' and old.status is distinct from new.status then kind:='cancelled';title_text:='Meeting cancelled';preview_text:=new.title||' was cancelled.';
  elsif new.scheduled_for is distinct from old.scheduled_for or new.scheduled_end_at is distinct from old.scheduled_end_at then kind:='schedule_changed';title_text:='Meeting schedule changed';preview_text:=new.title||' has a new schedule.';
  else return new; end if;
  event_key:='meeting-schedule:'||new.id::text||':'||kind||':'||extract(epoch from coalesce(new.updated_at,now()))::bigint::text;
  for recipient in select user_id from public.meeting_notification_recipient_ids(new.id) loop
    perform public.enqueue_meeting_notification(recipient.user_id,auth.uid(),new.id,null,kind,event_key||':'||recipient.user_id::text,title_text,preview_text,new.scheduled_for,now());
  end loop;
  return new;
end;
$$;

create or replace function public.notify_meeting_cohost_assignment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient_id uuid;
begin
  foreach recipient_id in array coalesce(new.cohost_user_ids,'{}'::uuid[]) loop
    if not recipient_id=any(coalesce(old.cohost_user_ids,'{}'::uuid[])) then
      perform public.enqueue_meeting_notification(recipient_id,auth.uid(),new.id,null,'cohost_assigned','meeting-cohost:'||new.id::text||':'||recipient_id::text||':'||extract(epoch from coalesce(new.updated_at,now()))::bigint::text,'You are a meeting cohost','You can now help manage '||new.title||'.',new.scheduled_for,now());
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.notify_meeting_session_started()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare room_record public.meeting_rooms%rowtype; recipient record;
begin
  if new.status<>'live' or (tg_op='UPDATE' and old.status is not distinct from new.status) then return new; end if;
  select * into room_record from public.meeting_rooms where id=new.room_id;
  for recipient in select user_id from public.meeting_notification_recipient_ids(new.room_id) loop
    if recipient.user_id is distinct from new.started_by_user_id then perform public.enqueue_meeting_notification(recipient.user_id,new.started_by_user_id,new.room_id,new.id,'started','meeting-started:'||new.id::text||':'||recipient.user_id::text,'Meeting started',room_record.title||' is live now.',room_record.scheduled_for,now()); end if;
  end loop;
  return new;
end;
$$;

create or replace function public.notify_meeting_invite_received()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare room_record public.meeting_rooms%rowtype;
begin
  if new.invited_user_id is null then return new; end if;
  select * into room_record from public.meeting_rooms where id=new.room_id;
  perform public.enqueue_meeting_notification(new.invited_user_id,new.invited_by_user_id,new.room_id,new.session_id,'invite_received','meeting-invite:'||new.id::text||':'||new.invited_user_id::text,'Meeting invitation','You were invited to '||room_record.title||'.',room_record.scheduled_for,now());
  return new;
end;
$$;

create or replace function public.notify_meeting_waiting_hosts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; recipient_id uuid;
begin
  if new.status<>'waiting' then return new; end if;
  select * into target_room from public.meeting_rooms where id=new.room_id;
  for recipient_id in select distinct candidate from unnest(array_append(coalesce(target_room.cohost_user_ids,'{}'::uuid[]),target_room.host_user_id)) candidate where candidate<>new.user_id
  loop perform public.enqueue_meeting_notification(recipient_id,new.user_id,new.room_id,new.session_id,'waiting_request','meeting-waiting-request:'||new.id::text||':'||recipient_id::text,'Meeting join request',new.display_name||' is waiting to join.',target_room.scheduled_for,now()); end loop;
  update public.meeting_waiting_entries set host_notified_at=coalesce(host_notified_at,now()),updated_at=now() where id=new.id;
  return new;
end;
$$;

create or replace function public.notify_meeting_waiting_resolution()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; notification_title text; notification_preview text;
begin
  if new.status is not distinct from old.status or new.status='waiting' then return new; end if;
  select * into target_room from public.meeting_rooms where id=new.room_id;
  notification_title:=case new.status when 'admitted' then 'You can join the meeting' when 'denied' then 'Meeting join request denied' when 'expired' then 'Meeting join request expired' else 'Meeting join request cancelled' end;
  notification_preview:=case new.status when 'admitted' then 'The host admitted you. Open the meeting to connect.' when 'denied' then 'The host did not admit this request.' when 'expired' then 'The waiting request is no longer active.' else 'The waiting request was cancelled.' end;
  perform public.enqueue_meeting_notification(new.user_id,new.resolved_by_user_id,new.room_id,new.session_id,'admission_result','meeting-waiting-result:'||new.id::text||':'||new.status,notification_title,notification_preview,target_room.scheduled_for,now());
  return new;
end;
$$;

create or replace function public.notify_meeting_stage_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype; session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype; recipient_id uuid;
begin
  if new.stage_request_status<>'requested' or old.stage_request_status is not distinct from new.stage_request_status then return new; end if;
  select * into participant_record from public.meeting_session_participants where id=new.participant_id;
  select * into session_record from public.meeting_sessions where id=new.session_id;
  select * into room_record from public.meeting_rooms where id=session_record.room_id;
  for recipient_id in select distinct candidate from unnest(array_append(coalesce(room_record.cohost_user_ids,'{}'::uuid[]),room_record.host_user_id)) candidate where candidate is distinct from participant_record.user_id
  loop perform public.enqueue_meeting_notification(recipient_id,participant_record.user_id,room_record.id,session_record.id,'stage_request','meeting-stage-request:'||new.participant_id::text||':'||extract(epoch from new.stage_requested_at)::bigint::text||':'||recipient_id::text,'Stage request',participant_record.display_name||' requested to join the stage.',room_record.scheduled_for,now()); end loop;
  return new;
end;
$$;

drop trigger if exists meeting_schedule_notification on public.meeting_rooms;
create trigger meeting_schedule_notification after update of scheduled_for,scheduled_end_at,status on public.meeting_rooms for each row execute function public.notify_meeting_schedule_change();
drop trigger if exists meeting_cohost_notification on public.meeting_rooms;
create trigger meeting_cohost_notification after update of cohost_user_ids on public.meeting_rooms for each row execute function public.notify_meeting_cohost_assignment();
drop trigger if exists meeting_session_started_notification on public.meeting_sessions;
create trigger meeting_session_started_notification after insert or update of status on public.meeting_sessions for each row execute function public.notify_meeting_session_started();
drop trigger if exists meeting_invite_received_notification on public.meeting_invites;
create trigger meeting_invite_received_notification after insert on public.meeting_invites for each row execute function public.notify_meeting_invite_received();
drop trigger if exists meeting_stage_request_notification on public.meeting_participant_runtime_state;
create trigger meeting_stage_request_notification after update of stage_request_status on public.meeting_participant_runtime_state for each row execute function public.notify_meeting_stage_request();

revoke all on function public.meeting_notification_deep_link(uuid,uuid),public.meeting_notification_recipient_ids(uuid),public.deliver_meeting_notification_job(uuid),public.enqueue_meeting_notification(uuid,uuid,uuid,uuid,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.notify_meeting_schedule_change(),public.notify_meeting_cohost_assignment(),public.notify_meeting_session_started(),public.notify_meeting_invite_received(),public.notify_meeting_waiting_hosts(),public.notify_meeting_waiting_resolution(),public.notify_meeting_stage_request() from public,anon,authenticated;
revoke all on function public.dispatch_due_meeting_notifications(integer),public.enqueue_due_meeting_reminders(timestamptz,integer),public.process_meeting_notification_jobs(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.dispatch_due_meeting_notifications(integer),public.enqueue_due_meeting_reminders(timestamptz,integer),public.process_meeting_notification_jobs(timestamptz,integer) to service_role;

comment on table public.meeting_notification_jobs is 'Private idempotent outbox for meeting notification metadata. A protected scheduler retries due jobs; raw invite tokens and provider credentials are forbidden.';
comment on function public.process_meeting_notification_jobs(timestamptz,integer) is 'Service-role scheduler entry point. Claims due reminders and retries notification inbox inserts without duplicate source events.';
commit;
