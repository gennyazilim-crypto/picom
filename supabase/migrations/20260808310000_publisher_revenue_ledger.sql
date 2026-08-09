-- TASK31: Immutable directional publisher finance ledger + trusted writers.
-- Accounting model: single-sided publisher ledger (gross credit + fee/refund/payout debits).
-- Period settlement table public.revenue_ledger remains for contract-period summaries.
-- Money: integer minor units only. No UPDATE/DELETE of economic fields.

begin;

create table if not exists public.publisher_finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'SUBSCRIPTION_GROSS',
    'SUBSCRIPTION_PLATFORM_FEE',
    'SUBSCRIPTION_PROVIDER_FEE',
    'SUBSCRIPTION_NET',
    'DONATION_GROSS',
    'DONATION_PLATFORM_FEE',
    'DONATION_PROVIDER_FEE',
    'DONATION_NET',
    'AD_REVENUE_GROSS',
    'AD_REVENUE_PLATFORM_SHARE',
    'AD_REVENUE_CREATOR_SHARE',
    'REFUND',
    'CHARGEBACK',
    'CHARGEBACK_REVERSAL',
    'PAYOUT',
    'PAYOUT_REVERSAL',
    'ADJUSTMENT'
  )),
  source_type text not null check (source_type in (
    'subscription', 'donation', 'ad_revenue', 'refund', 'chargeback', 'payout', 'adjustment', 'payment'
  )),
  source_id uuid,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('credit', 'debit')),
  -- balance_bucket: how this entry contributes to derived balances
  balance_bucket text not null check (balance_bucket in (
    'pending', 'available', 'paid', 'refunded_or_reversed', 'non_balance'
  )),
  status text not null default 'posted' check (status in ('posted')),
  available_at timestamptz,
  provider_transaction_ref text,
  provider_event_id text,
  correlation_id text not null check (char_length(btrim(correlation_id)) between 1 and 160),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  reversal_of_ledger_entry_id uuid references public.publisher_finance_ledger_entries(id) on delete restrict,
  fee_policy_id uuid references public.publisher_monetization_fee_policies(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  internal_test boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists publisher_finance_ledger_idempotency_uidx
  on public.publisher_finance_ledger_entries (idempotency_key);

create unique index if not exists publisher_finance_ledger_provider_event_uidx
  on public.publisher_finance_ledger_entries (provider_event_id)
  where provider_event_id is not null;

create index if not exists publisher_finance_ledger_publisher_created_idx
  on public.publisher_finance_ledger_entries (publisher_user_id, created_at desc);

create index if not exists publisher_finance_ledger_source_idx
  on public.publisher_finance_ledger_entries (source_type, source_id);

create index if not exists publisher_finance_ledger_provider_tx_idx
  on public.publisher_finance_ledger_entries (provider_transaction_ref)
  where provider_transaction_ref is not null;

comment on table public.publisher_finance_ledger_entries is
  'Append-only directional publisher revenue ledger. Corrections via compensating entries only.';

create or replace function public.publisher_finance_prevent_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'PUBLISHER_FINANCE_LEDGER_APPEND_ONLY' using errcode = '55000';
end;
$$;

drop trigger if exists publisher_finance_prevent_ledger_mutation on public.publisher_finance_ledger_entries;
create trigger publisher_finance_prevent_ledger_mutation
  before update or delete on public.publisher_finance_ledger_entries
  for each row execute function public.publisher_finance_prevent_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Finance audit (append-oriented)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'MONETIZATION_ACCOUNT_CREATED',
    'MONETIZATION_STATUS_CHANGED',
    'SUBSCRIPTION_PRODUCT_CREATED',
    'SUBSCRIPTION_PRODUCT_UPDATED',
    'SUBSCRIPTION_CANCEL_REQUESTED',
    'DONATION_PAYMENT_CREATED',
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'REVENUE_RECORDED',
    'REFUND_RECORDED',
    'CHARGEBACK_RECORDED',
    'AD_REVENUE_SETTLED',
    'FINANCE_ADJUSTMENT_CREATED'
  )),
  actor_user_id uuid references public.profiles(id) on delete set null,
  publisher_user_id uuid references public.profiles(id) on delete set null,
  economic_reference_type text,
  economic_reference_id uuid,
  correlation_id text check (correlation_id is null or char_length(btrim(correlation_id)) between 1 and 160),
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists publisher_finance_audit_publisher_idx
  on public.publisher_finance_audit_events (publisher_user_id, created_at desc);

