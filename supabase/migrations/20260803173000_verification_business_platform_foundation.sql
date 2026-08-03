begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 160),
  legal_name text,
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('organization_owner', 'business_admin', 'billing_admin', 'campaign_manager', 'brand_manager', 'content_manager', 'analyst', 'support_contact')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id, organization_id);
create index if not exists organization_members_role_idx on public.organization_members (organization_id, role);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invited_email text not null check (char_length(btrim(invited_email)) between 3 and 320),
  invited_role text not null check (invited_role in ('business_admin', 'billing_admin', 'campaign_manager', 'brand_manager', 'content_manager', 'analyst', 'support_contact')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz
);

create unique index if not exists organization_invitations_pending_email_uidx
  on public.organization_invitations (organization_id, lower(invited_email))
  where status = 'pending';

create table if not exists public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'organization')),
  subject_id uuid not null,
  verification_type text not null check (char_length(btrim(verification_type)) between 2 and 80),
  status text not null default 'draft' check (status in ('draft', 'pending', 'requires_input', 'under_review', 'verified', 'rejected', 'expired', 'cancelled')),
  provider text,
  provider_reference text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  expires_at timestamptz,
  public_reason_code text,
  internal_reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists verification_cases_one_open_uidx
  on public.verification_cases (subject_type, subject_id, verification_type)
  where status in ('draft', 'pending', 'requires_input', 'under_review');

create table if not exists public.verification_case_status_history (
  id bigint generated always as identity primary key,
  verification_case_id uuid not null references public.verification_cases(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  public_reason_code text,
  internal_reason_code text,
  created_at timestamptz not null default now()
);

alter table public.verification_badges
  add column if not exists status text,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists expires_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists public_reason_code text,
  add column if not exists internal_reason_code text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.verification_badges
set status = case when revoked_at is null then 'active' else 'revoked' end
where status is null;

alter table public.verification_badges
  alter column status set not null,
  alter column status set default 'pending';

alter table public.verification_badges
  drop constraint if exists verification_badges_subject_type_check,
  add constraint verification_badges_subject_type_check check (subject_type in ('user', 'community', 'role', 'organization')),
  drop constraint if exists verification_badges_badge_kind_check,
  add constraint verification_badges_badge_kind_check check (badge_kind in ('profile_reviewed', 'community_official', 'role_managed', 'verified_user', 'official_community', 'picom_staff', 'verified_bot', 'creator_verified', 'verified', 'creator', 'publisher', 'business')),
  add constraint verification_badges_status_check check (status in ('pending', 'active', 'suspended', 'revoked', 'expired')),
  add constraint verification_badges_metadata_object_check check (jsonb_typeof(metadata) = 'object');

-- Replace legacy revoked_at uniqueness with status-aware active uniqueness.
drop index if exists public.idx_verification_badges_active_subject_kind;

create unique index if not exists verification_badges_one_active_type_uidx
  on public.verification_badges (subject_type, subject_id, badge_kind)
  where status = 'active';

create unique index if not exists verification_badges_one_primary_personal_uidx
  on public.verification_badges (subject_id)
  where subject_type = 'user' and is_primary and status = 'active';

create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'organization')),
  subject_id uuid not null,
  entitlement_key text not null check (entitlement_key in ('ad_free', 'verified_badge_eligible', 'priority_support', 'creator_analytics', 'publisher_analytics', 'monetization', 'business_dashboard', 'advertiser_dashboard')),
  status text not null default 'pending' check (status in ('pending', 'active', 'grace_period', 'suspended', 'expired', 'revoked')),
  source_type text not null check (char_length(btrim(source_type)) between 2 and 80),
  source_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  grace_until timestamptz,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists account_entitlements_one_active_uidx
  on public.account_entitlements (subject_type, subject_id, entitlement_key)
  where status in ('active', 'grace_period');

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 240),
  brand_name text not null check (char_length(btrim(brand_name)) between 2 and 160),
  company_type text not null check (char_length(btrim(company_type)) between 2 and 80),
  registration_number text,
  vat_number text,
  registered_country text not null check (char_length(btrim(registered_country)) between 2 and 8),
  registered_address text not null check (char_length(btrim(registered_address)) between 5 and 500),
  official_website text,
  corporate_email_domain text,
  representative_name text not null check (char_length(btrim(representative_name)) between 2 and 160),
  industry text,
  advertising_purpose text,
  estimated_monthly_budget_minor bigint check (estimated_monthly_budget_minor is null or estimated_monthly_budget_minor >= 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'requires_information', 'identity_verification_required', 'approved', 'rejected', 'suspended', 'revoked', 'expired')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  public_decision_reason text,
  internal_review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_applications_one_open_uidx
  on public.business_applications (organization_id)
  where status in ('draft', 'submitted', 'under_review', 'requires_information', 'identity_verification_required');

