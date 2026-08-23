-- TASK32: Payout engine — eligibility, requests, batches, ledger reserve/pay/fail/reverse.

begin;

-- Extend ledger entry types for reservation/release
alter table public.publisher_finance_ledger_entries
  drop constraint if exists publisher_finance_ledger_entries_entry_type_check;

alter table public.publisher_finance_ledger_entries
  add constraint publisher_finance_ledger_entries_entry_type_check
  check (entry_type in (
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
    'PAYOUT_RESERVED',
    'PAYOUT_RELEASED',
    'PAYOUT_REVERSAL',
    'ADJUSTMENT'
  ));

create table if not exists public.publisher_payout_batches (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  provider_batch_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publisher_payout_batches_status_idx
  on public.publisher_payout_batches (status, created_at desc);

create trigger publisher_payout_batches_touch_updated_at
  before update on public.publisher_payout_batches
  for each row execute function public.verification_business_touch_updated_at();

create table if not exists public.publisher_payout_requests (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  payout_account_id uuid references public.publisher_payout_accounts(id) on delete restrict,
  batch_id uuid references public.publisher_payout_batches(id) on delete set null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  requested_amount_minor bigint not null check (requested_amount_minor > 0),
  status text not null default 'REQUESTED'
    check (status in (
      'REQUESTED', 'REVIEW_REQUIRED', 'APPROVED', 'PROCESSING',
      'PAID', 'FAILED', 'CANCELLED', 'REVERSED'
    )),
  provider text,
  provider_payout_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  reserve_ledger_entry_id uuid references public.publisher_finance_ledger_entries(id) on delete restrict,
  paid_ledger_entry_id uuid references public.publisher_finance_ledger_entries(id) on delete restrict,
  failure_code text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  reversed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 20),
  locked_at timestamptz,
  locked_by text,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create unique index if not exists publisher_payout_requests_provider_ref_uidx
  on public.publisher_payout_requests (provider, provider_payout_ref)
  where provider_payout_ref is not null;

create index if not exists publisher_payout_requests_publisher_idx
  on public.publisher_payout_requests (publisher_user_id, created_at desc);

create index if not exists publisher_payout_requests_status_idx
  on public.publisher_payout_requests (status, created_at);

create index if not exists publisher_payout_requests_claim_idx
  on public.publisher_payout_requests (status, locked_at)
  where status in ('APPROVED', 'PROCESSING');

create trigger publisher_payout_requests_touch_updated_at
  before update on public.publisher_payout_requests
  for each row execute function public.verification_business_touch_updated_at();

-- Available balance helper (excludes internal_test unless requested)
create or replace function public._publisher_available_balance_minor(
  p_publisher_user_id uuid,
  p_currency text,
  p_include_internal_test boolean default false
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    case
      when e.balance_bucket = 'available'
        or (e.balance_bucket = 'pending' and e.available_at is not null and e.available_at <= now())
      then public._publisher_finance_signed_amount(e.direction, e.amount_minor)
      else 0
    end
  ), 0)::bigint
  from public.publisher_finance_ledger_entries e
  where e.publisher_user_id = p_publisher_user_id
    and e.currency = upper(p_currency)
    and (p_include_internal_test or e.internal_test = false);
$$;

