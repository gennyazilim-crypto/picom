-- TASK33: RLS, list RPCs, readiness, re-auth gate, internal_test helpers.

begin;

alter table public.publisher_studio_permission_definitions enable row level security;
alter table public.publisher_studio_roles enable row level security;
alter table public.publisher_studio_role_permissions enable row level security;
alter table public.publisher_team_members enable row level security;
alter table public.publisher_team_invitations enable row level security;
alter table public.publisher_studio_audit_events enable row level security;
alter table public.publisher_team_invite_rate_limits enable row level security;

revoke all on table public.publisher_studio_permission_definitions from public, anon, authenticated;
revoke all on table public.publisher_studio_roles from public, anon, authenticated;
revoke all on table public.publisher_studio_role_permissions from public, anon, authenticated;
revoke all on table public.publisher_team_members from public, anon, authenticated;
revoke all on table public.publisher_team_invitations from public, anon, authenticated;
revoke all on table public.publisher_studio_audit_events from public, anon, authenticated;
revoke all on table public.publisher_team_invite_rate_limits from public, anon, authenticated;

grant select on table public.publisher_studio_permission_definitions to authenticated;
grant select on table public.publisher_studio_roles to authenticated;
grant select on table public.publisher_studio_role_permissions to authenticated;
grant select on table public.publisher_team_members to authenticated;
-- invitations: no broad select (token_hash); use RPC
grant select on table public.publisher_studio_audit_events to authenticated;

drop policy if exists publisher_studio_perm_defs_select on public.publisher_studio_permission_definitions;
create policy publisher_studio_perm_defs_select on public.publisher_studio_permission_definitions
  for select to authenticated using (true);

drop policy if exists publisher_studio_roles_select on public.publisher_studio_roles;
create policy publisher_studio_roles_select on public.publisher_studio_roles
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or public.publisher_studio_has_permission(publisher_user_id, 'team.read')
  );

drop policy if exists publisher_studio_role_perms_select on public.publisher_studio_role_permissions;
create policy publisher_studio_role_perms_select on public.publisher_studio_role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.publisher_studio_roles r
      where r.id = role_id
        and (
          r.publisher_user_id = auth.uid()
          or public.publisher_studio_has_permission(r.publisher_user_id, 'team.read')
        )
    )
  );

drop policy if exists publisher_team_members_select on public.publisher_team_members;
create policy publisher_team_members_select on public.publisher_team_members
  for select to authenticated
  using (
    member_user_id = auth.uid()
    or publisher_user_id = auth.uid()
    or public.publisher_studio_has_permission(publisher_user_id, 'team.read')
  );

drop policy if exists publisher_studio_audit_select on public.publisher_studio_audit_events;
create policy publisher_studio_audit_select on public.publisher_studio_audit_events
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or public.publisher_studio_has_permission(publisher_user_id, 'audit.read')
  );

-- No direct mutation policies for authenticated (RPC only)
-- service_role bypasses RLS

