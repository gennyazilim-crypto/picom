-- PICOM simplified deletion lifecycle.
-- Community and account deletion are server-authoritative, recoverable for 30 days,
-- and deliberately retain compliance/audit records after finalization.
begin;

-- ---------------------------------------------------------------------------
-- Community lifecycle: owner-requested, 30-day recovery, service finalization
-- ---------------------------------------------------------------------------

alter table public.communities
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists scheduled_deletion_at timestamptz,
  add column if not exists deletion_cancelled_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_restore_state jsonb;

alter table public.communities
  drop constraint if exists communities_deletion_schedule_check;
alter table public.communities
  add constraint communities_deletion_schedule_check check (
    (scheduled_deletion_at is null or deletion_requested_at is not null)
    and (deleted_at is null or scheduled_deletion_at is null)
    and (deletion_restore_state is null or jsonb_typeof(deletion_restore_state) = 'object')
  );

create index if not exists communities_due_deletion_idx
  on public.communities (scheduled_deletion_at)
  where scheduled_deletion_at is not null and deleted_at is null;

-- Existing owner/admin update paths remain usable, but lifecycle fields can only be
-- changed by the narrowly scoped RPCs below or the service finalizer.
create or replace function public.prevent_community_deletion_lifecycle_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    new.deletion_requested_at is distinct from old.deletion_requested_at
    or new.scheduled_deletion_at is distinct from old.scheduled_deletion_at
    or new.deletion_cancelled_at is distinct from old.deletion_cancelled_at
    or new.deleted_at is distinct from old.deleted_at
    or new.deletion_restore_state is distinct from old.deletion_restore_state
  ) and current_setting('picom.community_deletion_lifecycle', true) is distinct from 'trusted' then
    raise exception 'COMMUNITY_DELETION_LIFECYCLE_MANAGED_SERVER_SIDE' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists communities_deletion_lifecycle_guard on public.communities;
create trigger communities_deletion_lifecycle_guard
before update on public.communities
for each row execute function public.prevent_community_deletion_lifecycle_mutation();