create or replace function public.evaluate_publisher_payout_eligibility(
  p_publisher_user_id uuid,
  p_currency text,
  p_amount_minor bigint default null,
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  account public.monetization_accounts%rowtype;
  kyc public.publisher_kyc_profiles%rowtype;
  tax public.publisher_tax_profiles%rowtype;
  dest public.publisher_payout_accounts%rowtype;
  policy public.publisher_payout_policies%rowtype;
  available bigint;
  reasons text[] := array[]::text[];
  eligible boolean := true;
  active_hold boolean := false;
begin
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object('ok', false, 'eligible', false, 'reasons', jsonb_build_array('INVALID_CURRENCY'));
  end if;

  select * into account
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'eligible', false, 'reasons', jsonb_build_array('MONETIZATION_ACCOUNT_MISSING'));
  end if;

  if account.monetization_status in ('suspended', 'revoked', 'not_eligible')
     or account.monetization_suspended_at is not null then
    eligible := false;
    reasons := array_append(reasons, 'MONETIZATION_SUSPENDED');
  end if;

  if coalesce(account.payouts_enabled, false) = false then
    eligible := false;
    reasons := array_append(reasons, 'PAYOUTS_DISABLED');
  end if;

  select * into kyc from public.publisher_kyc_profiles
  where publisher_user_id = p_publisher_user_id
    and (p_include_internal_test or internal_test = false);
  if not found or kyc.status <> 'VERIFIED' then
    eligible := false;
    reasons := array_append(reasons, 'KYC_NOT_VERIFIED');
  end if;

  select * into tax from public.publisher_tax_profiles
  where publisher_user_id = p_publisher_user_id
    and (p_include_internal_test or internal_test = false);
  if not found or tax.tax_status not in ('VERIFIED', 'INCOMPLETE', 'PENDING') then
    -- Tax engine not certified: require profile presence but do not invent VERIFIED gate alone.
    if not found then
      eligible := false;
      reasons := array_append(reasons, 'TAX_PROFILE_MISSING');
    end if;
  end if;
  if found and tax.tax_status in ('RESTRICTED', 'BLOCKED') then
    eligible := false;
    reasons := array_append(reasons, 'TAX_RESTRICTED');
  end if;

  select * into dest from public.publisher_payout_accounts
  where publisher_user_id = p_publisher_user_id
    and currency = upper(p_currency)
    and status = 'VERIFIED'
    and disabled_at is null
    and (p_include_internal_test or internal_test = false)
  order by is_default desc, updated_at desc
  limit 1;
  if not found then
    eligible := false;
    reasons := array_append(reasons, 'PAYOUT_ACCOUNT_NOT_VERIFIED');
  end if;

  select exists (
    select 1 from public.publisher_payout_holds h
    where h.publisher_user_id = p_publisher_user_id
      and h.released_at is null
      and (p_include_internal_test or h.internal_test = false)
  ) into active_hold;
  if active_hold then
    eligible := false;
    reasons := array_append(reasons, 'PAYOUT_HOLD_ACTIVE');
  end if;

  available := public._publisher_available_balance_minor(p_publisher_user_id, p_currency, p_include_internal_test);
  if available <= 0 then
    eligible := false;
    reasons := array_append(reasons, 'INSUFFICIENT_AVAILABLE_BALANCE');
  end if;

  select * into policy
  from public.publisher_payout_policies
  where status = 'active'
    and (currency is null or currency = upper(p_currency))
  order by created_at desc
  limit 1;

  if not found then
    eligible := false;
    reasons := array_append(reasons, 'PAYOUT_MINIMUM_NOT_CONFIGURED');
  elsif policy.minimum_payout_amount_minor is not null
        and p_amount_minor is not null
        and p_amount_minor < policy.minimum_payout_amount_minor then
    eligible := false;
    reasons := array_append(reasons, 'BELOW_MINIMUM_PAYOUT');
  elsif policy.minimum_payout_amount_minor is not null
        and available < policy.minimum_payout_amount_minor then
    eligible := false;
    reasons := array_append(reasons, 'BELOW_MINIMUM_PAYOUT');
  end if;

  if p_amount_minor is not null then
    if p_amount_minor <= 0 then
      eligible := false;
      reasons := array_append(reasons, 'INVALID_AMOUNT');
    elsif p_amount_minor > available then
      eligible := false;
      reasons := array_append(reasons, 'AMOUNT_EXCEEDS_AVAILABLE');
    end if;
  end if;

  -- Provider capability gate (no credentials => not eligible for public payout)
  reasons := array_append(reasons, 'PAYOUT_PROVIDER_NOT_CONFIGURED');
  eligible := false;

  return jsonb_build_object(
    'ok', true,
    'eligible', eligible,
    'available_balance_minor', available,
    'currency', upper(p_currency),
    'payout_account_id', dest.id,
    'minimum_payout_amount_minor', policy.minimum_payout_amount_minor,
    'reasons', to_jsonb(reasons),
    'provider_runtime', 'BLOCKED_PROVIDER_CONFIGURATION'
  );
end;
$$;

revoke all on function public.evaluate_publisher_payout_eligibility(uuid, text, bigint, boolean) from public, anon;
grant execute on function public.evaluate_publisher_payout_eligibility(uuid, text, bigint, boolean) to authenticated, service_role;

