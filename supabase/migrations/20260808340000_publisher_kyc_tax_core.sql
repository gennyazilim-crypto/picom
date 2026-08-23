-- TASK32: Publisher KYC + tax profile core (provider-neutral).
-- Distinct from account verification / publisher badge / business verification.

begin;

-- Expand monetization_accounts.kyc_status to canonical set (map existing values).
alter table public.monetization_accounts
  drop constraint if exists monetization_accounts_kyc_status_check;

update public.monetization_accounts
set kyc_status = upper(replace(kyc_status, ' ', '_'))
where kyc_status is not null;

update public.monetization_accounts
set kyc_status = case lower(kyc_status)
  when 'not_started' then 'NOT_STARTED'
  when 'required' then 'REQUIRED'
  when 'pending' then 'PENDING'
  when 'verified' then 'VERIFIED'
  when 'restricted' then 'RESTRICTED'
  when 'rejected' then 'REJECTED'
  when 'not_configured' then 'NOT_STARTED'
  when 'onboarding' then 'ONBOARDING'
  when 'more_information_required' then 'MORE_INFORMATION_REQUIRED'
  when 'expired' then 'EXPIRED'
  else coalesce(nullif(kyc_status, ''), 'NOT_STARTED')
end;

alter table public.monetization_accounts
  alter column kyc_status set default 'NOT_STARTED';

alter table public.monetization_accounts
  add constraint monetization_accounts_kyc_status_check
  check (kyc_status in (
    'NOT_STARTED', 'REQUIRED', 'ONBOARDING', 'PENDING',
    'MORE_INFORMATION_REQUIRED', 'VERIFIED', 'REJECTED', 'RESTRICTED', 'EXPIRED'
  ));

create table if not exists public.publisher_kyc_profiles (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  status text not null default 'NOT_STARTED'
    check (status in (
      'NOT_STARTED', 'REQUIRED', 'ONBOARDING', 'PENDING',
      'MORE_INFORMATION_REQUIRED', 'VERIFIED', 'REJECTED', 'RESTRICTED', 'EXPIRED'
    )),
  provider text,
  provider_account_ref text,
  provider_verification_ref text,
  provider_environment text check (provider_environment is null or provider_environment in ('TEST', 'LIVE', 'UNKNOWN')),
  requirements_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requirements_summary) = 'object'),
  last_provider_event_id text,
  verified_at timestamptz,
  expires_at timestamptz,
  restricted_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_user_id)
);

create index if not exists publisher_kyc_profiles_status_idx
  on public.publisher_kyc_profiles (status);

create index if not exists publisher_kyc_profiles_provider_ref_idx
  on public.publisher_kyc_profiles (provider_account_ref)
  where provider_account_ref is not null;

create trigger publisher_kyc_profiles_touch_updated_at
  before update on public.publisher_kyc_profiles
  for each row execute function public.verification_business_touch_updated_at();

comment on table public.publisher_kyc_profiles is
  'Publisher KYC state separate from PICOM Verified badge. Prefer provider-hosted identity; no raw ID images.';

create table if not exists public.publisher_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  entity_type text not null default 'INDIVIDUAL'
    check (entity_type in ('INDIVIDUAL', 'BUSINESS')),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  tax_status text not null default 'NOT_STARTED'
    check (tax_status in (
      'NOT_STARTED', 'INCOMPLETE', 'PENDING', 'VERIFIED', 'RESTRICTED', 'BLOCKED', 'UNKNOWN'
    )),
  tax_provider_ref text,
  tax_id_redacted text check (tax_id_redacted is null or char_length(tax_id_redacted) <= 12),
  vat_status text check (vat_status is null or vat_status in (
    'NOT_APPLICABLE', 'UNKNOWN', 'PENDING', 'REGISTERED', 'NOT_REGISTERED', 'RESTRICTED'
  )),
  tax_form_status text check (tax_form_status is null or tax_form_status in (
    'NOT_REQUIRED', 'REQUIRED', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED'
  )),
  terms_version text,
  terms_accepted_at timestamptz,
  terms_accepted_by uuid references public.profiles(id) on delete set null,
  tax_verified_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_user_id)
);

create index if not exists publisher_tax_profiles_status_idx
  on public.publisher_tax_profiles (tax_status);

create trigger publisher_tax_profiles_touch_updated_at
  before update on public.publisher_tax_profiles
  for each row execute function public.verification_business_touch_updated_at();

comment on table public.publisher_tax_profiles is
  'Tax profile domain + provider hooks. No invented VAT/withholding engine. No full tax IDs in UI.';

-- KYC audit extension via publisher_finance_audit_events event_type expansion
alter table public.publisher_finance_audit_events
  drop constraint if exists publisher_finance_audit_events_event_type_check;

