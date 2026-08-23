-- Publisher stream schedule reminders + Live Now notification preference modes.
-- Does not modify Case 04 / Case 18 discovery or eligibility counting.

begin;

-- ---------------------------------------------------------------------------
-- Notification preference modes → product contract
-- all_live | scheduled_only | important_only | off
-- ---------------------------------------------------------------------------
alter table public.live_broadcaster_notification_prefs
  drop constraint if exists live_broadcaster_notification_prefs_mode_check;

update public.live_broadcaster_notification_prefs
set mode = case mode
  when 'all' then 'all_live'
  when 'community_member_only' then 'important_only'
  else mode
end
where mode in ('all', 'community_member_only');

alter table public.live_broadcaster_notification_prefs
  alter column mode set default 'all_live';

alter table public.live_broadcaster_notification_prefs
  add constraint live_broadcaster_notification_prefs_mode_check
  check (mode in ('all_live', 'scheduled_only', 'important_only', 'off'));

create or replace function public.upsert_live_broadcaster_notification_pref(
  target_broadcaster_id uuid,
  target_mode text
)
returns public.live_broadcaster_notification_prefs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  mode_text text := lower(btrim(coalesce(target_mode, 'all_live')));
  row_out public.live_broadcaster_notification_prefs%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_broadcaster_id is null or target_broadcaster_id = actor_id then
    raise exception 'LIVE_NOTIF_FORBIDDEN' using errcode = '42501';
  end if;

  -- Accept legacy aliases for one release window.
  if mode_text = 'all' then mode_text := 'all_live'; end if;
  if mode_text = 'community_member_only' then mode_text := 'important_only'; end if;

  if mode_text not in ('all_live', 'scheduled_only', 'important_only', 'off') then
    raise exception 'LIVE_NOTIF_INVALID_MODE' using errcode = '22023';
  end if;
  if public.users_are_blocked(actor_id, target_broadcaster_id) then
    raise exception 'LIVE_NOTIF_BLOCKED' using errcode = '42501';
  end if;

  insert into public.live_broadcaster_notification_prefs(viewer_user_id, broadcaster_user_id, mode, updated_at)
  values (actor_id, target_broadcaster_id, mode_text, now())
  on conflict (viewer_user_id, broadcaster_user_id) do update
    set mode = excluded.mode,
        updated_at = now()
  returning * into row_out;

  return row_out;
end;
$$;