-- Request payout (manual). Reserves funds transactionally. Provider submit remains blocked without credentials.
create or replace function public.request_publisher_payout(
  p_currency text,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  acct_id uuid;
  elig jsonb;
  available bigint;
  dest_id uuid;
  existing uuid;
  req_id uuid;
  reserve_id uuid;
  corr text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if coalesce(p_include_internal_test, false) and auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'INTERNAL_TEST_FORBIDDEN');
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  end if;

  select id into existing from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
  if existing is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', existing);
  end if;

  -- Lock monetization account row to serialize concurrent payouts for this publisher.
  select id into acct_id
  from public.monetization_accounts
  where subject_id = actor and program_type = 'publisher'
  order by updated_at desc
  limit 1
  for update;

  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  -- Also lock existing open payout requests for race safety
  perform 1
  from public.publisher_payout_requests
  where publisher_user_id = actor
    and currency = upper(p_currency)
    and status in ('REQUESTED', 'REVIEW_REQUIRED', 'APPROVED', 'PROCESSING')
  for update;

  elig := public.evaluate_publisher_payout_eligibility(actor, upper(p_currency), p_amount_minor, p_include_internal_test);

  -- For internal_test fixtures, allow reservation path without live provider when explicitly flagged
  -- and other economic gates pass (used for race/idempotency certification only).
  if p_include_internal_test then
    available := public._publisher_available_balance_minor(actor, upper(p_currency), true);
    if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > available then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_AVAILABLE_BALANCE', 'available', available);
    end if;
  else
    -- Public path remains fail-closed on provider + eligibility
    if coalesce((elig->>'eligible')::boolean, false) = false then
      return jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE', 'eligibility', elig);
    end if;
    available := (elig->>'available_balance_minor')::bigint;
  end if;

  dest_id := nullif(elig->>'payout_account_id', '')::uuid;

  corr := 'payout:' || p_idempotency_key;

  insert into public.publisher_payout_requests (
    publisher_user_id, monetization_account_id, payout_account_id, currency,
    requested_amount_minor, status, idempotency_key, internal_test
  ) values (
    actor, acct_id, dest_id, upper(p_currency),
    p_amount_minor,
    case when p_include_internal_test then 'APPROVED' else 'REVIEW_REQUIRED' end,
    p_idempotency_key,
    coalesce(p_include_internal_test, false)
  )
  on conflict (idempotency_key) do nothing
  returning id into req_id;

  if req_id is null then
    select id into req_id from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', req_id);
  end if;

  reserve_id := public._publisher_finance_insert_ledger_entry(
    actor, acct_id,
    'PAYOUT_RESERVED', 'payout', req_id,
    p_amount_minor, upper(p_currency), 'debit', 'available',
    now(), null, null,
    corr, p_idempotency_key || ':reserve', null, null,
    jsonb_build_object('role', 'payout_reserve'),
    coalesce(p_include_internal_test, false)
  );

  update public.publisher_payout_requests
  set reserve_ledger_entry_id = reserve_id,
      approved_at = case when p_include_internal_test then now() else null end,
      updated_at = now()
  where id = req_id;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_REQUESTED', actor, actor, 'payout_request', req_id, corr,
    jsonb_build_object(
      'amount_minor', p_amount_minor,
      'currency', upper(p_currency),
      'internal_test', coalesce(p_include_internal_test, false)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', req_id,
    'status', case when p_include_internal_test then 'APPROVED' else 'REVIEW_REQUIRED' end,
    'reserve_ledger_entry_id', reserve_id,
    'provider_submit', 'BLOCKED_PROVIDER_CONFIGURATION'
  );
exception
  when unique_violation then
    select id into existing from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', existing);
end;
$$;

revoke all on function public.request_publisher_payout(text, bigint, text, boolean) from public, anon;
grant execute on function public.request_publisher_payout(text, bigint, text, boolean) to authenticated, service_role;