create table if not exists public.business_application_status_history (
  id bigint generated always as identity primary key,
  business_application_id uuid not null references public.business_applications(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  public_decision_reason text,
  internal_review_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_profile_reserved_slugs (
  slug text primary key check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  created_at timestamptz not null default now()
);

insert into public.business_profile_reserved_slugs (slug) values
  ('admin'), ('api'), ('app'), ('auth'), ('billing'), ('business'), ('help'), ('legal'), ('login'), ('picom'), ('root'), ('settings'), ('support'), ('www')
on conflict do nothing;

create table if not exists public.business_profiles (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 160),
  legal_name text,
  bio text not null default '' check (char_length(bio) <= 500),
  description text not null default '' check (char_length(description) <= 10000),
  website_url text,
  support_url text,
  public_contact_email text,
  industry text,
  founded_year integer check (founded_year is null or founded_year between 1000 and 3000),
  headquarters_country text,
  profile_logo_asset_id uuid,
  cover_asset_id uuid,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  public_status text not null default 'draft' check (public_status in ('draft', 'published', 'suspended', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_profiles_slug_lower_uidx on public.business_profiles (lower(slug));

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_type text not null check (asset_type in ('primary_logo', 'square_logo', 'light_logo', 'dark_logo', 'monochrome_logo', 'profile_cover', 'brand_guideline')),
  storage_path text not null check (char_length(btrim(storage_path)) between 3 and 1024),
  mime_type text not null check (char_length(btrim(mime_type)) between 3 and 120),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  file_size bigint not null check (file_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check (version > 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'active', 'rejected', 'archived', 'quarantined')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  unique (organization_id, asset_type, version),
  unique (storage_path)
);

alter table public.business_profiles
  add constraint business_profiles_profile_logo_asset_fk foreign key (profile_logo_asset_id) references public.brand_assets(id) on delete set null,
  add constraint business_profiles_cover_asset_fk foreign key (cover_asset_id) references public.brand_assets(id) on delete set null;

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 240),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'),
  short_description text not null default '' check (char_length(short_description) <= 500),
  description text not null default '' check (char_length(description) <= 20000),
  product_type text not null check (product_type in ('physical_product', 'digital_product', 'service', 'subscription', 'event', 'software', 'game', 'application', 'membership', 'other')),
  category_id uuid,
  sku text,
  price_amount_minor bigint check (price_amount_minor is null or price_amount_minor >= 0),
  compare_at_price_amount_minor bigint check (compare_at_price_amount_minor is null or compare_at_price_amount_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  availability text not null default 'available' check (availability in ('available', 'preorder', 'out_of_stock', 'discontinued')),
  purchase_url text,
  product_url text,
  support_url text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'unlisted', 'out_of_stock', 'archived', 'rejected', 'suspended')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected', 'not_required')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (compare_at_price_amount_minor is null or price_amount_minor is null or compare_at_price_amount_minor >= price_amount_minor)
);

create index if not exists business_products_public_idx on public.business_products (organization_id, status, published_at desc);

create table if not exists public.business_product_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  asset_id uuid references public.brand_assets(id) on delete restrict,
  external_url text,
  media_type text not null check (media_type in ('image', 'video', 'document')),
  position integer not null check (position >= 0),
  alt_text text,
  created_at timestamptz not null default now(),
  check ((asset_id is null) <> (external_url is null)),
  unique (product_id, position)
);

create table if not exists public.business_product_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.business_product_collection_items (
  collection_id uuid not null references public.business_product_collections(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id),
  unique (collection_id, position)
);

create table if not exists public.business_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  post_type text not null check (post_type in ('brand_update', 'product_announcement', 'product_launch', 'offer', 'discount', 'event', 'case_study', 'video', 'poll', 'job_posting', 'service_announcement', 'sponsored_content')),
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived', 'rejected', 'suspended')),
  sponsorship_state text not null default 'organic' check (sponsorship_state in ('organic', 'campaign_managed', 'sponsored')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((post_type = 'sponsored_content') = (sponsorship_state <> 'organic'))
);

create index if not exists business_posts_public_idx on public.business_posts (organization_id, status, published_at desc);

create table if not exists public.business_post_products (
  post_id uuid not null references public.business_posts(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, product_id),
  unique (post_id, position)
);

create table if not exists public.advertiser_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'organization')),
  owner_id uuid not null,
  advertiser_type text not null check (advertiser_type in ('individual', 'sole_trader', 'company', 'agency', 'business_partner')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 160),
  billing_status text not null default 'unconfigured' check (billing_status in ('unconfigured', 'pending', 'active', 'past_due', 'suspended')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  advertising_status text not null default 'pending' check (advertising_status in ('pending', 'active', 'suspended', 'revoked')),
  risk_status text not null default 'unknown' check (risk_status in ('unknown', 'clear', 'review_required', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

create table if not exists public.advertiser_account_members (
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner', 'billing_manager', 'campaign_manager', 'analyst')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (advertiser_account_id, user_id)
);

create table if not exists public.monetization_accounts (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type = 'user'),
  subject_id uuid not null references public.profiles(id) on delete restrict,
  program_type text not null check (program_type in ('creator', 'publisher')),
  badge_status text not null default 'none' check (badge_status in ('none', 'pending', 'active', 'suspended', 'revoked', 'expired')),
  monetization_status text not null default 'pending' check (monetization_status in ('pending', 'eligible', 'active', 'suspended', 'revoked', 'not_eligible')),
  payout_onboarding_status text not null default 'not_started' check (payout_onboarding_status in ('not_started', 'incomplete', 'pending_review', 'complete', 'rejected', 'not_configured')),
  compliance_status text not null default 'pending' check (compliance_status in ('pending', 'clear', 'review_required', 'blocked', 'expired')),
  contract_id uuid,
  activated_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists monetization_accounts_one_active_uidx
  on public.monetization_accounts (subject_id, program_type)
  where monetization_status = 'active';

create table if not exists public.revenue_share_contracts (
  id uuid primary key default gen_random_uuid(),
  program_type text not null check (program_type in ('creator', 'publisher')),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  effective_from timestamptz not null,
  effective_until timestamptz,
  platform_percentage numeric(7, 4) not null check (platform_percentage >= 0 and platform_percentage <= 100),
  partner_percentage numeric(7, 4) not null check (partner_percentage >= 0 and partner_percentage <= 100),
  hold_period_days integer not null default 0 check (hold_period_days >= 0 and hold_period_days <= 3650),
  minimum_payout_amount_minor bigint not null default 0 check (minimum_payout_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  created_at timestamptz not null default now(),
  unique (program_type, version),
  check (platform_percentage + partner_percentage = 100),
  check (effective_until is null or effective_until > effective_from)
);

alter table public.monetization_accounts
  add constraint monetization_accounts_contract_fk foreign key (contract_id) references public.revenue_share_contracts(id) on delete restrict;

create table if not exists public.revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  earning_period_start timestamptz not null,
  earning_period_end timestamptz not null,
  gross_revenue_minor bigint not null check (gross_revenue_minor >= 0),
  invalid_traffic_deduction_minor bigint not null default 0 check (invalid_traffic_deduction_minor >= 0),
  refund_adjustment_minor bigint not null default 0 check (refund_adjustment_minor >= 0),
  platform_share_minor bigint not null check (platform_share_minor >= 0),
  partner_share_minor bigint not null check (partner_share_minor >= 0),
  tax_withholding_minor bigint not null default 0 check (tax_withholding_minor >= 0),
  net_payable_minor bigint not null check (net_payable_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  contract_id uuid not null references public.revenue_share_contracts(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'held', 'payable', 'paid', 'void', 'adjustment')),
  correlation_id text not null check (char_length(btrim(correlation_id)) between 1 and 160),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  unique (idempotency_key),
  check (earning_period_end > earning_period_start),
  check (net_payable_minor = greatest(partner_share_minor - tax_withholding_minor, 0))
);

create index if not exists revenue_ledger_account_period_idx on public.revenue_ledger (monetization_account_id, earning_period_start desc);

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) between 2 and 80),
  provider_event_id text not null check (char_length(btrim(provider_event_id)) between 1 and 240),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 160),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'processed', 'retrying', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.platform_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (char_length(btrim(scope)) between 2 and 120),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  actor_id uuid references public.profiles(id) on delete set null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_reference text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (scope, idempotency_key)
);