alter table public.publisher_finance_audit_events
  add constraint publisher_finance_audit_events_event_type_check
  check (event_type in (
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
    'FINANCE_ADJUSTMENT_CREATED',
    'KYC_STARTED',
    'KYC_STATUS_CHANGED',
    'TAX_PROFILE_CREATED',
    'TAX_PROFILE_UPDATED',
    'PAYOUT_ACCOUNT_ADDED',
    'PAYOUT_ACCOUNT_REPLACED',
    'PAYOUT_ACCOUNT_DISABLED',
    'PAYOUT_HOLD_CREATED',
    'PAYOUT_HOLD_RELEASED',
    'PAYOUT_REQUESTED',
    'PAYOUT_APPROVED',
    'PAYOUT_SUBMITTED',
    'PAYOUT_PAID',
    'PAYOUT_FAILED',
    'PAYOUT_REVERSED',
    'PAYOUT_RECONCILIATION_MISMATCH',
    'STATEMENT_FINALIZED'
  ));

-- Sync helper: map KYC profile status onto monetization_accounts summary (service only)
create or replace function public.service_sync_publisher_kyc_status(
  p_publisher_user_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_account_ref text default null,
  p_provider_verification_ref text default null,
  p_provider_environment text default null,
  p_provider_event_id text default null,
  p_requirements_summary jsonb default '{}'::jsonb,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acct_id uuid;
  profile_id uuid;
  prev text;
begin
  if p_status is null or p_status not in (
    'NOT_STARTED', 'REQUIRED', 'ONBOARDING', 'PENDING',
    'MORE_INFORMATION_REQUIRED', 'VERIFIED', 'REJECTED', 'RESTRICTED', 'EXPIRED'
  ) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  end if;

  select id into acct_id
  from public.monetization_accounts
  where subject_id = p_publisher_user_id and program_type = 'publisher'
  order by updated_at desc
  limit 1;

  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  insert into public.publisher_kyc_profiles (
    publisher_user_id, monetization_account_id, status, provider,
    provider_account_ref, provider_verification_ref, provider_environment,
    requirements_summary, last_provider_event_id, verified_at, restricted_at, internal_test
  ) values (
    p_publisher_user_id, acct_id, p_status, p_provider,
    p_provider_account_ref, p_provider_verification_ref, p_provider_environment,
    coalesce(p_requirements_summary, '{}'::jsonb), p_provider_event_id,
    case when p_status = 'VERIFIED' then now() else null end,
    case when p_status = 'RESTRICTED' then now() else null end,
    coalesce(p_internal_test, false)
  )
  on conflict (publisher_user_id) do update
  set
    status = excluded.status,
    provider = coalesce(excluded.provider, publisher_kyc_profiles.provider),
    provider_account_ref = coalesce(excluded.provider_account_ref, publisher_kyc_profiles.provider_account_ref),
    provider_verification_ref = coalesce(excluded.provider_verification_ref, publisher_kyc_profiles.provider_verification_ref),
    provider_environment = coalesce(excluded.provider_environment, publisher_kyc_profiles.provider_environment),
    requirements_summary = coalesce(excluded.requirements_summary, publisher_kyc_profiles.requirements_summary),
    last_provider_event_id = coalesce(excluded.last_provider_event_id, publisher_kyc_profiles.last_provider_event_id),
    verified_at = case when excluded.status = 'VERIFIED' then coalesce(publisher_kyc_profiles.verified_at, now()) else publisher_kyc_profiles.verified_at end,
    restricted_at = case when excluded.status = 'RESTRICTED' then now() else publisher_kyc_profiles.restricted_at end,
    updated_at = now()
  returning id, status into profile_id, prev;

  update public.monetization_accounts
  set
    kyc_status = p_status,
    provider = coalesce(p_provider, provider),
    provider_account_ref = coalesce(p_provider_account_ref, provider_account_ref),
    provider_environment = coalesce(p_provider_environment, provider_environment),
    updated_at = now()
  where id = acct_id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'KYC_STATUS_CHANGED', p_publisher_user_id, 'kyc_profile', profile_id,
    coalesce(p_provider_event_id, 'kyc:' || profile_id::text),
    jsonb_build_object('status', p_status, 'internal_test', coalesce(p_internal_test, false))
  );

  return jsonb_build_object('ok', true, 'profile_id', profile_id, 'status', p_status);
end;
$$;

revoke all on function public.service_sync_publisher_kyc_status(uuid, text, text, text, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.service_sync_publisher_kyc_status(uuid, text, text, text, text, text, text, jsonb, boolean)
  to service_role;

-- Publisher-safe KYC status (no raw provider risk / documents)
create or replace function public.get_my_publisher_kyc_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  row_data public.publisher_kyc_profiles%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into row_data
  from public.publisher_kyc_profiles
  where publisher_user_id = actor
    and internal_test = false;

  if not found then
    return jsonb_build_object('ok', true, 'status', 'NOT_STARTED', 'provider_hosted', true);
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', row_data.status,
    'requirements', coalesce(row_data.requirements_summary, '{}'::jsonb),
    'verified_at', row_data.verified_at,
    'updated_at', row_data.updated_at,
    'provider_hosted', true
  );
end;
$$;

revoke all on function public.get_my_publisher_kyc_status() from public, anon;
grant execute on function public.get_my_publisher_kyc_status() to authenticated, service_role;