-- Mark paid (provider webhook / service only). Does not restore reserved available; adds paid bucket debit.
create or replace function public.service_mark_publisher_payout_paid(
  p_request_id uuid,
  p_provider_payout_ref text,
  p_provider_event_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.publisher_payout_requests%rowtype;
  paid_id uuid;
begin
  select * into req from public.publisher_payout_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if req.status = 'PAID' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', req.id);
  end if;
  if req.status not in ('APPROVED', 'PROCESSING', 'REVIEW_REQUIRED') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'status', req.status);
  end if;

  paid_id := public._publisher_finance_insert_ledger_entry(
    req.publisher_user_id, req.monetization_account_id,
    'PAYOUT', 'payout', req.id,
    req.requested_amount_minor, req.currency, 'debit', 'paid',
    now(), p_provider_payout_ref, p_provider_event_id,
    'payout-paid:' || req.id::text, p_idempotency_key || ':paid', null, null,
    jsonb_build_object('role', 'payout_paid'), req.internal_test
  );

  update public.publisher_payout_requests
  set status = 'PAID',
      provider_payout_ref = coalesce(provider_payout_ref, p_provider_payout_ref),
      paid_ledger_entry_id = paid_id,
      paid_at = now(),
      processing_at = coalesce(processing_at, now()),
      updated_at = now()
  where id = req.id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_PAID', req.publisher_user_id, 'payout_request', req.id, 'payout-paid:' || req.id::text,
    jsonb_build_object('amount_minor', req.requested_amount_minor, 'currency', req.currency, 'internal_test', req.internal_test)
  );

  return jsonb_build_object('ok', true, 'request_id', req.id, 'paid_ledger_entry_id', paid_id);
end;
$$;

create or replace function public.service_mark_publisher_payout_failed(
  p_request_id uuid,
  p_failure_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.publisher_payout_requests%rowtype;
  release_id uuid;
begin
  select * into req from public.publisher_payout_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if req.status in ('FAILED', 'CANCELLED') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if req.status = 'PAID' then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
  end if;

  if req.reserve_ledger_entry_id is not null then
    release_id := public._publisher_finance_insert_ledger_entry(
      req.publisher_user_id, req.monetization_account_id,
      'PAYOUT_RELEASED', 'payout', req.id,
      req.requested_amount_minor, req.currency, 'credit', 'available',
      now(), null, null,
      'payout-fail:' || req.id::text, p_idempotency_key || ':release', req.reserve_ledger_entry_id, null,
      jsonb_build_object('role', 'payout_release', 'failure_code', p_failure_code), req.internal_test
    );
  end if;

  update public.publisher_payout_requests
  set status = 'FAILED',
      failure_code = left(coalesce(p_failure_code, 'PROVIDER_FAILED'), 120),
      failed_at = now(),
      updated_at = now()
  where id = req.id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_FAILED', req.publisher_user_id, 'payout_request', req.id, 'payout-fail:' || req.id::text,
    jsonb_build_object('failure_code', p_failure_code, 'internal_test', req.internal_test)
  );

  return jsonb_build_object('ok', true, 'release_ledger_entry_id', release_id);
end;
$$;

create or replace function public.service_mark_publisher_payout_reversed(
  p_request_id uuid,
  p_provider_event_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.publisher_payout_requests%rowtype;
  rev_id uuid;
begin
  select * into req from public.publisher_payout_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if req.status = 'REVERSED' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if req.status <> 'PAID' then
    return jsonb_build_object('ok', false, 'error', 'NOT_PAID');
  end if;

  -- Compensating: credit available (restore liability to platform/publisher available)
  rev_id := public._publisher_finance_insert_ledger_entry(
    req.publisher_user_id, req.monetization_account_id,
    'PAYOUT_REVERSAL', 'payout', req.id,
    req.requested_amount_minor, req.currency, 'credit', 'available',
    now(), req.provider_payout_ref, p_provider_event_id,
    'payout-rev:' || req.id::text, p_idempotency_key || ':reversal', req.paid_ledger_entry_id, null,
    jsonb_build_object('role', 'payout_reversal'), req.internal_test
  );

  update public.publisher_payout_requests
  set status = 'REVERSED', reversed_at = now(), updated_at = now()
  where id = req.id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_REVERSED', req.publisher_user_id, 'payout_request', req.id, 'payout-rev:' || req.id::text,
    jsonb_build_object('amount_minor', req.requested_amount_minor, 'currency', req.currency, 'internal_test', req.internal_test)
  );

  return jsonb_build_object('ok', true, 'reversal_ledger_entry_id', rev_id);
end;
$$;

