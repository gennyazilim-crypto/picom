-- Root dashboard: permissions registry, MFA step-up, audited mutations,
-- extended module lists, command search, and export jobs.
-- All privileged access is RPC-only (security definer); tables revoke direct grants.
begin;

-- ---------------------------------------------------------------------------
-- 0) is_admin compat (create or replace)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Bootstrap missing roles into platform_role_catalog
-- ---------------------------------------------------------------------------
insert into public.platform_role_catalog (role_key, label, description) values
  ('root_owner', 'Root owner', 'Full platform ownership with audited bootstrap'),
  ('platform_admin', 'Platform admin', 'Cross-module platform administration'),
  ('support_manager', 'Support manager', 'Support queue and staffing management'),
  ('support_agent', 'Support agent', 'Ticket handling and customer replies'),
  ('ads_manager', 'Ads manager', 'Campaign and inventory management'),
  ('ads_operator', 'Ads operator', 'Campaign operations and pacing'),
  ('ads_reviewer', 'Ads reviewer', 'Creative and brand-safety review'),
  ('security_manager', 'Security manager', 'SOC oversight and incident linkage'),
  ('security_analyst', 'Security analyst', 'Security event triage'),
  ('trust_safety_manager', 'Trust & Safety manager', 'Moderation and case management'),
  ('moderator', 'Moderator', 'Content and community moderation'),
  ('finance_viewer', 'Finance viewer', 'Revenue and approval read access'),
  ('finance_operator', 'Finance operator', 'Subscription sync and approval requests'),
  ('analytics_viewer', 'Analytics viewer', 'Aggregated analytics read access'),
  ('community_operations', 'Community operations', 'Community, voice, radio, and podcast ops read'),
  ('content_operations', 'Content operations', 'Content, feed, and notification ops read'),
  ('developer_operations', 'Developer operations', 'Feature flags and platform ops'),
  ('read_only_auditor', 'Read-only auditor', 'Immutable audit read access')