create or replace function public.publisher_finance_prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'PUBLISHER_FINANCE_AUDIT_APPEND_ONLY' using errcode = '55000';
end;
$$;

drop trigger if exists publisher_finance_prevent_audit_mutation on public.publisher_finance_audit_events;
create trigger publisher_finance_prevent_audit_mutation
  before update or delete on public.publisher_finance_audit_events
  for each row execute function public.publisher_finance_prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- Dead-letter / quarantine for unreconciliationable provider events
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_finance_event_failures (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) between 2 and 80),
  provider_event_ref text not null check (char_length(btrim(provider_event_ref)) between 1 and 240),
  event_type text,
  error_code text not null check (char_length(btrim(error_code)) between 2 and 120),
  attempts integer not null default 1 check (attempts >= 0 and attempts <= 100),
  next_retry_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'retrying', 'resolved', 'dead')),
  safe_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(safe_context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_ref, error_code)
);

create trigger publisher_finance_event_failures_touch_updated_at
  before update on public.publisher_finance_event_failures
  for each row execute function public.verification_business_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Internal insert helper (service only)
-- ---------------------------------------------------------------------------
create or replace function public._publisher_finance_insert_ledger_entry(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_entry_type text,
  p_source_type text,
  p_source_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_direction text,
  p_balance_bucket text,
  p_available_at timestamptz,
  p_provider_transaction_ref text,
  p_provider_event_id text,
  p_correlation_id text,
  p_idempotency_key text,
  p_reversal_of uuid,
  p_fee_policy_id uuid,
  p_metadata jsonb,
  p_internal_test boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing uuid;
  inserted uuid;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'INVALID_AMOUNT_MINOR' using errcode = '22023';
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY' using errcode = '22023';
  end if;

  select id into existing
  from public.publisher_finance_ledger_entries
  where idempotency_key = p_idempotency_key;

  if existing is not null then
    return existing;
  end if;

  insert into public.publisher_finance_ledger_entries (
    publisher_user_id,
    monetization_account_id,
    entry_type,
    source_type,
    source_id,
    amount_minor,
    currency,
    direction,
    balance_bucket,
    available_at,
    provider_transaction_ref,
    provider_event_id,
    correlation_id,
    idempotency_key,
    reversal_of_ledger_entry_id,
    fee_policy_id,
    metadata,
    internal_test
  ) values (
    p_publisher_user_id,
    p_monetization_account_id,
    p_entry_type,
    p_source_type,
    p_source_id,
    p_amount_minor,
    upper(p_currency),
    p_direction,
    p_balance_bucket,
    p_available_at,
    p_provider_transaction_ref,
    p_provider_event_id,
    p_correlation_id,
    p_idempotency_key,
    p_reversal_of,
    p_fee_policy_id,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_internal_test, false)
  )
  on conflict (idempotency_key) do nothing
  returning id into inserted;

  if inserted is null then
    select id into inserted
    from public.publisher_finance_ledger_entries
    where idempotency_key = p_idempotency_key;
  end if;

  return inserted;
end;
$$;

revoke all on function public._publisher_finance_insert_ledger_entry(
  uuid, uuid, text, text, uuid, bigint, text, text, text, timestamptz, text, text, text, text, uuid, uuid, jsonb, boolean
) from public, anon, authenticated;