revoke all on function public.service_mark_publisher_payout_paid(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.service_mark_publisher_payout_failed(uuid, text, text) from public, anon, authenticated;
revoke all on function public.service_mark_publisher_payout_reversed(uuid, text, text) from public, anon, authenticated;
grant execute on function public.service_mark_publisher_payout_paid(uuid, text, text, text) to service_role;
grant execute on function public.service_mark_publisher_payout_failed(uuid, text, text) to service_role;
grant execute on function public.service_mark_publisher_payout_reversed(uuid, text, text) to service_role;

-- Worker claim (SKIP LOCKED)
create or replace function public.claim_publisher_payout_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.publisher_payout_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with picked as (
    select r.id
    from public.publisher_payout_requests r
    where r.status = 'APPROVED'
      and (r.locked_at is null or r.locked_at < now() - interval '5 minutes')
    order by r.created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  update public.publisher_payout_requests r
  set status = 'PROCESSING',
      locked_at = now(),
      locked_by = left(coalesce(p_worker_id, 'worker'), 120),
      processing_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  from picked
  where r.id = picked.id
  returning r.*;
end;
$$;

revoke all on function public.claim_publisher_payout_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_publisher_payout_jobs(text, integer) to service_role;

create or replace function public.get_my_publisher_payout_requests(
  p_limit integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  rows jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'currency', r.currency,
    'requested_amount_minor', r.requested_amount_minor,
    'status', r.status,
    'provider_payout_ref_masked', case
      when r.provider_payout_ref is null then null
      else '…' || right(r.provider_payout_ref, 4)
    end,
    'requested_at', r.requested_at,
    'paid_at', r.paid_at,
    'failed_at', r.failed_at,
    'failure_code', r.failure_code
  ) order by r.created_at desc), '[]'::jsonb)
  into rows
  from (
    select * from public.publisher_payout_requests
    where publisher_user_id = actor and internal_test = false
    order by created_at desc
    limit lim
  ) r;

  return jsonb_build_object('ok', true, 'items', rows);
end;
$$;

revoke all on function public.get_my_publisher_payout_requests(integer) from public, anon;
grant execute on function public.get_my_publisher_payout_requests(integer) to authenticated, service_role;

-- Internal-test-only reservation helper for race/idempotency certification (service_role).
create or replace function public.service_request_publisher_payout_internal_test(
  p_publisher_user_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acct_id uuid;
  available bigint;
  existing uuid;
  req_id uuid;
  reserve_id uuid;
  corr text;
begin
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  end if;

  select id into existing from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
  if existing is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', existing);
  end if;

  select id into acct_id
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc limit 1
  for update;
  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  perform 1
  from public.publisher_payout_requests
  where publisher_user_id = p_publisher_user_id
    and currency = upper(p_currency)
    and status in ('REQUESTED', 'REVIEW_REQUIRED', 'APPROVED', 'PROCESSING')
  for update;

  available := public._publisher_available_balance_minor(p_publisher_user_id, upper(p_currency), true);
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > available then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_AVAILABLE_BALANCE', 'available', available);
  end if;

  corr := 'payout-it:' || p_idempotency_key;

  insert into public.publisher_payout_requests (
    publisher_user_id, monetization_account_id, currency, requested_amount_minor,
    status, idempotency_key, approved_at, internal_test
  ) values (
    p_publisher_user_id, acct_id, upper(p_currency), p_amount_minor,
    'APPROVED', p_idempotency_key, now(), true
  )
  on conflict (idempotency_key) do nothing
  returning id into req_id;

  if req_id is null then
    select id into req_id from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', req_id);
  end if;

  reserve_id := public._publisher_finance_insert_ledger_entry(
    p_publisher_user_id, acct_id,
    'PAYOUT_RESERVED', 'payout', req_id,
    p_amount_minor, upper(p_currency), 'debit', 'available',
    now(), null, null,
    corr, p_idempotency_key || ':reserve', null, null,
    jsonb_build_object('role', 'payout_reserve'), true
  );

  update public.publisher_payout_requests
  set reserve_ledger_entry_id = reserve_id, updated_at = now()
  where id = req_id;

  return jsonb_build_object('ok', true, 'request_id', req_id, 'reserve_ledger_entry_id', reserve_id, 'available_after_check', available);
exception
  when unique_violation then
    select id into existing from public.publisher_payout_requests where idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'request_id', existing);
end;
$$;

revoke all on function public.service_request_publisher_payout_internal_test(uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.service_request_publisher_payout_internal_test(uuid, text, bigint, text)
  to service_role;

commit;
