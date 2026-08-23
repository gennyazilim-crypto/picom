-- TASK32: Payout accounts + holds + policy config (provider references only).

begin;

create table if not exists public.publisher_payout_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null check (char_length(btrim(policy_key)) between 2 and 80),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  minimum_payout_amount_minor bigint check (minimum_payout_amount_minor is null or minimum_payout_amount_minor > 0),
  maximum_payout_amount_minor bigint check (maximum_payout_amount_minor is null or maximum_payout_amount_minor > 0),
  requires_kyc_verified boolean not null default true,
  requires_tax_profile boolean not null default true,
  requires_payout_account boolean not null default true,
  auto_payout_enabled boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'superseded', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  unique (policy_key, version),
  check (
    minimum_payout_amount_minor is null
    or maximum_payout_amount_minor is null
    or maximum_payout_amount_minor >= minimum_payout_amount_minor
  )
);

comment on table public.publisher_payout_policies is
  'Payout business policy versions. Public payouts remain OFF until an active policy is business-approved.';

create table if not exists public.publisher_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  provider text not null check (char_length(btrim(provider)) between 2 and 80),
  provider_account_ref text,
  provider_external_account_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  account_type text not null default 'bank_account'
    check (account_type in ('bank_account', 'provider_balance', 'other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VERIFICATION_REQUIRED', 'VERIFIED', 'RESTRICTED', 'DISABLED')),
  display_label_redacted text check (display_label_redacted is null or char_length(display_label_redacted) <= 80),
  last4_or_masked text check (last4_or_masked is null or char_length(last4_or_masked) <= 12),
  is_default boolean not null default false,
  disabled_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publisher_payout_accounts_publisher_status_idx
  on public.publisher_payout_accounts (publisher_user_id, status);

create unique index if not exists publisher_payout_accounts_default_uidx
  on public.publisher_payout_accounts (publisher_user_id, currency)
  where is_default = true and status <> 'DISABLED' and disabled_at is null;

create trigger publisher_payout_accounts_touch_updated_at
  before update on public.publisher_payout_accounts
  for each row execute function public.verification_business_touch_updated_at();

comment on table public.publisher_payout_accounts is
  'Provider payout destination references only. Never store full IBAN/account credentials.';

create table if not exists public.publisher_payout_holds (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  reason_code text not null check (reason_code in (
    'KYC', 'COMPLIANCE', 'CHARGEBACK_RISK', 'MANUAL_REVIEW', 'PROVIDER_RESTRICTION', 'LEGAL'
  )),
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  internal_reference text check (internal_reference is null or char_length(internal_reference) <= 120),
  created_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  release_reason text check (release_reason is null or char_length(release_reason) <= 500),
  internal_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists publisher_payout_holds_active_idx
  on public.publisher_payout_holds (publisher_user_id, released_at)
  where released_at is null;

-- Service upsert payout account (provider webhook / onboarding only)
create or replace function public.service_upsert_publisher_payout_account(
  p_publisher_user_id uuid,
  p_provider text,
  p_provider_account_ref text,
  p_provider_external_account_ref text,
  p_currency text,
  p_status text,
  p_country_code text default null,
  p_display_label_redacted text default null,
  p_last4_or_masked text default null,
  p_is_default boolean default true,
  p_provider_environment text default null,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acct_id uuid;
  row_id uuid;
begin
  if p_status not in ('PENDING', 'VERIFICATION_REQUIRED', 'VERIFIED', 'RESTRICTED', 'DISABLED') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_CURRENCY');
  end if;

  select id into acct_id
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc limit 1;
  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  if coalesce(p_is_default, true) then
    update public.publisher_payout_accounts
    set is_default = false, updated_at = now()
    where publisher_user_id = p_publisher_user_id and currency = upper(p_currency) and is_default = true;
  end if;

  insert into public.publisher_payout_accounts (
    publisher_user_id, monetization_account_id, provider, provider_account_ref,
    provider_external_account_ref, provider_environment, currency, country_code, status,
    display_label_redacted, last4_or_masked, is_default, internal_test
  ) values (
    p_publisher_user_id, acct_id, p_provider, p_provider_account_ref,
    p_provider_external_account_ref, p_provider_environment, upper(p_currency), p_country_code, p_status,
    p_display_label_redacted, p_last4_or_masked, coalesce(p_is_default, true), coalesce(p_internal_test, false)
  )
  returning id into row_id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_ACCOUNT_ADDED', p_publisher_user_id, 'payout_account', row_id, 'payout-acct:' || row_id::text,
    jsonb_build_object('status', p_status, 'currency', upper(p_currency), 'masked', p_last4_or_masked, 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'id', row_id);
end;
$$;

revoke all on function public.service_upsert_publisher_payout_account(uuid, text, text, text, text, text, text, text, text, boolean, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_upsert_publisher_payout_account(uuid, text, text, text, text, text, text, text, text, boolean, text, boolean)
  to service_role;

create or replace function public.get_my_publisher_payout_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  rows jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'provider', a.provider,
    'currency', a.currency,
    'country_code', a.country_code,
    'status', a.status,
    'display_label_redacted', a.display_label_redacted,
    'last4_or_masked', a.last4_or_masked,
    'is_default', a.is_default,
    'updated_at', a.updated_at
  ) order by a.created_at desc), '[]'::jsonb)
  into rows
  from public.publisher_payout_accounts a
  where a.publisher_user_id = actor
    and a.internal_test = false
    and a.disabled_at is null;

  return jsonb_build_object('ok', true, 'items', rows);