-- Keep the discovery source authoritative even if a caller later changes a listing flag.
drop function if exists public.list_public_discovery_communities(text, text, integer);
create function public.list_public_discovery_communities(
  search_text text default null,
  category_filter text default null,
  result_limit integer default 60
)
returns table(
  id uuid,
  name text,
  description text,
  icon_url text,
  banner_url text,
  accent_color text,
  category text,
  member_count bigint,
  join_policy text,
  is_member boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select community.id, community.name, community.description, community.icon_url,
    community.banner_url, community.accent_color, community.category,
    count(membership.id) as member_count, community.discovery_join_policy as join_policy,
    coalesce(bool_or(membership.user_id = auth.uid()), false) as is_member
  from public.communities community
  join public.community_discovery_reviews review
    on review.community_id = community.id and review.status = 'approved'
  left join public.community_members membership on membership.community_id = community.id
  where community.visibility = 'public'
    and community.public_read_enabled = true
    and community.discovery_listed = true
    and community.scheduled_deletion_at is null
    and community.deleted_at is null
    and (category_filter is null or community.category = category_filter)
    and (
      search_text is null or btrim(search_text) = ''
      or community.name ilike '%' || left(btrim(search_text), 80) || '%'
      or coalesce(community.description, '') ilike '%' || left(btrim(search_text), 80) || '%'
    )
  group by community.id
  order by count(membership.id) desc, community.created_at desc
  limit least(greatest(result_limit, 1), 60);
$$;
revoke all on function public.list_public_discovery_communities(text, text, integer) from public;
grant execute on function public.list_public_discovery_communities(text, text, integer) to anon, authenticated;

create or replace function public.join_or_request_discovery_community(target_community_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_policy text; default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select community.discovery_join_policy into target_policy
  from public.communities community
  join public.community_discovery_reviews review on review.community_id = community.id and review.status = 'approved'
  where community.id = target_community_id
    and community.visibility = 'public'
    and community.public_read_enabled = true
    and community.discovery_listed = true
    and community.scheduled_deletion_at is null
    and community.deleted_at is null;
  if not found then raise exception 'DISCOVERY_COMMUNITY_UNAVAILABLE' using errcode = '22023'; end if;
  if exists (select 1 from public.community_members membership where membership.community_id = target_community_id and membership.user_id = auth.uid()) then
    return 'already_member';
  end if;
  if target_policy = 'request' then
    insert into public.community_join_requests(community_id, user_id, status, created_at, reviewed_at, reviewed_by)
    values(target_community_id, auth.uid(), 'pending', now(), null, null)
    on conflict (community_id, user_id) do update
      set status = case when community_join_requests.status in ('denied', 'canceled') then 'pending' else community_join_requests.status end,
          created_at = case when community_join_requests.status in ('denied', 'canceled') then now() else community_join_requests.created_at end,
          reviewed_at = null, reviewed_by = null;
    return 'requested';
  end if;
  select role.id into default_role_id
  from public.roles role
  where role.community_id = target_community_id and (role.is_default = true or role.name = 'Member')
  order by role.is_default desc, role.level asc limit 1;
  if default_role_id is null then raise exception 'DISCOVERY_DEFAULT_ROLE_MISSING' using errcode = '22023'; end if;
  insert into public.community_members(community_id, user_id, role_id)
  values(target_community_id, auth.uid(), default_role_id)
  on conflict (community_id, user_id) do nothing;
  return 'joined';
end;
$$;
revoke all on function public.join_or_request_discovery_community(uuid) from public, anon;
grant execute on function public.join_or_request_discovery_community(uuid) to authenticated;

create or replace function public.can_create_community_invite(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id
      and community.scheduled_deletion_at is null
      and community.deleted_at is null
  ) and (
    public.is_community_owner(target_community_id) or exists (
      select 1 from public.community_members membership
      join public.roles role on role.id = membership.role_id
      where membership.community_id = target_community_id
        and membership.user_id = auth.uid()
        and (role.level >= 60 or coalesce((role.permissions ->> 'createInvites')::boolean, false))
    )
  );
$$;
revoke all on function public.can_create_community_invite(uuid) from public, anon;
grant execute on function public.can_create_community_invite(uuid) to authenticated;

create or replace function public.enforce_community_membership_join_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_owner_id uuid;
begin
  if exists (
    select 1 from public.communities community
    where community.id = new.community_id
      and (community.scheduled_deletion_at is not null or community.deleted_at is not null)
  ) then raise exception 'COMMUNITY_DELETION_PENDING' using errcode = '23514'; end if;
  if exists (select 1 from public.community_bans ban where ban.community_id = new.community_id and ban.user_id = new.user_id and ban.revoked_at is null) then
    raise exception 'JOIN_BANNED' using errcode = '42501';
  end if;
  select community.owner_id into target_owner_id from public.communities community where community.id = new.community_id;
  if target_owner_id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '23503'; end if;
  if new.user_id <> target_owner_id and public.users_are_blocked(new.user_id, target_owner_id) then
    raise exception 'JOIN_BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.live_session_is_publisher_discovery_eligible(target public.community_live_screen_sessions)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target.status in ('live', 'reconnecting')
    and coalesce(target.visibility_mode, 'channel_members') = 'public_discovery'
    and coalesce(target.moderation_status, 'approved') = 'approved'
    and target.deleted_at is null
    and target.hidden_at is null
    and exists (
      select 1 from public.communities community
      where community.id = target.community_id
        and community.scheduled_deletion_at is null
        and community.deleted_at is null
    )
    and public.user_can_broadcast_on_picom_live(target.broadcaster_user_id);
$$;
revoke all on function public.live_session_is_publisher_discovery_eligible(public.community_live_screen_sessions) from public, anon;
grant execute on function public.live_session_is_publisher_discovery_eligible(public.community_live_screen_sessions) to authenticated;

alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check(action_type in(
  'community_update','channel_create','channel_update','channel_delete','role_change','member_change','moderation_action',
  'invite_create','invite_revoke','invite_accept','webhook_create','webhook_revoke','webhook_message','discovery_review',
  'meeting_room_create','meeting_room_update','meeting_room_archive','meeting_room_delete','meeting_control',
  'meeting_lifecycle','meeting_admission','meeting_role','meeting_moderation','meeting_media','meeting_caption',
  'community_deletion_requested','community_deletion_cancelled','community_deletion_finalized'
));

create or replace function public.request_community_deletion(target_community_id uuid)
returns table(community_id uuid, scheduled_deletion_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.communities%rowtype; requested_at timestamptz := now(); due_at timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null or not public.is_community_owner(target_community_id) then raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode = '42501'; end if;
  select * into target from public.communities where id = target_community_id for update;
  if not found or target.deleted_at is not null then raise exception 'COMMUNITY_NOT_AVAILABLE' using errcode = '22023'; end if;
  if target.scheduled_deletion_at is not null then return query select target.id, target.scheduled_deletion_at; return; end if;
  perform set_config('picom.community_deletion_lifecycle', 'trusted', true);
  update public.communities
  set deletion_requested_at = requested_at,
      scheduled_deletion_at = due_at,
      deletion_cancelled_at = null,
      deletion_restore_state = jsonb_build_object(
        'visibility', target.visibility,
        'public_read_enabled', target.public_read_enabled,
        'discovery_listed', target.discovery_listed
      ),
      visibility = 'private', public_read_enabled = false, discovery_listed = false,
      updated_at = requested_at
  where id = target_community_id;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason, metadata)
  values(target_community_id, auth.uid(), 'community_deletion_requested', 'community', target_community_id,
    '30-day deletion recovery window started', jsonb_build_object('scheduled_deletion_at', due_at));
  return query select target_community_id, due_at;
end;
$$;

create or replace function public.cancel_community_deletion(target_community_id uuid)
returns table(community_id uuid, cancelled_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.communities%rowtype; cancelled timestamptz := now(); restore_state jsonb;
begin
  if auth.uid() is null or not public.is_community_owner(target_community_id) then raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode = '42501'; end if;
  select * into target from public.communities where id = target_community_id for update;
  if not found or target.deleted_at is not null or target.scheduled_deletion_at is null then raise exception 'NO_PENDING_COMMUNITY_DELETION' using errcode = '22023'; end if;
  if target.scheduled_deletion_at <= cancelled then raise exception 'COMMUNITY_DELETION_FINALIZATION_DUE' using errcode = '23514'; end if;
  restore_state := coalesce(target.deletion_restore_state, '{}'::jsonb);
  perform set_config('picom.community_deletion_lifecycle', 'trusted', true);
  update public.communities
  set scheduled_deletion_at = null,
      deletion_cancelled_at = cancelled,
      deletion_restore_state = null,
      visibility = coalesce(restore_state ->> 'visibility', visibility),
      public_read_enabled = coalesce((restore_state ->> 'public_read_enabled')::boolean, public_read_enabled),
      discovery_listed = coalesce((restore_state ->> 'discovery_listed')::boolean, discovery_listed),
      updated_at = cancelled
  where id = target_community_id;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason, metadata)
  values(target_community_id, auth.uid(), 'community_deletion_cancelled', 'community', target_community_id,
    'Scheduled community deletion cancelled', '{}'::jsonb);
  return query select target_community_id, cancelled;
end;
$$;

create or replace function public.get_community_deletion_status(target_community_id uuid)
returns table(scheduled_deletion_at timestamptz, deletion_requested_at timestamptz, deleted_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select community.scheduled_deletion_at, community.deletion_requested_at, community.deleted_at
  from public.communities community
  where community.id = target_community_id and public.is_community_owner(target_community_id);
$$;

create or replace function public.finalize_due_community_deletions(batch_limit integer default 25)
returns table(community_id uuid, finalized_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.communities%rowtype; finalized timestamptz := now(); safe_limit integer := least(greatest(coalesce(batch_limit, 25), 1), 100);
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  for target in
    select * from public.communities community
    where community.deleted_at is null and community.scheduled_deletion_at is not null and community.scheduled_deletion_at <= finalized
    order by community.scheduled_deletion_at asc
    limit safe_limit for update skip locked
  loop
    perform set_config('picom.community_deletion_lifecycle', 'trusted', true);
    update public.communities
    set deleted_at = finalized, scheduled_deletion_at = null, deletion_restore_state = null,
        archived_at = coalesce(archived_at, finalized), visibility = 'private', public_read_enabled = false,
        discovery_listed = false, updated_at = finalized
    where id = target.id;
    update public.community_live_screen_sessions session
    set status = 'ended', ended_at = coalesce(ended_at, finalized), updated_at = finalized
    where session.community_id = target.id and session.status in ('live', 'reconnecting');
    insert into public.audit_log(community_id, actor_id, actor_kind, event_source, action_type, target_type, target_id, reason, metadata)
    values(target.id, null, 'system', 'system', 'community_deletion_finalized', 'community', target.id,
      'Community finalized after 30-day recovery window', jsonb_build_object('retention', 'content and audit history retained pending policy'));
    community_id := target.id; finalized_at := finalized; return next;
  end loop;
end;
$$;

revoke all on function public.request_community_deletion(uuid), public.cancel_community_deletion(uuid), public.get_community_deletion_status(uuid), public.finalize_due_community_deletions(integer) from public, anon;
grant execute on function public.request_community_deletion(uuid), public.cancel_community_deletion(uuid), public.get_community_deletion_status(uuid) to authenticated;
grant execute on function public.finalize_due_community_deletions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Account lifecycle: email confirmation first, then a 30-day recovery window
-- ---------------------------------------------------------------------------

alter table public.account_deletion_requests
  add column if not exists email_confirmation_requested_at timestamptz,
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists scheduled_deletion_at timestamptz,
  add column if not exists deletion_cancelled_at timestamptz;

alter table public.account_deletion_requests drop constraint if exists account_deletion_requests_status_check;
alter table public.account_deletion_requests add constraint account_deletion_requests_status_check check(status in (
  'requested','email_pending','pending_deletion','reviewing','canceled','completed','failed'
));
drop index if exists public.idx_account_deletion_one_active_request;
create unique index if not exists idx_account_deletion_one_active_request
  on public.account_deletion_requests(user_id)
  where status in ('requested','email_pending','pending_deletion','reviewing');
create index if not exists account_deletion_due_idx
  on public.account_deletion_requests(scheduled_deletion_at)
  where status = 'pending_deletion' and scheduled_deletion_at is not null;

create table if not exists public.account_deletion_email_confirmations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_deletion_requests(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz,
  confirmed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create unique index if not exists account_deletion_email_confirmation_one_live_idx
  on public.account_deletion_email_confirmations(request_id)
  where confirmed_at is null and invalidated_at is null;
alter table public.account_deletion_email_confirmations enable row level security;
revoke all on public.account_deletion_email_confirmations from public, anon, authenticated;
grant all on public.account_deletion_email_confirmations to service_role;

alter table public.account_security_events drop constraint if exists account_security_events_event_type_check;
alter table public.account_security_events add constraint account_security_events_event_type_check check(event_type in (
  'account_deletion_requested','account_deletion_canceled','account_sessions_revoked','account_profile_anonymized',
  'account_auth_soft_deleted','account_registered','profile_completed','password_changed','email_change_requested',
  'mfa_enabled','mfa_disabled','login_new_device','account_deactivated','account_reactivated',
  'profile_verification_submitted','account_anonymized','email_verification_created','email_verification_sent',
  'email_verification_resent','email_verification_delivery_failed','email_verification_completed',
  'email_verification_expired','email_verification_invalid_token','email_verification_rate_limited','email_address_changed',
  'email_verification_reminder_shown','provider_linked','provider_unlinked','provider_link_failed','provider_login','session_revoked',
  'account_deletion_email_requested','account_deletion_email_delivery_failed',
  'account_deletion_email_confirmed','account_deletion_email_expired','account_deletion_finalized'
));

revoke insert, update, delete on public.account_deletion_requests from authenticated;
revoke execute on function public.request_current_user_account_deletion(text) from authenticated;

create or replace function public.begin_current_user_account_deletion()
returns table(request_id uuid, email_confirmation_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_user_id uuid := auth.uid(); active_request public.account_deletion_requests%rowtype; created_request public.account_deletion_requests%rowtype;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles profile where profile.id = current_user_id and profile.is_deleted) then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501'; end if;
  if exists (select 1 from public.communities community where community.owner_id = current_user_id and community.deleted_at is null) then
    raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode = '23514';
  end if;
  select request.* into active_request from public.account_deletion_requests request
  where request.user_id = current_user_id and request.status in ('email_pending','pending_deletion','reviewing')
  order by request.requested_at desc limit 1 for update;
  if active_request.id is not null then
    return query select active_request.id, case when active_request.status = 'email_pending' then now() + interval '24 hours' else null end;
    return;
  end if;
  insert into public.account_deletion_requests(user_id, status, email_confirmation_requested_at, session_revocation_status)
  values(current_user_id, 'email_pending', now(), 'pending') returning * into created_request;
  insert into public.account_security_events(user_id, event_type, request_id, metadata)
  values(current_user_id, 'account_deletion_email_requested', created_request.id, jsonb_build_object('confirmation_ttl_hours', 24));
  return query select created_request.id, now() + interval '24 hours';
end;
$$;

create or replace function public.issue_account_deletion_email_confirmation(
  target_request_id uuid, target_user_id uuid, target_token_hash text, target_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  if target_token_hash !~ '^[0-9a-f]{64}$' or target_expires_at <= now() or target_expires_at > now() + interval '24 hours 5 minutes' then
    raise exception 'INVALID_DELETION_CONFIRMATION' using errcode = '22023';
  end if;
  if not exists (select 1 from public.account_deletion_requests request where request.id = target_request_id and request.user_id = target_user_id and request.status = 'email_pending') then
    raise exception 'DELETION_REQUEST_NOT_EMAIL_PENDING' using errcode = '23514';
  end if;
  update public.account_deletion_email_confirmations
  set invalidated_at = now()
  where request_id = target_request_id and confirmed_at is null and invalidated_at is null;
  insert into public.account_deletion_email_confirmations(request_id, user_id, token_hash, expires_at, sent_at)
  values(target_request_id, target_user_id, target_token_hash, target_expires_at, now());
end;
$$;

create or replace function public.invalidate_account_deletion_email_confirmation(target_request_id uuid, target_user_id uuid, failure_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  update public.account_deletion_email_confirmations set invalidated_at = now()
  where request_id = target_request_id and user_id = target_user_id and confirmed_at is null and invalidated_at is null;
  insert into public.account_security_events(user_id, event_type, request_id, metadata)
  values(target_user_id, 'account_deletion_email_delivery_failed', target_request_id,
    jsonb_build_object('reason', left(coalesce(failure_reason, 'delivery_failed'), 120)));
end;
$$;

create or replace function public.confirm_account_deletion_email_confirmation(target_token_hash text)
returns table(request_id uuid, scheduled_deletion_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare confirmation public.account_deletion_email_confirmations%rowtype; target_request public.account_deletion_requests%rowtype; confirmed timestamptz := now(); due_at timestamptz := now() + interval '30 days';
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  if target_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_DELETION_CONFIRMATION' using errcode = '22023'; end if;
  select * into confirmation from public.account_deletion_email_confirmations where token_hash = target_token_hash for update;
  if not found then raise exception 'INVALID_DELETION_CONFIRMATION' using errcode = '22023'; end if;
  if confirmation.confirmed_at is not null or confirmation.invalidated_at is not null then raise exception 'DELETION_CONFIRMATION_ALREADY_USED' using errcode = '22023'; end if;
  if confirmation.expires_at <= confirmed then
    update public.account_deletion_email_confirmations set invalidated_at = confirmed where id = confirmation.id;
    insert into public.account_security_events(user_id, event_type, request_id) values(confirmation.user_id, 'account_deletion_email_expired', confirmation.request_id);
    raise exception 'DELETION_CONFIRMATION_EXPIRED' using errcode = '22023';
  end if;
  select * into target_request from public.account_deletion_requests where id = confirmation.request_id and user_id = confirmation.user_id for update;
  if not found or target_request.status <> 'email_pending' then raise exception 'DELETION_REQUEST_NOT_EMAIL_PENDING' using errcode = '23514'; end if;
  update public.account_deletion_email_confirmations set confirmed_at = confirmed where id = confirmation.id;
  update public.account_deletion_requests
  set status = 'pending_deletion', email_confirmed_at = confirmed, scheduled_deletion_at = due_at,
      anonymize_after = due_at, requested_at = confirmed, deletion_cancelled_at = null
  where id = target_request.id;
  insert into public.account_security_events(user_id, event_type, request_id, metadata)
  values(target_request.user_id, 'account_deletion_email_confirmed', target_request.id,
    jsonb_build_object('scheduled_deletion_at', due_at, 'recovery_days', 30));
  return query select target_request.id, due_at;
end;
$$;

create or replace function public.cancel_current_user_account_deletion()
returns table(request_id uuid, canceled_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_user_id uuid := auth.uid(); active_request public.account_deletion_requests%rowtype; cancelled timestamptz := now();
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into active_request from public.account_deletion_requests request
  where request.user_id = current_user_id and request.status in ('email_pending','pending_deletion')
  order by request.requested_at desc limit 1 for update;
  if not found then raise exception 'NO_ACTIVE_DELETION_REQUEST' using errcode = '22023'; end if;
  update public.account_deletion_email_confirmations confirmation set invalidated_at = cancelled
  where confirmation.request_id = active_request.id and confirmation.confirmed_at is null and confirmation.invalidated_at is null;
  update public.account_deletion_requests
  set status = 'canceled', canceled_at = cancelled, deletion_cancelled_at = cancelled,
      scheduled_deletion_at = null, anonymize_after = null
  where id = active_request.id;
  update public.profiles set deletion_requested_at = null, updated_at = cancelled where id = current_user_id;
  insert into public.account_security_events(user_id, event_type, request_id)
  values(current_user_id, 'account_deletion_canceled', active_request.id);
  return query select active_request.id, cancelled;
end;
$$;

create or replace function public.get_current_user_account_deletion_status()
returns table(request_id uuid, status text, requested_at timestamptz, scheduled_deletion_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select request.id, request.status, request.requested_at, request.scheduled_deletion_at
  from public.account_deletion_requests request
  where request.user_id = auth.uid()
  order by request.requested_at desc
  limit 1;
$$;

create or replace function public.finalize_due_account_deletions(batch_limit integer default 25)
returns table(request_id uuid, target_user_id uuid, finalized_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.account_deletion_requests%rowtype; finalized timestamptz := now(); safe_limit integer := least(greatest(coalesce(batch_limit, 25), 1), 100);
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  for target in
    select * from public.account_deletion_requests request
    where (request.status = 'pending_deletion' and request.scheduled_deletion_at <= finalized)
       or (request.status = 'reviewing' and request.finalization_status = 'auth_soft_delete_failed')
    order by request.scheduled_deletion_at asc nulls first
    limit safe_limit for update skip locked
  loop
    if target.status = 'pending_deletion' then
      if exists (select 1 from public.communities community where community.owner_id = target.user_id and community.deleted_at is null) then
        raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode = '23514';
      end if;
      update public.user_device_sessions set revoked_at = coalesce(revoked_at, finalized) where user_id = target.user_id and revoked_at is null;
      delete from public.user_follows where follower_id = target.user_id or followed_id = target.user_id;
      delete from public.friend_requests where sender_id = target.user_id or recipient_id = target.user_id;
      delete from public.friendships where user_low_id = target.user_id or user_high_id = target.user_id;
      delete from public.saved_messages where user_id = target.user_id;
      delete from public.direct_conversation_participants where user_id = target.user_id;
      delete from public.community_members where user_id = target.user_id;
      update public.profiles
      set username = 'deleted-' || substr(replace(target.user_id::text, '-', ''), 1, 12),
          display_name = 'Deleted User', avatar_url = null, status = 'offline', status_text = 'Account deleted',
          bio = null, accent_color = null, onboarding_completed = false, is_deleted = true,
          deleted_at = finalized, deletion_requested_at = finalized, updated_at = finalized
      where id = target.user_id;
      update public.account_deletion_requests
      set status = 'reviewing', finalization_status = 'profile_anonymized', completed_at = finalized,
          sessions_revoked_at = coalesce(sessions_revoked_at, finalized), session_revocation_status = 'completed'
      where id = target.id;
      insert into public.account_security_events(user_id, event_type, request_id, metadata)
      values(target.user_id, 'account_profile_anonymized', target.id, jsonb_build_object('stage', 'finalization_prepared'));
    end if;
    request_id := target.id; target_user_id := target.user_id; finalized_at := finalized; return next;
  end loop;
end;
$$;

create or replace function public.complete_account_deletion_finalization(target_request_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  update public.account_deletion_requests
  set status = 'completed', finalization_status = 'completed', completed_at = coalesce(completed_at, now())
  where id = target_request_id and user_id = target_user_id and status = 'reviewing';
  if not found then raise exception 'DELETION_FINALIZATION_NOT_PREPARED' using errcode = '23514'; end if;
  insert into public.account_security_events(user_id, event_type, request_id)
  values(target_user_id, 'account_auth_soft_deleted', target_request_id);
  insert into public.account_security_events(user_id, event_type, request_id)
  values(target_user_id, 'account_deletion_finalized', target_request_id);
end;
$$;

revoke all on function public.begin_current_user_account_deletion(), public.cancel_current_user_account_deletion(), public.get_current_user_account_deletion_status(), public.issue_account_deletion_email_confirmation(uuid, uuid, text, timestamptz), public.invalidate_account_deletion_email_confirmation(uuid, uuid, text), public.confirm_account_deletion_email_confirmation(text), public.finalize_due_account_deletions(integer), public.complete_account_deletion_finalization(uuid, uuid) from public, anon;
grant execute on function public.begin_current_user_account_deletion(), public.cancel_current_user_account_deletion(), public.get_current_user_account_deletion_status() to authenticated;
grant execute on function public.issue_account_deletion_email_confirmation(uuid, uuid, text, timestamptz), public.invalidate_account_deletion_email_confirmation(uuid, uuid, text), public.confirm_account_deletion_email_confirmation(text), public.finalize_due_account_deletions(integer), public.complete_account_deletion_finalization(uuid, uuid) to service_role;

comment on table public.account_deletion_email_confirmations is 'One-time, hashed account-deletion confirmation credentials. Raw tokens never persist.';
comment on function public.finalize_due_community_deletions(integer) is 'Service-only, batched, SKIP LOCKED finalizer. It tombstones the community and preserves audit/retention records.';
comment on function public.finalize_due_account_deletions(integer) is 'Service-only, batched, idempotent account finalization preparation. Auth deletion remains in the trusted worker.';

commit;