on conflict (role_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Permission registry + role→permission mapping
-- ---------------------------------------------------------------------------
create table if not exists public.platform_permissions (
  permission_key text primary key,
  label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.platform_permissions enable row level security;
revoke all on public.platform_permissions from public, anon, authenticated;

insert into public.platform_permissions (permission_key, label, description) values
  ('dashboard.read', 'Dashboard read', 'Read root dashboard modules and overview'),
  ('support.read', 'Support read', 'Read support tickets'),
  ('support.write', 'Support write', 'Create and update support tickets'),
  ('support.assign', 'Support assign', 'Assign support tickets'),
  ('ads.read', 'Ads read', 'Read ad campaigns'),
  ('ads.write', 'Ads write', 'Create and update ad campaigns'),
  ('ads.review', 'Ads review', 'Set ad creative review status'),
  ('finance.read', 'Finance read', 'Read finance approvals and subscriptions'),
  ('finance.write', 'Finance write', 'Create finance approval requests'),
  ('finance.approve', 'Finance approve', 'Approve or reject finance requests'),
  ('incidents.read', 'Incidents read', 'Read platform incidents'),
  ('incidents.write', 'Incidents write', 'Create and update platform incidents'),
  ('flags.write', 'Feature flags write', 'Upsert remote feature flags'),
  ('roles.manage', 'Roles manage', 'Assign or revoke platform roles'),
  ('subscriptions.write', 'Subscriptions write', 'Admin sync subscription records'),
  ('exports.create', 'Exports create', 'Create root dashboard export jobs'),
  ('search.command', 'Command search', 'Global command-center search'),
  ('voice.read', 'Voice read', 'List voice rooms / meeting sessions'),
  ('radio.read', 'Radio read', 'List radio sessions'),
  ('podcast.read', 'Podcast read', 'List podcast shows / series'),
  ('notifications.read', 'Notifications read', 'List notification ops metadata'),
  ('reports.read', 'Reports read', 'List content safety reports'),
  ('dm_safety.read', 'DM safety read', 'List DM safety reports')
on conflict (permission_key) do nothing;

create table if not exists public.platform_role_permissions (
  role_key text not null references public.platform_role_catalog(role_key) on delete cascade,
  permission_key text not null references public.platform_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

alter table public.platform_role_permissions enable row level security;
revoke all on public.platform_role_permissions from public, anon, authenticated;

-- Broad category seeds (root_owner / platform_admin resolved in has_platform_permission)
insert into public.platform_role_permissions (role_key, permission_key)
select role_key, permission_key
from (
  values
    -- support
    ('support_manager', 'dashboard.read'),
    ('support_manager', 'support.read'),
    ('support_manager', 'support.write'),
    ('support_manager', 'support.assign'),
    ('support_manager', 'search.command'),
    ('support_manager', 'exports.create'),
    ('support_agent', 'dashboard.read'),
    ('support_agent', 'support.read'),
    ('support_agent', 'support.write'),
    ('support_agent', 'support.assign'),
    -- ads
    ('ads_manager', 'dashboard.read'),
    ('ads_manager', 'ads.read'),
    ('ads_manager', 'ads.write'),
    ('ads_manager', 'ads.review'),
    ('ads_manager', 'search.command'),
    ('ads_operator', 'dashboard.read'),
    ('ads_operator', 'ads.read'),
    ('ads_operator', 'ads.write'),
    ('ads_reviewer', 'dashboard.read'),
    ('ads_reviewer', 'ads.read'),
    ('ads_reviewer', 'ads.review'),
    -- security / T&S
    ('security_manager', 'dashboard.read'),
    ('security_manager', 'incidents.read'),
    ('security_manager', 'incidents.write'),
    ('security_manager', 'reports.read'),
    ('security_manager', 'dm_safety.read'),
    ('security_manager', 'search.command'),
    ('security_analyst', 'dashboard.read'),
    ('security_analyst', 'incidents.read'),
    ('security_analyst', 'reports.read'),
    ('security_analyst', 'dm_safety.read'),
    ('trust_safety_manager', 'dashboard.read'),
    ('trust_safety_manager', 'reports.read'),
    ('trust_safety_manager', 'dm_safety.read'),
    ('trust_safety_manager', 'search.command'),
    ('moderator', 'dashboard.read'),
    ('moderator', 'reports.read'),
    ('moderator', 'dm_safety.read'),
    -- finance
    ('finance_viewer', 'dashboard.read'),
    ('finance_viewer', 'finance.read'),
    ('finance_operator', 'dashboard.read'),
    ('finance_operator', 'finance.read'),
    ('finance_operator', 'finance.write'),
    ('finance_operator', 'finance.approve'),
    ('finance_operator', 'subscriptions.write'),
    -- analytics / ops
    ('analytics_viewer', 'dashboard.read'),
    ('community_operations', 'dashboard.read'),
    ('community_operations', 'voice.read'),
    ('community_operations', 'radio.read'),
    ('community_operations', 'podcast.read'),
    ('community_operations', 'search.command'),
    ('content_operations', 'dashboard.read'),
    ('content_operations', 'reports.read'),
    ('content_operations', 'podcast.read'),
    ('content_operations', 'notifications.read'),
    ('developer_operations', 'dashboard.read'),
    ('developer_operations', 'flags.write'),
    ('developer_operations', 'incidents.read'),
    ('read_only_auditor', 'dashboard.read'),
    ('read_only_auditor', 'finance.read'),
    ('read_only_auditor', 'incidents.read'),
    ('read_only_auditor', 'reports.read')
) as seed(role_key, permission_key)
on conflict (role_key, permission_key) do nothing;

create or replace function public.has_platform_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_app_admin()
    or public.is_root_owner()
    or public.has_platform_role('root_owner')
    or public.has_platform_role('platform_admin')
    or exists (
      select 1
      from public.platform_role_assignments assignment
      join public.platform_role_permissions mapping
        on mapping.role_key = assignment.role_key
      where assignment.user_id = auth.uid()
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and mapping.permission_key = has_platform_permission.permission_key
    );
$$;

revoke all on function public.has_platform_permission(text) from public, anon;
grant execute on function public.has_platform_permission(text) to authenticated;

create or replace function public.assert_root_dashboard_permission(required_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.has_platform_permission(required_permission) then
    raise exception 'ROOT_DASHBOARD_PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_root_dashboard_permission(text) from public, anon;
grant execute on function public.assert_root_dashboard_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Enriched root dashboard audit (no secrets / no PII payloads)
-- ---------------------------------------------------------------------------
create table if not exists public.root_dashboard_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action_type text not null check (char_length(action_type) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text check (target_id is null or char_length(target_id) <= 160),
  reason text check (reason is null or char_length(reason) <= 500),
  case_id text check (case_id is null or char_length(case_id) <= 80),
  correlation_id uuid,
  before_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(before_json) = 'object'),
  after_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(after_json) = 'object'),
  result text not null default 'ok' check (result in ('ok', 'denied', 'error', 'bypass')),
  created_at timestamptz not null default now()
);

create index if not exists root_dashboard_audit_created_idx
  on public.root_dashboard_audit (created_at desc, id desc);
create index if not exists root_dashboard_audit_action_idx
  on public.root_dashboard_audit (action_type, created_at desc);
create index if not exists root_dashboard_audit_correlation_idx
  on public.root_dashboard_audit (correlation_id)
  where correlation_id is not null;

alter table public.root_dashboard_audit enable row level security;
revoke all on public.root_dashboard_audit from public, anon, authenticated;

comment on table public.root_dashboard_audit is
  'Append-only root dashboard privileged audit. Never store secrets, tokens, PAN, emails, IPs, or message bodies.';

create or replace function public.write_root_dashboard_audit(
  p_action_type text,
  p_target_type text,
  p_target_id text default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null,
  p_before_json jsonb default '{}'::jsonb,
  p_after_json jsonb default '{}'::jsonb,
  p_result text default 'ok'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  clean_before jsonb := coalesce(p_before_json, '{}'::jsonb);
  clean_after jsonb := coalesce(p_after_json, '{}'::jsonb);
  forbidden_keys text[] := array[
    'password', 'token', 'access_token', 'refresh_token', 'secret', 'api_key',
    'authorization', 'pan', 'card_number', 'cvv', 'ssn', 'email', 'phone',
    'raw_body', 'message_body', 'ip', 'user_agent'
  ];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not (
    public.is_app_admin()
    or public.is_root_owner()
    or exists (
      select 1 from public.platform_role_assignments a
      where a.user_id = auth.uid()
        and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
    )
  ) then
    raise exception 'ROOT_DASHBOARD_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if char_length(trim(p_action_type)) not between 1 and 80
     or char_length(trim(p_target_type)) not between 1 and 40 then
    raise exception 'ROOT_AUDIT_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(clean_before) is distinct from 'object'
     or jsonb_typeof(clean_after) is distinct from 'object' then
    raise exception 'ROOT_AUDIT_JSON_INVALID' using errcode = '22023';
  end if;
  if clean_before ?| forbidden_keys or clean_after ?| forbidden_keys then
    raise exception 'ROOT_AUDIT_PII_FORBIDDEN' using errcode = '22023';
  end if;

  insert into public.root_dashboard_audit (
    actor_id, action_type, target_type, target_id, reason, case_id,
    correlation_id, before_json, after_json, result
  ) values (
    auth.uid(),
    trim(p_action_type),
    trim(p_target_type),
    nullif(left(trim(coalesce(p_target_id, '')), 160), ''),
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    nullif(left(trim(coalesce(p_case_id, '')), 80), ''),
    p_correlation_id,
    clean_before,
    clean_after,
    coalesce(nullif(trim(p_result), ''), 'ok')
  )
  returning id into new_id;

  -- Lightweight bridge into legacy admin audit (metadata only)
  begin
    insert into public.admin_operations_audit (actor_id, action_type, target_type, target_id)
    values (
      auth.uid(),
      left(trim(p_action_type), 80),
      left(trim(p_target_type), 40),
      nullif(left(trim(coalesce(p_target_id, '')), 160), '')
    );
  exception
    when others then
      null;
  end;

  return new_id;
end;
$$;

revoke all on function public.write_root_dashboard_audit(text, text, text, text, text, uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.write_root_dashboard_audit(text, text, text, text, text, uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) MFA / privileged step-up
-- ---------------------------------------------------------------------------
create table if not exists public.privileged_step_up_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null check (char_length(action_key) between 1 and 80),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (confirmed_at is null or confirmed_at >= created_at)
);

create index if not exists privileged_step_up_user_action_idx
  on public.privileged_step_up_challenges (user_id, action_key, confirmed_at desc)
  where confirmed_at is not null;

alter table public.privileged_step_up_challenges enable row level security;
revoke all on public.privileged_step_up_challenges from public, anon, authenticated;

create or replace function public.create_privileged_step_up(action_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge_id uuid;
  clean_key text := left(trim(coalesce(action_key, '')), 80);
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(clean_key) < 1 then
    raise exception 'STEP_UP_ACTION_INVALID' using errcode = '22023';
  end if;
  if not (
    public.is_app_admin()
    or public.is_root_owner()
    or public.has_platform_role('root_owner')
    or public.has_platform_role('platform_admin')
    or exists (
      select 1 from public.platform_role_assignments a
      where a.user_id = auth.uid()
        and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
    )
  ) then
    raise exception 'ROOT_DASHBOARD_PERMISSION_DENIED' using errcode = '42501';
  end if;

  insert into public.privileged_step_up_challenges (user_id, action_key, expires_at)
  values (auth.uid(), clean_key, now() + interval '10 minutes')
  returning id into challenge_id;

  perform public.write_root_dashboard_audit(
    'step_up_create',
    'step_up',
    challenge_id::text,
    null,
    null,
    challenge_id,
    '{}'::jsonb,
    jsonb_build_object('action_key', clean_key),
    'ok'
  );

  return challenge_id;
end;
$$;

revoke all on function public.create_privileged_step_up(text) from public, anon;
grant execute on function public.create_privileged_step_up(text) to authenticated;

create or replace function public.confirm_privileged_step_up(challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if challenge_id is null then
    raise exception 'STEP_UP_CHALLENGE_INVALID' using errcode = '22023';
  end if;

  update public.privileged_step_up_challenges challenge
  set confirmed_at = now()
  where challenge.id = challenge_id
    and challenge.user_id = auth.uid()
    and challenge.confirmed_at is null
    and challenge.expires_at > now();

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'STEP_UP_CHALLENGE_INVALID' using errcode = '22023';
  end if;

  perform public.write_root_dashboard_audit(
    'step_up_confirm',
    'step_up',
    challenge_id::text,
    null,
    null,
    challenge_id,
    '{}'::jsonb,
    jsonb_build_object('confirmed', true),
    'ok'
  );

  return true;
end;
$$;

revoke all on function public.confirm_privileged_step_up(uuid) from public, anon;
grant execute on function public.confirm_privileged_step_up(uuid) to authenticated;

create or replace function public.require_or_consume_step_up(
  action_key text,
  challenge_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_key text := left(trim(coalesce(action_key, '')), 80);
  matched_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(clean_key) < 1 then
    raise exception 'STEP_UP_ACTION_INVALID' using errcode = '22023';
  end if;

  select challenge.id
    into matched_id
  from public.privileged_step_up_challenges challenge
  where challenge.user_id = auth.uid()
    and challenge.action_key = clean_key
    and challenge.confirmed_at is not null
    and challenge.confirmed_at >= now() - interval '5 minutes'
    and challenge.expires_at > now()
    and (challenge_id is null or challenge.id = challenge_id)
  order by challenge.confirmed_at desc
  limit 1
  for update;

  if matched_id is null then
    raise exception 'STEP_UP_REQUIRED' using errcode = '42501';
  end if;

  -- Consume: prevent reuse of the same challenge
  update public.privileged_step_up_challenges
  set expires_at = now()
  where id = matched_id;

  perform public.write_root_dashboard_audit(
    'step_up_consume',
    'step_up',
    matched_id::text,
    null,
    null,
    matched_id,
    '{}'::jsonb,
    jsonb_build_object('action_key', clean_key),
    'ok'
  );

  return matched_id;
end;
$$;

revoke all on function public.require_or_consume_step_up(text, uuid) from public, anon;
grant execute on function public.require_or_consume_step_up(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Mutations (all audited)
-- ---------------------------------------------------------------------------

create or replace function public.create_support_ticket(
  p_subject text,
  p_category text default 'general',
  p_priority text default 'normal',
  p_requester_id uuid default null,
  p_tags text[] default '{}',
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  ticket_no text;
begin
  perform public.assert_root_dashboard_permission('support.write');
  if char_length(trim(coalesce(p_subject, ''))) not between 3 and 200 then
    raise exception 'SUPPORT_TICKET_INVALID' using errcode = '22023';
  end if;
  if coalesce(p_priority, 'normal') not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'SUPPORT_TICKET_INVALID' using errcode = '22023';
  end if;

  ticket_no := 'ST-' || to_char(now() at time zone 'utc', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.support_tickets (
    ticket_number, subject, category, priority, requester_id, tags
  ) values (
    ticket_no,
    trim(p_subject),
    left(coalesce(nullif(trim(p_category), ''), 'general'), 80),
    coalesce(p_priority, 'normal'),
    p_requester_id,
    coalesce(p_tags, '{}')
  )
  returning id into new_id;

  perform public.write_root_dashboard_audit(
    'support_ticket_create',
    'support_ticket',
    new_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    '{}'::jsonb,
    jsonb_build_object(
      'ticket_number', ticket_no,
      'category', left(coalesce(nullif(trim(p_category), ''), 'general'), 80),
      'priority', coalesce(p_priority, 'normal')
    ),
    'ok'
  );

  return new_id;
end;
$$;

create or replace function public.update_support_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.support_tickets%rowtype;
begin
  perform public.assert_root_dashboard_permission('support.write');
  if p_status not in ('open', 'pending', 'resolved', 'closed', 'merged') then
    raise exception 'SUPPORT_TICKET_STATUS_INVALID' using errcode = '22023';
  end if;

  select * into before_row from public.support_tickets where id = p_ticket_id;
  if before_row.id is null then
    raise exception 'SUPPORT_TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.support_tickets
  set status = p_status,
      updated_at = now(),
      resolved_at = case
        when p_status in ('resolved', 'closed') then coalesce(resolved_at, now())
        else null
      end
  where id = p_ticket_id;

  perform public.write_root_dashboard_audit(
    'support_ticket_status',
    'support_ticket',
    p_ticket_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('status', before_row.status),
    jsonb_build_object('status', p_status),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.assign_support_ticket(
  p_ticket_id uuid,
  p_assignee_id uuid,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_assignee uuid;
begin
  perform public.assert_root_dashboard_permission('support.assign');

  select assignee_id into before_assignee
  from public.support_tickets
  where id = p_ticket_id;
  if not found then
    raise exception 'SUPPORT_TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_assignee_id is not null and not exists (
    select 1 from public.profiles where id = p_assignee_id
  ) then
    raise exception 'SUPPORT_ASSIGNEE_INVALID' using errcode = '22023';
  end if;

  update public.support_tickets
  set assignee_id = p_assignee_id,
      updated_at = now()
  where id = p_ticket_id;

  perform public.write_root_dashboard_audit(
    'support_ticket_assign',
    'support_ticket',
    p_ticket_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('assignee_id', before_assignee),
    jsonb_build_object('assignee_id', p_assignee_id),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.upsert_ad_campaign(
  p_id uuid default null,
  p_name text default null,
  p_advertiser_label text default 'Advertiser',
  p_objective text default 'awareness',
  p_budget_cents bigint default 0,
  p_schedule_start timestamptz default null,
  p_schedule_end timestamptz default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  before_json jsonb := '{}'::jsonb;
begin
  perform public.assert_root_dashboard_permission('ads.write');

  if p_id is null then
    if char_length(trim(coalesce(p_name, ''))) not between 2 and 120 then
      raise exception 'AD_CAMPAIGN_INVALID' using errcode = '22023';
    end if;
    insert into public.ad_campaigns (
      name, advertiser_label, objective, budget_cents, schedule_start, schedule_end
    ) values (
      trim(p_name),
      left(coalesce(nullif(trim(p_advertiser_label), ''), 'Advertiser'), 120),
      left(coalesce(nullif(trim(p_objective), ''), 'awareness'), 80),
      greatest(coalesce(p_budget_cents, 0), 0),
      p_schedule_start,
      p_schedule_end
    )
    returning id into target_id;
  else
    select jsonb_build_object(
      'name', name,
      'status', status,
      'budget_cents', budget_cents,
      'objective', objective
    ) into before_json
    from public.ad_campaigns
    where id = p_id;
    if before_json is null then
      raise exception 'AD_CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
    end if;

    update public.ad_campaigns
    set name = coalesce(nullif(trim(p_name), ''), name),
        advertiser_label = coalesce(nullif(trim(p_advertiser_label), ''), advertiser_label),
        objective = coalesce(nullif(trim(p_objective), ''), objective),
        budget_cents = coalesce(p_budget_cents, budget_cents),
        schedule_start = coalesce(p_schedule_start, schedule_start),
        schedule_end = coalesce(p_schedule_end, schedule_end),
        updated_at = now()
    where id = p_id;

    target_id := p_id;
  end if;

  perform public.write_root_dashboard_audit(
    'ad_campaign_upsert',
    'ad_campaign',
    target_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    before_json,
    jsonb_build_object('name', coalesce(nullif(trim(p_name), ''), before_json->>'name')),
    'ok'
  );

  return target_id;
end;
$$;

create or replace function public.set_ad_campaign_status(
  p_campaign_id uuid,
  p_status text,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_status text;
begin
  perform public.assert_root_dashboard_permission('ads.write');
  if p_status not in ('draft', 'in_review', 'active', 'paused', 'archived') then
    raise exception 'AD_CAMPAIGN_STATUS_INVALID' using errcode = '22023';
  end if;

  select status into before_status from public.ad_campaigns where id = p_campaign_id;
  if before_status is null then
    raise exception 'AD_CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.ad_campaigns
  set status = p_status, updated_at = now()
  where id = p_campaign_id;

  perform public.write_root_dashboard_audit(
    'ad_campaign_status',
    'ad_campaign',
    p_campaign_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_status),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.set_ad_review_status(
  p_campaign_id uuid,
  p_review_status text,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_review text;
begin
  perform public.assert_root_dashboard_permission('ads.review');
  if p_review_status not in ('pending', 'in_review', 'approved', 'rejected') then
    raise exception 'AD_REVIEW_STATUS_INVALID' using errcode = '22023';
  end if;

  select review_status into before_review from public.ad_campaigns where id = p_campaign_id;
  if before_review is null then
    raise exception 'AD_CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.ad_campaigns
  set review_status = p_review_status,
      status = case
        when p_review_status = 'approved' and status = 'draft' then 'in_review'
        else status
      end,
      updated_at = now()
  where id = p_campaign_id;

  perform public.write_root_dashboard_audit(
    'ad_review_status',
    'ad_campaign',
    p_campaign_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('review_status', before_review),
    jsonb_build_object('review_status', p_review_status),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.create_platform_incident(
  p_title text,
  p_severity text,
  p_affected_services text[] default '{}',
  p_public_message text default null,
  p_owner_id uuid default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform public.assert_root_dashboard_permission('incidents.write');
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 200 then
    raise exception 'INCIDENT_INVALID' using errcode = '22023';
  end if;
  if p_severity not in ('sev1', 'sev2', 'sev3', 'sev4') then
    raise exception 'INCIDENT_SEVERITY_INVALID' using errcode = '22023';
  end if;

  insert into public.platform_incidents (
    title, severity, affected_services, public_message, owner_id
  ) values (
    trim(p_title),
    p_severity,
    coalesce(p_affected_services, '{}'),
    nullif(left(trim(coalesce(p_public_message, '')), 2000), ''),
    p_owner_id
  )
  returning id into new_id;

  perform public.write_root_dashboard_audit(
    'incident_create',
    'platform_incident',
    new_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    '{}'::jsonb,
    jsonb_build_object('severity', p_severity),
    'ok'
  );

  return new_id;
end;
$$;

create or replace function public.update_platform_incident_status(
  p_incident_id uuid,
  p_status text,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_status text;
begin
  perform public.assert_root_dashboard_permission('incidents.write');
  if p_status not in ('investigating', 'identified', 'monitoring', 'resolved') then
    raise exception 'INCIDENT_STATUS_INVALID' using errcode = '22023';
  end if;

  select status into before_status from public.platform_incidents where id = p_incident_id;
  if before_status is null then
    raise exception 'INCIDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.platform_incidents
  set status = p_status,
      updated_at = now(),
      resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end
  where id = p_incident_id;

  perform public.write_root_dashboard_audit(
    'incident_status',
    'platform_incident',
    p_incident_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_status),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.create_finance_approval_request(
  p_request_type text,
  p_amount_cents bigint,
  p_currency text default 'USD',
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform public.assert_root_dashboard_permission('finance.write');
  if char_length(trim(coalesce(p_request_type, ''))) not between 1 and 120 then
    raise exception 'FINANCE_REQUEST_INVALID' using errcode = '22023';
  end if;
  if coalesce(p_amount_cents, -1) < 0 then
    raise exception 'FINANCE_REQUEST_INVALID' using errcode = '22023';
  end if;

  insert into public.finance_approval_requests (
    request_type, amount_cents, currency, requested_by
  ) values (
    trim(p_request_type),
    p_amount_cents,
    upper(left(coalesce(nullif(trim(p_currency), ''), 'USD'), 8)),
    auth.uid()
  )
  returning id into new_id;

  perform public.write_root_dashboard_audit(
    'finance_request_create',
    'finance_approval',
    new_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    '{}'::jsonb,
    jsonb_build_object(
      'request_type', trim(p_request_type),
      'amount_cents', p_amount_cents,
      'currency', upper(left(coalesce(nullif(trim(p_currency), ''), 'USD'), 8))
    ),
    'ok'
  );

  return new_id;
end;
$$;

create or replace function public.review_finance_approval_request(
  p_request_id uuid,
  p_decision text,
  p_step_up_challenge_id uuid default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_status text;
begin
  perform public.assert_root_dashboard_permission('finance.approve');
  if p_decision not in ('approved', 'rejected') then
    raise exception 'FINANCE_DECISION_INVALID' using errcode = '22023';
  end if;

  perform public.require_or_consume_step_up('finance.approve', p_step_up_challenge_id);

  select status into before_status
  from public.finance_approval_requests
  where id = p_request_id;
  if before_status is null then
    raise exception 'FINANCE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if before_status <> 'pending' then
    raise exception 'FINANCE_REQUEST_NOT_PENDING' using errcode = '22023';
  end if;

  update public.finance_approval_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  perform public.write_root_dashboard_audit(
    'finance_request_review',
    'finance_approval',
    p_request_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_decision),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.upsert_remote_feature_flag(
  p_flag_key text,
  p_enabled boolean,
  p_description text default '',
  p_step_up_challenge_id uuid default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_key text := left(trim(coalesce(p_flag_key, '')), 120);
  before_enabled boolean;
  requires_step_up boolean := false;
  is_kill_or_emergency boolean;
begin
  perform public.assert_root_dashboard_permission('flags.write');
  if char_length(clean_key) < 2 then
    raise exception 'FEATURE_FLAG_INVALID' using errcode = '22023';
  end if;

  select enabled into before_enabled
  from public.remote_feature_flags
  where flag_key = clean_key;

  is_kill_or_emergency := clean_key ~* '(kill|emergency|breaker)';
  -- Step-up for kill/emergency flags, or emergency disable of a live flag (true -> false)
  requires_step_up := is_kill_or_emergency
    or (before_enabled is true and p_enabled is false);

  if requires_step_up then
    perform public.require_or_consume_step_up('flags.kill_switch', p_step_up_challenge_id);
  end if;

  insert into public.remote_feature_flags (flag_key, enabled, description, updated_at, updated_by)
  values (
    clean_key,
    coalesce(p_enabled, false),
    left(coalesce(p_description, ''), 500),
    now(),
    auth.uid()
  )
  on conflict (flag_key) do update
  set enabled = excluded.enabled,
      description = excluded.description,
      updated_at = now(),
      updated_by = auth.uid();

  perform public.write_root_dashboard_audit(
    'feature_flag_upsert',
    'feature_flag',
    clean_key,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('enabled', before_enabled),
    jsonb_build_object('enabled', coalesce(p_enabled, false), 'step_up', requires_step_up),
    'ok'
  );

  return clean_key;
end;
$$;

create or replace function public.assign_platform_role(
  p_user_id uuid,
  p_role_key text,
  p_scope_type text default 'global',
  p_expires_at timestamptz default null,
  p_step_up_challenge_id uuid default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_role text := trim(coalesce(p_role_key, ''));
  clean_scope text := coalesce(nullif(trim(p_scope_type), ''), 'global');
  assignment_id uuid;
  actor_is_root boolean;
begin
  perform public.assert_root_dashboard_permission('roles.manage');
  perform public.require_or_consume_step_up('roles.manage', p_step_up_challenge_id);

  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'ROLE_ASSIGN_USER_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_role_catalog where role_key = clean_role) then
    raise exception 'ROLE_KEY_INVALID' using errcode = '22023';
  end if;
  if clean_scope not in ('global', 'environment') then
    raise exception 'ROLE_SCOPE_INVALID' using errcode = '22023';
  end if;

  actor_is_root := public.is_root_owner() or public.has_platform_role('root_owner');
  if clean_role = 'root_owner' and not actor_is_root then
    raise exception 'ROOT_OWNER_SELF_ESCALATION_DENIED' using errcode = '42501';
  end if;
  -- Prevent non-root actors from escalating themselves to root_owner
  if clean_role = 'root_owner' and p_user_id = auth.uid() and not actor_is_root then
    raise exception 'ROOT_OWNER_SELF_ESCALATION_DENIED' using errcode = '42501';
  end if;

  insert into public.platform_role_assignments (
    user_id, role_key, scope_type, expires_at, granted_by, revoked_at
  ) values (
    p_user_id, clean_role, clean_scope, p_expires_at, auth.uid(), null
  )
  on conflict (user_id, role_key, scope_type) do update
  set expires_at = excluded.expires_at,
      granted_by = auth.uid(),
      revoked_at = null,
      created_at = case
        when public.platform_role_assignments.revoked_at is not null then now()
        else public.platform_role_assignments.created_at
      end
  returning id into assignment_id;

  perform public.write_root_dashboard_audit(
    'role_assign',
    'platform_role',
    assignment_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    '{}'::jsonb,
    jsonb_build_object(
      'user_id', p_user_id,
      'role_key', clean_role,
      'scope_type', clean_scope
    ),
    'ok'
  );

  return assignment_id;
end;
$$;

create or replace function public.revoke_platform_role(
  p_assignment_id uuid,
  p_step_up_challenge_id uuid default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.platform_role_assignments%rowtype;
  actor_is_root boolean;
begin
  perform public.assert_root_dashboard_permission('roles.manage');
  perform public.require_or_consume_step_up('roles.manage', p_step_up_challenge_id);

  select * into before_row
  from public.platform_role_assignments
  where id = p_assignment_id;
  if before_row.id is null then
    raise exception 'ROLE_ASSIGNMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  actor_is_root := public.is_root_owner() or public.has_platform_role('root_owner');
  if before_row.role_key = 'root_owner' and not actor_is_root then
    raise exception 'ROOT_OWNER_REVOKE_DENIED' using errcode = '42501';
  end if;

  update public.platform_role_assignments
  set revoked_at = now()
  where id = p_assignment_id
    and revoked_at is null;

  perform public.write_root_dashboard_audit(
    'role_revoke',
    'platform_role',
    p_assignment_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object(
      'user_id', before_row.user_id,
      'role_key', before_row.role_key,
      'scope_type', before_row.scope_type
    ),
    jsonb_build_object('revoked', true),
    'ok'
  );

  return true;
end;
$$;

create or replace function public.upsert_subscription_record(
  p_external_ref text,
  p_plan_key text,
  p_status text,
  p_currency text default 'USD',
  p_mrr_cents bigint default 0,
  p_region_code text default null,
  p_subscriber_ref text default null,
  p_current_period_end timestamptz default null,
  p_canceled_at timestamptz default null,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_ref text := left(trim(coalesce(p_external_ref, '')), 160);
  target_id uuid;
  before_status text;
begin
  perform public.assert_root_dashboard_permission('subscriptions.write');
  if char_length(clean_ref) < 2 then
    raise exception 'SUBSCRIPTION_REF_INVALID' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_plan_key, ''))) < 1 then
    raise exception 'SUBSCRIPTION_PLAN_INVALID' using errcode = '22023';
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'canceled', 'paused') then
    raise exception 'SUBSCRIPTION_STATUS_INVALID' using errcode = '22023';
  end if;
  -- Admin sync only — never accept PAN / card fields (parameters intentionally omit them)

  select id, status into target_id, before_status
  from public.subscription_records
  where external_ref = clean_ref;

  if target_id is null then
    insert into public.subscription_records (
      external_ref, plan_key, status, currency, mrr_cents,
      region_code, subscriber_ref, current_period_end, canceled_at
    ) values (
      clean_ref,
      trim(p_plan_key),
      p_status,
      upper(left(coalesce(nullif(trim(p_currency), ''), 'USD'), 8)),
      greatest(coalesce(p_mrr_cents, 0), 0),
      nullif(left(trim(coalesce(p_region_code, '')), 16), ''),
      nullif(left(trim(coalesce(p_subscriber_ref, '')), 120), ''),
      p_current_period_end,
      p_canceled_at
    )
    returning id into target_id;
  else
    update public.subscription_records
    set plan_key = trim(p_plan_key),
        status = p_status,
        currency = upper(left(coalesce(nullif(trim(p_currency), ''), 'USD'), 8)),
        mrr_cents = greatest(coalesce(p_mrr_cents, 0), 0),
        region_code = nullif(left(trim(coalesce(p_region_code, '')), 16), ''),
        subscriber_ref = nullif(left(trim(coalesce(p_subscriber_ref, '')), 120), ''),
        current_period_end = p_current_period_end,
        canceled_at = p_canceled_at,
        updated_at = now()
    where id = target_id;
  end if;

  perform public.write_root_dashboard_audit(
    'subscription_upsert',
    'subscription',
    target_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_status, 'plan_key', trim(p_plan_key), 'mrr_cents', greatest(coalesce(p_mrr_cents, 0), 0)),
    'ok'
  );

  return target_id;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text, uuid, text[], text, text, uuid) from public, anon;
revoke all on function public.update_support_ticket_status(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.assign_support_ticket(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.upsert_ad_campaign(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, uuid) from public, anon;
revoke all on function public.set_ad_campaign_status(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.set_ad_review_status(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.create_platform_incident(text, text, text[], text, uuid, text, text, uuid) from public, anon;
revoke all on function public.update_platform_incident_status(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.create_finance_approval_request(text, bigint, text, text, text, uuid) from public, anon;
revoke all on function public.review_finance_approval_request(uuid, text, uuid, text, text, uuid) from public, anon;
revoke all on function public.upsert_remote_feature_flag(text, boolean, text, uuid, text, text, uuid) from public, anon;
revoke all on function public.assign_platform_role(uuid, text, text, timestamptz, uuid, text, text, uuid) from public, anon;
revoke all on function public.revoke_platform_role(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.upsert_subscription_record(text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, uuid) from public, anon;

grant execute on function public.create_support_ticket(text, text, text, uuid, text[], text, text, uuid) to authenticated;
grant execute on function public.update_support_ticket_status(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.assign_support_ticket(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.upsert_ad_campaign(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.set_ad_campaign_status(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.set_ad_review_status(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.create_platform_incident(text, text, text[], text, uuid, text, text, uuid) to authenticated;
grant execute on function public.update_platform_incident_status(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.create_finance_approval_request(text, bigint, text, text, text, uuid) to authenticated;
grant execute on function public.review_finance_approval_request(uuid, text, uuid, text, text, uuid) to authenticated;
grant execute on function public.upsert_remote_feature_flag(text, boolean, text, uuid, text, text, uuid) to authenticated;
grant execute on function public.assign_platform_role(uuid, text, text, timestamptz, uuid, text, text, uuid) to authenticated;
grant execute on function public.revoke_platform_role(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.upsert_subscription_record(text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Extend list_root_dashboard_module_v1 (+ new modules)
-- ---------------------------------------------------------------------------
create or replace function public.list_root_dashboard_module_v1(
  module_name text,
  page_cursor_created_at timestamptz default null,
  page_cursor_id text default null,
  page_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_limit integer := least(greatest(coalesce(page_limit, 25), 1), 50);
  result jsonb;
  required_perm text := 'dashboard.read';
begin
  if module_name in ('voice_rooms') then
    required_perm := 'voice.read';
  elsif module_name in ('radio_sessions') then
    required_perm := 'radio.read';
  elsif module_name in ('podcast_shows') then
    required_perm := 'podcast.read';
  elsif module_name in ('notifications_ops') then
    required_perm := 'notifications.read';
  elsif module_name in ('content_reports') then
    required_perm := 'reports.read';
  elsif module_name in ('dm_safety_reports') then
    required_perm := 'dm_safety.read';
  elsif module_name in ('support_tickets', 'support_team') then
    required_perm := 'support.read';
  elsif module_name in ('ad_campaigns', 'ad_creative_review', 'advertising_team') then
    required_perm := 'ads.read';
  elsif module_name in ('subscriptions', 'finance_approvals') then
    required_perm := 'finance.read';
  elsif module_name in ('incidents', 'security_alerts', 'security_team') then
    required_perm := 'incidents.read';
  elsif module_name in ('moderation_team') then
    required_perm := 'reports.read';
  end if;

  if not public.has_platform_permission(required_perm)
     and not public.has_platform_permission('dashboard.read') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if module_name = 'support_tickets' then
    with candidates as (
      select ticket.id::text id, ticket.subject label, ticket.category || ' · ' || ticket.priority detail, ticket.status, ticket.created_at
      from public.support_tickets ticket
      where page_cursor_created_at is null
        or (ticket.created_at, ticket.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by ticket.created_at desc, ticket.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'support_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('support_manager', 'support_agent')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'ad_campaigns' then
    with candidates as (
      select campaign.id::text id, campaign.name label, campaign.objective || ' · spend ' || campaign.spend_cents::text detail, campaign.status, campaign.created_at
      from public.ad_campaigns campaign
      where page_cursor_created_at is null
        or (campaign.created_at, campaign.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by campaign.created_at desc, campaign.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'ad_creative_review' then
    with candidates as (
      select campaign.id::text id, campaign.name label, campaign.review_status detail, campaign.status, campaign.created_at
      from public.ad_campaigns campaign
      where campaign.review_status in ('pending', 'in_review', 'rejected')
        and (page_cursor_created_at is null or (campaign.created_at, campaign.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by campaign.created_at desc, campaign.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'advertising_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('ads_manager', 'ads_operator', 'ads_reviewer')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'subscriptions' then
    with candidates as (
      select record.id::text id, record.plan_key label, record.status || ' · ' || record.currency detail, record.status, record.created_at
      from public.subscription_records record
      where page_cursor_created_at is null
        or (record.created_at, record.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by record.created_at desc, record.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'finance_approvals' then
    with candidates as (
      select request.id::text id, request.request_type label, request.amount_cents::text || ' ' || request.currency detail, request.status, request.created_at
      from public.finance_approval_requests request
      where page_cursor_created_at is null
        or (request.created_at, request.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by request.created_at desc, request.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'incidents' then
    with candidates as (
      select incident.id::text id, incident.title label, incident.severity detail, incident.status, incident.created_at
      from public.platform_incidents incident
      where page_cursor_created_at is null
        or (incident.created_at, incident.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by incident.created_at desc, incident.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'security_alerts' then
    with candidates as (
      select event.id::text id, replace(event.event_type, '_', ' ') label, event.reason_code detail, event.severity status, event.created_at
      from public.abuse_events event
      where event.severity in ('high', 'critical')
        and event.created_at >= now() - interval '7 days'
        and (page_cursor_created_at is null or (event.created_at, event.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by event.created_at desc, event.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'security_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('security_manager', 'security_analyst')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'moderation_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('trust_safety_manager', 'moderator')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'role_assignments' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, assignment.scope_type status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'audit_logs' then
    with candidates as (
      select audit.id::text id, audit.action_type label, audit.target_type detail, coalesce(audit.result, 'recorded') status, audit.created_at
      from public.root_dashboard_audit audit
      where page_cursor_created_at is null
        or (audit.created_at, audit.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '0'))
      order by audit.created_at desc, audit.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'feature_flags' then
    with candidates as (
      select flag.flag_key id, flag.flag_key label, flag.description detail, case when flag.enabled then 'enabled' else 'disabled' end status, flag.updated_at created_at
      from public.remote_feature_flags flag
      where page_cursor_created_at is null
        or (flag.updated_at, flag.flag_key) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by flag.updated_at desc, flag.flag_key desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'voice_rooms' then
    with candidates as (
      select
        session.id::text id,
        coalesce(room.title, session.provider_room_name) label,
        room.mode || ' · ' || session.status || ' · p' || session.participant_count::text detail,
        session.status,
        session.created_at
      from public.meeting_sessions session
      join public.meeting_rooms room on room.id = session.room_id
      where room.mode in ('voice', 'meeting', 'stage')
        and (page_cursor_created_at is null
          or (session.created_at, session.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by session.created_at desc, session.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'radio_sessions' then
    with candidates as (
      select
        session.id::text id,
        session.title label,
        session.status || ' · listeners ' || session.listener_count::text detail,
        session.status,
        session.created_at
      from public.radio_sessions session
      where page_cursor_created_at is null
        or (session.created_at, session.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by session.created_at desc, session.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'podcast_shows' then
    with candidates as (
      select
        series.id::text id,
        series.title label,
        case when series.is_active then 'active' else 'inactive' end detail,
        case when series.is_active then 'active' else 'inactive' end status,
        series.created_at
      from public.podcast_series series
      where page_cursor_created_at is null
        or (series.created_at, series.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by series.created_at desc, series.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'notifications_ops' then
    if to_regclass('public.notifications') is null then
      result := jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_cursor', null);
    else
      with candidates as (
        select
          n.id::text id,
          n.title label,
          n.category || ' · ' || n.context_kind detail,
          case when n.read_at is null then 'unread' else 'read' end status,
          n.created_at
        from public.notifications n
        where n.deleted_at is null
          and (page_cursor_created_at is null
            or (n.created_at, n.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
        order by n.created_at desc, n.id desc
        limit safe_limit + 1
      ),
      page as (select * from candidates limit safe_limit)
      select jsonb_build_object(
        'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
        'has_more', (select count(*) > safe_limit from candidates),
        'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
      ) into result;
    end if;

  elsif module_name in ('content_reports', 'reports') then
    with candidates as (
      select
        report.id::text id,
        report.target_type || ' report' label,
        report.reason || ' · ' || coalesce(report.status, 'open') detail,
        report.status,
        report.created_at
      from public.reports report
      where coalesce(report.target_type, '') <> 'direct_message'
        and report.conversation_id is null
        and (page_cursor_created_at is null
          or (report.created_at, report.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by report.created_at desc, report.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'dm_safety_reports' then
    with candidates as (
      select
        report.id::text id,
        'DM safety report' label,
        report.reason || ' · ' || report.status detail,
        report.status,
        report.created_at
      from public.reports report
      where (
          report.target_type = 'direct_message'
          or report.conversation_id is not null
        )
        and (
          page_cursor_created_at is null
          or (report.created_at, report.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
        )
      order by report.created_at desc, report.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  else
    raise exception 'ROOT_DASHBOARD_MODULE_INVALID' using errcode = '22023';
  end if;

  return result;
end;
$$;

revoke all on function public.list_root_dashboard_module_v1(text, timestamptz, text, integer) from public, anon;
grant execute on function public.list_root_dashboard_module_v1(text, timestamptz, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Command center search
-- ---------------------------------------------------------------------------
create or replace function public.get_root_dashboard_command_search_v1(
  query text,
  result_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(query, '')));
  safe_limit integer := least(greatest(coalesce(result_limit, 20), 1), 20);
  results jsonb := '[]'::jsonb;
begin
  if not public.has_platform_permission('search.command')
     and not public.has_platform_permission('dashboard.read') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if char_length(q) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'query', query, 'limit', safe_limit);
  end if;

  with ticket_hits as (
    select 'support_ticket'::text entity_type, ticket.id::text entity_id,
           ticket.subject label, ticket.ticket_number detail, ticket.created_at
    from public.support_tickets ticket
    where lower(ticket.subject) like '%' || q || '%'
       or lower(ticket.ticket_number) like '%' || q || '%'
    order by ticket.created_at desc
    limit safe_limit
  ),
  campaign_hits as (
    select 'ad_campaign'::text, campaign.id::text, campaign.name, campaign.status, campaign.created_at
    from public.ad_campaigns campaign
    where lower(campaign.name) like '%' || q || '%'
    order by campaign.created_at desc
    limit safe_limit
  ),
  incident_hits as (
    select 'incident'::text, incident.id::text, incident.title, incident.severity, incident.created_at
    from public.platform_incidents incident
    where lower(incident.title) like '%' || q || '%'
    order by incident.created_at desc
    limit safe_limit
  ),
  profile_hits as (
    select 'profile'::text, profile.id::text,
           coalesce(nullif(profile.display_name, ''), profile.username) label,
           '@' || profile.username detail,
           profile.created_at
    from public.profiles profile
    where lower(profile.username) like '%' || q || '%'
       or lower(coalesce(profile.display_name, '')) like '%' || q || '%'
    order by profile.created_at desc
    limit safe_limit
  ),
  community_hits as (
    select 'community'::text, community.id::text, community.name, community.visibility, community.created_at
    from public.communities community
    where lower(community.name) like '%' || q || '%'
    order by community.created_at desc
    limit safe_limit
  ),
  combined as (
    select * from ticket_hits
    union all select * from campaign_hits
    union all select * from incident_hits
    union all select * from profile_hits
    union all select * from community_hits
    order by created_at desc
    limit safe_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'entity_type', entity_type,
    'entity_id', entity_id,
    'label', label,
    'detail', detail,
    'created_at', created_at
  ) order by created_at desc), '[]'::jsonb)
  into results
  from combined;

  return jsonb_build_object(
    'items', results,
    'query', query,
    'limit', safe_limit
  );
end;
$$;

revoke all on function public.get_root_dashboard_command_search_v1(text, integer) from public, anon;
grant execute on function public.get_root_dashboard_command_search_v1(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Export jobs
-- ---------------------------------------------------------------------------
create table if not exists public.root_dashboard_export_jobs (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  module_name text not null check (char_length(module_name) between 1 and 80),
  format text not null default 'csv' check (format in ('csv', 'json')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed', 'expired')),
  row_limit integer not null default 1000 check (row_limit between 1 and 10000),
  filter_json jsonb not null default '{}'::jsonb check (jsonb_typeof(filter_json) = 'object'),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);

create index if not exists root_dashboard_export_jobs_requester_idx
  on public.root_dashboard_export_jobs (requester_id, created_at desc);

alter table public.root_dashboard_export_jobs enable row level security;
revoke all on public.root_dashboard_export_jobs from public, anon, authenticated;

create or replace function public.create_root_dashboard_export_job(
  p_module_name text,
  p_format text default 'csv',
  p_row_limit integer default 1000,
  p_filter_json jsonb default '{}'::jsonb,
  p_reason text default null,
  p_case_id text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  clean_module text := left(trim(coalesce(p_module_name, '')), 80);
  clean_format text := lower(coalesce(nullif(trim(p_format), ''), 'csv'));
begin
  perform public.assert_root_dashboard_permission('exports.create');
  if char_length(clean_module) < 1 then
    raise exception 'EXPORT_MODULE_INVALID' using errcode = '22023';
  end if;
  if clean_format not in ('csv', 'json') then
    raise exception 'EXPORT_FORMAT_INVALID' using errcode = '22023';
  end if;

  insert into public.root_dashboard_export_jobs (
    requester_id, module_name, format, row_limit, filter_json, expires_at
  ) values (
    auth.uid(),
    clean_module,
    clean_format,
    least(greatest(coalesce(p_row_limit, 1000), 1), 10000),
    coalesce(p_filter_json, '{}'::jsonb),
    now() + interval '7 days'
  )
  returning id into new_id;

  perform public.write_root_dashboard_audit(
    'export_job_create',
    'export_job',
    new_id::text,
    p_reason,
    p_case_id,
    p_correlation_id,
    '{}'::jsonb,
    jsonb_build_object('module_name', clean_module, 'format', clean_format),
    'ok'
  );

  return new_id;
end;
$$;

create or replace function public.list_root_dashboard_export_jobs(
  page_cursor_created_at timestamptz default null,
  page_cursor_id text default null,
  page_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_limit integer := least(greatest(coalesce(page_limit, 25), 1), 50);
  result jsonb;
begin
  if not public.has_platform_permission('exports.create')
     and not public.has_platform_permission('dashboard.read') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  with candidates as (
    select
      job.id::text id,
      job.module_name label,
      job.format || ' · ' || job.status detail,
      job.status,
      job.created_at
    from public.root_dashboard_export_jobs job
    where (
        job.requester_id = auth.uid()
        or public.is_app_admin()
        or public.is_root_owner()
      )
      and (
        page_cursor_created_at is null
        or (job.created_at, job.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      )
    order by job.created_at desc, job.id desc
    limit safe_limit + 1
  ),
  page as (select * from candidates limit safe_limit)
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
    'has_more', (select count(*) > safe_limit from candidates),
    'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
  ) into result;

  return result;
end;
$$;

revoke all on function public.create_root_dashboard_export_job(text, text, integer, jsonb, text, text, uuid) from public, anon;
revoke all on function public.list_root_dashboard_export_jobs(timestamptz, text, integer) from public, anon;
grant execute on function public.create_root_dashboard_export_job(text, text, integer, jsonb, text, text, uuid) to authenticated;
grant execute on function public.list_root_dashboard_export_jobs(timestamptz, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) RLS: authenticated get ZERO direct table access (RPC-only)
-- ---------------------------------------------------------------------------
revoke all on public.platform_permissions from public, anon, authenticated;
revoke all on public.platform_role_permissions from public, anon, authenticated;
revoke all on public.root_dashboard_audit from public, anon, authenticated;
revoke all on public.privileged_step_up_challenges from public, anon, authenticated;
revoke all on public.root_dashboard_export_jobs from public, anon, authenticated;

-- Reinforce revoke on dashboard ops tables from core migration
revoke all on public.root_owners from public, anon, authenticated;
revoke all on public.platform_role_catalog from public, anon, authenticated;
revoke all on public.platform_role_assignments from public, anon, authenticated;
revoke all on public.support_tickets from public, anon, authenticated;
revoke all on public.ad_campaigns from public, anon, authenticated;
revoke all on public.subscription_records from public, anon, authenticated;
revoke all on public.finance_approval_requests from public, anon, authenticated;
revoke all on public.platform_incidents from public, anon, authenticated;
revoke all on public.remote_feature_flags from public, anon, authenticated;

-- Overview / summary keep admin gate but also accept permission mapping
create or replace function public.get_root_dashboard_overview_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_online_users bigint := 0;
  v_active_sessions bigint := 0;
  v_active_voice_rooms bigint := 0;
  v_registrations bigint := 0;
  v_dau bigint := 0;
  v_wau bigint := 0;
  v_mau bigint := 0;
  v_support_backlog bigint := 0;
  v_moderation_backlog bigint := 0;
  v_security_alerts bigint := 0;
  v_ad_impressions bigint := 0;
  v_ad_clicks bigint := 0;
  v_active_subscriptions bigint := 0;
  v_mrr_cents bigint := 0;
  v_open_incidents bigint := 0;
  v_privileged_actions bigint := 0;
  v_analytics_available boolean := to_regclass('public.analytics_events') is not null;
begin
  if not public.has_platform_permission('dashboard.read') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select count(distinct session.user_id)
    into v_online_users
  from public.user_presence_sessions session
  where session.expires_at > now()
    and session.status in ('online', 'idle', 'dnd');

  select count(*)
    into v_active_sessions
  from public.user_presence_sessions session
  where session.expires_at > now();

  select count(distinct session.room_id)
    into v_active_voice_rooms
  from public.meeting_sessions session
  where session.status in ('preparing', 'live', 'reconnecting');

  select count(*)
    into v_registrations
  from public.profiles profile
  where profile.created_at >= now() - interval '24 hours';

  if v_analytics_available then
    execute $sql$
      select count(distinct actor_user_id)
      from public.analytics_events
      where created_at >= now() - interval '24 hours'
        and actor_user_id is not null
    $sql$ into v_dau;

    execute $sql$
      select count(distinct actor_user_id)
      from public.analytics_events
      where created_at >= now() - interval '7 days'
        and actor_user_id is not null
    $sql$ into v_wau;

    execute $sql$
      select count(distinct actor_user_id)
      from public.analytics_events
      where created_at >= now() - interval '30 days'
        and actor_user_id is not null
    $sql$ into v_mau;
  end if;

  select count(*)
    into v_support_backlog
  from public.support_tickets ticket
  where ticket.status in ('open', 'pending');

  select count(*)
    into v_moderation_backlog
  from public.reports report
  where report.status = 'open';

  select count(*)
    into v_security_alerts
  from public.abuse_events event
  where event.severity in ('high', 'critical')
    and event.created_at >= now() - interval '24 hours';

  select coalesce(sum(campaign.impressions), 0), coalesce(sum(campaign.clicks), 0)
    into v_ad_impressions, v_ad_clicks
  from public.ad_campaigns campaign
  where campaign.status = 'active';

  select count(*), coalesce(sum(record.mrr_cents), 0)
    into v_active_subscriptions, v_mrr_cents
  from public.subscription_records record
  where record.status in ('active', 'trialing');

  select count(*)
    into v_open_incidents
  from public.platform_incidents incident
  where incident.status <> 'resolved';

  select count(*)
    into v_privileged_actions
  from public.root_dashboard_audit audit
  where audit.created_at >= now() - interval '24 hours';

  return jsonb_build_object(
    'online_users', v_online_users,
    'active_sessions', v_active_sessions,
    'active_voice_rooms', v_active_voice_rooms,
    'registrations_24h', v_registrations,
    'dau', case when v_analytics_available then v_dau else null end,
    'wau', case when v_analytics_available then v_wau else null end,
    'mau', case when v_analytics_available then v_mau else null end,
    'analytics_available', v_analytics_available,
    'support_backlog', v_support_backlog,
    'moderation_backlog', v_moderation_backlog,
    'security_alerts_24h', v_security_alerts,
    'ad_impressions', v_ad_impressions,
    'ad_clicks', v_ad_clicks,
    'active_subscriptions', v_active_subscriptions,
    'mrr_cents', v_mrr_cents,
    'open_incidents', v_open_incidents,
    'privileged_actions_24h', v_privileged_actions,
    'checked_at', now()
  );
end;
$$;

create or replace function public.get_root_dashboard_module_summary_v1(module_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_platform_permission('dashboard.read') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if module_name = 'support' then
    return jsonb_build_object(
      'open', (select count(*) from public.support_tickets where status in ('open', 'pending')),
      'urgent', (select count(*) from public.support_tickets where priority = 'urgent' and status in ('open', 'pending')),
      'resolved_24h', (select count(*) from public.support_tickets where resolved_at >= now() - interval '24 hours')
    );
  elsif module_name = 'advertising' then
    return jsonb_build_object(
      'active_campaigns', (select count(*) from public.ad_campaigns where status = 'active'),
      'pending_review', (select count(*) from public.ad_campaigns where review_status in ('pending', 'in_review')),
      'impressions', (select coalesce(sum(impressions), 0) from public.ad_campaigns where status = 'active'),
      'clicks', (select coalesce(sum(clicks), 0) from public.ad_campaigns where status = 'active')
    );
  elsif module_name = 'revenue' then
    return jsonb_build_object(
      'active_subscriptions', (select count(*) from public.subscription_records where status in ('active', 'trialing')),
      'past_due', (select count(*) from public.subscription_records where status = 'past_due'),
      'canceled_30d', (select count(*) from public.subscription_records where canceled_at >= now() - interval '30 days'),
      'mrr_cents', (select coalesce(sum(mrr_cents), 0) from public.subscription_records where status in ('active', 'trialing'))
    );
  elsif module_name = 'incidents' then
    return jsonb_build_object(
      'open', (select count(*) from public.platform_incidents where status <> 'resolved'),
      'sev1', (select count(*) from public.platform_incidents where severity = 'sev1' and status <> 'resolved')
    );
  else
    raise exception 'ROOT_DASHBOARD_SUMMARY_INVALID' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.get_root_dashboard_overview_v1() from public, anon;
revoke all on function public.get_root_dashboard_module_summary_v1(text) from public, anon;
grant execute on function public.get_root_dashboard_overview_v1() to authenticated;
grant execute on function public.get_root_dashboard_module_summary_v1(text) to authenticated;

commit;