end;
$$;

revoke all on function public.get_my_publisher_payout_accounts() from public, anon;
grant execute on function public.get_my_publisher_payout_accounts() to authenticated, service_role;

-- Finance hold create/release
create or replace function public.root_create_publisher_payout_hold(
  p_publisher_user_id uuid,
  p_reason_code text,
  p_reason text,
  p_internal_reference text default null,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  acct_id uuid;
  hold_id uuid;
begin
  perform public.assert_root_dashboard_permission('finance.approve');

  select id into acct_id
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc limit 1;
  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  insert into public.publisher_payout_holds (
    publisher_user_id, monetization_account_id, reason_code, reason, internal_reference, created_by, internal_test
  ) values (
    p_publisher_user_id, acct_id, p_reason_code, btrim(p_reason), p_internal_reference, actor, coalesce(p_internal_test, false)
  )
  returning id into hold_id;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, reason, correlation_id, metadata
  ) values (
    'PAYOUT_HOLD_CREATED', actor, p_publisher_user_id, 'payout_hold', hold_id, btrim(p_reason),
    'hold:' || hold_id::text,
    jsonb_build_object('reason_code', p_reason_code)
  );

  return jsonb_build_object('ok', true, 'hold_id', hold_id);
end;
$$;

create or replace function public.root_release_publisher_payout_hold(
  p_hold_id uuid,
  p_release_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  hold public.publisher_payout_holds%rowtype;
begin
  perform public.assert_root_dashboard_permission('finance.approve');
  if p_release_reason is null or char_length(btrim(p_release_reason)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;

  select * into hold from public.publisher_payout_holds where id = p_hold_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if hold.released_at is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  update public.publisher_payout_holds
  set released_at = now(), released_by = actor, release_reason = btrim(p_release_reason)
  where id = p_hold_id;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, reason, correlation_id
  ) values (
    'PAYOUT_HOLD_RELEASED', actor, hold.publisher_user_id, 'payout_hold', p_hold_id, btrim(p_release_reason),
    'hold-release:' || p_hold_id::text
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.root_create_publisher_payout_hold(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.root_release_publisher_payout_hold(uuid, text) from public, anon;
grant execute on function public.root_create_publisher_payout_hold(uuid, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.root_release_publisher_payout_hold(uuid, text) to authenticated, service_role;

commit;
