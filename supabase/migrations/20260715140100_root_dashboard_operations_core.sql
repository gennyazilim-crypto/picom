-- Root owner dashboard operations: RBAC foundation, support/ads/revenue/incidents, overview RPC.
begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin();
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.root_owners (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  activated_at timestamptz not null default now(),
  activated_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= activated_at)
);

alter table public.root_owners enable row level security;
revoke all on public.root_owners from public, anon, authenticated;

create or replace function public.is_root_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.root_owners owner
      where owner.user_id = auth.uid()
        and owner.revoked_at is null
    );
$$;

revoke all on function public.is_root_owner() from public;
grant execute on function public.is_root_owner() to authenticated;

create table if not exists public.platform_role_catalog (
  role_key text primary key,
  label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

insert into public.platform_role_catalog (role_key, label, description) values
  ('root_owner', 'Root owner', 'Full platform ownership with audited bootstrap'),
  ('platform_admin', 'Platform admin', 'Cross-module platform administration'),
  ('support_manager', 'Support manager', 'Support queue and staffing management'),
  ('support_agent', 'Support agent', 'Ticket handling and customer replies'),
  ('ads_manager', 'Ads manager', 'Campaign and inventory management'),
  ('ads_operator', 'Ads operator', 'Campaign operations and pacing'),
  ('security_manager', 'Security manager', 'SOC oversight and incident linkage'),
  ('security_analyst', 'Security analyst', 'Security event triage'),
  ('trust_safety_manager', 'Trust & Safety manager', 'Moderation and case management'),
  ('moderator', 'Moderator', 'Content and community moderation'),
  ('finance_viewer', 'Finance viewer', 'Revenue and approval read access'),
  ('analytics_viewer', 'Analytics viewer', 'Aggregated analytics read access'),
  ('read_only_auditor', 'Read-only auditor', 'Immutable audit read access')
on conflict (role_key) do nothing;

create table if not exists public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.platform_role_catalog(role_key) on delete restrict,
  scope_type text not null default 'global' check (scope_type in ('global', 'environment')),
  expires_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, role_key, scope_type)
);

create index if not exists platform_role_assignments_role_idx
  on public.platform_role_assignments (role_key, revoked_at, expires_at);

alter table public.platform_role_assignments enable row level security;
revoke all on public.platform_role_assignments from public, anon, authenticated;

create or replace function public.has_platform_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.platform_role_assignments assignment
      where assignment.user_id = auth.uid()
        and assignment.role_key = target_role
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
    );
$$;

revoke all on function public.has_platform_role(text) from public;
grant execute on function public.has_platform_role(text) to authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed', 'merged')),
  requester_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  sla_due_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc, id desc);

alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public, anon, authenticated;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  advertiser_label text not null default 'Advertiser',
  objective text not null default 'awareness',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'active', 'paused', 'archived')),
  review_status text not null default 'pending' check (review_status in ('pending', 'in_review', 'approved', 'rejected')),
  budget_cents bigint not null default 0 check (budget_cents >= 0),
  spend_cents bigint not null default 0 check (spend_cents >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  fraud_flags integer not null default 0 check (fraud_flags >= 0),
  schedule_start timestamptz,
  schedule_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_status_created_idx
  on public.ad_campaigns (status, created_at desc, id desc);

alter table public.ad_campaigns enable row level security;
revoke all on public.ad_campaigns from public, anon, authenticated;

create table if not exists public.subscription_records (
  id uuid primary key default gen_random_uuid(),
  external_ref text not null unique,
  plan_key text not null,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  currency text not null default 'USD',
  mrr_cents bigint not null default 0 check (mrr_cents >= 0),
  region_code text,
  subscriber_ref text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_records_status_created_idx
  on public.subscription_records (status, created_at desc, id desc);

alter table public.subscription_records enable row level security;
revoke all on public.subscription_records from public, anon, authenticated;

create table if not exists public.finance_approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists finance_approval_requests_status_created_idx
  on public.finance_approval_requests (status, created_at desc, id desc);

alter table public.finance_approval_requests enable row level security;
revoke all on public.finance_approval_requests from public, anon, authenticated;

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  severity text not null check (severity in ('sev1', 'sev2', 'sev3', 'sev4')),
  status text not null default 'investigating' check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  affected_services text[] not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  public_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists platform_incidents_status_created_idx
  on public.platform_incidents (status, created_at desc, id desc);

alter table public.platform_incidents enable row level security;
revoke all on public.platform_incidents from public, anon, authenticated;

create table if not exists public.remote_feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.remote_feature_flags enable row level security;
revoke all on public.remote_feature_flags from public, anon, authenticated;

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
begin
  if not public.is_app_admin() then
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
      where assignment.role_key in ('ads_manager', 'ads_operator')
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
      select audit.id::text id, audit.action_type label, audit.target_type detail, 'recorded' status, audit.created_at
      from public.admin_operations_audit audit
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

  else
    raise exception 'ROOT_DASHBOARD_MODULE_INVALID' using errcode = '22023';
  end if;

  return result;
end;
$$;

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
  if not public.is_app_admin() then
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
  from public.admin_operations_audit audit
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
  if not public.is_app_admin() then
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

revoke all on function public.list_root_dashboard_module_v1(text, timestamptz, text, integer) from public, anon;
revoke all on function public.get_root_dashboard_overview_v1() from public, anon;
revoke all on function public.get_root_dashboard_module_summary_v1(text) from public, anon;

grant execute on function public.list_root_dashboard_module_v1(text, timestamptz, text, integer) to authenticated;
grant execute on function public.get_root_dashboard_overview_v1() to authenticated;
grant execute on function public.get_root_dashboard_module_summary_v1(text) to authenticated;

do $$
declare
  owner_id uuid;
begin
  select auth_user.id
    into owner_id
  from auth.users auth_user
  where lower(auth_user.email) = lower('f.tayboga@gmail.com')
  limit 1;

  if owner_id is not null then
    insert into public.root_owners (user_id, activated_by)
    values (owner_id, owner_id)
    on conflict (user_id) do nothing;

    insert into public.app_admins (user_id, granted_by)
    values (owner_id, owner_id)
    on conflict (user_id) do nothing;

    insert into public.platform_role_assignments (user_id, role_key, granted_by)
    values (owner_id, 'root_owner', owner_id)
    on conflict (user_id, role_key, scope_type) do nothing;
  end if;
end;
$$;

commit;
