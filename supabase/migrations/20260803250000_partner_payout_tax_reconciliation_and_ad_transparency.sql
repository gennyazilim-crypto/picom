-- PICOM partner payout, tax, reconciliation, and ad transparency.
-- Additive only. Does not rewrite prior migrations or DROP TABLE.
begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Platform payout settings / kill switches
-- ---------------------------------------------------------------------------
create table if not exists public.payout_platform_settings (
  setting_key text primary key check (char_length(btrim(setting_key)) between 2 and 80),
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.payout_platform_settings (setting_key, setting_value) values
  ('global_payouts_enabled', 'false'::jsonb),
  ('provider_payouts_enabled', 'false'::jsonb),
  ('creator_payouts_enabled', 'false'::jsonb),
  ('publisher_payouts_enabled', 'false'::jsonb),
  ('batch_processing_enabled', 'false'::jsonb),
  ('payout_dual_approval_required', 'true'::jsonb),
  ('payout_reconciliation_enabled', 'false'::jsonb),
  ('payout_default_schedule', '"monthly"'::jsonb),
  ('payout_default_currency', '"USD"'::jsonb)
on conflict (setting_key) do nothing;

create or replace function public.payout_setting_bool(p_key text, p_default boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (setting_value #>> '{}')::boolean from public.payout_platform_settings where setting_key = p_key),
    p_default
  );
$$;

create or replace function public.payout_allow_internal_transition()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(current_setting('picom.payout_internal', true), ''), '') = '1';
$$;

create or replace function public.payout_prevent_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'PAYOUT_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.is_finance_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.verification_business_is_platform_admin();
$$;

create or replace function public.is_finance_approver()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.verification_business_is_platform_admin();
$$;

-- ---------------------------------------------------------------------------
-- Monetization account / application extensions
-- ---------------------------------------------------------------------------
alter table public.monetization_accounts
  add column if not exists payout_profile_id uuid,
  add column if not exists tax_profile_id uuid,
  add column if not exists application_status text not null default 'not_applied',
  add column if not exists limited_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.monetization_accounts drop constraint if exists monetization_accounts_monetization_status_check;
alter table public.monetization_accounts
  add constraint monetization_accounts_monetization_status_check
  check (monetization_status in (
    'not_applied', 'pending', 'eligible', 'approved', 'active', 'limited', 'suspended', 'revoked', 'not_eligible'
  ));

alter table public.monetization_accounts drop constraint if exists monetization_accounts_compliance_status_check;
alter table public.monetization_accounts
  add constraint monetization_accounts_compliance_status_check
  check (compliance_status in (
    'pending', 'active', 'clear', 'requires_information', 'restricted', 'suspended', 'blocked', 'review_required', 'expired'
  ));

alter table public.monetization_accounts drop constraint if exists monetization_accounts_payout_onboarding_status_check;
alter table public.monetization_accounts
  add constraint monetization_accounts_payout_onboarding_status_check
  check (payout_onboarding_status in (
    'not_started', 'incomplete', 'pending', 'requires_information', 'under_review', 'complete', 'rejected', 'expired', 'pending_review', 'not_configured'
  ));

alter table public.monetization_accounts drop constraint if exists monetization_accounts_application_status_check;
alter table public.monetization_accounts
  add constraint monetization_accounts_application_status_check
  check (application_status in (
    'not_applied', 'draft', 'submitted', 'under_review', 'requires_information', 'approved', 'rejected', 'suspended', 'revoked', 'expired'
  ));

create table if not exists public.monetization_applications (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  program_type text not null check (program_type in ('creator', 'publisher')),
  subject_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'requires_information', 'approved', 'rejected', 'suspended', 'revoked', 'expired'
  )),
  public_reason_code text,
  internal_reason_code text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (monetization_account_id, idempotency_key)
);

create unique index if not exists monetization_applications_one_open_uidx
  on public.monetization_applications (monetization_account_id)
  where status in ('draft', 'submitted', 'under_review', 'requires_information');

create table if not exists public.monetization_application_review_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.monetization_applications(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'requires_information', 'suspended', 'revoked')),
  public_reason_code text,
  internal_reason_code text,
  policy_version text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (application_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Payout profiles + tax profiles
-- ---------------------------------------------------------------------------
create table if not exists public.payout_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'organization')),
  owner_id uuid not null,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  payee_type text not null check (payee_type in ('individual', 'sole_trader', 'company', 'nonprofit', 'agency')),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  payout_currency text not null check (payout_currency ~ '^[A-Z]{3}$'),
  provider text not null default 'stripe_connect' check (provider in ('stripe_connect', 'none')),
  provider_account_id text,
  onboarding_status text not null default 'not_started' check (onboarding_status in (
    'not_started', 'pending', 'requires_information', 'under_review', 'complete', 'rejected', 'expired'
  )),
  capabilities_status text not null default 'inactive' check (capabilities_status in (
    'inactive', 'pending', 'active', 'restricted', 'disabled'
  )),
  requirements_status text not null default 'pending' check (requirements_status in (
    'pending', 'currently_due', 'past_due', 'eventually_due', 'satisfied'
  )),
  payout_status text not null default 'disabled' check (payout_status in (
    'disabled', 'pending', 'enabled', 'paused', 'blocked'
  )),
  risk_status text not null default 'normal' check (risk_status in (
    'normal', 'review_required', 'restricted', 'high_risk', 'blocked'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (monetization_account_id, provider)
);

create unique index if not exists payout_profiles_provider_account_uidx
  on public.payout_profiles (provider, provider_account_id)
  where provider_account_id is not null;

create table if not exists public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'organization')),
  owner_id uuid not null,
  payout_profile_id uuid not null references public.payout_profiles(id) on delete restrict,
  tax_residency_country text not null check (tax_residency_country ~ '^[A-Z]{2}$'),
  tax_entity_type text not null check (tax_entity_type in ('individual', 'sole_trader', 'company', 'nonprofit')),
  tax_identifier_last4 text check (tax_identifier_last4 is null or tax_identifier_last4 ~ '^[0-9A-Z]{4}$'),
  tax_identifier_token_reference text,
  vat_status text not null default 'unknown' check (vat_status in ('unknown', 'not_applicable', 'registered', 'not_registered')),
  tax_form_type text,
  tax_form_status text not null default 'not_started' check (tax_form_status in (
    'not_required', 'not_started', 'pending', 'requires_information', 'submitted', 'verified', 'rejected', 'expired'
  )),
  withholding_status text not null default 'unknown' check (withholding_status in (
    'unknown', 'pending_review', 'exempt', 'standard', 'custom', 'blocked'
  )),
  provider text not null default 'none',
  provider_tax_reference text,
  submitted_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payout_profile_id)
);

alter table public.monetization_accounts
  drop constraint if exists monetization_accounts_payout_profile_fk;
alter table public.monetization_accounts
  add constraint monetization_accounts_payout_profile_fk
  foreign key (payout_profile_id) references public.payout_profiles(id) on delete restrict;

alter table public.monetization_accounts
  drop constraint if exists monetization_accounts_tax_profile_fk;
alter table public.monetization_accounts
  add constraint monetization_accounts_tax_profile_fk
  foreign key (tax_profile_id) references public.tax_profiles(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Legal documents + acceptances
-- ---------------------------------------------------------------------------
create table if not exists public.monetization_legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null check (document_key in (
    'creator_monetization_agreement', 'publisher_monetization_agreement', 'revenue_share_policy',
    'payout_terms', 'tax_withholding_notice', 'invalid_traffic_policy', 'sponsored_content_policy',
    'advertising_revenue_attribution_policy', 'appeal_complaint_procedure', 'privacy_data_retention_update'
  )),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  content_hash text,
  status text not null default 'draft' check (status in ('draft', 'pending_legal', 'active', 'superseded', 'retired')),
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_key, version)
);