create or replace function public.list_my_publisher_team_members(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid;
  rows jsonb;
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  pub := actor;
  if not public.publisher_studio_has_permission(pub, 'team.read') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into rows
  from (
    select m.id, m.member_user_id, m.status, m.joined_at, m.created_at,
           r.role_key, r.display_name as role_display_name
    from public.publisher_team_members m
    join public.publisher_studio_roles r on r.id = m.role_id
    where m.publisher_user_id = pub
      and m.status in ('ACTIVE', 'INVITED', 'SUSPENDED')
    order by m.created_at desc
    limit lim
  ) x;

  return jsonb_build_object('ok', true, 'items', rows);
end;
$$;

create or replace function public.list_my_publisher_studio_audit(
  p_limit integer default 40,
  p_domain text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  pub uuid := actor;
  rows jsonb;
  lim integer := greatest(1, least(coalesce(p_limit, 40), 100));
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.publisher_studio_has_permission(pub, 'audit.read')
     and not public.publisher_studio_has_permission(pub, 'security.read') then
    return jsonb_build_object('ok', false, 'error', 'NO_PERMISSION');
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into rows
  from (
    select e.id, e.created_at, e.event_type, e.resource_type, e.status, e.summary,
           e.actor_user_id
    from public.publisher_studio_audit_events e
    where e.publisher_user_id = pub
      and e.internal_test = false
      and (
        p_domain is null
        or (p_domain = 'team' and e.event_type like 'TEAM_%')
        or (p_domain = 'security' and e.event_type in (
          'SENSITIVE_ACTION_REAUTH_REQUIRED','SESSION_REVOKED',
          'STREAM_CREDENTIAL_ROTATED','STREAM_CREDENTIAL_REVOKED'
        ))
        or (p_domain = 'finance' and e.event_type in (
          'FINANCE_PERMISSION_CHANGED','PAYOUT_HOLD_CHANGED','KYC_STATUS_CHANGED'
        ))
      )
    order by e.created_at desc
    limit lim
  ) x;

  return jsonb_build_object('ok', true, 'items', rows);
end;
$$;

create or replace function public.get_my_publisher_studio_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  badge_active boolean := false;
  kyc_status text := 'NOT_STARTED';
  tax_status text := 'NOT_STARTED';
  payout_account_status text := 'MISSING';
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  badge_active := public.user_has_active_publisher_badge(actor);

  select coalesce(k.status, 'NOT_STARTED') into kyc_status
  from public.publisher_kyc_profiles k where k.publisher_user_id = actor;
  select coalesce(t.tax_status, 'NOT_STARTED') into tax_status
  from public.publisher_tax_profiles t where t.publisher_user_id = actor;
  select coalesce(a.status, 'MISSING') into payout_account_status
  from public.publisher_payout_accounts a
  where a.publisher_user_id = actor and a.disabled_at is null
  order by a.is_default desc, a.updated_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'items', jsonb_build_array(
      jsonb_build_object('id', 'publisher_badge', 'state', case when badge_active then 'READY' else 'SETUP_REQUIRED' end),
      jsonb_build_object('id', 'stream_management', 'state', 'FEATURE_DISABLED', 'note', 'enablePublisherStreamManagement OFF'),
      jsonb_build_object('id', 'live_chat', 'state', 'FEATURE_DISABLED', 'note', 'enableLiveChat OFF'),
      jsonb_build_object('id', 'analytics', 'state', 'FEATURE_DISABLED', 'note', 'enablePublisherAnalytics OFF'),
      jsonb_build_object('id', 'recording', 'state', 'INFRASTRUCTURE_UNAVAILABLE', 'note', 'LIVEKIT_EGRESS BLOCKED'),
      jsonb_build_object('id', 'payments', 'state', 'PROVIDER_NOT_CONFIGURED', 'note', 'Task31'),
      jsonb_build_object('id', 'kyc', 'state', case when kyc_status = 'VERIFIED' then 'READY' else 'SETUP_REQUIRED' end, 'status', kyc_status, 'note', 'KYC provider NOT_CONFIGURED'),
      jsonb_build_object('id', 'tax', 'state', 'BLOCKED_LEGAL_PROVIDER_CONFIGURATION', 'status', tax_status),
      jsonb_build_object('id', 'payout_account', 'state', case when payout_account_status = 'VERIFIED' then 'READY' else 'SETUP_REQUIRED' end, 'status', coalesce(payout_account_status, 'MISSING'), 'note', 'Payout provider NOT_CONFIGURED'),
      jsonb_build_object('id', 'legal_terms', 'state', 'BLOCKED_CONTENT_APPROVAL'),
      jsonb_build_object('id', 'live_payout', 'state', 'OFF')
    )
  );
end;
$$;

-- Recent-auth gate using JWT iat when available (no invented password capture)
create or replace function public.publisher_studio_require_recent_auth(
  p_max_age_seconds integer default 900
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  iat bigint;
  age integer;
  max_age integer := greatest(60, least(coalesce(p_max_age_seconds, 900), 3600));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED', 'requires_reauth', true);
  end if;
  iat := nullif(claims->>'iat', '')::bigint;
  if iat is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'REAUTH_CAPABILITY_PARTIAL',
      'requires_reauth', true,
      'note', 'JWT iat unavailable; use Auth step-up / re-login'
    );
  end if;
  age := extract(epoch from now())::bigint - iat;
  if age > max_age then
    perform public._publisher_studio_audit(
      auth.uid(), 'SENSITIVE_ACTION_REAUTH_REQUIRED', 'Recent authentication required',
      'security', null, 'denied',
      jsonb_build_object('age_seconds', age, 'max_age_seconds', max_age), false
    );
    return jsonb_build_object('ok', false, 'error', 'REAUTH_REQUIRED', 'requires_reauth', true, 'age_seconds', age);
  end if;
  return jsonb_build_object('ok', true, 'age_seconds', age);
end;
$$;

-- Internal-test privilege/race helpers (service_role only)
create or replace function public.service_publisher_studio_internal_fixture(
  p_publisher_user_id uuid,
  p_member_user_id uuid,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  role_id uuid;
  mid uuid;
begin
  perform public.ensure_publisher_studio_builtin_roles(p_publisher_user_id, true);
  select id into role_id from public.publisher_studio_roles
  where publisher_user_id = p_publisher_user_id and role_key = upper(p_role_key);
  if role_id is null then
    return jsonb_build_object('ok', false, 'error', 'ROLE_NOT_FOUND');
  end if;
  insert into public.publisher_team_members (
    publisher_user_id, member_user_id, role_id, status, invited_by, joined_at, internal_test
  ) values (
    p_publisher_user_id, p_member_user_id, role_id, 'ACTIVE', p_publisher_user_id, now(), true
  )
  on conflict (publisher_user_id, member_user_id) do update
    set role_id = excluded.role_id, status = 'ACTIVE', disabled_at = null,
        internal_test = true, updated_at = now()
  returning id into mid;
  return jsonb_build_object('ok', true, 'member_id', mid, 'role_key', upper(p_role_key));
end;
$$;

revoke all on function public.list_my_publisher_team_members(integer) from public, anon;
revoke all on function public.list_my_publisher_studio_audit(integer, text) from public, anon;
revoke all on function public.get_my_publisher_studio_readiness() from public, anon;
revoke all on function public.publisher_studio_require_recent_auth(integer) from public, anon;
revoke all on function public.service_publisher_studio_internal_fixture(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.list_my_publisher_team_members(integer) to authenticated;
grant execute on function public.list_my_publisher_studio_audit(integer, text) to authenticated;
grant execute on function public.get_my_publisher_studio_readiness() to authenticated;
grant execute on function public.publisher_studio_require_recent_auth(integer) to authenticated;
grant execute on function public.service_publisher_studio_internal_fixture(uuid, uuid, text) to service_role;

-- Owner cannot demote OWNER role row
create or replace function public.prevent_publisher_owner_role_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.is_system_owner then
    raise exception 'OWNER_ROLE_IMMUTABLE' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.is_system_owner and (
    new.role_key is distinct from 'OWNER'
    or new.is_system_owner is distinct from true
    or new.status = 'retired'
  ) then
    raise exception 'OWNER_ROLE_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists publisher_studio_roles_owner_lock on public.publisher_studio_roles;
create trigger publisher_studio_roles_owner_lock
  before update or delete on public.publisher_studio_roles
  for each row execute function public.prevent_publisher_owner_role_mutation();

commit;
