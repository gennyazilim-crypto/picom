-- TASK33: Built-in roles, permission grants, effective permission helpers.

begin;

create or replace function public.ensure_publisher_studio_builtin_roles(
  p_publisher_user_id uuid,
  p_internal_test boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_role uuid;
  mgr uuid; strm uuid; modr uuid; anal uuid; fin uuid; edtr uuid;
begin
  insert into public.publisher_studio_roles (
    publisher_user_id, role_key, display_name, is_builtin, is_system_owner, internal_test
  ) values
    (p_publisher_user_id, 'OWNER', 'Owner', true, true, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'MANAGER', 'Manager', true, false, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'STREAM_MANAGER', 'Stream Manager', true, false, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'MODERATOR', 'Moderator', true, false, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'ANALYST', 'Analyst', true, false, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'FINANCE_MANAGER', 'Finance Manager', true, false, coalesce(p_internal_test, false)),
    (p_publisher_user_id, 'EDITOR', 'Editor', true, false, coalesce(p_internal_test, false))
  on conflict (publisher_user_id, role_key) do update
    set display_name = excluded.display_name,
        is_builtin = true,
        updated_at = now();

  select id into owner_role from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'OWNER';
  select id into mgr from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'MANAGER';
  select id into strm from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'STREAM_MANAGER';
  select id into modr from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'MODERATOR';
  select id into anal from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'ANALYST';
  select id into fin from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'FINANCE_MANAGER';
  select id into edtr from public.publisher_studio_roles
    where publisher_user_id = p_publisher_user_id and role_key = 'EDITOR';

  -- OWNER: all studio permissions
  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select owner_role, d.permission_key, true
  from public.publisher_studio_permission_definitions d
  on conflict do nothing;

  -- MANAGER: ops without finance/approve/credentials
  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select mgr, x, true from unnest(array[
    'publisher.profile.read','publisher.profile.write',
    'streams.read','streams.create','streams.write','streams.schedule','streams.go_live','streams.end',
    'chat.read','chat.moderate','chat.settings.manage','moderators.manage',
    'analytics.read','media.read','media.manage','clips.create','replays.publish',
    'monetization.read','team.read','team.manage','security.read','audit.read'
  ]) as t(x)
  on conflict do nothing;

  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select strm, x, true from unnest(array[
    'publisher.profile.read','streams.read','streams.create','streams.write','streams.schedule',
    'streams.go_live','streams.end','streams.credentials.manage',
    'chat.read','chat.settings.manage','media.read','media.manage','audit.read'
  ]) as t(x)
  on conflict do nothing;

  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select modr, x, true from unnest(array[
    'publisher.profile.read','streams.read','chat.read','chat.moderate','chat.settings.manage','audit.read'
  ]) as t(x)
  on conflict do nothing;

  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select anal, x, true from unnest(array[
    'publisher.profile.read','streams.read','analytics.read','media.read','audit.read'
  ]) as t(x)
  on conflict do nothing;

  -- FINANCE_MANAGER: finance/KYC/payout only — no stream moderation / team.manage
  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select fin, x, true from unnest(array[
    'publisher.profile.read','monetization.read','monetization.manage',
    'finance.read','finance.write','kyc.read_status','kyc.manage',
    'payout.read','payout.manage','statements.read','audit.read','security.read'
  ]) as t(x)
  on conflict do nothing;

  insert into public.publisher_studio_role_permissions (role_id, permission_key, allowed)
  select edtr, x, true from unnest(array[
    'publisher.profile.read','streams.read','streams.write','media.read','media.manage',
    'clips.create','replays.publish','audit.read'
  ]) as t(x)
  on conflict do nothing;

  -- Ensure owner membership row
  insert into public.publisher_team_members (
    publisher_user_id, member_user_id, role_id, status, invited_by, joined_at, internal_test
  ) values (
    p_publisher_user_id, p_publisher_user_id, owner_role, 'ACTIVE', p_publisher_user_id, now(),
    coalesce(p_internal_test, false)
  )
  on conflict (publisher_user_id, member_user_id) do update
    set role_id = excluded.role_id,
        status = 'ACTIVE',
        disabled_at = null,
        updated_at = now();
end;
$$;

revoke all on function public.ensure_publisher_studio_builtin_roles(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.ensure_publisher_studio_builtin_roles(uuid, boolean)
  to service_role;

create or replace function public.publisher_studio_is_owner(p_publisher_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.uid() = p_publisher_user_id, false)
    and public.user_has_active_publisher_badge(p_publisher_user_id);
$$;

create or replace function public.publisher_studio_has_permission(
  p_publisher_user_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  allowed boolean := false;
begin
  if actor is null or p_publisher_user_id is null or p_permission_key is null then
    return false;
  end if;

  if not exists (
    select 1 from public.publisher_studio_permission_definitions d
    where d.permission_key = p_permission_key
  ) then
    return false;
  end if;

  -- Owner shortcut: only when badge-active publisher matches auth.uid()
  if actor = p_publisher_user_id and public.user_has_active_publisher_badge(p_publisher_user_id) then
    return true;
  end if;

  select coalesce(bool_or(rp.allowed), false) into allowed
  from public.publisher_team_members m
  join public.publisher_studio_roles r on r.id = m.role_id
  join public.publisher_studio_role_permissions rp on rp.role_id = r.id
  where m.publisher_user_id = p_publisher_user_id
    and m.member_user_id = actor
    and m.status = 'ACTIVE'
    and m.disabled_at is null
    and r.status = 'active'
    and rp.permission_key = p_permission_key
    and rp.allowed = true;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.publisher_studio_is_owner(uuid) from public, anon;
revoke all on function public.publisher_studio_has_permission(uuid, text) from public, anon;
grant execute on function public.publisher_studio_is_owner(uuid) to authenticated, service_role;
grant execute on function public.publisher_studio_has_permission(uuid, text) to authenticated, service_role;

create or replace function public.get_my_publisher_studio_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid;
  perms text[];
  role_key text;
  membership_status text;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  -- Prefer own publisher context when badge-active; else first ACTIVE membership
  if public.user_has_active_publisher_badge(actor) then
    pub := actor;
    role_key := 'OWNER';
    membership_status := 'ACTIVE';
  else
    select m.publisher_user_id, r.role_key, m.status
      into pub, role_key, membership_status
    from public.publisher_team_members m
    join public.publisher_studio_roles r on r.id = m.role_id
    where m.member_user_id = actor
      and m.status = 'ACTIVE'
      and m.disabled_at is null
    order by m.updated_at desc
    limit 1;
  end if;

  if pub is null then
    return jsonb_build_object(
      'ok', true,
      'has_studio_access', false,
      'reason', 'NO_PUBLISHER_CONTEXT'
    );
  end if;

  select coalesce(array_agg(distinct rp.permission_key order by rp.permission_key), array[]::text[])
    into perms
  from public.publisher_team_members m
  join public.publisher_studio_role_permissions rp on rp.role_id = m.role_id and rp.allowed
  where m.publisher_user_id = pub
    and m.member_user_id = actor
    and m.status = 'ACTIVE'
    and m.disabled_at is null;

  if actor = pub then
    select coalesce(array_agg(d.permission_key order by d.permission_key), array[]::text[])
      into perms
    from public.publisher_studio_permission_definitions d;
  end if;

  return jsonb_build_object(
    'ok', true,
    'has_studio_access', true,
    'publisher_user_id', pub,
    'actor_user_id', actor,
    'is_owner', actor = pub,
    'role_key', role_key,
    'membership_status', membership_status,
    'permissions', to_jsonb(coalesce(perms, array[]::text[])),
    'finance_isolated', not ('finance.read' = any(coalesce(perms, array[]::text[]))),
    'note', 'Server remains authority; client permissions are for UI gating only'
  );
end;
$$;

revoke all on function public.get_my_publisher_studio_context() from public, anon;
grant execute on function public.get_my_publisher_studio_context() to authenticated, service_role;

-- Bootstrap builtin roles for badge holders via RPC (owner self-serve)
create or replace function public.bootstrap_my_publisher_studio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.user_has_active_publisher_badge(actor) then
    return jsonb_build_object('ok', false, 'error', 'PUBLISHER_BADGE_REQUIRED');
  end if;
  perform public.ensure_publisher_studio_builtin_roles(actor, false);
  return public.get_my_publisher_studio_context();
end;
$$;

revoke all on function public.bootstrap_my_publisher_studio() from public, anon;
grant execute on function public.bootstrap_my_publisher_studio() to authenticated;

commit;