insert into public.monetization_legal_document_versions (document_key, version, status)
values
  ('creator_monetization_agreement', 'v1-draft', 'pending_legal'),
  ('publisher_monetization_agreement', 'v1-draft', 'pending_legal'),
  ('revenue_share_policy', 'v1-draft', 'pending_legal'),
  ('payout_terms', 'v1-draft', 'pending_legal'),
  ('tax_withholding_notice', 'v1-draft', 'pending_legal'),
  ('invalid_traffic_policy', 'v1-draft', 'pending_legal'),
  ('sponsored_content_policy', 'v1-draft', 'pending_legal'),
  ('advertising_revenue_attribution_policy', 'v1-draft', 'pending_legal'),
  ('appeal_complaint_procedure', 'v1-draft', 'pending_legal'),
  ('privacy_data_retention_update', 'v1-draft', 'pending_legal')
on conflict (document_key, version) do nothing;

create table if not exists public.monetization_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  document_key text not null,
  document_version text not null,
  legal_document_version_id uuid not null references public.monetization_legal_document_versions(id) on delete restrict,
  program_type text not null check (program_type in ('creator', 'publisher')),
  user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  locale text not null default 'en',
  safe_ip_hash text,
  safe_user_agent_hash text,
  acceptance_method text not null default 'web_checkbox' check (acceptance_method in ('web_checkbox', 'desktop_bridge', 'api')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists monetization_agreement_acceptances_active_uidx
  on public.monetization_agreement_acceptances (monetization_account_id, legal_document_version_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Revenue contract extensions (keep percentages; add basis points)
-- ---------------------------------------------------------------------------
alter table public.revenue_share_contracts
  add column if not exists contract_key text,
  add column if not exists platform_percentage_basis_points integer,
  add column if not exists partner_percentage_basis_points integer,
  add column if not exists invalid_traffic_hold_days integer not null default 7 check (invalid_traffic_hold_days between 0 and 3650),
  add column if not exists standard_hold_days integer,
  add column if not exists reserve_percentage_basis_points integer not null default 0 check (reserve_percentage_basis_points between 0 and 10000),
  add column if not exists promotional_credit_eligible boolean not null default false,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null,
  add column if not exists activated_at timestamptz;

update public.revenue_share_contracts
set platform_percentage_basis_points = coalesce(platform_percentage_basis_points, round(platform_percentage * 100)::integer),
    partner_percentage_basis_points = coalesce(partner_percentage_basis_points, round(partner_percentage * 100)::integer),
    standard_hold_days = coalesce(standard_hold_days, hold_period_days),
    contract_key = coalesce(contract_key, program_type || ':' || version)
where true;

alter table public.revenue_share_contracts drop constraint if exists revenue_share_contracts_bps_sum_check;
alter table public.revenue_share_contracts
  add constraint revenue_share_contracts_bps_sum_check
  check (
    platform_percentage_basis_points is null
    or partner_percentage_basis_points is null
    or platform_percentage_basis_points + partner_percentage_basis_points = 10000
  );

alter table public.revenue_share_contracts drop constraint if exists revenue_share_contracts_status_check;
alter table public.revenue_share_contracts
  add constraint revenue_share_contracts_status_check
  check (status in ('draft', 'approved', 'active', 'superseded', 'retired'));

-- Accrual status expansion
alter table public.partner_revenue_accruals
  add column if not exists reserve_minor bigint not null default 0 check (reserve_minor >= 0),
  add column if not exists withholding_minor bigint not null default 0 check (withholding_minor >= 0),
  add column if not exists net_payable_minor bigint,
  add column if not exists available_at timestamptz,
  add column if not exists payout_item_id uuid,
  add column if not exists hold_reason_code text;

alter table public.partner_revenue_accruals drop constraint if exists partner_revenue_accruals_status_check;
alter table public.partner_revenue_accruals
  add constraint partner_revenue_accruals_status_check
  check (status in (
    'pending', 'held', 'available', 'reserved_for_payout', 'processing', 'paid',
    'reversed', 'disputed', 'expired'
  ));

update public.partner_revenue_accruals
set net_payable_minor = coalesce(net_payable_minor, greatest(amount_minor - reserve_minor - withholding_minor, 0))
where net_payable_minor is null;

-- ---------------------------------------------------------------------------
-- Holds / reserves / schedules
-- ---------------------------------------------------------------------------
create table if not exists public.finance_holds (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  hold_reason text not null check (hold_reason in (
    'standard_settlement', 'invalid_traffic_review', 'tax_information_required', 'payout_onboarding_incomplete',
    'compliance_review', 'account_suspension', 'dispute', 'chargeback_exposure', 'minimum_payout_not_reached',
    'manual_risk_hold', 'legal_hold'
  )),
  public_reason_code text not null,
  internal_reason_code text,
  status text not null default 'active' check (status in ('active', 'released', 'expired')),
  placed_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (monetization_account_id, idempotency_key)
);

create table if not exists public.finance_reserves (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  reserve_reason text not null check (reserve_reason in (
    'invalid_traffic_reserve', 'refund_reserve', 'dispute_reserve', 'provider_reserve', 'manual_financial_reserve'
  )),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'released', 'applied')),
  placed_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (monetization_account_id, idempotency_key)
);

create table if not exists public.payout_schedules (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  schedule_type text not null default 'monthly' check (schedule_type in ('monthly', 'biweekly', 'weekly', 'manual_review')),
  payout_day integer check (payout_day is null or payout_day between 1 and 28),
  timezone text not null default 'UTC',
  minimum_payout_override_minor bigint check (minimum_payout_override_minor is null or minimum_payout_override_minor >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'forced_manual')),
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (monetization_account_id)
);

create table if not exists public.partner_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  pending_minor bigint not null default 0 check (pending_minor >= 0),
  held_minor bigint not null default 0 check (held_minor >= 0),
  available_minor bigint not null default 0 check (available_minor >= 0),
  reserved_for_payout_minor bigint not null default 0 check (reserved_for_payout_minor >= 0),
  processing_minor bigint not null default 0 check (processing_minor >= 0),
  paid_lifetime_minor bigint not null default 0 check (paid_lifetime_minor >= 0),
  reversed_lifetime_minor bigint not null default 0 check (reversed_lifetime_minor >= 0),
  calculated_at timestamptz not null default now(),
  source text not null default 'ledger_recompute' check (source in ('ledger_recompute', 'manual_audit')),
  correlation_id text
);

-- ---------------------------------------------------------------------------
-- Payout batches / items / mappings
-- ---------------------------------------------------------------------------
create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  period_start timestamptz not null,
  period_end timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null default 'stripe_connect',
  program_type text check (program_type is null or program_type in ('creator', 'publisher')),
  status text not null default 'draft' check (status in (
    'draft', 'calculated', 'awaiting_approval', 'approved', 'processing',
    'partially_completed', 'completed', 'failed', 'cancelled', 'reversed'
  )),
  item_count integer not null default 0 check (item_count >= 0),
  gross_amount_minor bigint not null default 0 check (gross_amount_minor >= 0),
  reserve_amount_minor bigint not null default 0 check (reserve_amount_minor >= 0),
  withholding_amount_minor bigint not null default 0 check (withholding_amount_minor >= 0),
  net_amount_minor bigint not null default 0 check (net_amount_minor >= 0),
  content_hash text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  reconciliation_status text not null default 'pending' check (reconciliation_status in (
    'pending', 'matched', 'variance_found', 'requires_review', 'failed'
  )),
  idempotency_key text not null unique,
  check (period_end > period_start),
  check (approved_by is null or approved_by <> created_by or true)
);

