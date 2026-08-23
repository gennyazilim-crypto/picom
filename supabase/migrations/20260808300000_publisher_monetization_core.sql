-- TASK31: Publisher monetization core — extends verification-business foundations.
-- Provider-neutral. No payment credentials. Integer minor units only.

begin;

-- ---------------------------------------------------------------------------
-- Extend monetization_accounts (reuse; do not duplicate)
-- ---------------------------------------------------------------------------
alter table public.monetization_accounts
  add column if not exists eligibility_status text,
  add column if not exists provider text,
  add column if not exists provider_account_ref text,
  add column if not exists provider_environment text,
  add column if not exists payments_enabled boolean not null default false,
  add column if not exists payouts_enabled boolean not null default false,
  add column if not exists kyc_status text not null default 'not_started',
  add column if not exists default_currency text,
  add column if not exists tax_status text not null default 'unknown',
  add column if not exists tax_country text,
  add column if not exists vat_handling text,
  add column if not exists provider_tax_ref text,
  add column if not exists monetization_suspended_at timestamptz,
  add column if not exists terms_accepted_version text,
  add column if not exists terms_accepted_at timestamptz;

update public.monetization_accounts
set eligibility_status = case
  when monetization_status = 'not_eligible' then 'NOT_ELIGIBLE'
  when monetization_status = 'pending' then 'ELIGIBLE'
  when monetization_status = 'eligible' then 'ELIGIBLE'
  when monetization_status = 'active' and payments_enabled then 'PAYMENTS_ENABLED'
  when monetization_status = 'active' then 'ONBOARDING'
  when monetization_status = 'suspended' then 'SUSPENDED'
  when monetization_status = 'revoked' then 'NOT_ELIGIBLE'
  else coalesce(eligibility_status, 'NOT_ELIGIBLE')
end
where eligibility_status is null;

alter table public.monetization_accounts
  alter column eligibility_status set default 'NOT_ELIGIBLE';

