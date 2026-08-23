-- TASK33: Creator Studio publisher team core (invitations + members).
-- Distinct from community RBAC and platform Root finance RBAC.

begin;

create table if not exists public.publisher_studio_permission_definitions (
  permission_key text primary key
    check (permission_key ~ '^[a-z][a-z0-9_.]{2,80}$'),
  domain text not null check (domain in (
    'profile', 'streams', 'chat', 'analytics', 'media',
    'monetization', 'finance', 'team', 'security', 'audit'
  )),
  description text not null check (char_length(btrim(description)) between 4 and 200),
  is_dangerous boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.publisher_studio_permission_definitions is
  'Allowlisted Creator Studio permissions. Platform root/service permissions are never assignable here.';

insert into public.publisher_studio_permission_definitions (permission_key, domain, description, is_dangerous)
values
  ('publisher.profile.read', 'profile', 'Read publisher studio profile', false),
  ('publisher.profile.write', 'profile', 'Update publisher studio profile settings', false),
  ('streams.read', 'streams', 'View streams and schedules', false),
  ('streams.create', 'streams', 'Create stream schedules', false),
  ('streams.write', 'streams', 'Edit stream metadata/settings', false),
  ('streams.schedule', 'streams', 'Manage stream schedule', false),
  ('streams.go_live', 'streams', 'Start a live broadcast', true),
  ('streams.end', 'streams', 'End an active live broadcast', true),
  ('streams.credentials.manage', 'streams', 'Rotate or revoke stream credentials', true),
  ('chat.read', 'chat', 'Read live chat', false),
  ('chat.moderate', 'chat', 'Moderate live chat', false),
  ('chat.settings.manage', 'chat', 'Manage chat defaults', false),
  ('moderators.manage', 'chat', 'Assign stream moderators', true),
  ('analytics.read', 'analytics', 'Read publisher analytics', false),
  ('media.read', 'media', 'View recordings/replays/clips', false),
  ('media.manage', 'media', 'Manage media archive', false),
  ('clips.create', 'media', 'Create clips', false),
  ('replays.publish', 'media', 'Publish replays', false),
  ('monetization.read', 'monetization', 'Read monetization setup status', false),
  ('monetization.manage', 'monetization', 'Manage monetization products', true),
  ('finance.read', 'finance', 'Read earnings/statements (sanitized)', true),
  ('finance.write', 'finance', 'Non-approve finance configuration', true),
  ('finance.approve', 'finance', 'Approve payouts/adjustments', true),
  ('kyc.read_status', 'finance', 'Read own KYC status summary', true),
  ('kyc.manage', 'finance', 'Start/manage KYC onboarding', true),
  ('payout.read', 'finance', 'Read payout requests/status', true),
  ('payout.manage', 'finance', 'Request/manage payouts', true),
  ('statements.read', 'finance', 'Read finance statements', true),
  ('team.read', 'team', 'View team members and roles', false),
  ('team.manage', 'team', 'Invite/remove team members', true),
  ('roles.manage', 'team', 'Create/update custom roles', true),
  ('security.read', 'security', 'View security center summaries', false),
  ('security.manage', 'security', 'Manage security settings', true),
  ('audit.read', 'audit', 'Read sanitized studio activity', false)
on conflict (permission_key) do nothing;

create table if not exists public.publisher_studio_roles (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  role_key text not null check (role_key ~ '^[A-Z][A-Z0-9_]{1,40}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  is_builtin boolean not null default false,
  is_system_owner boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'retired')),
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_user_id, role_key),
  check (not is_system_owner or (is_builtin and role_key = 'OWNER'))
);

create index if not exists publisher_studio_roles_publisher_idx
  on public.publisher_studio_roles (publisher_user_id);

create trigger publisher_studio_roles_touch_updated_at
  before update on public.publisher_studio_roles
  for each row execute function public.verification_business_touch_updated_at();

create table if not exists public.publisher_studio_role_permissions (
  role_id uuid not null references public.publisher_studio_roles(id) on delete cascade,
  permission_key text not null references public.publisher_studio_permission_definitions(permission_key),
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create index if not exists publisher_studio_role_permissions_perm_idx
  on public.publisher_studio_role_permissions (permission_key);

create table if not exists public.publisher_team_members (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  member_user_id uuid not null references public.profiles(id) on delete restrict,
  role_id uuid not null references public.publisher_studio_roles(id) on delete restrict,
  status text not null default 'ACTIVE'
    check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED', 'EXPIRED')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  disabled_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_user_id, member_user_id),
  check (publisher_user_id <> member_user_id or status in ('ACTIVE', 'SUSPENDED'))
);

create index if not exists publisher_team_members_publisher_status_idx
  on public.publisher_team_members (publisher_user_id, status);

create index if not exists publisher_team_members_member_idx
  on public.publisher_team_members (member_user_id, status);

create trigger publisher_team_members_touch_updated_at
  before update on public.publisher_team_members
  for each row execute function public.verification_business_touch_updated_at();

create table if not exists public.publisher_team_invitations (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  role_id uuid not null references public.publisher_studio_roles(id) on delete restrict,
  invitee_user_id uuid references public.profiles(id) on delete set null,
  invitee_email_normalized text
    check (invitee_email_normalized is null or invitee_email_normalized ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null check (token_hint ~ '^[0-9a-f]{4,12}$'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED', 'USED')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  unique (token_hash),
  check (invitee_user_id is not null or invitee_email_normalized is not null),
  check (expires_at > created_at)
);

create index if not exists publisher_team_invitations_publisher_status_idx
  on public.publisher_team_invitations (publisher_user_id, status, expires_at);

create index if not exists publisher_team_invitations_invitee_idx
  on public.publisher_team_invitations (invitee_user_id, status)
  where invitee_user_id is not null;

-- Safety: operational hard upper bound (not a commercial entitlement)
create or replace function public.publisher_team_member_limit()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$ select 50 $$;

comment on function public.publisher_team_member_limit() is
  'Operational abuse upper bound for publisher team size; not a subscription entitlement.';

commit;