create or replace function public.verification_business_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.verification_business_validate_subject()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subject_type = 'user' and not exists (select 1 from public.profiles where id = new.subject_id) then
    raise exception 'VERIFICATION_BUSINESS_SUBJECT_NOT_FOUND' using errcode = '23503';
  end if;
  if new.subject_type = 'organization' and not exists (select 1 from public.organizations where id = new.subject_id) then
    raise exception 'VERIFICATION_BUSINESS_SUBJECT_NOT_FOUND' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_validate_badge_subject()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subject_type = 'user' and not exists (select 1 from public.profiles where id = new.subject_id) then
    raise exception 'VERIFICATION_BUSINESS_SUBJECT_NOT_FOUND' using errcode = '23503';
  end if;
  if new.subject_type = 'organization' and not exists (select 1 from public.organizations where id = new.subject_id) then
    raise exception 'VERIFICATION_BUSINESS_SUBJECT_NOT_FOUND' using errcode = '23503';
  end if;
  if new.badge_kind = 'business' and new.subject_type <> 'organization' then
    raise exception 'BUSINESS_BADGE_REQUIRES_ORGANIZATION' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_validate_product_relationship()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  product_organization_id uuid;
  collection_organization_id uuid;
  post_organization_id uuid;
begin
  if tg_table_name = 'business_product_media' then
    select organization_id into product_organization_id from public.business_products where id = new.product_id;
    if product_organization_id is null or product_organization_id <> new.organization_id then
      raise exception 'CROSS_ORGANIZATION_PRODUCT_MEDIA_FORBIDDEN' using errcode = '23514';
    end if;
    if new.asset_id is not null and not exists (select 1 from public.brand_assets where id = new.asset_id and organization_id = new.organization_id) then
      raise exception 'CROSS_ORGANIZATION_ASSET_FORBIDDEN' using errcode = '23514';
    end if;
  elsif tg_table_name = 'business_product_collection_items' then
    select organization_id into collection_organization_id from public.business_product_collections where id = new.collection_id;
    select organization_id into product_organization_id from public.business_products where id = new.product_id;
    if collection_organization_id is null or collection_organization_id <> product_organization_id then
      raise exception 'CROSS_ORGANIZATION_COLLECTION_PRODUCT_FORBIDDEN' using errcode = '23514';
    end if;
  elsif tg_table_name = 'business_post_products' then
    select organization_id into post_organization_id from public.business_posts where id = new.post_id;
    select organization_id into product_organization_id from public.business_products where id = new.product_id;
    if post_organization_id is null or post_organization_id <> product_organization_id then
      raise exception 'CROSS_ORGANIZATION_POST_PRODUCT_FORBIDDEN' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_validate_advertiser_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_type = 'user' and not exists (select 1 from public.profiles where id = new.owner_id) then
    raise exception 'ADVERTISER_OWNER_NOT_FOUND' using errcode = '23503';
  end if;
  if new.owner_type = 'organization' and not exists (select 1 from public.organizations where id = new.owner_id) then
    raise exception 'ADVERTISER_OWNER_NOT_FOUND' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_require_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.role = 'organization_owner' and not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id and role = 'organization_owner' and id <> old.id
  ) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.role = 'organization_owner' and new.role <> 'organization_owner' and not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id and role = 'organization_owner' and id <> old.id
  ) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.verification_business_record_case_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.verification_case_status_history (verification_case_id, to_status, changed_by, public_reason_code, internal_reason_code)
    values (new.id, new.status, auth.uid(), new.public_reason_code, new.internal_reason_code);
  elsif new.status is distinct from old.status then
    insert into public.verification_case_status_history (verification_case_id, from_status, to_status, changed_by, public_reason_code, internal_reason_code)
    values (new.id, old.status, new.status, auth.uid(), new.public_reason_code, new.internal_reason_code);
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_record_application_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.business_application_status_history (business_application_id, to_status, changed_by, public_decision_reason, internal_review_notes)
    values (new.id, new.status, auth.uid(), new.public_decision_reason, new.internal_review_notes);
  elsif new.status is distinct from old.status then
    insert into public.business_application_status_history (business_application_id, from_status, to_status, changed_by, public_decision_reason, internal_review_notes)
    values (new.id, old.status, new.status, auth.uid(), new.public_decision_reason, new.internal_review_notes);
  end if;
  return new;
end;
$$;

create or replace function public.verification_business_prevent_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'REVENUE_LEDGER_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and (allowed_roles is null or member.role = any (allowed_roles))
  );
$$;

create or replace function public.verification_business_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.is_app_admin(), false) or coalesce(public.is_root_owner(), false);
$$;

