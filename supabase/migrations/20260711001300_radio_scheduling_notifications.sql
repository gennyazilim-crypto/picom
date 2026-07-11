begin;

create table if not exists public.radio_session_reminders (
  id uuid primary key default gen_random_uuid(),
  radio_session_id uuid not null references public.radio_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  remind_minutes_before integer not null default 15 check (remind_minutes_before between 0 and 1440),
  last_known_starts_at timestamptz not null,
  last_known_status text not null check (last_known_status in ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  last_notification_key text,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (radio_session_id, user_id)
);

create index if not exists radio_session_reminders_user_schedule_idx
  on public.radio_session_reminders(user_id, last_known_starts_at);
create index if not exists radio_session_reminders_session_idx
  on public.radio_session_reminders(radio_session_id);

create or replace function public.touch_radio_session_reminder_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists radio_session_reminders_touch_updated_at on public.radio_session_reminders;
create trigger radio_session_reminders_touch_updated_at
before update on public.radio_session_reminders
for each row execute function public.touch_radio_session_reminder_updated_at();

alter table public.radio_session_reminders enable row level security;

drop policy if exists radio_session_reminders_select_own on public.radio_session_reminders;
create policy radio_session_reminders_select_own
on public.radio_session_reminders for select to authenticated
using (user_id = auth.uid() and public.can_view_radio_session(radio_session_id));

drop policy if exists radio_session_reminders_insert_own_visible_schedule on public.radio_session_reminders;
create policy radio_session_reminders_insert_own_visible_schedule
on public.radio_session_reminders for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_radio_session(radio_session_id)
  and exists (
    select 1 from public.radio_sessions session
    where session.id = radio_session_id and session.status = 'scheduled'
  )
);

drop policy if exists radio_session_reminders_update_own on public.radio_session_reminders;
create policy radio_session_reminders_update_own
on public.radio_session_reminders for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists radio_session_reminders_delete_own on public.radio_session_reminders;
create policy radio_session_reminders_delete_own
on public.radio_session_reminders for delete to authenticated
using (user_id = auth.uid());

create or replace function public.claim_radio_session_reminder_event(
  target_reminder_id uuid,
  event_key text,
  event_starts_at timestamptz,
  event_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(event_key, ''))) not between 1 and 240 then
    raise exception 'RADIO_REMINDER_EVENT_KEY_INVALID' using errcode = '22023';
  end if;
  if event_status not in ('draft', 'scheduled', 'live', 'ended', 'cancelled') then
    raise exception 'RADIO_REMINDER_STATUS_INVALID' using errcode = '22023';
  end if;

  update public.radio_session_reminders reminder
  set last_notification_key = event_key,
      last_notified_at = now(),
      last_known_starts_at = event_starts_at,
      last_known_status = event_status,
      updated_at = now()
  where reminder.id = target_reminder_id
    and reminder.user_id = auth.uid()
    and reminder.last_notification_key is distinct from event_key;
  return found;
end;
$$;

revoke all on table public.radio_session_reminders from public, anon;
grant select, insert, update, delete on table public.radio_session_reminders to authenticated;
revoke all on function public.claim_radio_session_reminder_event(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.claim_radio_session_reminder_event(uuid, text, timestamptz, text) to authenticated;

comment on table public.radio_session_reminders is 'Per-user Radio schedule reminders. RLS prevents reading or mutating another listener reminder.';
comment on function public.claim_radio_session_reminder_event(uuid, text, timestamptz, text) is 'Atomically claims a schedule-change, cancellation, live, or due reminder event to prevent duplicate notifications across reconnects.';

commit;
