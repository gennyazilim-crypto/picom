-- Community deletion is immediate and irreversible. Account deletion remains
-- email-confirmed with a separate 30-day recovery lifecycle.
begin;

-- Retire the old community-only recovery API. Existing queued community
-- deletion data is made inert; no account-deletion function is changed here.
revoke all on function public.request_community_deletion(uuid), public.cancel_community_deletion(uuid), public.get_community_deletion_status(uuid), public.finalize_due_community_deletions(integer) from public, anon, authenticated, service_role;
drop function if exists public.request_community_deletion(uuid);
drop function if exists public.cancel_community_deletion(uuid);
drop function if exists public.get_community_deletion_status(uuid);
drop function if exists public.finalize_due_community_deletions(integer);

-- The old typed-confirmation archive path is historical-only. It must not
-- remain a second, recoverable community-removal flow for authenticated users.
revoke all on function public.archive_community(uuid, text, text) from public, anon, authenticated;

select set_config('picom.community_deletion_lifecycle', 'trusted', true);

update public.communities
set scheduled_deletion_at = null,
    deletion_restore_state = null,
    deletion_cancelled_at = coalesce(deletion_cancelled_at, now()),
    updated_at = now()
where deleted_at is null
  and scheduled_deletion_at is not null;

create or replace function public.enforce_community_membership_join_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_owner_id uuid;
begin
  if exists (select 1 from public.community_bans ban where ban.community_id = new.community_id and ban.user_id = new.user_id and ban.revoked_at is null) then
    raise exception 'JOIN_BANNED' using errcode = '42501';
  end if;
  select community.owner_id into target_owner_id
  from public.communities community
  where community.id = new.community_id
    and community.archived_at is null
    and community.deleted_at is null;
  if target_owner_id is null then
    raise exception 'COMMUNITY_NOT_AVAILABLE' using errcode = '23503';
  end if;
  if new.user_id <> target_owner_id and public.users_are_blocked(new.user_id, target_owner_id) then
    raise exception 'JOIN_BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

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
    or new.archived_at is distinct from old.archived_at
  ) and current_setting('picom.community_deletion_lifecycle', true) is distinct from 'trusted' then
    raise exception 'COMMUNITY_DELETION_LIFECYCLE_MANAGED_SERVER_SIDE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.delete_owned_community(target_community_id uuid)
returns table(community_id uuid, deleted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.communities%rowtype;
  deleted_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  select * into target
  from public.communities
  where id = target_community_id
  for update;
  if not found or target.owner_id <> auth.uid() then
    raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  -- A second confirmed request is safe and never restores the community.
  if target.deleted_at is not null or target.archived_at is not null then
    return query select target.id, coalesce(target.deleted_at, target.archived_at);
    return;
  end if;

  perform set_config('picom.community_deletion_lifecycle', 'trusted', true);
  update public.communities
  set deletion_requested_at = deleted_now,
      scheduled_deletion_at = null,
      deletion_cancelled_at = null,
      deletion_restore_state = null,
      deleted_at = deleted_now,
      archived_at = deleted_now,
      visibility = 'private',
      public_read_enabled = false,
      discovery_listed = false,
      updated_at = deleted_now
  where id = target.id;

  update public.community_invites
  set revoked_at = coalesce(revoked_at, deleted_now)
  where community_id = target.id;

  update public.secret_community_invites
  set revoked_at = coalesce(revoked_at, deleted_now)
  where community_id = target.id;

  update public.community_join_requests
  set status = 'canceled', reviewed_at = coalesce(reviewed_at, deleted_now)
  where community_id = target.id and status = 'pending';

  update public.community_live_screen_sessions session
  set status = 'ended', ended_at = coalesce(ended_at, deleted_now), updated_at = deleted_now
  where session.community_id = target.id and session.status in ('live', 'reconnecting');

  insert into public.audit_log(community_id, actor_id, actor_kind, event_source, action_type, target_type, target_id, reason, metadata)
  values (
    target.id, auth.uid(), 'user', 'backend', 'community_deletion_finalized', 'community', target.id,
    'Community permanently deleted by its owner',
    jsonb_build_object('retention', 'content and audit history retained only where required', 'immediate', true)
  );

  return query select target.id, deleted_now;
end;
$$;

revoke all on function public.delete_owned_community(uuid) from public, anon;
grant execute on function public.delete_owned_community(uuid) to authenticated;

-- Channels are also owner-only and immediately deleted. The old input remains
-- solely for ABI compatibility; it is deliberately ignored.
create or replace function public.delete_managed_channel(target_channel_id uuid, confirmation_name text default null)
returns table(deleted_channel_id uuid, fallback_channel_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_channel public.channels%rowtype; fallback_id uuid;
begin
  if auth.uid() is null then raise exception 'PERMISSION_DENIED' using errcode = '42501'; end if;
  select * into current_channel from public.channels where id = target_channel_id for update;
  -- Repeating a completed deletion is safe and never recreates the channel.
  if not found then return; end if;
  if not exists (
    select 1 from public.communities community
    where community.id = current_channel.community_id
      and community.owner_id = auth.uid()
      and community.archived_at is null
      and community.deleted_at is null
  ) then raise exception 'PERMISSION_DENIED' using errcode = '42501'; end if;
  select id into fallback_id from public.channels
  where community_id = current_channel.community_id and id <> target_channel_id
  order by position asc, created_at asc limit 1;
  if fallback_id is null then raise exception 'LAST_CHANNEL_REQUIRED'; end if;
  delete from public.channels where id = target_channel_id;
  return query select target_channel_id, fallback_id;
end;
$$;

revoke all on function public.delete_managed_channel(uuid, text) from public, anon;
grant execute on function public.delete_managed_channel(uuid, text) to authenticated;

comment on function public.delete_owned_community(uuid) is
  'Owner-only, immediate and irreversible user-facing community deletion. The account deletion lifecycle is intentionally separate.';

commit;