-- Start KYC: fail-closed without provider
create or replace function public.request_publisher_kyc_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, correlation_id, metadata
  ) values (
    'KYC_STARTED', actor, actor, 'kyc-start:' || actor::text,
    jsonb_build_object('result', 'BLOCKED_PROVIDER_CONFIGURATION')
  );

  return jsonb_build_object(
    'ok', false,
    'error', 'KYC_PROVIDER_NOT_CONFIGURED',
    'code', 'BLOCKED_PROVIDER_CONFIGURATION',
    'message', 'KYC provider runtime is not configured. Hosted onboarding unavailable.'
  );
end;
$$;

revoke all on function public.request_publisher_kyc_onboarding() from public, anon;
grant execute on function public.request_publisher_kyc_onboarding() to authenticated, service_role;

-- Upsert own tax profile (minimal fields; cannot set VERIFIED)
create or replace function public.upsert_my_publisher_tax_profile(
  p_entity_type text,
  p_country_code text,
  p_vat_status text default null,
  p_tax_form_status text default null,
  p_terms_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  acct_id uuid;
  profile_id uuid;
  country text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_entity_type not in ('INDIVIDUAL', 'BUSINESS') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ENTITY_TYPE');
  end if;
  country := nullif(upper(btrim(coalesce(p_country_code, ''))), '');
  if country is not null and country !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_COUNTRY');
  end if;

  select id into acct_id
  from public.monetization_accounts
  where subject_id = actor and program_type = 'publisher'
  order by updated_at desc limit 1;

  if acct_id is null then
    return jsonb_build_object('ok', false, 'error', 'MONETIZATION_ACCOUNT_NOT_FOUND');
  end if;

  insert into public.publisher_tax_profiles (
    publisher_user_id, monetization_account_id, entity_type, country_code,
    tax_status, vat_status, tax_form_status, terms_version, terms_accepted_at, terms_accepted_by
  ) values (
    actor, acct_id, p_entity_type, country,
    'INCOMPLETE',
    p_vat_status,
    coalesce(p_tax_form_status, 'NOT_REQUIRED'),
    nullif(btrim(coalesce(p_terms_version, '')), ''),
    case when p_terms_version is not null and btrim(p_terms_version) <> '' then now() else null end,
    case when p_terms_version is not null and btrim(p_terms_version) <> '' then actor else null end
  )
  on conflict (publisher_user_id) do update
  set
    entity_type = excluded.entity_type,
    country_code = excluded.country_code,
    vat_status = coalesce(excluded.vat_status, publisher_tax_profiles.vat_status),
    tax_form_status = coalesce(excluded.tax_form_status, publisher_tax_profiles.tax_form_status),
    terms_version = coalesce(excluded.terms_version, publisher_tax_profiles.terms_version),
    terms_accepted_at = coalesce(excluded.terms_accepted_at, publisher_tax_profiles.terms_accepted_at),
    terms_accepted_by = coalesce(excluded.terms_accepted_by, publisher_tax_profiles.terms_accepted_by),
    tax_status = case
      when publisher_tax_profiles.tax_status in ('VERIFIED', 'RESTRICTED', 'BLOCKED') then publisher_tax_profiles.tax_status
      else 'INCOMPLETE'
    end,
    updated_at = now()
  returning id into profile_id;

  update public.monetization_accounts
  set tax_status = case
      when tax_status in ('verified', 'VERIFIED') then 'verified'
      else 'pending'
    end,
    tax_country = country,
    updated_at = now()
  where id = acct_id;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'TAX_PROFILE_UPDATED', actor, actor, 'tax_profile', profile_id, 'tax:' || profile_id::text,
    jsonb_build_object('entity_type', p_entity_type, 'country_code', country)
  );

  return jsonb_build_object('ok', true, 'profile_id', profile_id, 'tax_status', 'INCOMPLETE');
end;
$$;

revoke all on function public.upsert_my_publisher_tax_profile(text, text, text, text, text) from public, anon;
grant execute on function public.upsert_my_publisher_tax_profile(text, text, text, text, text) to authenticated, service_role;

create or replace function public.get_my_publisher_tax_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  row_data public.publisher_tax_profiles%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into row_data from public.publisher_tax_profiles where publisher_user_id = actor and internal_test = false;
  if not found then
    return jsonb_build_object('ok', true, 'exists', false, 'tax_status', 'NOT_STARTED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'exists', true,
    'entity_type', row_data.entity_type,
    'country_code', row_data.country_code,
    'tax_status', row_data.tax_status,
    'tax_id_redacted', row_data.tax_id_redacted,
    'vat_status', row_data.vat_status,
    'tax_form_status', row_data.tax_form_status,
    'terms_version', row_data.terms_version,
    'updated_at', row_data.updated_at
  );
end;
$$;

revoke all on function public.get_my_publisher_tax_profile() from public, anon;
grant execute on function public.get_my_publisher_tax_profile() to authenticated, service_role;

commit;