create unique index if not exists payout_batches_period_currency_program_uidx
  on public.payout_batches (period_start, period_end, currency, (coalesce(program_type, '')))
  where status not in ('cancelled', 'failed');

create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.payout_batches(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  payout_profile_id uuid not null references public.payout_profiles(id) on delete restrict,
  provider_account_id_reference text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_amount_minor bigint not null check (gross_amount_minor >= 0),
  reserve_amount_minor bigint not null default 0 check (reserve_amount_minor >= 0),
  withholding_amount_minor bigint not null default 0 check (withholding_amount_minor >= 0),
  fees_minor bigint not null default 0 check (fees_minor >= 0),
  net_amount_minor bigint not null check (net_amount_minor >= 0),
  status text not null default 'pending' check (status in (
    'pending', 'reserved', 'approved', 'processing', 'paid', 'failed',
    'retry_scheduled', 'returned', 'cancelled', 'reversed'
  )),
  provider_transfer_id text,
  provider_payout_id text,
  failure_code text,
  failure_message_safe text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  processing_started_at timestamptz,
  paid_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text not null unique,
  check (gross_amount_minor - reserve_amount_minor - withholding_amount_minor - fees_minor = net_amount_minor)
);

create table if not exists public.payout_item_accruals (
  payout_item_id uuid not null references public.payout_items(id) on delete restrict,
  accrual_id uuid not null references public.partner_revenue_accruals(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  primary key (payout_item_id, accrual_id)
);

create unique index if not exists payout_item_accruals_active_accrual_uidx
  on public.payout_item_accruals (accrual_id);

alter table public.partner_revenue_accruals
  drop constraint if exists partner_revenue_accruals_payout_item_fk;
alter table public.partner_revenue_accruals
  add constraint partner_revenue_accruals_payout_item_fk
  foreign key (payout_item_id) references public.payout_items(id) on delete restrict;

create table if not exists public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in (
    'revenue_correction', 'invalid_traffic_reversal', 'payout_return', 'provider_fee_correction',
    'withholding_correction', 'reserve_release', 'contract_correction', 'manual_credit', 'manual_debit'
  )),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('credit', 'debit')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'applied', 'rejected')),
  public_reason_code text not null,
  internal_reason_code text,
  supporting_reference text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  idempotency_key text not null unique
);

create table if not exists public.financial_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('revenue', 'payout', 'balance')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  provider text,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in (
    'pending', 'running', 'matched', 'variance_found', 'requires_review', 'failed'
  )),
  expected_total_minor bigint,
  provider_total_minor bigint,
  variance_minor bigint,
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  idempotency_key text not null unique,
  check (period_end > period_start)
);

create table if not exists public.financial_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.financial_reconciliation_runs(id) on delete restrict,
  finding_type text not null check (finding_type in (
    'missing_internal_entry', 'missing_provider_entry', 'amount_mismatch', 'currency_mismatch',
    'duplicate_provider_transfer', 'stale_processing_item', 'unexpected_return', 'balance_mismatch',
    'contract_mismatch', 'accrual_without_source', 'payout_without_accrual'
  )),
  subject_type text,
  subject_id uuid,
  amount_minor bigint,
  currency text,
  status text not null default 'open' check (status in ('open', 'resolved', 'accepted_variance')),
  detail_safe text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  available_minor bigint not null check (available_minor >= 0),
  pending_minor bigint not null default 0 check (pending_minor >= 0),
  captured_at timestamptz not null default now(),
  source text not null default 'provider_retrieve',
  correlation_id text
);

-- ---------------------------------------------------------------------------
-- Ad transparency archive
-- ---------------------------------------------------------------------------
create table if not exists public.ad_transparency_archive (
  id uuid primary key default gen_random_uuid(),
  archive_key text not null unique,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  advertiser_display_name text not null,
  advertiser_type text not null,
  verified_business boolean not null default false,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  snapshot_id uuid not null references public.ad_creative_snapshots(id) on delete restrict,
  creative_snapshot_public jsonb not null check (jsonb_typeof(creative_snapshot_public) = 'object'),
  sponsor_label text not null default 'Sponsored',
  destination_domain text,
  first_delivery_at timestamptz not null,
  last_delivery_at timestamptz not null,
  broad_countries text[] not null default '{}'::text[],
  broad_languages text[] not null default '{}'::text[],
  broad_targeting_reasons text[] not null default '{}'::text[],
  placement_types text[] not null default '{}'::text[],
  objective text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'suspended', 'removed')),
  public_policy_reason text,
  archived_at timestamptz not null default now(),
  check (last_delivery_at >= first_delivery_at)
);

create table if not exists public.ad_transparency_retention (
  archive_record_id uuid primary key references public.ad_transparency_archive(id) on delete restrict,
  policy_version text not null,
  retain_until timestamptz not null,
  legal_hold boolean not null default false,
  archived_at timestamptz not null default now(),
  deletion_eligible_at timestamptz
);

create table if not exists public.payout_worker_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in (
    'monetization_status_reconciliation', 'provider_account_refresh', 'tax_form_expiry_scan',
    'agreement_version_expiry_scan', 'accrual_hold_release', 'payout_eligibility_refresh',
    'payout_batch_scheduler', 'payout_item_processing', 'payout_retry', 'payout_return_reconciliation',
    'provider_event_reconciliation', 'daily_balance_snapshot', 'revenue_reconciliation',
    'payout_reconciliation', 'transparency_archive_materialization', 'transparency_retention_cleanup',
    'stale_processing_item_recovery'
  )),
  subject_id uuid,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'completed', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_expires_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guards and legal helpers