alter table public.monetization_accounts
  alter column eligibility_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_eligibility_status_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_eligibility_status_check
      check (eligibility_status in (
        'NOT_ELIGIBLE', 'ELIGIBLE', 'ONBOARDING', 'PAYMENTS_ENABLED',
        'PAYMENTS_RESTRICTED', 'KYC_REQUIRED', 'PAYOUTS_DISABLED', 'SUSPENDED'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_provider_environment_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_provider_environment_check
      check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_kyc_status_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_kyc_status_check
      check (kyc_status in (
        'not_started', 'required', 'pending', 'verified', 'restricted', 'rejected', 'not_configured'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_default_currency_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_default_currency_check
      check (default_currency is null or default_currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_tax_status_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_tax_status_check
      check (tax_status in ('unknown', 'not_started', 'pending', 'verified', 'restricted', 'blocked'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monetization_accounts_tax_country_check'
  ) then
    alter table public.monetization_accounts
      add constraint monetization_accounts_tax_country_check
      check (tax_country is null or tax_country ~ '^[A-Z]{2}$');
  end if;
end $$;

comment on column public.monetization_accounts.eligibility_status is
  'Publisher monetization eligibility; distinct from badge/KYC/payout readiness.';
comment on column public.monetization_accounts.provider_account_ref is
  'Provider connected-account reference only; never credentials.';
comment on column public.monetization_accounts.payments_enabled is
  'True only after trusted provider/runtime certification; default false.';

-- ---------------------------------------------------------------------------
-- Fee / currency policy config (no invented public percentages)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_monetization_fee_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null check (char_length(btrim(policy_key)) between 2 and 80),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  source_type text not null check (source_type in ('subscription', 'donation', 'ad_revenue', 'adjustment')),
  platform_fee_bps integer check (platform_fee_bps is null or (platform_fee_bps >= 0 and platform_fee_bps <= 10000)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  min_amount_minor bigint check (min_amount_minor is null or min_amount_minor > 0),
  max_amount_minor bigint check (max_amount_minor is null or max_amount_minor > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'superseded', 'retired')),
  notes text,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  unique (policy_key, version),
  check (effective_until is null or effective_until > effective_from),
  check (
    min_amount_minor is null
    or max_amount_minor is null
    or max_amount_minor >= min_amount_minor
  )
);

comment on table public.publisher_monetization_fee_policies is
  'Canonical fee/limit policy versions. Public monetization stays OFF until an active policy is business-approved.';

-- ---------------------------------------------------------------------------
-- Subscription products (server-authoritative price)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_subscription_products (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  active boolean not null default false,
  benefits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(benefits) = 'object'),
  provider_product_ref text,
  provider_price_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  fee_policy_id uuid references public.publisher_monetization_fee_policies(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publisher_subscription_products_publisher_idx
  on public.publisher_subscription_products (publisher_user_id, active, created_at desc);

create trigger publisher_subscription_products_touch_updated_at
  before update on public.publisher_subscription_products
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  subscriber_user_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.publisher_subscription_products(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  status text not null default 'INCOMPLETE'
    check (status in (
      'INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE',
      'CANCEL_AT_PERIOD_END', 'CANCELLED', 'UNPAID', 'EXPIRED'
    )),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  provider text,
  provider_subscription_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  idempotency_key text,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (publisher_user_id <> subscriber_user_id)
);

create unique index if not exists publisher_subscriptions_idempotency_uidx
  on public.publisher_subscriptions (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists publisher_subscriptions_provider_ref_uidx
  on public.publisher_subscriptions (provider, provider_subscription_ref)
  where provider_subscription_ref is not null;

create index if not exists publisher_subscriptions_publisher_status_idx
  on public.publisher_subscriptions (publisher_user_id, status);

create index if not exists publisher_subscriptions_subscriber_status_idx
  on public.publisher_subscriptions (subscriber_user_id, status);

create trigger publisher_subscriptions_touch_updated_at
  before update on public.publisher_subscriptions
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Payment transactions (provider refs; no card data)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  payer_user_id uuid references public.profiles(id) on delete set null,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  source_type text not null check (source_type in ('subscription', 'donation', 'refund', 'chargeback', 'adjustment')),
  source_id uuid,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'CREATED'
    check (status in (
      'CREATED', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED',
      'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED', 'CHARGEBACK'
    )),
  provider text,
  provider_transaction_ref text,
  provider_event_id text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  idempotency_key text,
  correlation_id text not null check (char_length(btrim(correlation_id)) between 1 and 160),
  failure_code text,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_payment_transactions_idempotency_uidx
  on public.publisher_payment_transactions (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists publisher_payment_transactions_provider_ref_uidx
  on public.publisher_payment_transactions (provider, provider_transaction_ref)
  where provider_transaction_ref is not null;

create index if not exists publisher_payment_transactions_publisher_idx
  on public.publisher_payment_transactions (publisher_user_id, created_at desc);

create trigger publisher_payment_transactions_touch_updated_at
  before update on public.publisher_payment_transactions
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Donations / tips (one-time)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_donations (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  donor_user_id uuid references public.profiles(id) on delete set null,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  payment_transaction_id uuid references public.publisher_payment_transactions(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'CREATED'
    check (status in ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'DISPUTED')),
  message text check (message is null or char_length(message) <= 280),
  message_moderation_state text not null default 'PENDING'
    check (message_moderation_state in ('PENDING', 'VISIBLE', 'HIDDEN', 'REJECTED')),
  anonymous_display boolean not null default false,
  provider_payment_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  idempotency_key text,
  correlation_id text not null check (char_length(btrim(correlation_id)) between 1 and 160),
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_donations_idempotency_uidx
  on public.publisher_donations (idempotency_key)
  where idempotency_key is not null;

create index if not exists publisher_donations_publisher_idx
  on public.publisher_donations (publisher_user_id, created_at desc);

create trigger publisher_donations_touch_updated_at
  before update on public.publisher_donations
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Ad revenue attribution (trusted settlement input; no client-authored revenue)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_ad_revenue_attributions (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  stream_id uuid,
  ad_campaign_id text not null check (char_length(btrim(ad_campaign_id)) between 1 and 160),
  ad_delivery_id text check (ad_delivery_id is null or char_length(btrim(ad_delivery_id)) between 1 and 160),
  period_start timestamptz not null,
  period_end timestamptz not null,
  impressions_valid bigint not null default 0 check (impressions_valid >= 0),
  clicks_valid bigint not null default 0 check (clicks_valid >= 0),
  traffic_status text not null default 'PENDING_REVIEW'
    check (traffic_status in ('VALID', 'PENDING_REVIEW', 'INVALID', 'WITHHELD')),
  gross_revenue_minor bigint not null check (gross_revenue_minor >= 0),
  creator_share_minor bigint not null check (creator_share_minor >= 0),
  platform_share_minor bigint not null check (platform_share_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  applied_share_bps integer check (applied_share_bps is null or (applied_share_bps >= 0 and applied_share_bps <= 10000)),
  fee_policy_id uuid references public.publisher_monetization_fee_policies(id) on delete restrict,
  settlement_status text not null default 'PENDING'
    check (settlement_status in ('PENDING', 'SETTLED', 'WITHHELD', 'VOID')),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  correlation_id text not null check (char_length(btrim(correlation_id)) between 1 and 160),
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (creator_share_minor + platform_share_minor = gross_revenue_minor)
);

create unique index if not exists publisher_ad_revenue_attributions_idempotency_uidx
  on public.publisher_ad_revenue_attributions (idempotency_key);

create index if not exists publisher_ad_revenue_attributions_publisher_period_idx
  on public.publisher_ad_revenue_attributions (publisher_user_id, period_start desc);

create trigger publisher_ad_revenue_attributions_touch_updated_at
  before update on public.publisher_ad_revenue_attributions
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Eligibility helper (server-side)
-- ---------------------------------------------------------------------------
create or replace function public.compute_publisher_monetization_eligibility(target_publisher_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  account public.monetization_accounts%rowtype;
  account_active boolean := false;
begin
  if target_publisher_user_id is null then
    return 'NOT_ELIGIBLE';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = target_publisher_user_id
  ) into account_active;

  if not account_active then
    return 'NOT_ELIGIBLE';
  end if;

  select * into account
  from public.monetization_accounts
  where subject_id = target_publisher_user_id
    and program_type = 'publisher'
  order by updated_at desc
  limit 1;

  if not found then
    return 'NOT_ELIGIBLE';
  end if;

  if account.monetization_suspended_at is not null or account.monetization_status = 'suspended' then
    return 'SUSPENDED';
  end if;

  if account.monetization_status in ('not_eligible', 'revoked') then
    return 'NOT_ELIGIBLE';
  end if;

  if account.kyc_status in ('required', 'pending') and account.payments_enabled = false then
    return 'KYC_REQUIRED';
  end if;

  if account.payments_enabled = false and account.eligibility_status = 'PAYMENTS_RESTRICTED' then
    return 'PAYMENTS_RESTRICTED';
  end if;

  if account.payments_enabled then
    if account.payouts_enabled = false then
      return 'PAYOUTS_DISABLED';
    end if;
    return 'PAYMENTS_ENABLED';
  end if;

  if account.monetization_status = 'active' then
    return 'ONBOARDING';
  end if;

  if account.monetization_status in ('pending', 'eligible') then
    return 'ELIGIBLE';
  end if;

  return coalesce(account.eligibility_status, 'NOT_ELIGIBLE');
end;
$$;

revoke all on function public.compute_publisher_monetization_eligibility(uuid) from public, anon;
grant execute on function public.compute_publisher_monetization_eligibility(uuid) to authenticated, service_role;

commit;
