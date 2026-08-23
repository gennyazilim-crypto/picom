-- TASK33: Studio security/audit hub + invite/team mutation RPCs.

begin;

create table if not exists public.publisher_studio_audit_events (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'TEAM_INVITE_CREATED',
    'TEAM_INVITE_ACCEPTED',
    'TEAM_INVITE_REVOKED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_ROLE_CHANGED',
    'CUSTOM_ROLE_CREATED',
    'CUSTOM_ROLE_UPDATED',
    'CUSTOM_ROLE_DELETED',
    'SENSITIVE_ACTION_REAUTH_REQUIRED',
    'SESSION_REVOKED',
    'STREAM_CREDENTIAL_ROTATED',
    'STREAM_CREDENTIAL_REVOKED',
    'FINANCE_PERMISSION_CHANGED',
    'PAYOUT_HOLD_CHANGED',
    'KYC_STATUS_CHANGED',
    'STUDIO_BOOTSTRAPPED',
    'PERMISSION_DENIED'
  )),
  resource_type text check (resource_type is null or char_length(resource_type) <= 40),
  resource_id uuid,
  status text not null default 'recorded'
    check (status in ('recorded', 'denied', 'completed')),
  summary text not null check (char_length(btrim(summary)) between 4 and 240),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  internal_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists publisher_studio_audit_publisher_created_idx
  on public.publisher_studio_audit_events (publisher_user_id, created_at desc);

comment on table public.publisher_studio_audit_events is
  'Sanitized Creator Studio activity. No invite tokens, secrets, tax IDs, or bank details.';

create or replace function public._publisher_studio_audit(
  p_publisher_user_id uuid,
  p_event_type text,
  p_summary text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_status text default 'recorded',
  p_metadata jsonb default '{}'::jsonb,
  p_internal_test boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  eid uuid;
begin
  insert into public.publisher_studio_audit_events (
    publisher_user_id, actor_user_id, event_type, resource_type, resource_id,
    status, summary, metadata, internal_test
  ) values (
    p_publisher_user_id, auth.uid(), p_event_type, p_resource_type, p_resource_id,
    coalesce(p_status, 'recorded'), p_summary, coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_internal_test, false)
  ) returning id into eid;
  return eid;
end;
$$;

revoke all on function public._publisher_studio_audit(uuid, text, text, text, uuid, text, jsonb, boolean)
  from public, anon, authenticated;

-- Invite rate limit (bounded)
create table if not exists public.publisher_team_invite_rate_limits (
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default date_trunc('hour', now()),
  invite_count integer not null default 0 check (invite_count >= 0),
  primary key (publisher_user_id, window_started_at)
);

