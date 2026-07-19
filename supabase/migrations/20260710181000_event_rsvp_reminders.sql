alter table public.community_events add column if not exists event_type text not null default 'meeting' check (event_type in ('meeting','voice','release','review','social'));
create table if not exists public.community_event_rsvps (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('interested','going','not_going')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,user_id)
);
create table if not exists public.community_event_reminders (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes_before integer not null default 15 check (minutes_before between 5 and 1440), enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,user_id)
);
alter table public.community_event_rsvps enable row level security;
alter table public.community_event_reminders enable row level security;
grant select on public.community_event_rsvps to authenticated;
grant select,insert,update,delete on public.community_event_reminders to authenticated;
create policy "event_rsvp_self_select" on public.community_event_rsvps for select to authenticated using (user_id=auth.uid());
create policy "event_reminder_self_all" on public.community_event_reminders for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.community_events event where event.id=event_id and event.cancelled_at is null and public.is_community_member(event.community_id)));
create or replace function public.set_community_event_rsvp(target_event_id uuid, next_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare target_community_id uuid;
begin
  if next_status not in ('interested','going','not_going') then raise exception 'EVENT_RSVP_INVALID'; end if;
  select community_id into target_community_id from public.community_events where id=target_event_id and cancelled_at is null and starts_at > now();
  if target_community_id is null or not public.is_community_member(target_community_id) then raise exception 'EVENT_RSVP_FORBIDDEN'; end if;
  insert into public.community_event_rsvps(event_id,user_id,status) values(target_event_id,auth.uid(),next_status)
  on conflict(event_id,user_id) do update set status=excluded.status,updated_at=now();
  return true;
end;
$$;
revoke insert,update,delete on public.community_event_rsvps from authenticated;
grant execute on function public.set_community_event_rsvp(uuid,text) to authenticated;
create index if not exists idx_event_rsvps_event_status on public.community_event_rsvps(event_id,status);
comment on table public.community_event_reminders is 'User-owned reminder preferences. Delivery must re-check notification, DND, mute, and quiet-hour settings.';