-- ---------------------------------------------------------------------------
create or replace function public.payout_require_active_legal(program_type text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  missing text;
  required text[];
begin
  if program_type = 'creator' then
    required := array['creator_monetization_agreement', 'revenue_share_policy', 'payout_terms', 'tax_withholding_notice'];
  else
    required := array['publisher_monetization_agreement', 'revenue_share_policy', 'payout_terms', 'tax_withholding_notice'];
  end if;
  select d.doc_key into missing
  from unnest(required) as d(doc_key)
  where not exists (
    select 1 from public.monetization_legal_document_versions v
    where v.document_key = d.doc_key and v.status = 'active'
  )
  limit 1;
  if missing is not null then
    raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.payout_guard_monetization_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.payout_allow_internal_transition() then
    if new.monetization_status is distinct from old.monetization_status
       and new.monetization_status in ('approved', 'active', 'limited') then
      raise exception 'CLIENT_CANNOT_ACTIVATE_MONETIZATION' using errcode = '42501';
    end if;
    if new.payout_onboarding_status is distinct from old.payout_onboarding_status
       and new.payout_onboarding_status = 'complete' then
      raise exception 'CLIENT_CANNOT_COMPLETE_PAYOUT_ONBOARDING' using errcode = '42501';
    end if;
    if new.compliance_status is distinct from old.compliance_status
       and new.compliance_status in ('active', 'clear') then
      raise exception 'CLIENT_CANNOT_SET_COMPLIANCE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_guard_monetization_write on public.monetization_accounts;
create trigger payout_guard_monetization_write
  before update on public.monetization_accounts
  for each row execute function public.payout_guard_monetization_write();

create or replace function public.payout_guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.payout_allow_internal_transition() then
    if new.provider_account_id is distinct from old.provider_account_id then
      raise exception 'CLIENT_CANNOT_SET_PROVIDER_ACCOUNT' using errcode = '42501';
    end if;
    if new.onboarding_status is distinct from old.onboarding_status and new.onboarding_status = 'complete' then
      raise exception 'CLIENT_CANNOT_COMPLETE_PAYOUT_ONBOARDING' using errcode = '42501';
    end if;
    if new.payout_status is distinct from old.payout_status and new.payout_status = 'enabled' then
      raise exception 'CLIENT_CANNOT_ENABLE_PAYOUT' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_guard_profile_write on public.payout_profiles;
create trigger payout_guard_profile_write
  before update on public.payout_profiles
  for each row execute function public.payout_guard_profile_write();

create or replace function public.payout_guard_tax_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.payout_allow_internal_transition() then
    if new.tax_form_status is distinct from old.tax_form_status and new.tax_form_status = 'verified' then
      raise exception 'CLIENT_CANNOT_VERIFY_TAX' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_guard_tax_write on public.tax_profiles;
create trigger payout_guard_tax_write
  before update on public.tax_profiles
  for each row execute function public.payout_guard_tax_write();

-- ---------------------------------------------------------------------------
-- Monetization application RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_monetization_application(
  target_program_type text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  account public.monetization_accounts%rowtype;
  application_id uuid;
  badge_ok boolean;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_program_type not in ('creator', 'publisher') then
    raise exception 'PROGRAM_INVALID' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.verification_badges b
    where b.subject_type = 'user' and b.subject_id = actor and b.status = 'active'
      and (
        (target_program_type = 'creator' and b.badge_kind in ('creator', 'creator_verified'))
        or (target_program_type = 'publisher' and b.badge_kind in ('publisher'))
      )
  ) into badge_ok;
  -- Fallback: monetization_accounts.badge_status already tracked from program
  select * into account
  from public.monetization_accounts
  where subject_id = actor and program_type = target_program_type
  for update;

  if not found then
    insert into public.monetization_accounts (
      subject_type, subject_id, program_type, badge_status, monetization_status, application_status, compliance_status
    ) values (
      'user', actor, target_program_type,
      case when badge_ok then 'active' else 'none' end,
      'not_applied', 'draft', 'pending'
    )
    returning * into account;
  end if;

  if account.badge_status <> 'active' and not badge_ok then
    raise exception 'BADGE_REQUIRED' using errcode = 'P0001';
  end if;

  select id into application_id
  from public.monetization_applications
  where monetization_account_id = account.id and idempotency_key = target_idempotency_key;
  if found then return application_id; end if;

  insert into public.monetization_applications (
    monetization_account_id, program_type, subject_id, status, idempotency_key
  ) values (
    account.id, target_program_type, actor, 'draft', target_idempotency_key
  )
  returning id into application_id;

  update public.monetization_accounts
  set application_status = 'draft', monetization_status = case when monetization_status = 'not_applied' then 'pending' else monetization_status end,
      badge_status = case when badge_ok then 'active' else badge_status end,
      updated_at = now()
  where id = account.id;

  return application_id;
end;
$$;

create or replace function public.submit_monetization_application(target_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  app public.monetization_applications%rowtype;
begin
  select * into app from public.monetization_applications where id = target_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if app.subject_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if app.status not in ('draft', 'requires_information') then
    raise exception 'APPLICATION_SUBMIT_INVALID' using errcode = 'P0001';
  end if;
  update public.monetization_applications
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = target_application_id;
  update public.monetization_accounts
  set application_status = 'submitted', monetization_status = 'pending', updated_at = now()
  where id = app.monetization_account_id;
end;
$$;

create or replace function public.root_review_monetization_application(
  target_application_id uuid,
  target_decision text,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  app public.monetization_applications%rowtype;
begin
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform set_config('picom.payout_internal', '1', true);
  select * into app from public.monetization_applications where id = target_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.monetization_application_review_decisions (
    application_id, reviewer_id, decision, public_reason_code, internal_reason_code, policy_version, idempotency_key
  ) values (
    target_application_id, auth.uid(), target_decision, public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  on conflict (application_id, idempotency_key) do nothing;

  update public.monetization_applications
  set status = target_decision, reviewed_by = auth.uid(), reviewed_at = now(),
      public_reason_code = public_reason_code, internal_reason_code = internal_reason_code, updated_at = now()
  where id = target_application_id;

  if target_decision = 'approved' then
    update public.monetization_accounts
    set application_status = 'approved', monetization_status = 'approved', compliance_status = 'clear', updated_at = now()
    where id = app.monetization_account_id;
  elsif target_decision = 'rejected' then
    update public.monetization_accounts
    set application_status = 'rejected', monetization_status = 'not_eligible', updated_at = now()
    where id = app.monetization_account_id;
  elsif target_decision = 'requires_information' then
    update public.monetization_accounts
    set application_status = 'requires_information', compliance_status = 'requires_information', updated_at = now()
    where id = app.monetization_account_id;
  elsif target_decision = 'suspended' then
    update public.monetization_accounts
    set application_status = 'suspended', monetization_status = 'suspended', suspended_at = now(), updated_at = now()
    where id = app.monetization_account_id;
  end if;
end;
$$;

create or replace function public.accept_monetization_agreement(
  target_monetization_account_id uuid,
  target_document_key text,
  target_document_version text,
  target_locale text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.monetization_accounts%rowtype;
  doc public.monetization_legal_document_versions%rowtype;
  acceptance_id uuid;
begin
  select * into account from public.monetization_accounts where id = target_monetization_account_id;
  if not found or account.subject_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into doc from public.monetization_legal_document_versions
  where document_key = target_document_key and version = target_document_version;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  -- Acceptances may be recorded while pending_legal for draft UX, but activation gates require active.
  insert into public.monetization_agreement_acceptances (
    document_key, document_version, legal_document_version_id, program_type, user_id,
    monetization_account_id, locale, acceptance_method
  ) values (
    target_document_key, target_document_version, doc.id, account.program_type, auth.uid(),
    target_monetization_account_id, coalesce(target_locale, 'en'), 'web_checkbox'
  )
  returning id into acceptance_id;
  return acceptance_id;
end;
$$;

create or replace function public.create_payout_profile(
  target_monetization_account_id uuid,
  target_payee_type text,
  target_legal_name text,
  target_country_code text,
  target_payout_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.monetization_accounts%rowtype;
  profile_id uuid;
begin
  select * into account from public.monetization_accounts where id = target_monetization_account_id;
  if not found or account.subject_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if account.monetization_status not in ('approved', 'active', 'limited', 'pending') then
    raise exception 'MONETIZATION_NOT_READY' using errcode = 'P0001';
  end if;
  insert into public.payout_profiles (
    owner_type, owner_id, monetization_account_id, payee_type, legal_name, country_code, payout_currency, provider
  ) values (
    'user', auth.uid(), target_monetization_account_id, target_payee_type, btrim(target_legal_name),
    upper(target_country_code), upper(target_payout_currency), 'stripe_connect'
  )
  returning id into profile_id;
  update public.monetization_accounts
  set payout_profile_id = profile_id, payout_onboarding_status = 'pending', updated_at = now()
  where id = target_monetization_account_id;
  return profile_id;
end;
$$;

create or replace function public.create_tax_profile(
  target_payout_profile_id uuid,
  target_tax_residency_country text,
  target_tax_entity_type text,
  target_tax_identifier_last4 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile public.payout_profiles%rowtype;
  tax_id uuid;
begin
  select * into profile from public.payout_profiles where id = target_payout_profile_id;
  if not found or profile.owner_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.tax_profiles (
    owner_type, owner_id, payout_profile_id, tax_residency_country, tax_entity_type,
    tax_identifier_last4, tax_form_status, withholding_status
  ) values (
    profile.owner_type, profile.owner_id, target_payout_profile_id, upper(target_tax_residency_country),
    target_tax_entity_type, target_tax_identifier_last4, 'pending', 'unknown'
  )
  returning id into tax_id;
  update public.monetization_accounts
  set tax_profile_id = tax_id, updated_at = now()
  where id = profile.monetization_account_id;
  return tax_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Balance + eligibility
-- ---------------------------------------------------------------------------
create or replace function public.compute_partner_balance(
  target_monetization_account_id uuid,
  target_currency text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  pending_minor bigint := 0;
  held_minor bigint := 0;
  available_minor bigint := 0;
  reserved_minor bigint := 0;
  processing_minor bigint := 0;
  paid_minor bigint := 0;
  reversed_minor bigint := 0;
  reserve_active bigint := 0;
begin
  select
    coalesce(sum(case when status = 'pending' then amount_minor else 0 end), 0),
    coalesce(sum(case when status = 'held' then amount_minor else 0 end), 0),
    coalesce(sum(case when status = 'available' then coalesce(net_payable_minor, amount_minor) else 0 end), 0),
    coalesce(sum(case when status = 'reserved_for_payout' then coalesce(net_payable_minor, amount_minor) else 0 end), 0),
    coalesce(sum(case when status = 'processing' then coalesce(net_payable_minor, amount_minor) else 0 end), 0),
    coalesce(sum(case when status = 'paid' then coalesce(net_payable_minor, amount_minor) else 0 end), 0),
    coalesce(sum(case when status = 'reversed' then amount_minor else 0 end), 0)
  into pending_minor, held_minor, available_minor, reserved_minor, processing_minor, paid_minor, reversed_minor
  from public.partner_revenue_accruals
  where monetization_account_id = target_monetization_account_id
    and currency = target_currency;

  select coalesce(sum(amount_minor), 0) into reserve_active
  from public.finance_reserves
  where monetization_account_id = target_monetization_account_id
    and currency = target_currency
    and status = 'active';

  available_minor := greatest(available_minor - reserve_active, 0);

  return jsonb_build_object(
    'pending_minor', pending_minor,
    'held_minor', held_minor,
    'available_minor', available_minor,
    'reserved_for_payout_minor', reserved_minor,
    'processing_minor', processing_minor,
    'paid_lifetime_minor', paid_minor,
    'reversed_lifetime_minor', reversed_minor,
    'currency', target_currency,
    'calculated_at', now()
  );
end;
$$;

create or replace function public.resolve_payout_eligibility(
  target_monetization_account_id uuid,
  target_currency text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  account public.monetization_accounts%rowtype;
  profile public.payout_profiles%rowtype;
  tax public.tax_profiles%rowtype;
  contract public.revenue_share_contracts%rowtype;
  balance jsonb;
  available bigint;
  minimum bigint := 0;
  reason text := 'eligible';
  next_action text := null;
begin
  select * into account from public.monetization_accounts where id = target_monetization_account_id;
  if not found then
    return jsonb_build_object('eligible', false, 'reason_code', 'account_not_found');
  end if;
  if account.subject_id <> auth.uid() and not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.payout_setting_bool('global_payouts_enabled', false) then
    return jsonb_build_object('eligible', false, 'reason_code', 'global_payouts_disabled', 'next_required_action', 'wait_for_platform');
  end if;
  if account.program_type = 'creator' and not public.payout_setting_bool('creator_payouts_enabled', false) then
    return jsonb_build_object('eligible', false, 'reason_code', 'creator_payouts_disabled');
  end if;
  if account.program_type = 'publisher' and not public.payout_setting_bool('publisher_payouts_enabled', false) then
    return jsonb_build_object('eligible', false, 'reason_code', 'publisher_payouts_disabled');
  end if;
  if account.monetization_status not in ('approved', 'active') then
    return jsonb_build_object('eligible', false, 'reason_code', 'monetization_inactive', 'next_required_action', 'complete_monetization_review');
  end if;
  if account.badge_status <> 'active' then
    return jsonb_build_object('eligible', false, 'reason_code', 'badge_inactive');
  end if;
  if account.compliance_status not in ('active', 'clear') then
    return jsonb_build_object('eligible', false, 'reason_code', 'compliance_blocked', 'next_required_action', 'resolve_compliance');
  end if;
  if exists (select 1 from public.finance_holds h where h.monetization_account_id = account.id and h.status = 'active') then
    return jsonb_build_object('eligible', false, 'reason_code', 'account_hold', 'next_required_action', 'resolve_hold');
  end if;

  begin
    perform public.payout_require_active_legal(account.program_type);
  exception when others then
    return jsonb_build_object('eligible', false, 'reason_code', 'LEGAL_COPY_REQUIRED', 'next_required_action', 'accept_active_agreements');
  end;

  if not exists (
    select 1
    from public.monetization_agreement_acceptances a
    join public.monetization_legal_document_versions v on v.id = a.legal_document_version_id
    where a.monetization_account_id = account.id
      and a.revoked_at is null
      and v.status = 'active'
      and v.document_key = case when account.program_type = 'creator' then 'creator_monetization_agreement' else 'publisher_monetization_agreement' end
  ) then
    return jsonb_build_object('eligible', false, 'reason_code', 'agreement_missing', 'next_required_action', 'accept_agreement');
  end if;

  select * into profile from public.payout_profiles where id = account.payout_profile_id;
  if not found or profile.onboarding_status <> 'complete' or profile.capabilities_status <> 'active' or profile.payout_status <> 'enabled' then
    return jsonb_build_object('eligible', false, 'reason_code', 'payout_onboarding_incomplete', 'next_required_action', 'complete_payout_onboarding');
  end if;
  if profile.payout_currency <> target_currency then
    return jsonb_build_object('eligible', false, 'reason_code', 'currency_mismatch');
  end if;

  select * into tax from public.tax_profiles where id = account.tax_profile_id;
  if not found or tax.tax_form_status in ('requires_information', 'rejected', 'expired', 'not_started', 'pending')
     or tax.withholding_status in ('unknown', 'pending_review', 'blocked') then
    return jsonb_build_object('eligible', false, 'reason_code', 'tax_information_required', 'next_required_action', 'complete_tax_profile');
  end if;

  if account.contract_id is not null then
    select * into contract from public.revenue_share_contracts where id = account.contract_id and status = 'active';
  else
    select * into contract from public.revenue_share_contracts
    where program_type = account.program_type and status = 'active'
    order by effective_from desc limit 1;
  end if;
  if not found then
    return jsonb_build_object('eligible', false, 'reason_code', 'contract_missing');
  end if;
  minimum := coalesce(contract.minimum_payout_amount_minor, 0);

  balance := public.compute_partner_balance(account.id, target_currency);
  available := coalesce((balance ->> 'available_minor')::bigint, 0);
  if available < minimum then
    return jsonb_build_object(
      'eligible', false,
      'reason_code', 'minimum_payout_not_reached',
      'available_amount_minor', available,
      'minimum_payout_minor', minimum,
      'currency', target_currency
    );
  end if;

  return jsonb_build_object(
    'eligible', true,
    'reason_code', reason,
    'next_required_action', next_action,
    'available_amount_minor', available,
    'minimum_payout_minor', minimum,
    'currency', target_currency
  );
end;
$$;

create or replace function public.preview_payout_batch(
  period_start timestamptz,
  period_end timestamptz,
  target_currency text,
  target_program_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_count integer := 0;
  gross bigint := 0;
  net bigint := 0;
begin
  if not public.is_finance_operator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select count(*), coalesce(sum(coalesce(a.net_payable_minor, a.amount_minor)), 0), coalesce(sum(coalesce(a.net_payable_minor, a.amount_minor)), 0)
  into item_count, gross, net
  from public.partner_revenue_accruals a
  join public.monetization_accounts m on m.id = a.monetization_account_id
  where a.status = 'available'
    and a.currency = target_currency
    and a.created_at >= period_start and a.created_at < period_end
    and (target_program_type is null or m.program_type = target_program_type);
  return jsonb_build_object(
    'item_count', item_count,
    'gross_amount_minor', gross,
    'net_amount_minor', net,
    'currency', target_currency,
    'mutates_state', false
  );
end;
$$;

create or replace function public.create_payout_batch(
  period_start timestamptz,
  period_end timestamptz,
  target_currency text,
  target_program_type text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch_id uuid;
  account record;
  eligibility jsonb;
  profile public.payout_profiles%rowtype;
  item_id uuid;
  sum_gross bigint := 0;
  sum_net bigint := 0;
  sum_reserve bigint := 0;
  sum_withhold bigint := 0;
  item_count integer := 0;
  amount bigint;
  locked_ids uuid[];
begin
  if not public.is_finance_operator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform set_config('picom.payout_internal', '1', true);

  select id into batch_id from public.payout_batches where idempotency_key = target_idempotency_key;
  if found then return batch_id; end if;

  insert into public.payout_batches (
    batch_key, period_start, period_end, currency, provider, program_type, status, created_by, idempotency_key
  ) values (
    'batch:' || target_idempotency_key, period_start, period_end, target_currency, 'stripe_connect',
    target_program_type, 'calculated', auth.uid(), target_idempotency_key
  )
  returning id into batch_id;

  for account in
    select m.*
    from public.monetization_accounts m
    where m.monetization_status in ('approved', 'active')
      and (target_program_type is null or m.program_type = target_program_type)
  loop
    eligibility := public.resolve_payout_eligibility(account.id, target_currency);
    if coalesce(eligibility ->> 'eligible', 'false') <> 'true' then
      continue;
    end if;
    select * into profile from public.payout_profiles where id = account.payout_profile_id;
    if not found then continue; end if;

    select coalesce(array_agg(locked.id), '{}'::uuid[]), coalesce(sum(locked.amt), 0)
    into locked_ids, amount
    from (
      select a.id, coalesce(a.net_payable_minor, a.amount_minor) as amt
      from public.partner_revenue_accruals a
      where a.monetization_account_id = account.id
        and a.currency = target_currency
        and a.status = 'available'
        and a.created_at >= period_start and a.created_at < period_end
      for update skip locked
    ) locked;

    if amount <= 0 or locked_ids is null or cardinality(locked_ids) = 0 then
      continue;
    end if;

    insert into public.payout_items (
      payout_batch_id, monetization_account_id, payout_profile_id, provider_account_id_reference,
      currency, gross_amount_minor, reserve_amount_minor, withholding_amount_minor, fees_minor, net_amount_minor,
      status, idempotency_key
    ) values (
      batch_id, account.id, profile.id, null,
      target_currency, amount, 0, 0, 0, amount,
      'reserved', 'item:' || target_idempotency_key || ':' || account.id::text
    )
    returning id into item_id;

    insert into public.payout_item_accruals (payout_item_id, accrual_id, amount_minor, currency)
    select item_id, a.id, coalesce(a.net_payable_minor, a.amount_minor), a.currency
    from public.partner_revenue_accruals a
    where a.id = any(locked_ids);

    update public.partner_revenue_accruals a
    set status = 'reserved_for_payout', payout_item_id = item_id
    where a.id = any(locked_ids);

    item_count := item_count + 1;
    sum_gross := sum_gross + amount;
    sum_net := sum_net + amount;
  end loop;

  update public.payout_batches
  set item_count = item_count,
      gross_amount_minor = sum_gross,
      reserve_amount_minor = sum_reserve,
      withholding_amount_minor = sum_withhold,
      net_amount_minor = sum_net,
      status = 'awaiting_approval',
      content_hash = encode(extensions.digest(batch_id::text || ':' || item_count::text || ':' || sum_net::text, 'sha256'), 'hex')
  where id = batch_id;

  return batch_id;
end;
$$;

create or replace function public.approve_payout_batch(target_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch public.payout_batches%rowtype;
begin
  if not public.is_finance_approver() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform set_config('picom.payout_internal', '1', true);
  select * into batch from public.payout_batches where id = target_batch_id for update;
  if not found then raise exception 'BATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if batch.status <> 'awaiting_approval' then raise exception 'BATCH_APPROVE_INVALID' using errcode = 'P0001'; end if;
  if public.payout_setting_bool('payout_dual_approval_required', true) and batch.created_by = auth.uid() then
    raise exception 'DUAL_APPROVAL_REQUIRED' using errcode = '42501';
  end if;
  update public.payout_batches
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = target_batch_id;
  update public.payout_items set status = 'approved', updated_at = now() where payout_batch_id = target_batch_id and status = 'reserved';
end;
$$;

create or replace function public.cancel_payout_batch(target_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch public.payout_batches%rowtype;
begin
  if not public.is_finance_operator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform set_config('picom.payout_internal', '1', true);
  select * into batch from public.payout_batches where id = target_batch_id for update;
  if batch.status not in ('draft', 'calculated', 'awaiting_approval', 'approved') then
    raise exception 'BATCH_CANCEL_INVALID' using errcode = 'P0001';
  end if;
  update public.partner_revenue_accruals a
  set status = 'available', payout_item_id = null
  where a.payout_item_id in (select id from public.payout_items where payout_batch_id = target_batch_id)
    and a.status = 'reserved_for_payout';
  update public.payout_items set status = 'cancelled', updated_at = now() where payout_batch_id = target_batch_id;
  update public.payout_batches set status = 'cancelled' where id = target_batch_id;
end;
$$;

create or replace function public.root_toggle_payout_setting(target_key text, target_value boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.verification_business_is_platform_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if target_key not in (
    'global_payouts_enabled', 'provider_payouts_enabled', 'creator_payouts_enabled',
    'publisher_payouts_enabled', 'batch_processing_enabled'
  ) then
    raise exception 'SETTING_INVALID' using errcode = '22023';
  end if;
  insert into public.payout_platform_settings (setting_key, setting_value, updated_by, updated_at)
  values (target_key, to_jsonb(target_value), auth.uid(), now())
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function public.materialize_ad_transparency_archive(
  target_decision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  snap public.ad_creative_snapshots%rowtype;
  advertiser public.advertiser_accounts%rowtype;
  campaign public.ad_campaigns%rowtype;
  archive_id uuid;
  public_payload jsonb;
  verified boolean := false;
begin
  if not public.verification_business_is_platform_admin() and auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found or not decision.eligible or decision.snapshot_id is null then
    raise exception 'DECISION_NOT_ARCHIVABLE' using errcode = 'P0001';
  end if;
  -- Preview/test deliveries without campaign/snapshot already rejected.
  select * into snap from public.ad_creative_snapshots where id = decision.snapshot_id;
  select * into advertiser from public.advertiser_accounts where id = decision.advertiser_account_id;
  select * into campaign from public.ad_campaigns where id = decision.campaign_id;

  select exists (
    select 1 from public.verification_badges b
    where b.subject_type = 'organization'
      and b.status = 'active'
      and b.badge_kind in ('business')
      and advertiser.owner_type = 'organization'
      and b.subject_id = advertiser.owner_id
  ) into verified;

  public_payload := jsonb_build_object(
    'headline', snap.snapshot_payload ->> 'headline',
    'body', snap.snapshot_payload ->> 'body',
    'call_to_action', snap.snapshot_payload ->> 'call_to_action',
    'creative_type', snap.snapshot_payload ->> 'creative_type',
    'disclosure_text', coalesce(snap.snapshot_payload ->> 'disclosure_text', 'Sponsored')
  );

  insert into public.ad_transparency_archive (
    archive_key, advertiser_account_id, advertiser_display_name, advertiser_type, verified_business,
    campaign_id, snapshot_id, creative_snapshot_public, destination_domain,
    first_delivery_at, last_delivery_at, placement_types, objective, status
  ) values (
    'archive:' || decision.snapshot_id::text,
    advertiser.id, advertiser.display_name, advertiser.advertiser_type, verified,
    decision.campaign_id, snap.id, public_payload, snap.destination_domain,
    decision.issued_at, decision.issued_at, array[decision.placement_key], campaign.objective, 'active'
  )
  on conflict (archive_key) do update
    set last_delivery_at = greatest(public.ad_transparency_archive.last_delivery_at, excluded.last_delivery_at),
        placement_types = (
          select array_agg(distinct p) from unnest(public.ad_transparency_archive.placement_types || excluded.placement_types) as p
        )
  returning id into archive_id;

  insert into public.ad_transparency_retention (archive_record_id, policy_version, retain_until, deletion_eligible_at)
  values (archive_id, 'v1', now() + interval '2555 days', now() + interval '2555 days')
  on conflict (archive_record_id) do nothing;

  return archive_id;
end;
$$;

create or replace function public.get_public_ad_transparency_archive(limit_count integer default 50)
returns setof public.ad_transparency_archive
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.ad_transparency_archive
  where status in ('active', 'paused', 'completed', 'suspended')
  order by last_delivery_at desc
  limit greatest(least(coalesce(limit_count, 50), 100), 1);
$$;

create or replace function public.apply_provider_payout_account_state(
  target_provider_account_id text,
  target_onboarding_status text,
  target_capabilities_status text,
  target_payout_status text,
  target_requirements_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' and not public.is_finance_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform set_config('picom.payout_internal', '1', true);
  update public.payout_profiles
  set onboarding_status = target_onboarding_status,
      capabilities_status = target_capabilities_status,
      payout_status = target_payout_status,
      requirements_status = target_requirements_status,
      updated_at = now()
  where provider_account_id = target_provider_account_id;

  if target_onboarding_status = 'complete' and target_payout_status = 'enabled' then
    update public.monetization_accounts m
    set payout_onboarding_status = 'complete', updated_at = now()
    from public.payout_profiles p
    where p.id = m.payout_profile_id
      and p.provider_account_id = target_provider_account_id;
  end if;
end;
$$;

create or replace function public.apply_provider_payout_item_event(
  target_provider_transfer_id text,
  target_event text,
  target_failure_code text default null,
  target_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item public.payout_items%rowtype;
  subject uuid;
  idem text := coalesce(target_idempotency_key, 'provider:' || target_provider_transfer_id || ':' || target_event);
begin
  if auth.role() <> 'service_role' and not public.is_finance_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform set_config('picom.payout_internal', '1', true);

  select * into item
  from public.payout_items
  where provider_transfer_id = target_provider_transfer_id
     or provider_payout_id = target_provider_transfer_id
  for update;
  if not found then
    return;
  end if;

  select subject_id into subject from public.monetization_accounts where id = item.monetization_account_id;

  if target_event = 'paid' then
    if item.status = 'paid' then return; end if;
    update public.payout_items
    set status = 'paid', paid_at = now(), updated_at = now()
    where id = item.id;
    update public.partner_revenue_accruals
    set status = 'paid'
    where payout_item_id = item.id and status in ('reserved_for_payout', 'processing');
  elsif target_event = 'failed' then
    update public.payout_items
    set status = case when target_failure_code in ('provider_timeout','temporary_provider_error','rate_limit','transient_bank_unavailable')
                      then 'retry_scheduled' else 'failed' end,
        failure_code = coalesce(target_failure_code, 'provider_error'),
        failure_message_safe = 'Payout could not be completed. Update payout details or contact support.',
        updated_at = now()
    where id = item.id and status not in ('paid', 'returned', 'reversed');
  elsif target_event in ('returned', 'reversed', 'canceled') then
    if item.status in ('returned', 'reversed') then return; end if;
    update public.payout_items
    set status = 'returned', returned_at = now(), updated_at = now()
    where id = item.id;
    if subject is not null and item.net_amount_minor > 0 then
      insert into public.financial_adjustments (
        monetization_account_id, adjustment_type, amount_minor, currency, direction, status,
        public_reason_code, internal_reason_code, supporting_reference, created_by, idempotency_key
      ) values (
        item.monetization_account_id, 'payout_return', item.net_amount_minor, item.currency, 'credit', 'applied',
        'payout_returned', 'provider_return', target_provider_transfer_id, subject, idem
      )
      on conflict (idempotency_key) do nothing;
    end if;
    insert into public.finance_holds (
      monetization_account_id, hold_reason, public_reason_code, status, idempotency_key
    ) values (
      item.monetization_account_id, 'payout_onboarding_incomplete', 'payout_returned_review', 'active',
      'hold:' || idem
    )
    on conflict (monetization_account_id, idempotency_key) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payout processing claim (provider send remains Edge/worker; fail-closed)
-- ---------------------------------------------------------------------------
create or replace function public.claim_payout_batch_for_processing(target_batch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch public.payout_batches%rowtype;
begin
  if auth.role() <> 'service_role' and not public.is_finance_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not public.payout_setting_bool('global_payouts_enabled', false)
     or not public.payout_setting_bool('provider_payouts_enabled', false)
     or not public.payout_setting_bool('batch_processing_enabled', false) then
    raise exception 'PAYOUT_KILL_SWITCH_ACTIVE' using errcode = 'P0001';
  end if;
  perform set_config('picom.payout_internal', '1', true);
  select * into batch from public.payout_batches where id = target_batch_id for update;
  if not found then raise exception 'BATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if batch.status <> 'approved' then raise exception 'BATCH_NOT_APPROVED' using errcode = 'P0001'; end if;
  update public.payout_batches
  set status = 'processing', processing_started_at = now()
  where id = target_batch_id;
  update public.payout_items
  set status = 'processing', processing_started_at = now(), updated_at = now()
  where payout_batch_id = target_batch_id and status = 'approved';
  return target_batch_id;
end;
$$;

-- Compatibility: partner attribution accepts compliance active|clear (additive override).
create or replace function public.payout_monetization_allows_accrual(target_monetization_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.monetization_accounts m
    where m.id = target_monetization_account_id
      and m.monetization_status = 'active'
      and m.compliance_status in ('clear', 'active')
      and m.revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Append-only triggers + RLS + grants
-- ---------------------------------------------------------------------------
drop trigger if exists payout_review_decisions_append_only on public.monetization_application_review_decisions;
create trigger payout_review_decisions_append_only
  before update or delete on public.monetization_application_review_decisions
  for each row execute function public.payout_prevent_mutation();

drop trigger if exists payout_agreement_acceptances_no_update on public.monetization_agreement_acceptances;
create trigger payout_agreement_acceptances_no_update
  before update or delete on public.monetization_agreement_acceptances
  for each row execute function public.payout_prevent_mutation();

drop trigger if exists payout_item_accruals_no_delete on public.payout_item_accruals;
create trigger payout_item_accruals_no_delete
  before delete on public.payout_item_accruals
  for each row execute function public.payout_prevent_mutation();

drop trigger if exists financial_adjustments_no_delete on public.financial_adjustments;
create trigger financial_adjustments_no_delete
  before delete on public.financial_adjustments
  for each row execute function public.payout_prevent_mutation();

alter table public.payout_platform_settings enable row level security;
alter table public.monetization_applications enable row level security;
alter table public.monetization_application_review_decisions enable row level security;
alter table public.payout_profiles enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.monetization_legal_document_versions enable row level security;
alter table public.monetization_agreement_acceptances enable row level security;
alter table public.finance_holds enable row level security;
alter table public.finance_reserves enable row level security;
alter table public.payout_schedules enable row level security;
alter table public.partner_balance_snapshots enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_item_accruals enable row level security;
alter table public.financial_adjustments enable row level security;
alter table public.financial_reconciliation_runs enable row level security;
alter table public.financial_reconciliation_findings enable row level security;
alter table public.provider_balance_snapshots enable row level security;
alter table public.ad_transparency_archive enable row level security;
alter table public.ad_transparency_retention enable row level security;
alter table public.payout_worker_jobs enable row level security;

revoke all on table
  public.payout_platform_settings, public.monetization_applications, public.monetization_application_review_decisions,
  public.payout_profiles, public.tax_profiles, public.monetization_agreement_acceptances,
  public.finance_holds, public.finance_reserves, public.payout_schedules, public.partner_balance_snapshots,
  public.payout_batches, public.payout_items, public.payout_item_accruals, public.financial_adjustments,
  public.financial_reconciliation_runs, public.financial_reconciliation_findings, public.provider_balance_snapshots,
  public.ad_transparency_retention, public.payout_worker_jobs
from public, anon;

revoke all on table
  public.payout_platform_settings, public.monetization_application_review_decisions,
  public.finance_holds, public.finance_reserves, public.payout_batches, public.payout_items,
  public.payout_item_accruals, public.financial_adjustments, public.financial_reconciliation_runs,
  public.financial_reconciliation_findings, public.provider_balance_snapshots, public.ad_transparency_retention,
  public.payout_worker_jobs
from authenticated;

create policy monetization_apps_owner_select on public.monetization_applications
  for select to authenticated
  using (subject_id = auth.uid() or public.verification_business_is_platform_admin());

create policy payout_profiles_owner_select on public.payout_profiles
  for select to authenticated
  using (owner_id = auth.uid() or public.verification_business_is_platform_admin());

create policy tax_profiles_owner_select on public.tax_profiles
  for select to authenticated
  using (owner_id = auth.uid() or public.verification_business_is_platform_admin());

create policy monetization_legal_select on public.monetization_legal_document_versions
  for select to authenticated using (true);

create policy monetization_acceptances_owner_select on public.monetization_agreement_acceptances
  for select to authenticated
  using (user_id = auth.uid() or public.verification_business_is_platform_admin());

create policy payout_schedules_owner_select on public.payout_schedules
  for select to authenticated
  using (
    exists (select 1 from public.monetization_accounts m where m.id = monetization_account_id and m.subject_id = auth.uid())
    or public.verification_business_is_platform_admin()
  );

create policy partner_balance_owner_select on public.partner_balance_snapshots
  for select to authenticated
  using (
    exists (select 1 from public.monetization_accounts m where m.id = monetization_account_id and m.subject_id = auth.uid())
    or public.verification_business_is_platform_admin()
  );

create policy ad_transparency_public_select on public.ad_transparency_archive
  for select to anon, authenticated using (true);

revoke all on function public.payout_prevent_mutation() from public, anon, authenticated;
revoke all on function public.payout_guard_monetization_write() from public, anon, authenticated;
revoke all on function public.payout_guard_profile_write() from public, anon, authenticated;
revoke all on function public.payout_guard_tax_write() from public, anon, authenticated;

revoke all on function public.create_monetization_application(text, text) from public, anon;
revoke all on function public.submit_monetization_application(uuid) from public, anon;
revoke all on function public.root_review_monetization_application(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.accept_monetization_agreement(uuid, text, text, text) from public, anon;
revoke all on function public.create_payout_profile(uuid, text, text, text, text) from public, anon;
revoke all on function public.create_tax_profile(uuid, text, text, text) from public, anon;
revoke all on function public.compute_partner_balance(uuid, text) from public, anon;
revoke all on function public.resolve_payout_eligibility(uuid, text) from public, anon;
revoke all on function public.preview_payout_batch(timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.create_payout_batch(timestamptz, timestamptz, text, text, text) from public, anon;
revoke all on function public.approve_payout_batch(uuid) from public, anon;
revoke all on function public.cancel_payout_batch(uuid) from public, anon;
revoke all on function public.root_toggle_payout_setting(text, boolean) from public, anon;
revoke all on function public.claim_payout_batch_for_processing(uuid) from public, anon;
revoke all on function public.payout_monetization_allows_accrual(uuid) from public, anon;
revoke all on function public.apply_provider_payout_account_state(text, text, text, text, text) from public, anon;
revoke all on function public.apply_provider_payout_item_event(text, text, text, text) from public, anon;
revoke all on function public.materialize_ad_transparency_archive(uuid) from public, anon;
revoke all on function public.get_public_ad_transparency_archive(integer) from public;

grant execute on function public.create_monetization_application(text, text) to authenticated;
grant execute on function public.submit_monetization_application(uuid) to authenticated;
grant execute on function public.root_review_monetization_application(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.accept_monetization_agreement(uuid, text, text, text) to authenticated;
grant execute on function public.create_payout_profile(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_tax_profile(uuid, text, text, text) to authenticated;
grant execute on function public.compute_partner_balance(uuid, text) to authenticated;
grant execute on function public.resolve_payout_eligibility(uuid, text) to authenticated;
grant execute on function public.preview_payout_batch(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.create_payout_batch(timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.approve_payout_batch(uuid) to authenticated;
grant execute on function public.cancel_payout_batch(uuid) to authenticated;
grant execute on function public.root_toggle_payout_setting(text, boolean) to authenticated;
grant execute on function public.claim_payout_batch_for_processing(uuid) to authenticated;
grant execute on function public.payout_monetization_allows_accrual(uuid) to authenticated;
grant execute on function public.apply_provider_payout_account_state(text, text, text, text, text) to authenticated;
grant execute on function public.apply_provider_payout_item_event(text, text, text, text) to authenticated;
grant execute on function public.materialize_ad_transparency_archive(uuid) to authenticated;
grant execute on function public.get_public_ad_transparency_archive(integer) to anon, authenticated;
grant execute on function public.payout_setting_bool(text, boolean) to authenticated;
grant execute on function public.is_finance_operator() to authenticated;
grant execute on function public.is_finance_approver() to authenticated;

commit;