create or replace function public.can_manage_organization_content(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager']);
$$;

create or replace function public.can_manage_organization_business(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin', 'brand_manager']);
$$;

create or replace function public.can_view_platform_subject(target_subject_type text, target_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when target_subject_type = 'user' then auth.uid() = target_subject_id
    when target_subject_type = 'organization' then public.has_organization_role(target_subject_id, null)
    else false
  end;
$$;

create or replace function public.create_organization(target_display_name text, target_legal_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  organization_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  insert into public.organizations (display_name, legal_name, created_by)
  values (btrim(target_display_name), nullif(btrim(coalesce(target_legal_name, '')), ''), actor_id)
  returning id into organization_id;
  insert into public.organization_members (organization_id, user_id, role, created_by)
  values (organization_id, actor_id, 'organization_owner', actor_id);
  return organization_id;
end;
$$;

create or replace function public.manage_organization_member(target_organization_id uuid, target_user_id uuid, target_role text, action text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.has_organization_role(target_organization_id, array['organization_owner']) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if action = 'remove' then
    delete from public.organization_members where organization_id = target_organization_id and user_id = target_user_id;
    return;
  end if;
  if action not in ('add', 'change_role') or target_role not in ('organization_owner', 'business_admin', 'billing_admin', 'campaign_manager', 'brand_manager', 'content_manager', 'analyst', 'support_contact') then
    raise exception 'ORGANIZATION_MEMBER_ACTION_INVALID' using errcode = '22023';
  end if;
  insert into public.organization_members (organization_id, user_id, role, created_by)
  values (target_organization_id, target_user_id, target_role, actor_id)
  on conflict (organization_id, user_id) do update
  set role = excluded.role, created_by = excluded.created_by, updated_at = now();
end;
$$;

create or replace function public.submit_verification_case(target_subject_type text, target_subject_id uuid, target_verification_type text, target_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  verification_case_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_subject_type = 'user' and target_subject_id <> auth.uid() then
    raise exception 'VERIFICATION_SUBJECT_FORBIDDEN' using errcode = '42501';
  end if;
  if target_subject_type = 'organization' and not public.has_organization_role(target_subject_id, array['organization_owner', 'business_admin']) then
    raise exception 'VERIFICATION_SUBJECT_FORBIDDEN' using errcode = '42501';
  end if;
  if target_subject_type not in ('user', 'organization') or jsonb_typeof(target_metadata) <> 'object' then
    raise exception 'VERIFICATION_CASE_INVALID' using errcode = '22023';
  end if;
  insert into public.verification_cases (subject_type, subject_id, verification_type, status, submitted_at, metadata)
  values (target_subject_type, target_subject_id, btrim(target_verification_type), 'pending', now(), target_metadata)
  returning id into verification_case_id;
  return verification_case_id;
end;
$$;

create or replace function public.submit_business_application(
  target_organization_id uuid,
  target_legal_name text,
  target_brand_name text,
  target_company_type text,
  target_registered_country text,
  target_registered_address text,
  target_representative_name text,
  target_registration_number text default null,
  target_vat_number text default null,
  target_official_website text default null,
  target_corporate_email_domain text default null,
  target_industry text default null,
  target_advertising_purpose text default null,
  target_estimated_monthly_budget_minor bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_id uuid;
begin
  if auth.uid() is null or not public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin']) then
    raise exception 'BUSINESS_APPLICATION_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.business_applications (
    organization_id, applicant_user_id, legal_name, brand_name, company_type, registered_country,
    registered_address, representative_name, registration_number, vat_number, official_website,
    corporate_email_domain, industry, advertising_purpose, estimated_monthly_budget_minor, status, submitted_at
  ) values (
    target_organization_id, auth.uid(), btrim(target_legal_name), btrim(target_brand_name), btrim(target_company_type), btrim(target_registered_country),
    btrim(target_registered_address), btrim(target_representative_name), nullif(btrim(coalesce(target_registration_number, '')), ''),
    nullif(btrim(coalesce(target_vat_number, '')), ''), nullif(btrim(coalesce(target_official_website, '')), ''),
    nullif(lower(btrim(coalesce(target_corporate_email_domain, ''))), ''), nullif(btrim(coalesce(target_industry, '')), ''),
    nullif(btrim(coalesce(target_advertising_purpose, '')), ''), target_estimated_monthly_budget_minor, 'submitted', now()
  ) returning id into application_id;
  return application_id;
end;
$$;

create or replace function public.review_business_application(target_application_id uuid, target_status text, target_public_reason text default null, target_internal_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_record public.business_applications%rowtype;
begin
  if not public.verification_business_is_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if target_status not in ('under_review', 'requires_information', 'identity_verification_required', 'approved', 'rejected', 'suspended', 'revoked', 'expired') then
    raise exception 'BUSINESS_APPLICATION_STATUS_INVALID' using errcode = '22023';
  end if;
  select * into application_record from public.business_applications where id = target_application_id for update;
  if application_record.id is null then
    raise exception 'BUSINESS_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.business_applications
  set status = target_status,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      public_decision_reason = nullif(btrim(coalesce(target_public_reason, '')), ''),
      internal_review_notes = nullif(btrim(coalesce(target_internal_notes, '')), '')
  where id = target_application_id;
  if target_status = 'approved' then
    update public.organizations set status = 'active' where id = application_record.organization_id;
  elsif target_status in ('suspended', 'revoked', 'expired') then
    update public.organizations set status = 'suspended' where id = application_record.organization_id;
  end if;
end;
$$;

create or replace function public.publish_business_profile(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin', 'brand_manager']) then
    raise exception 'BUSINESS_PROFILE_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = target_organization_id and status = 'active') then
    raise exception 'ORGANIZATION_NOT_ACTIVE' using errcode = '42501';
  end if;
  if not exists (select 1 from public.business_applications where organization_id = target_organization_id and status = 'approved') then
    raise exception 'BUSINESS_VERIFICATION_REQUIRED' using errcode = '42501';
  end if;
  update public.business_profiles set public_status = 'published', published_at = now() where organization_id = target_organization_id;
  if not found then
    raise exception 'BUSINESS_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.upsert_business_profile(
  target_organization_id uuid,
  target_slug text,
  target_display_name text,
  target_bio text default '',
  target_description text default '',
  target_website_url text default null,
  target_support_url text default null,
  target_public_contact_email text default null,
  target_industry text default null,
  target_founded_year integer default null,
  target_headquarters_country text default null,
  target_profile_logo_asset_id uuid default null,
  target_cover_asset_id uuid default null,
  target_primary_color text default null,
  target_secondary_color text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_organization_business(target_organization_id) then
    raise exception 'BUSINESS_PROFILE_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from public.business_profile_reserved_slugs where slug = lower(btrim(target_slug))) then
    raise exception 'BUSINESS_PROFILE_SLUG_RESERVED' using errcode = '22023';
  end if;
  if target_profile_logo_asset_id is not null and not exists (select 1 from public.brand_assets where id = target_profile_logo_asset_id and organization_id = target_organization_id) then
    raise exception 'BUSINESS_PROFILE_ASSET_FORBIDDEN' using errcode = '42501';
  end if;
  if target_cover_asset_id is not null and not exists (select 1 from public.brand_assets where id = target_cover_asset_id and organization_id = target_organization_id) then
    raise exception 'BUSINESS_PROFILE_ASSET_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.business_profiles (
    organization_id, slug, display_name, bio, description, website_url, support_url, public_contact_email,
    industry, founded_year, headquarters_country, profile_logo_asset_id, cover_asset_id, primary_color, secondary_color
  ) values (
    target_organization_id, lower(btrim(target_slug)), btrim(target_display_name), btrim(target_bio), btrim(target_description),
    nullif(btrim(coalesce(target_website_url, '')), ''), nullif(btrim(coalesce(target_support_url, '')), ''),
    nullif(lower(btrim(coalesce(target_public_contact_email, ''))), ''), nullif(btrim(coalesce(target_industry, '')), ''),
    target_founded_year, nullif(btrim(coalesce(target_headquarters_country, '')), ''), target_profile_logo_asset_id,
    target_cover_asset_id, nullif(upper(btrim(coalesce(target_primary_color, ''))), ''), nullif(upper(btrim(coalesce(target_secondary_color, ''))), '')
  ) on conflict (organization_id) do update
  set slug = excluded.slug,
      display_name = excluded.display_name,
      bio = excluded.bio,
      description = excluded.description,
      website_url = excluded.website_url,
      support_url = excluded.support_url,
      public_contact_email = excluded.public_contact_email,
      industry = excluded.industry,
      founded_year = excluded.founded_year,
      headquarters_country = excluded.headquarters_country,
      profile_logo_asset_id = excluded.profile_logo_asset_id,
      cover_asset_id = excluded.cover_asset_id,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      updated_at = now();
end;
$$;

create or replace function public.create_business_post(target_organization_id uuid, target_post_type text, target_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_id uuid;
begin
  if not public.can_manage_organization_content(target_organization_id) then
    raise exception 'BUSINESS_POST_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = target_organization_id and status = 'active') then
    raise exception 'ORGANIZATION_NOT_ACTIVE' using errcode = '42501';
  end if;
  if target_post_type not in ('brand_update', 'product_announcement', 'product_launch', 'offer', 'discount', 'event', 'case_study', 'video', 'poll', 'job_posting', 'service_announcement') then
    raise exception 'BUSINESS_POST_TYPE_FORBIDDEN' using errcode = '22023';
  end if;
  insert into public.business_posts (organization_id, author_user_id, post_type, body, status, sponsorship_state)
  values (target_organization_id, auth.uid(), target_post_type, btrim(target_body), 'draft', 'organic')
  returning id into post_id;
  return post_id;
end;
$$;

create or replace function public.create_business_product(
  target_organization_id uuid,
  target_name text,
  target_slug text,
  target_product_type text,
  target_short_description text default '',
  target_description text default '',
  target_price_amount_minor bigint default null,
  target_compare_at_price_amount_minor bigint default null,
  target_currency text default 'USD',
  target_availability text default 'available',
  target_purchase_url text default null,
  target_product_url text default null,
  target_support_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  product_id uuid;
begin
  if not public.can_manage_organization_content(target_organization_id) then
    raise exception 'BUSINESS_PRODUCT_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = target_organization_id and status = 'active') then
    raise exception 'ORGANIZATION_NOT_ACTIVE' using errcode = '42501';
  end if;
  insert into public.business_products (
    organization_id, name, slug, product_type, short_description, description, price_amount_minor,
    compare_at_price_amount_minor, currency, availability, purchase_url, product_url, support_url,
    status, moderation_status, created_by
  ) values (
    target_organization_id, btrim(target_name), lower(btrim(target_slug)), target_product_type, btrim(target_short_description),
    btrim(target_description), target_price_amount_minor, target_compare_at_price_amount_minor, upper(btrim(target_currency)),
    target_availability, nullif(btrim(coalesce(target_purchase_url, '')), ''), nullif(btrim(coalesce(target_product_url, '')), ''),
    nullif(btrim(coalesce(target_support_url, '')), ''), 'draft', 'pending', auth.uid()
  ) returning id into product_id;
  return product_id;
end;
$$;

create or replace function public.tag_business_post_product(target_post_id uuid, target_product_id uuid, target_position integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_organization_id uuid;
begin
  select organization_id into target_organization_id from public.business_posts where id = target_post_id;
  if target_organization_id is null or not public.can_manage_organization_content(target_organization_id) then
    raise exception 'BUSINESS_POST_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.business_post_products (post_id, product_id, position)
  values (target_post_id, target_product_id, target_position);
end;
$$;

create or replace function public.is_advertiser_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.advertiser_account_members member
    where member.advertiser_account_id = target_account_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_advertiser_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.advertiser_accounts account
    where account.id = target_account_id
      and (
        (account.owner_type = 'user' and account.owner_id = auth.uid())
        or (
          account.owner_type = 'organization'
          and public.has_organization_role(account.owner_id, array['organization_owner', 'billing_admin', 'campaign_manager'])
        )
        or public.is_advertiser_account_member(account.id)
        or public.verification_business_is_platform_admin()
      )
  );
$$;

create or replace function public.create_advertiser_account(target_owner_type text, target_owner_id uuid, target_advertiser_type text, target_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_owner_type = 'user' and target_owner_id <> auth.uid() then
    raise exception 'ADVERTISER_OWNER_FORBIDDEN' using errcode = '42501';
  end if;
  if target_owner_type = 'organization' and not public.has_organization_role(target_owner_id, array['organization_owner', 'business_admin', 'billing_admin', 'campaign_manager']) then
    raise exception 'ADVERTISER_OWNER_FORBIDDEN' using errcode = '42501';
  end if;
  if target_owner_type not in ('user', 'organization') or target_advertiser_type not in ('individual', 'sole_trader', 'company', 'agency', 'business_partner') then
    raise exception 'ADVERTISER_ACCOUNT_INVALID' using errcode = '22023';
  end if;
  insert into public.advertiser_accounts (owner_type, owner_id, advertiser_type, display_name)
  values (target_owner_type, target_owner_id, target_advertiser_type, btrim(target_display_name))
  returning id into account_id;
  insert into public.advertiser_account_members (advertiser_account_id, user_id, role, created_by)
  values (account_id, auth.uid(), 'owner', auth.uid());
  return account_id;
end;
$$;

create trigger verification_business_touch_organizations before update on public.organizations for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_organization_members before update on public.organization_members for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_verification_cases before update on public.verification_cases for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_verification_badges before update on public.verification_badges for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_entitlements before update on public.account_entitlements for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_business_applications before update on public.business_applications for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_business_profiles before update on public.business_profiles for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_products before update on public.business_products for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_collections before update on public.business_product_collections for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_posts before update on public.business_posts for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_advertiser_accounts before update on public.advertiser_accounts for each row execute function public.verification_business_touch_updated_at();
create trigger verification_business_touch_monetization_accounts before update on public.monetization_accounts for each row execute function public.verification_business_touch_updated_at();
drop trigger if exists verification_business_validate_case_subject on public.verification_cases;
drop trigger if exists verification_business_validate_badge_subject on public.verification_badges;
create trigger verification_business_validate_case_subject before insert or update on public.verification_cases for each row execute function public.verification_business_validate_subject();
create trigger verification_business_validate_badge_subject before insert or update on public.verification_badges for each row execute function public.verification_business_validate_badge_subject();
create trigger verification_business_validate_advertiser_owner before insert or update on public.advertiser_accounts for each row execute function public.verification_business_validate_advertiser_owner();
create trigger verification_business_validate_product_media before insert or update on public.business_product_media for each row execute function public.verification_business_validate_product_relationship();
create trigger verification_business_validate_collection_product before insert or update on public.business_product_collection_items for each row execute function public.verification_business_validate_product_relationship();
create trigger verification_business_validate_post_product before insert or update on public.business_post_products for each row execute function public.verification_business_validate_product_relationship();
create trigger verification_business_require_organization_owner before update or delete on public.organization_members for each row execute function public.verification_business_require_owner_membership();
create trigger verification_business_case_status_history after insert or update of status on public.verification_cases for each row execute function public.verification_business_record_case_history();
create trigger verification_business_application_status_history after insert or update of status on public.business_applications for each row execute function public.verification_business_record_application_history();
create trigger verification_business_prevent_revenue_ledger_mutation before update or delete on public.revenue_ledger for each row execute function public.verification_business_prevent_ledger_mutation();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.verification_cases enable row level security;
alter table public.verification_case_status_history enable row level security;
alter table public.verification_badges enable row level security;
alter table public.account_entitlements enable row level security;
alter table public.business_applications enable row level security;
alter table public.business_application_status_history enable row level security;
alter table public.business_profile_reserved_slugs enable row level security;
alter table public.business_profiles enable row level security;
alter table public.brand_assets enable row level security;
alter table public.business_products enable row level security;
alter table public.business_product_media enable row level security;
alter table public.business_product_collections enable row level security;
alter table public.business_product_collection_items enable row level security;
alter table public.business_posts enable row level security;
alter table public.business_post_products enable row level security;
alter table public.advertiser_accounts enable row level security;
alter table public.advertiser_account_members enable row level security;
alter table public.monetization_accounts enable row level security;
alter table public.revenue_share_contracts enable row level security;
alter table public.revenue_ledger enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.platform_idempotency_keys enable row level security;

drop policy if exists verification_business_organizations_member_select on public.organizations;
drop policy if exists verification_business_members_self_or_owner_select on public.organization_members;
drop policy if exists verification_business_invitations_owner_or_invitee_select on public.organization_invitations;
drop policy if exists verification_business_cases_owner_select on public.verification_cases;
drop policy if exists verification_business_case_history_admin_select on public.verification_case_status_history;
drop policy if exists verification_business_badges_admin_select on public.verification_badges;
drop policy if exists verification_business_entitlements_subject_select on public.account_entitlements;
drop policy if exists verification_business_applications_admin_select on public.business_applications;
drop policy if exists verification_business_application_history_admin_select on public.business_application_status_history;
drop policy if exists verification_business_profiles_manager_select on public.business_profiles;
drop policy if exists verification_business_assets_manager_select on public.brand_assets;
drop policy if exists verification_business_products_manager_select on public.business_products;
drop policy if exists verification_business_products_content_insert on public.business_products;
drop policy if exists verification_business_products_content_update on public.business_products;
drop policy if exists verification_business_media_manager_write on public.business_product_media;
drop policy if exists verification_business_collections_manager_write on public.business_product_collections;
drop policy if exists verification_business_collection_items_manager_write on public.business_product_collection_items;
drop policy if exists verification_business_posts_manager_select on public.business_posts;
drop policy if exists verification_business_post_products_manager_write on public.business_post_products;
drop policy if exists verification_business_advertisers_owner_select on public.advertiser_accounts;
drop policy if exists verification_business_advertiser_members_owner_select on public.advertiser_account_members;
drop policy if exists verification_business_monetization_subject_select on public.monetization_accounts;
drop policy if exists verification_business_contracts_admin_select on public.revenue_share_contracts;
drop policy if exists verification_business_ledger_subject_select on public.revenue_ledger;
drop policy if exists verification_business_webhooks_admin_select on public.provider_webhook_events;
drop policy if exists verification_business_idempotency_actor_select on public.platform_idempotency_keys;

create policy verification_business_organizations_member_select on public.organizations for select to authenticated using (public.has_organization_role(id, null) or public.verification_business_is_platform_admin());
create policy verification_business_members_self_or_owner_select on public.organization_members for select to authenticated using (user_id = auth.uid() or public.has_organization_role(organization_id, array['organization_owner']) or public.verification_business_is_platform_admin());
create policy verification_business_invitations_owner_or_invitee_select on public.organization_invitations for select to authenticated using (invited_email = (select email from auth.users where id = auth.uid()) or public.has_organization_role(organization_id, array['organization_owner']) or public.verification_business_is_platform_admin());
create policy verification_business_cases_owner_select on public.verification_cases for select to authenticated using (public.can_view_platform_subject(subject_type, subject_id) or public.verification_business_is_platform_admin());
create policy verification_business_case_history_admin_select on public.verification_case_status_history for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_badges_admin_select on public.verification_badges for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_entitlements_subject_select on public.account_entitlements for select to authenticated using (public.can_view_platform_subject(subject_type, subject_id) or public.verification_business_is_platform_admin());
create policy verification_business_applications_admin_select on public.business_applications for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_application_history_admin_select on public.business_application_status_history for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_profiles_manager_select on public.business_profiles for select to authenticated using (public.can_manage_organization_business(organization_id) or public.verification_business_is_platform_admin());
create policy verification_business_assets_manager_select on public.brand_assets for select to authenticated using (public.can_manage_organization_content(organization_id) or public.verification_business_is_platform_admin());
create policy verification_business_products_manager_select on public.business_products for select to authenticated using (public.can_manage_organization_content(organization_id) or public.verification_business_is_platform_admin());
create policy verification_business_products_content_insert on public.business_products for insert to authenticated with check (public.can_manage_organization_content(organization_id) and created_by = auth.uid() and status in ('draft', 'in_review') and moderation_status = 'pending' and exists (select 1 from public.organizations where id = organization_id and status = 'active'));
create policy verification_business_products_content_update on public.business_products for update to authenticated using (public.can_manage_organization_content(organization_id)) with check (public.can_manage_organization_content(organization_id) and status in ('draft', 'in_review', 'unlisted', 'out_of_stock') and moderation_status = 'pending' and exists (select 1 from public.organizations where id = organization_id and status = 'active'));
create policy verification_business_media_manager_write on public.business_product_media for all to authenticated using (public.can_manage_organization_content(organization_id)) with check (public.can_manage_organization_content(organization_id));
create policy verification_business_collections_manager_write on public.business_product_collections for all to authenticated using (public.can_manage_organization_content(organization_id)) with check (public.can_manage_organization_content(organization_id));
create policy verification_business_collection_items_manager_write on public.business_product_collection_items for all to authenticated using (exists (select 1 from public.business_product_collections collection where collection.id = collection_id and public.can_manage_organization_content(collection.organization_id))) with check (exists (select 1 from public.business_product_collections collection where collection.id = collection_id and public.can_manage_organization_content(collection.organization_id)));
create policy verification_business_posts_manager_select on public.business_posts for select to authenticated using (public.can_manage_organization_content(organization_id) or public.verification_business_is_platform_admin());
create policy verification_business_post_products_manager_write on public.business_post_products for all to authenticated using (exists (select 1 from public.business_posts post where post.id = post_id and public.can_manage_organization_content(post.organization_id))) with check (exists (select 1 from public.business_posts post where post.id = post_id and public.can_manage_organization_content(post.organization_id)));
create policy verification_business_advertisers_owner_select on public.advertiser_accounts for select to authenticated using (public.can_view_advertiser_account(id));
create policy verification_business_advertiser_members_owner_select on public.advertiser_account_members for select to authenticated using (user_id = auth.uid() or public.can_view_advertiser_account(advertiser_account_id));
create policy verification_business_monetization_subject_select on public.monetization_accounts for select to authenticated using (subject_id = auth.uid() or public.verification_business_is_platform_admin());
create policy verification_business_contracts_admin_select on public.revenue_share_contracts for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_ledger_subject_select on public.revenue_ledger for select to authenticated using (exists (select 1 from public.monetization_accounts account where account.id = monetization_account_id and account.subject_id = auth.uid()) or public.verification_business_is_platform_admin());
create policy verification_business_webhooks_admin_select on public.provider_webhook_events for select to authenticated using (public.verification_business_is_platform_admin());
create policy verification_business_idempotency_actor_select on public.platform_idempotency_keys for select to authenticated using (actor_id = auth.uid() or public.verification_business_is_platform_admin());

create or replace view public.public_profile_badges
with (security_barrier = true)
as
select id, subject_type, subject_id, badge_kind as badge_type, status, granted_at as issued_at, expires_at, public_reason_code, is_primary
from public.verification_badges
where status = 'active' and revoked_at is null and (expires_at is null or expires_at > now());

create or replace view public.public_business_profiles
with (security_barrier = true)
as
select profile.organization_id, profile.slug, profile.display_name, profile.bio, profile.description, profile.website_url, profile.support_url, profile.public_contact_email, profile.industry, profile.founded_year, profile.headquarters_country, profile.profile_logo_asset_id, profile.cover_asset_id, profile.primary_color, profile.secondary_color, profile.published_at
from public.business_profiles profile
join public.organizations organization on organization.id = profile.organization_id
where profile.public_status = 'published' and organization.status = 'active';

create or replace view public.public_brand_assets
with (security_barrier = true)
as
select asset.id, asset.organization_id, asset.asset_type, asset.storage_path, asset.mime_type, asset.width, asset.height, asset.version, asset.created_at
from public.brand_assets asset
join public.organizations organization on organization.id = asset.organization_id
where asset.status = 'active' and organization.status = 'active';

create or replace view public.public_business_products
with (security_barrier = true)
as
select product.id, product.organization_id, product.name, product.slug, product.short_description, product.description, product.product_type, product.sku, product.price_amount_minor, product.compare_at_price_amount_minor, product.currency, product.availability, product.purchase_url, product.product_url, product.support_url, product.published_at
from public.business_products product
join public.organizations organization on organization.id = product.organization_id
where product.status = 'published' and product.moderation_status = 'approved' and organization.status = 'active';

create or replace view public.public_business_posts
with (security_barrier = true)
as
select post.id, post.organization_id, post.post_type, post.body, post.published_at, post.created_at
from public.business_posts post
join public.organizations organization on organization.id = post.organization_id
where post.status = 'published' and post.sponsorship_state = 'organic' and organization.status = 'active';

-- Owner/applicant facing application surface intentionally omits internal review notes.
create or replace view public.business_application_owner_views
with (security_barrier = true)
as
select
  application.id,
  application.organization_id,
  application.applicant_user_id,
  application.legal_name,
  application.brand_name,
  application.company_type,
  application.registered_country,
  application.official_website,
  application.corporate_email_domain,
  application.representative_name,
  application.industry,
  application.status,
  application.submitted_at,
  application.reviewed_at,
  application.public_decision_reason,
  application.created_at,
  application.updated_at
from public.business_applications application
where application.applicant_user_id = auth.uid()
   or public.has_organization_role(application.organization_id, array['organization_owner', 'business_admin'])
   or public.verification_business_is_platform_admin();

revoke all on public.verification_badges, public.business_applications, public.business_application_status_history, public.verification_case_status_history, public.business_profile_reserved_slugs, public.provider_webhook_events, public.platform_idempotency_keys, public.revenue_share_contracts from anon, authenticated;
revoke all on public.organizations, public.organization_members, public.organization_invitations, public.verification_cases, public.account_entitlements, public.business_profiles, public.brand_assets, public.business_products, public.business_product_media, public.business_product_collections, public.business_product_collection_items, public.business_posts, public.business_post_products, public.advertiser_accounts, public.advertiser_account_members, public.monetization_accounts, public.revenue_ledger from anon, authenticated;

grant select on public.organizations, public.organization_members, public.organization_invitations, public.verification_cases, public.account_entitlements, public.business_profiles, public.brand_assets, public.business_products, public.business_product_media, public.business_product_collections, public.business_product_collection_items, public.business_posts, public.business_post_products, public.advertiser_accounts, public.advertiser_account_members, public.monetization_accounts, public.revenue_ledger, public.business_applications, public.verification_badges, public.revenue_share_contracts, public.provider_webhook_events, public.platform_idempotency_keys, public.business_application_status_history, public.verification_case_status_history to authenticated;
grant insert, update on public.business_products to authenticated;
grant insert, update, delete on public.business_product_media, public.business_product_collections, public.business_product_collection_items, public.business_post_products to authenticated;

grant select on public.public_profile_badges, public.public_business_profiles, public.public_brand_assets, public.public_business_products, public.public_business_posts, public.business_application_owner_views to anon, authenticated;

revoke all on function public.verification_business_touch_updated_at(), public.verification_business_validate_subject(), public.verification_business_validate_badge_subject(), public.verification_business_validate_product_relationship(), public.verification_business_validate_advertiser_owner(), public.verification_business_require_owner_membership(), public.verification_business_record_case_history(), public.verification_business_record_application_history(), public.verification_business_prevent_ledger_mutation() from public, anon, authenticated;
revoke all on function public.has_organization_role(uuid, text[]), public.verification_business_is_platform_admin(), public.can_manage_organization_content(uuid), public.can_manage_organization_business(uuid), public.can_view_platform_subject(text, uuid), public.is_advertiser_account_member(uuid), public.can_view_advertiser_account(uuid), public.create_organization(text, text), public.manage_organization_member(uuid, uuid, text, text), public.submit_verification_case(text, uuid, text, jsonb), public.submit_business_application(uuid, text, text, text, text, text, text, text, text, text, text, text, text, bigint), public.review_business_application(uuid, text, text, text), public.publish_business_profile(uuid), public.upsert_business_profile(uuid, text, text, text, text, text, text, text, text, integer, text, uuid, uuid, text, text), public.create_business_post(uuid, text, text), public.create_business_product(uuid, text, text, text, text, text, bigint, bigint, text, text, text, text, text), public.tag_business_post_product(uuid, uuid, integer), public.create_advertiser_account(text, uuid, text, text) from public, anon;
grant execute on function public.has_organization_role(uuid, text[]), public.verification_business_is_platform_admin(), public.can_manage_organization_content(uuid), public.can_manage_organization_business(uuid), public.can_view_platform_subject(text, uuid), public.is_advertiser_account_member(uuid), public.can_view_advertiser_account(uuid), public.create_organization(text, text), public.manage_organization_member(uuid, uuid, text, text), public.submit_verification_case(text, uuid, text, jsonb), public.submit_business_application(uuid, text, text, text, text, text, text, text, text, text, text, text, text, bigint), public.publish_business_profile(uuid), public.upsert_business_profile(uuid, text, text, text, text, text, text, text, text, integer, text, uuid, uuid, text, text), public.create_business_post(uuid, text, text), public.create_business_product(uuid, text, text, text, text, text, bigint, bigint, text, text, text, text, text), public.tag_business_post_product(uuid, uuid, integer), public.create_advertiser_account(text, uuid, text, text) to authenticated;
grant execute on function public.review_business_application(uuid, text, text, text) to authenticated;

commit;