-- Record subscription revenue: GROSS credit + platform/provider fee debits (balance-affecting).
-- Caller must supply authoritative amounts (never trust client). Fees may be 0 if unknown/not configured.
create or replace function public.service_record_subscription_revenue(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_subscription_id uuid,
  p_gross_minor bigint,
  p_platform_fee_minor bigint,
  p_provider_fee_minor bigint,
  p_currency text,
  p_available_at timestamptz,
  p_provider_transaction_ref text,
  p_provider_event_id text,
  p_correlation_id text,
  p_idempotency_key text,
  p_fee_policy_id uuid default null,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  net_minor bigint;
  gross_id uuid;
  platform_id uuid;
  provider_id uuid;
  net_id uuid;
  base_key text;
begin
  if p_gross_minor is null or p_gross_minor <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_GROSS');
  end if;
  if coalesce(p_platform_fee_minor, 0) < 0 or coalesce(p_provider_fee_minor, 0) < 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_FEE');
  end if;
  net_minor := p_gross_minor - coalesce(p_platform_fee_minor, 0) - coalesce(p_provider_fee_minor, 0);
  if net_minor < 0 then
    return jsonb_build_object('ok', false, 'error', 'FEE_EXCEEDS_GROSS');
  end if;

  base_key := p_idempotency_key;

  gross_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, p_monetization_account_id,
    'SUBSCRIPTION_GROSS', 'subscription', p_subscription_id,
    p_gross_minor, p_currency, 'credit', 'non_balance',
    p_available_at, p_provider_transaction_ref, p_provider_event_id,
    p_correlation_id, base_key || ':gross', null, p_fee_policy_id,
    jsonb_build_object('role', 'gross'), p_internal_test
  );

  if coalesce(p_platform_fee_minor, 0) > 0 then
    platform_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'SUBSCRIPTION_PLATFORM_FEE', 'subscription', p_subscription_id,
      p_platform_fee_minor, p_currency, 'debit', 'non_balance',
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':platform_fee', null, p_fee_policy_id,
      jsonb_build_object('role', 'platform_fee'), p_internal_test
    );
  end if;

  if coalesce(p_provider_fee_minor, 0) > 0 then
    provider_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'SUBSCRIPTION_PROVIDER_FEE', 'subscription', p_subscription_id,
      p_provider_fee_minor, p_currency, 'debit', 'non_balance',
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':provider_fee', null, p_fee_policy_id,
      jsonb_build_object('role', 'provider_fee'), p_internal_test
    );
  end if;

  if net_minor > 0 then
    net_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'SUBSCRIPTION_NET', 'subscription', p_subscription_id,
      net_minor, p_currency, 'credit',
      case when p_available_at is not null and p_available_at > now() then 'pending' else 'available' end,
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':net', null, p_fee_policy_id,
      jsonb_build_object('role', 'net', 'gross_minor', p_gross_minor), p_internal_test
    );
  end if;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'REVENUE_RECORDED', p_publisher_user_id, 'subscription', p_subscription_id, p_correlation_id,
    jsonb_build_object(
      'gross_minor', p_gross_minor,
      'platform_fee_minor', coalesce(p_platform_fee_minor, 0),
      'provider_fee_minor', coalesce(p_provider_fee_minor, 0),
      'net_minor', net_minor,
      'currency', upper(p_currency),
      'internal_test', coalesce(p_internal_test, false)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'gross_entry_id', gross_id,
    'platform_fee_entry_id', platform_id,
    'provider_fee_entry_id', provider_id,
    'net_entry_id', net_id,
    'net_minor', net_minor
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

create or replace function public.service_record_donation_revenue(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_donation_id uuid,
  p_gross_minor bigint,
  p_platform_fee_minor bigint,
  p_provider_fee_minor bigint,
  p_currency text,
  p_available_at timestamptz,
  p_provider_transaction_ref text,
  p_provider_event_id text,
  p_correlation_id text,
  p_idempotency_key text,
  p_fee_policy_id uuid default null,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  net_minor bigint;
  gross_id uuid;
  platform_id uuid;
  provider_id uuid;
  net_id uuid;
  base_key text := p_idempotency_key;
begin
  if p_gross_minor is null or p_gross_minor <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_GROSS');
  end if;
  net_minor := p_gross_minor - coalesce(p_platform_fee_minor, 0) - coalesce(p_provider_fee_minor, 0);
  if net_minor < 0 then
    return jsonb_build_object('ok', false, 'error', 'FEE_EXCEEDS_GROSS');
  end if;

  gross_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, p_monetization_account_id,
    'DONATION_GROSS', 'donation', p_donation_id,
    p_gross_minor, p_currency, 'credit', 'non_balance',
    p_available_at, p_provider_transaction_ref, p_provider_event_id,
    p_correlation_id, base_key || ':gross', null, p_fee_policy_id,
    jsonb_build_object('role', 'gross'), p_internal_test
  );

  if coalesce(p_platform_fee_minor, 0) > 0 then
    platform_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'DONATION_PLATFORM_FEE', 'donation', p_donation_id,
      p_platform_fee_minor, p_currency, 'debit', 'non_balance',
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':platform_fee', null, p_fee_policy_id,
      jsonb_build_object('role', 'platform_fee'), p_internal_test
    );
  end if;

  if coalesce(p_provider_fee_minor, 0) > 0 then
    provider_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'DONATION_PROVIDER_FEE', 'donation', p_donation_id,
      p_provider_fee_minor, p_currency, 'debit', 'non_balance',
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':provider_fee', null, p_fee_policy_id,
      jsonb_build_object('role', 'provider_fee'), p_internal_test
    );
  end if;

  if net_minor > 0 then
    net_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'DONATION_NET', 'donation', p_donation_id,
      net_minor, p_currency, 'credit',
      case when p_available_at is not null and p_available_at > now() then 'pending' else 'available' end,
      p_available_at, p_provider_transaction_ref, null,
      p_correlation_id, base_key || ':net', null, p_fee_policy_id,
      jsonb_build_object('role', 'net'), p_internal_test
    );
  end if;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'REVENUE_RECORDED', p_publisher_user_id, 'donation', p_donation_id, p_correlation_id,
    jsonb_build_object('gross_minor', p_gross_minor, 'net_minor', net_minor, 'currency', upper(p_currency), 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'net_entry_id', net_id, 'net_minor', net_minor, 'gross_entry_id', gross_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

create or replace function public.service_record_ad_revenue(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_attribution_id uuid,
  p_gross_minor bigint,
  p_platform_share_minor bigint,
  p_creator_share_minor bigint,
  p_currency text,
  p_available_at timestamptz,
  p_correlation_id text,
  p_idempotency_key text,
  p_fee_policy_id uuid default null,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  gross_id uuid;
  platform_id uuid;
  creator_id uuid;
  base_key text := p_idempotency_key;
begin
  if p_gross_minor is null or p_gross_minor < 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_GROSS');
  end if;
  if coalesce(p_platform_share_minor, 0) + coalesce(p_creator_share_minor, 0) <> p_gross_minor then
    return jsonb_build_object('ok', false, 'error', 'SHARE_MISMATCH');
  end if;
  if p_gross_minor = 0 then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'ZERO_GROSS');
  end if;

  gross_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, p_monetization_account_id,
    'AD_REVENUE_GROSS', 'ad_revenue', p_attribution_id,
    p_gross_minor, p_currency, 'credit', 'non_balance',
    p_available_at, null, null,
    p_correlation_id, base_key || ':gross', null, p_fee_policy_id,
    jsonb_build_object('role', 'gross'), p_internal_test
  );

  if coalesce(p_platform_share_minor, 0) > 0 then
    platform_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'AD_REVENUE_PLATFORM_SHARE', 'ad_revenue', p_attribution_id,
      p_platform_share_minor, p_currency, 'debit', 'non_balance',
      p_available_at, null, null,
      p_correlation_id, base_key || ':platform', null, p_fee_policy_id,
      jsonb_build_object('role', 'platform_share'), p_internal_test
    );
  end if;

  if coalesce(p_creator_share_minor, 0) > 0 then
    creator_id := public._publisher_finance_insert_ledger_entry(
      p_publisher_user_id, p_monetization_account_id,
      'AD_REVENUE_CREATOR_SHARE', 'ad_revenue', p_attribution_id,
      p_creator_share_minor, p_currency, 'credit',
      case when p_available_at is not null and p_available_at > now() then 'pending' else 'available' end,
      p_available_at, null, null,
      p_correlation_id, base_key || ':creator', null, p_fee_policy_id,
      jsonb_build_object('role', 'creator_share'), p_internal_test
    );
  end if;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'AD_REVENUE_SETTLED', p_publisher_user_id, 'ad_revenue', p_attribution_id, p_correlation_id,
    jsonb_build_object('gross_minor', p_gross_minor, 'creator_share_minor', p_creator_share_minor, 'currency', upper(p_currency), 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'creator_entry_id', creator_id, 'gross_entry_id', gross_id, 'platform_entry_id', platform_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

-- Refund reverses publisher NET only (provider fee refund behavior unknown / not assumed).
create or replace function public.service_record_refund(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_publisher_net_reversal_minor bigint,
  p_currency text,
  p_reversal_of_ledger_entry_id uuid,
  p_provider_transaction_ref text,
  p_provider_event_id text,
  p_correlation_id text,
  p_idempotency_key text,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry_id uuid;
begin
  if p_publisher_net_reversal_minor is null or p_publisher_net_reversal_minor <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  end if;

  entry_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, p_monetization_account_id,
    'REFUND', coalesce(p_source_type, 'refund'), p_source_id,
    p_publisher_net_reversal_minor, p_currency, 'debit', 'refunded_or_reversed',
    now(), p_provider_transaction_ref, p_provider_event_id,
    p_correlation_id, p_idempotency_key, p_reversal_of_ledger_entry_id, null,
    jsonb_build_object('role', 'refund_net'), p_internal_test
  );

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'REFUND_RECORDED', p_publisher_user_id, p_source_type, p_source_id, p_correlation_id,
    jsonb_build_object('amount_minor', p_publisher_net_reversal_minor, 'currency', upper(p_currency), 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'entry_id', entry_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

create or replace function public.service_record_chargeback(
  p_publisher_user_id uuid,
  p_monetization_account_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_publisher_net_reversal_minor bigint,
  p_currency text,
  p_reversal_of_ledger_entry_id uuid,
  p_provider_transaction_ref text,
  p_provider_event_id text,
  p_correlation_id text,
  p_idempotency_key text,
  p_dispute_status text default 'open',
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry_id uuid;
begin
  if p_publisher_net_reversal_minor is null or p_publisher_net_reversal_minor <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  end if;

  entry_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, p_monetization_account_id,
    'CHARGEBACK', coalesce(p_source_type, 'chargeback'), p_source_id,
    p_publisher_net_reversal_minor, p_currency, 'debit', 'refunded_or_reversed',
    now(), p_provider_transaction_ref, p_provider_event_id,
    p_correlation_id, p_idempotency_key, p_reversal_of_ledger_entry_id, null,
    jsonb_build_object('role', 'chargeback_net', 'dispute_status', coalesce(p_dispute_status, 'open')),
    p_internal_test
  );

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'CHARGEBACK_RECORDED', p_publisher_user_id, p_source_type, p_source_id, p_correlation_id,
    jsonb_build_object('amount_minor', p_publisher_net_reversal_minor, 'currency', upper(p_currency), 'dispute_status', coalesce(p_dispute_status, 'open'), 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'entry_id', entry_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

-- Root/finance manual adjustment — creates ledger row; never edits history.
create or replace function public.root_create_publisher_finance_adjustment(
  p_publisher_user_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_direction text,
  p_reason text,
  p_ticket_reference text,
  p_idempotency_key text,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_id uuid;
  entry_id uuid;
  actor uuid := auth.uid();
begin
  perform public.assert_root_dashboard_permission('finance.write');

  if p_amount_minor is null or p_amount_minor <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  end if;
  if p_direction not in ('credit', 'debit') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_DIRECTION');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;
  if p_ticket_reference is null or char_length(btrim(p_ticket_reference)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'TICKET_REQUIRED');
  end if;

  select id into account_id
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc
  limit 1;

  if account_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  entry_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, account_id,
    'ADJUSTMENT', 'adjustment', null,
    p_amount_minor, p_currency, p_direction, 'available',
    now(), null, null,
    'adj:' || p_idempotency_key, p_idempotency_key, null, null,
    jsonb_build_object('ticket', p_ticket_reference, 'reason', btrim(p_reason)),
    p_internal_test
  );

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, reason, metadata
  ) values (
    'FINANCE_ADJUSTMENT_CREATED', actor, p_publisher_user_id, 'ledger_entry', entry_id, 'adj:' || p_idempotency_key, btrim(p_reason),
    jsonb_build_object('ticket', p_ticket_reference, 'amount_minor', p_amount_minor, 'direction', p_direction, 'currency', upper(p_currency))
  );

  return jsonb_build_object('ok', true, 'entry_id', entry_id);
end;
$$;

revoke all on function public.service_record_subscription_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.service_record_donation_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.service_record_ad_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.service_record_refund(uuid, uuid, text, uuid, bigint, text, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.service_record_chargeback(uuid, uuid, text, uuid, bigint, text, uuid, text, text, text, text, text, boolean) from public, anon, authenticated;

grant execute on function public.service_record_subscription_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, text, text, uuid, boolean) to service_role;
grant execute on function public.service_record_donation_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, text, text, uuid, boolean) to service_role;
grant execute on function public.service_record_ad_revenue(uuid, uuid, uuid, bigint, bigint, bigint, text, timestamptz, text, text, uuid, boolean) to service_role;
grant execute on function public.service_record_refund(uuid, uuid, text, uuid, bigint, text, uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.service_record_chargeback(uuid, uuid, text, uuid, bigint, text, uuid, text, text, text, text, text, boolean) to service_role;

revoke all on function public.root_create_publisher_finance_adjustment(uuid, bigint, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.root_create_publisher_finance_adjustment(uuid, bigint, text, text, text, text, text, boolean) to authenticated, service_role;

commit;