create or replace function public.create_publisher_team_invitation(
  p_role_key text,
  p_invitee_user_id uuid default null,
  p_invitee_email text default null,
  p_expires_hours integer default 72,
  p_token_hash text default null,
  p_token_hint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid := actor;
  role_rec public.publisher_studio_roles%rowtype;
  email_norm text;
  inv_id uuid;
  window_start timestamptz := date_trunc('hour', now());
  cnt integer;
  expires_h integer := greatest(1, least(coalesce(p_expires_hours, 72), 168));
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.publisher_studio_has_permission(pub, 'team.manage') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;
  if p_role_key is null or upper(p_role_key) = 'OWNER' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_token_hint is null or p_token_hint !~ '^[0-9a-f]{4,12}$' then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_HASH_REQUIRED');
  end if;

  perform public.ensure_publisher_studio_builtin_roles(pub, false);

  select * into role_rec from public.publisher_studio_roles
  where publisher_user_id = pub and role_key = upper(p_role_key) and status = 'active';
  if not found or role_rec.is_system_owner then
    return jsonb_build_object('ok', false, 'error', 'ROLE_NOT_FOUND');
  end if;

  -- Finance-bearing roles require team.manage + roles.manage (or owner)
  if exists (
    select 1 from public.publisher_studio_role_permissions rp
    where rp.role_id = role_rec.id and rp.allowed
      and rp.permission_key in ('finance.read','finance.write','finance.approve','payout.manage')
  ) and not public.publisher_studio_has_permission(pub, 'roles.manage')
    and not public.publisher_studio_is_owner(pub) then
    return jsonb_build_object('ok', false, 'error', 'FINANCE_ROLE_REQUIRES_ROLES_MANAGE');
  end if;

  email_norm := nullif(lower(btrim(coalesce(p_invitee_email, ''))), '');
  if p_invitee_user_id is null and email_norm is null then
    return jsonb_build_object('ok', false, 'error', 'INVITEE_REQUIRED');
  end if;
  if p_invitee_user_id = pub then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_INVITE_SELF');
  end if;

  if (
    select count(*) from public.publisher_team_members
    where publisher_user_id = pub and status in ('ACTIVE', 'INVITED', 'SUSPENDED')
  ) >= public.publisher_team_member_limit() then
    return jsonb_build_object('ok', false, 'error', 'TEAM_MEMBER_LIMIT');
  end if;

  insert into public.publisher_team_invite_rate_limits (publisher_user_id, window_started_at, invite_count)
  values (pub, window_start, 1)
  on conflict (publisher_user_id, window_started_at) do update
    set invite_count = publisher_team_invite_rate_limits.invite_count + 1
  returning invite_count into cnt;
  if cnt > 20 then
    return jsonb_build_object('ok', false, 'error', 'INVITE_RATE_LIMITED');
  end if;

  -- Rapid duplicate guard
  if exists (
    select 1 from public.publisher_team_invitations i
    where i.publisher_user_id = pub
      and i.status = 'PENDING'
      and i.expires_at > now()
      and (
        (p_invitee_user_id is not null and i.invitee_user_id = p_invitee_user_id)
        or (email_norm is not null and i.invitee_email_normalized = email_norm)
      )
      and i.created_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_INVITE');
  end if;

  insert into public.publisher_team_invitations (
    publisher_user_id, role_id, invitee_user_id, invitee_email_normalized,
    token_hash, token_hint, status, invited_by, expires_at
  ) values (
    pub, role_rec.id, p_invitee_user_id, email_norm,
    p_token_hash, p_token_hint, 'PENDING', actor, now() + make_interval(hours => expires_h)
  ) returning id into inv_id;

  perform public._publisher_studio_audit(
    pub, 'TEAM_INVITE_CREATED', 'Team invitation created',
    'invitation', inv_id, 'completed',
    jsonb_build_object('role_key', role_rec.role_key), false
  );

  return jsonb_build_object(
    'ok', true,
    'invitation_id', inv_id,
    'role_key', role_rec.role_key,
    'expires_at', (now() + make_interval(hours => expires_h)),
    'token_hint', p_token_hint
  );
end;
$$;

create or replace function public.accept_publisher_team_invitation(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  inv public.publisher_team_invitations%rowtype;
  actor_email text;
  member_id uuid;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKEN');
  end if;

  select * into inv from public.publisher_team_invitations
  where token_hash = p_token_hash
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  end if;
  if inv.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_PENDING');
  end if;
  if inv.expires_at <= now() then
    update public.publisher_team_invitations set status = 'EXPIRED' where id = inv.id;
    return jsonb_build_object('ok', false, 'error', 'INVITE_EXPIRED');
  end if;
  if inv.invitee_user_id is not null and inv.invitee_user_id <> actor then
    return jsonb_build_object('ok', false, 'error', 'WRONG_USER');
  end if;

  select lower(coalesce(auth.jwt() ->> 'email', '')) into actor_email;
  if inv.invitee_email_normalized is not null
     and (actor_email = '' or actor_email <> inv.invitee_email_normalized) then
    return jsonb_build_object('ok', false, 'error', 'WRONG_EMAIL');
  end if;

  if not public.publisher_studio_has_permission(inv.publisher_user_id, 'team.manage')
     and inv.invited_by is not null then
    -- Inviter must still be authorized OR owner must still exist as publisher
    if not exists (
      select 1 from public.publisher_team_members m
      where m.publisher_user_id = inv.publisher_user_id
        and m.member_user_id = inv.invited_by
        and m.status = 'ACTIVE'
    ) and inv.publisher_user_id <> inv.invited_by then
      return jsonb_build_object('ok', false, 'error', 'INVITER_NO_LONGER_AUTHORIZED');
    end if;
  end if;

  if actor = inv.publisher_user_id then
    return jsonb_build_object('ok', false, 'error', 'OWNER_CANNOT_ACCEPT_AS_MEMBER');
  end if;

  insert into public.publisher_team_members (
    publisher_user_id, member_user_id, role_id, status, invited_by, joined_at
  ) values (
    inv.publisher_user_id, actor, inv.role_id, 'ACTIVE', inv.invited_by, now()
  )
  on conflict (publisher_user_id, member_user_id) do update
    set role_id = excluded.role_id,
        status = 'ACTIVE',
        disabled_at = null,
        joined_at = coalesce(publisher_team_members.joined_at, now()),
        updated_at = now()
  returning id into member_id;

  update public.publisher_team_invitations
  set status = 'ACCEPTED', accepted_at = now(), accepted_by = actor
  where id = inv.id;

  perform public._publisher_studio_audit(
    inv.publisher_user_id, 'TEAM_INVITE_ACCEPTED', 'Team invitation accepted',
    'invitation', inv.id, 'completed', '{}'::jsonb, false
  );

  return jsonb_build_object('ok', true, 'member_id', member_id, 'publisher_user_id', inv.publisher_user_id);
end;
$$;

create or replace function public.revoke_publisher_team_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  inv public.publisher_team_invitations%rowtype;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  select * into inv from public.publisher_team_invitations where id = p_invitation_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if not public.publisher_studio_has_permission(inv.publisher_user_id, 'team.manage') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;
  if inv.status <> 'PENDING' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  update public.publisher_team_invitations
  set status = 'REVOKED', revoked_at = now()
  where id = inv.id;
  perform public._publisher_studio_audit(
    inv.publisher_user_id, 'TEAM_INVITE_REVOKED', 'Team invitation revoked',
    'invitation', inv.id, 'completed', '{}'::jsonb, false
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_publisher_team_member(p_member_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid := actor;
  m public.publisher_team_members%rowtype;
  r public.publisher_studio_roles%rowtype;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.publisher_studio_has_permission(pub, 'team.manage') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;
  if p_member_user_id = pub then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_REMOVE_OWNER');
  end if;

  select * into m from public.publisher_team_members
  where publisher_user_id = pub and member_user_id = p_member_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into r from public.publisher_studio_roles where id = m.role_id;
  if r.is_system_owner or r.role_key = 'OWNER' then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_REMOVE_OWNER');
  end if;

  update public.publisher_team_members
  set status = 'REMOVED', disabled_at = now(), updated_at = now()
  where id = m.id;

  perform public._publisher_studio_audit(
    pub, 'TEAM_MEMBER_REMOVED', 'Team member removed',
    'team_member', m.id, 'completed',
    jsonb_build_object('previous_role', r.role_key), false
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.change_publisher_team_member_role(
  p_member_user_id uuid,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid := actor;
  m public.publisher_team_members%rowtype;
  new_role public.publisher_studio_roles%rowtype;
  old_role public.publisher_studio_roles%rowtype;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.publisher_studio_has_permission(pub, 'team.manage') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;
  if p_member_user_id = pub or upper(p_role_key) = 'OWNER' then
    return jsonb_build_object('ok', false, 'error', 'OWNER_INVARIANT');
  end if;

  select * into m from public.publisher_team_members
  where publisher_user_id = pub and member_user_id = p_member_user_id and status = 'ACTIVE'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into old_role from public.publisher_studio_roles where id = m.role_id;
  if old_role.is_system_owner then
    return jsonb_build_object('ok', false, 'error', 'OWNER_INVARIANT');
  end if;

  select * into new_role from public.publisher_studio_roles
  where publisher_user_id = pub and role_key = upper(p_role_key) and status = 'active';
  if not found or new_role.is_system_owner then
    return jsonb_build_object('ok', false, 'error', 'ROLE_NOT_FOUND');
  end if;

  -- Self-escalation block
  if p_member_user_id = actor and not public.publisher_studio_is_owner(pub) then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_CHANGE_OWN_ROLE');
  end if;

  update public.publisher_team_members
  set role_id = new_role.id, updated_at = now()
  where id = m.id;

  perform public._publisher_studio_audit(
    pub, 'TEAM_ROLE_CHANGED', 'Team member role changed',
    'team_member', m.id, 'completed',
    jsonb_build_object('from_role', old_role.role_key, 'to_role', new_role.role_key), false
  );

  if exists (
    select 1 from public.publisher_studio_role_permissions
    where role_id in (old_role.id, new_role.id) and allowed
      and permission_key like 'finance.%'
  ) then
    perform public._publisher_studio_audit(
      pub, 'FINANCE_PERMISSION_CHANGED', 'Finance-related role assignment changed',
      'team_member', m.id, 'completed',
      jsonb_build_object('from_role', old_role.role_key, 'to_role', new_role.role_key), false
    );
  end if;

  return jsonb_build_object('ok', true, 'role_key', new_role.role_key);
end;
$$;

revoke all on function public.create_publisher_team_invitation(text, uuid, text, integer, text, text)
  from public, anon;
revoke all on function public.accept_publisher_team_invitation(text) from public, anon;
revoke all on function public.revoke_publisher_team_invitation(uuid) from public, anon;
revoke all on function public.remove_publisher_team_member(uuid) from public, anon;
revoke all on function public.change_publisher_team_member_role(uuid, text) from public, anon;

grant execute on function public.create_publisher_team_invitation(text, uuid, text, integer, text, text)
  to authenticated;
grant execute on function public.accept_publisher_team_invitation(text) to authenticated;
grant execute on function public.revoke_publisher_team_invitation(uuid) to authenticated;
grant execute on function public.remove_publisher_team_member(uuid) to authenticated;
grant execute on function public.change_publisher_team_member_role(uuid, text) to authenticated;

commit;
