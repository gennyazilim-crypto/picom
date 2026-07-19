alter table public.account_deletion_requests
  add column if not exists anonymize_after timestamptz,
  add column if not exists sessions_revoked_at timestamptz,
  add column if not exists session_revocation_status text not null default 'pending'
    check (session_revocation_status in ('pending', 'completed', 'failed'));
create unique index if not exists idx_account_deletion_one_active_request
  on public.account_deletion_requests(user_id)
  where status in ('requested', 'reviewing');
create table if not exists public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null check (event_type in (
    'account_deletion_requested',
    'account_deletion_canceled',
    'account_sessions_revoked'
  )),
  request_id uuid references public.account_deletion_requests(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.account_security_events is
  'Append-only account security events. Never store passwords, tokens, raw IP addresses, or message content.';
create index if not exists idx_account_security_events_user_created
  on public.account_security_events(user_id, created_at desc);
alter table public.account_security_events enable row level security;
grant select on public.account_security_events to authenticated;
revoke insert, update, delete on public.account_security_events from authenticated;
drop policy if exists "account_security_events_own_select" on public.account_security_events;
create policy "account_security_events_own_select"
  on public.account_security_events
  for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists "deletion_request_own_cancel" on public.account_deletion_requests;
revoke update, delete on public.account_deletion_requests from authenticated;
create or replace function public.request_current_user_account_deletion(confirmation_username text)
returns table(request_id uuid, requested_at timestamptz, anonymize_after timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  profile_username text;
  existing_request public.account_deletion_requests%rowtype;
  created_request public.account_deletion_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select profile.username into profile_username
  from public.profiles profile
  where profile.id = current_user_id
  for update;

  if profile_username is null or lower(trim(profile_username)) <> lower(trim(confirmation_username)) then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.communities community where community.owner_id = current_user_id
  ) then
    raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode = '23514';
  end if;

  select request.* into existing_request
  from public.account_deletion_requests request
  where request.user_id = current_user_id
    and request.status in ('requested', 'reviewing')
  order by request.requested_at desc
  limit 1;

  if existing_request.id is not null then
    return query select existing_request.id, existing_request.requested_at, existing_request.anonymize_after;
    return;
  end if;

  insert into public.account_deletion_requests (
    user_id,
    status,
    anonymize_after,
    session_revocation_status
  ) values (
    current_user_id,
    'requested',
    now() + interval '14 days',
    'pending'
  ) returning * into created_request;

  update public.profiles
  set deletion_requested_at = created_request.requested_at,
      updated_at = now()
  where id = current_user_id;

  insert into public.account_security_events(user_id, event_type, request_id, metadata)
  values (
    current_user_id,
    'account_deletion_requested',
    created_request.id,
    jsonb_build_object('anonymize_after', created_request.anonymize_after)
  );

  return query select created_request.id, created_request.requested_at, created_request.anonymize_after;
end;
$$;
create or replace function public.cancel_current_user_account_deletion()
returns table(request_id uuid, canceled_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  active_request public.account_deletion_requests%rowtype;
  cancellation_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select request.* into active_request
  from public.account_deletion_requests request
  where request.user_id = current_user_id
    and request.status = 'requested'
  order by request.requested_at desc
  limit 1
  for update;

  if active_request.id is null then
    raise exception 'NO_ACTIVE_DELETION_REQUEST' using errcode = '22023';
  end if;

  update public.account_deletion_requests
  set status = 'canceled', canceled_at = cancellation_time
  where id = active_request.id;

  update public.profiles
  set deletion_requested_at = null, updated_at = now()
  where id = current_user_id;

  insert into public.account_security_events(user_id, event_type, request_id)
  values (current_user_id, 'account_deletion_canceled', active_request.id);

  return query select active_request.id, cancellation_time;
end;
$$;
grant execute on function public.request_current_user_account_deletion(text) to authenticated;
grant execute on function public.cancel_current_user_account_deletion() to authenticated;
-- Final anonymization is intentionally not scheduled here. A trusted operator or
-- reviewed background worker must apply the documented policy after the grace
-- period. No desktop or authenticated route can hard-delete an account.;