revoke all on function public.upsert_live_broadcaster_notification_pref(uuid, text) from public, anon;
grant execute on function public.upsert_live_broadcaster_notification_pref(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Publisher schedule reminders (user_id + schedule_id unique)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_stream_schedule_reminders (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.publisher_stream_schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes_before integer not null default 30 check (minutes_before between 5 and 1440),
  enabled boolean not null default true,
  channel text not null default 'app' check (channel in ('app', 'email', 'native', 'web')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'claimed', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  claimed_at timestamptz,
  claimed_by text,
  sent_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, schedule_id)
);

create unique index if not exists publisher_stream_schedule_reminders_idempotency_uidx
  on public.publisher_stream_schedule_reminders (idempotency_key)
  where idempotency_key is not null;

create index if not exists publisher_stream_schedule_reminders_due_idx
  on public.publisher_stream_schedule_reminders (delivery_status, scheduled_at)
  where enabled = true and delivery_status = 'pending';

alter table public.publisher_stream_schedule_reminders enable row level security;
alter table public.publisher_stream_schedule_reminders force row level security;
revoke all on public.publisher_stream_schedule_reminders from public, anon, authenticated;
grant select, update on public.publisher_stream_schedule_reminders to authenticated;
grant all on public.publisher_stream_schedule_reminders to service_role;

drop policy if exists publisher_schedule_reminders_select on public.publisher_stream_schedule_reminders;
create policy publisher_schedule_reminders_select
  on public.publisher_stream_schedule_reminders for select to authenticated
  using (user_id = auth.uid());

drop policy if exists publisher_schedule_reminders_update on public.publisher_stream_schedule_reminders;
create policy publisher_schedule_reminders_update
  on public.publisher_stream_schedule_reminders for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_publisher_stream_schedule_reminder(
  target_schedule_id uuid,
  target_enabled boolean,
  target_minutes_before integer default 30,
  target_channel text default 'app'
)
returns public.publisher_stream_schedule_reminders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  schedule_row public.publisher_stream_schedules%rowtype;
  minutes integer := greatest(5, least(1440, coalesce(target_minutes_before, 30)));
  channel_text text := lower(btrim(coalesce(target_channel, 'app')));
  row_out public.publisher_stream_schedule_reminders%rowtype;
  fire_at timestamptz;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if channel_text not in ('app', 'email', 'native', 'web') then
    raise exception 'PUBLISHER_REMINDER_CHANNEL_INVALID' using errcode = '22023';
  end if;

  select * into schedule_row
  from public.publisher_stream_schedules
  where id = target_schedule_id;
  if not found then
    raise exception 'PUBLISHER_SCHEDULE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if schedule_row.status not in ('scheduled', 'ready') then
    raise exception 'PUBLISHER_SCHEDULE_NOT_REMINDABLE' using errcode = '22023';
  end if;
  if schedule_row.visibility not in ('public', 'followers_only') then
    raise exception 'PUBLISHER_SCHEDULE_NOT_VISIBLE' using errcode = '42501';
  end if;
  if public.users_are_blocked(actor_id, schedule_row.owner_user_id) then
    raise exception 'PUBLISHER_REMINDER_BLOCKED' using errcode = '42501';
  end if;

  if not coalesce(target_enabled, false) then
    update public.publisher_stream_schedule_reminders
    set enabled = false,
        delivery_status = 'cancelled',
        updated_at = now()
    where schedule_id = target_schedule_id
      and user_id = actor_id
    returning * into row_out;
    if not found then
      insert into public.publisher_stream_schedule_reminders (
        schedule_id, user_id, minutes_before, enabled, channel, delivery_status, scheduled_at, idempotency_key
      ) values (
        target_schedule_id, actor_id, minutes, false, channel_text, 'cancelled', null,
        'publisher-schedule-reminder:' || target_schedule_id::text || ':' || actor_id::text || ':v1'
      )
      returning * into row_out;
    end if;
    return row_out;
  end if;

  fire_at := schedule_row.scheduled_start_at - make_interval(mins => minutes);
  if fire_at < now() then
    fire_at := now() + interval '30 seconds';
  end if;

  insert into public.publisher_stream_schedule_reminders (
    schedule_id, user_id, minutes_before, enabled, channel, delivery_status,
    scheduled_at, claimed_at, claimed_by, sent_at, idempotency_key, updated_at
  ) values (
    target_schedule_id, actor_id, minutes, true, channel_text, 'pending',
    fire_at, null, null, null,
    'publisher-schedule-reminder:' || target_schedule_id::text || ':' || actor_id::text || ':v1',
    now()
  )
  on conflict (user_id, schedule_id) do update
    set minutes_before = excluded.minutes_before,
        enabled = true,
        channel = excluded.channel,
        delivery_status = 'pending',
        scheduled_at = excluded.scheduled_at,
        claimed_at = null,
        claimed_by = null,
        sent_at = null,
        updated_at = now()
  returning * into row_out;

  return row_out;
end;
$$;

revoke all on function public.set_publisher_stream_schedule_reminder(uuid, boolean, integer, text) from public, anon;
grant execute on function public.set_publisher_stream_schedule_reminder(uuid, boolean, integer, text) to authenticated;

create or replace function public.list_my_publisher_stream_schedule_reminders()
returns table (
  schedule_id uuid,
  enabled boolean,
  minutes_before integer,
  scheduled_at timestamptz,
  delivery_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.schedule_id, r.enabled, r.minutes_before, r.scheduled_at, r.delivery_status
  from public.publisher_stream_schedule_reminders r
  where r.user_id = auth.uid()
    and r.enabled = true
    and r.delivery_status in ('pending', 'claimed');
$$;

revoke all on function public.list_my_publisher_stream_schedule_reminders() from public, anon;
grant execute on function public.list_my_publisher_stream_schedule_reminders() to authenticated;

-- Keep reminder schedule in sync when publisher schedule moves / cancels.
create or replace function public.sync_publisher_stream_schedule_reminders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.publisher_stream_schedule_reminders
    set enabled = false, delivery_status = 'cancelled', updated_at = now()
    where schedule_id = old.id and delivery_status in ('pending', 'claimed');
    return old;
  end if;

  if new.status in ('cancelled', 'blocked', 'completed') then
    update public.publisher_stream_schedule_reminders
    set enabled = false, delivery_status = 'cancelled', updated_at = now()
    where schedule_id = new.id and delivery_status in ('pending', 'claimed');
    return new;
  end if;

  if new.scheduled_start_at is distinct from old.scheduled_start_at then
    update public.publisher_stream_schedule_reminders
    set scheduled_at = greatest(
          new.scheduled_start_at - make_interval(mins => minutes_before),
          now() + interval '30 seconds'
        ),
        delivery_status = case when enabled then 'pending' else delivery_status end,
        claimed_at = null,
        claimed_by = null,
        sent_at = null,
        updated_at = now()
    where schedule_id = new.id
      and enabled = true
      and delivery_status in ('pending', 'claimed', 'sent');
  end if;

  return new;
end;
$$;

drop trigger if exists publisher_stream_schedules_reminder_sync on public.publisher_stream_schedules;
create trigger publisher_stream_schedules_reminder_sync
  after update or delete on public.publisher_stream_schedules
  for each row execute function public.sync_publisher_stream_schedule_reminders();

create or replace function public.claim_publisher_stream_schedule_reminders(
  p_worker_id text,
  p_batch_size integer default 25
)
returns setof public.publisher_stream_schedule_reminders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id from public.publisher_stream_schedule_reminders
    where delivery_status = 'pending'
      and enabled = true
      and scheduled_at is not null
      and scheduled_at <= now()
    order by scheduled_at
    limit greatest(coalesce(p_batch_size, 25), 1)
    for update skip locked
  )
  update public.publisher_stream_schedule_reminders r
  set delivery_status = 'claimed', claimed_at = now(), claimed_by = p_worker_id, updated_at = now()
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

revoke all on function public.claim_publisher_stream_schedule_reminders(text, integer) from public, anon, authenticated;
grant execute on function public.claim_publisher_stream_schedule_reminders(text, integer) to service_role;

-- Fanout preference checks (legacy aliases accepted via coalesce remap in preference reads).
create or replace function public.normalize_live_broadcaster_notif_mode(raw text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(btrim(coalesce(raw, 'all_live')))
    when 'all' then 'all_live'
    when 'community_member_only' then 'important_only'
    when 'all_live' then 'all_live'
    when 'scheduled_only' then 'scheduled_only'
    when 'important_only' then 'important_only'
    when 'off' then 'off'
    else 'all_live'
  end;
$$;

-- Keep live-start fanout aligned with product modes (all_live / important_only).
create or replace function public.fanout_live_broadcast_started(target_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.community_live_screen_sessions%rowtype;
  recipient record;
  pref_mode text;
  has_schedule boolean := false;
  is_member boolean := false;
  inserted integer := 0;
  n_inserted integer := 0;
  event_key text;
  actor_name text;
  title_text text;
  preview_text text;
  deep text;
begin
  select * into session_row
  from public.community_live_screen_sessions
  where id = target_session_id;

  if not found or session_row.status <> 'live' then
    return 0;
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), p.username, 'Broadcaster') into actor_name
  from public.profiles p
  where p.id = session_row.broadcaster_user_id;

  has_schedule := exists (
    select 1 from public.community_events event
    where event.event_type = 'livestream'
      and event.cancelled_at is null
      and (
        (event.metadata ->> 'live_session_id') = session_row.id::text
        or (
          event.created_by = session_row.broadcaster_user_id
          and event.status in ('published', 'live')
          and event.starts_at <= coalesce(session_row.started_at, now()) + interval '2 hours'
          and event.starts_at >= coalesce(session_row.started_at, now()) - interval '6 hours'
          and (event.community_id is null or event.community_id = session_row.community_id)
          and (event.channel_id is null or event.channel_id = session_row.channel_id)
        )
      )
  );

  title_text := left(coalesce(nullif(btrim(session_row.title), ''), 'Live now'), 160);
  preview_text := left(actor_name || ' started a live stream', 500);
  deep := 'picom://live-now/' || session_row.id::text;

  for recipient in
    select follow.follower_id as user_id
    from public.user_follows follow
    where follow.followed_id = session_row.broadcaster_user_id
  loop
    if public.users_are_blocked(recipient.user_id, session_row.broadcaster_user_id) then
      continue;
    end if;

    if not public.can_recipient_view_live_screen_session(recipient.user_id, session_row) then
      continue;
    end if;

    select public.normalize_live_broadcaster_notif_mode(pref.mode) into pref_mode
    from (select 1) _
    left join public.live_broadcaster_notification_prefs pref
      on pref.viewer_user_id = recipient.user_id
     and pref.broadcaster_user_id = session_row.broadcaster_user_id;

    if pref_mode is null then
      pref_mode := 'all_live';
    end if;

    if pref_mode = 'off' then
      continue;
    end if;

    if pref_mode = 'scheduled_only' and not has_schedule then
      continue;
    end if;

    if pref_mode = 'important_only' then
      is_member := exists (
        select 1 from public.community_members member
        where member.community_id = session_row.community_id
          and member.user_id = recipient.user_id
      );
      if not is_member then
        continue;
      end if;
    end if;

    if exists (
      select 1 from public.notification_preferences np
      where np.user_id = recipient.user_id
        and np.connection_notifications is false
    ) then
      continue;
    end if;

    event_key := 'live-start:' || session_row.id::text || ':' || recipient.user_id::text || ':v1';

    insert into public.notifications(
      recipient_id,
      actor_id,
      category,
      title,
      preview,
      context_kind,
      context_label,
      community_id,
      channel_id,
      user_id,
      source_event_id,
      deep_link
    ) values (
      recipient.user_id,
      session_row.broadcaster_user_id,
      'event',
      title_text,
      preview_text,
      'community',
      left(coalesce(
        (select c.name from public.communities c where c.id = session_row.community_id),
        'Live'
      ), 160),
      session_row.community_id,
      session_row.channel_id,
      session_row.broadcaster_user_id,
      event_key,
      deep
    )
    on conflict (recipient_id, source_event_id) where source_event_id is not null
    do nothing;

    get diagnostics n_inserted = row_count;
    inserted := inserted + n_inserted;
  end loop;

  return inserted;
end;
$$;

revoke all on function public.fanout_live_broadcast_started(uuid) from public, anon, authenticated;
grant execute on function public.fanout_live_broadcast_started(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
