-- TASK32: Statements + reconciliation quarantine.

begin;

create table if not exists public.publisher_finance_statements (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  version integer not null default 1 check (version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'FINALIZED', 'SUPERSEDED')),
  gross_revenue_minor bigint not null default 0,
  fees_minor bigint not null default 0,
  refunds_minor bigint not null default 0,
  chargebacks_minor bigint not null default 0,
  net_revenue_minor bigint not null default 0,
  payouts_minor bigint not null default 0,
  ending_available_balance_minor bigint not null default 0,
  ledger_cutoff_at timestamptz not null,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id) on delete set null,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create unique index if not exists publisher_finance_statements_period_uidx
  on public.publisher_finance_statements (publisher_user_id, period_start, period_end, currency, version);

create index if not exists publisher_finance_statements_publisher_idx
  on public.publisher_finance_statements (publisher_user_id, period_start desc, currency);

comment on table public.publisher_finance_statements is
  'Publisher earnings statements derived from immutable ledger. Not a tax invoice unless legally verified.';

create table if not exists public.publisher_payout_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid references public.profiles(id) on delete set null,
  payout_request_id uuid references public.publisher_payout_requests(id) on delete set null,
  issue_code text not null check (issue_code in (
    'MISSING_PROVIDER_RECORD',
    'MISSING_LOCAL_RECORD',
    'AMOUNT_MISMATCH',
    'CURRENCY_MISMATCH',
    'STATUS_MISMATCH',
    'DUPLICATE_PROVIDER_REF'
  )),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'wont_fix')),
  local_amount_minor bigint,
  provider_amount_minor bigint,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  provider_payout_ref text,
  safe_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(safe_context) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists publisher_payout_reconciliation_open_idx
  on public.publisher_payout_reconciliation_issues (status, created_at desc);

create or replace function public.service_finalize_publisher_finance_statement(
  p_publisher_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_currency text,
  p_internal_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acct_id uuid;
  stmt_id uuid;
  gross bigint := 0;
  fees bigint := 0;
  refunds bigint := 0;
  chargebacks bigint := 0;
  net bigint := 0;
  payouts bigint := 0;
  ending bigint := 0;
  ver integer := 1;
begin
  if p_period_end <= p_period_start then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
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

  select coalesce(max(version), 0) + 1 into ver
  from public.publisher_finance_statements
  where publisher_user_id = p_publisher_user_id
    and period_start = p_period_start
    and period_end = p_period_end
    and currency = upper(p_currency);

  select
    coalesce(sum(case when entry_type in ('SUBSCRIPTION_GROSS', 'DONATION_GROSS', 'AD_REVENUE_GROSS') and direction = 'credit' then amount_minor else 0 end), 0),
    coalesce(sum(case when entry_type in (
      'SUBSCRIPTION_PLATFORM_FEE', 'SUBSCRIPTION_PROVIDER_FEE',
      'DONATION_PLATFORM_FEE', 'DONATION_PROVIDER_FEE',
      'AD_REVENUE_PLATFORM_SHARE'
    ) and direction = 'debit' then amount_minor else 0 end), 0),
    coalesce(sum(case when entry_type = 'REFUND' and direction = 'debit' then amount_minor else 0 end), 0),
    coalesce(sum(case when entry_type = 'CHARGEBACK' and direction = 'debit' then amount_minor else 0 end), 0),
    coalesce(sum(case when entry_type in ('SUBSCRIPTION_NET', 'DONATION_NET', 'AD_REVENUE_CREATOR_SHARE') and direction = 'credit' then amount_minor else 0 end), 0),
    coalesce(sum(case when entry_type in ('PAYOUT', 'PAYOUT_RESERVED') and direction = 'debit' then amount_minor
                      when entry_type in ('PAYOUT_RELEASED', 'PAYOUT_REVERSAL') and direction = 'credit' then -amount_minor
                      else 0 end), 0)
  into gross, fees, refunds, chargebacks, net, payouts
  from public.publisher_finance_ledger_entries
  where publisher_user_id = p_publisher_user_id
    and currency = upper(p_currency)
    and created_at >= p_period_start
    and created_at < p_period_end
    and (p_internal_test or internal_test = false);

  ending := public._publisher_available_balance_minor(p_publisher_user_id, upper(p_currency), p_internal_test);

  -- Supersede previous finalized same period/currency
  update public.publisher_finance_statements
  set status = 'SUPERSEDED'
  where publisher_user_id = p_publisher_user_id
    and period_start = p_period_start
    and period_end = p_period_end
    and currency = upper(p_currency)
    and status = 'FINALIZED';

  insert into public.publisher_finance_statements (
    publisher_user_id, monetization_account_id, period_start, period_end, currency, version, status,
    gross_revenue_minor, fees_minor, refunds_minor, chargebacks_minor, net_revenue_minor,
    payouts_minor, ending_available_balance_minor, ledger_cutoff_at, finalized_at, internal_test
  ) values (
    p_publisher_user_id, acct_id, p_period_start, p_period_end, upper(p_currency), ver, 'FINALIZED',
    gross, fees, refunds, chargebacks, net,
    payouts, ending, p_period_end, now(), coalesce(p_internal_test, false)
  )
  returning id into stmt_id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'STATEMENT_FINALIZED', p_publisher_user_id, 'statement', stmt_id, 'stmt:' || stmt_id::text,
    jsonb_build_object(
      'currency', upper(p_currency),
      'gross_revenue_minor', gross,
      'net_revenue_minor', net,
      'payouts_minor', payouts,
      'ending_available_balance_minor', ending,
      'version', ver,
      'internal_test', coalesce(p_internal_test, false)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'statement_id', stmt_id,
    'version', ver,
    'gross_revenue_minor', gross,
    'fees_minor', fees,
    'refunds_minor', refunds,
    'chargebacks_minor', chargebacks,
    'net_revenue_minor', net,
    'payouts_minor', payouts,
    'ending_available_balance_minor', ending
  );
end;
$$;

revoke all on function public.service_finalize_publisher_finance_statement(uuid, timestamptz, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_finalize_publisher_finance_statement(uuid, timestamptz, timestamptz, text, boolean)
  to service_role;

create or replace function public.get_my_publisher_finance_statements(
  p_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 24), 1), 60);
  rows jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'period_start', s.period_start,
    'period_end', s.period_end,
    'currency', s.currency,
    'version', s.version,
    'status', s.status,
    'gross_revenue_minor', s.gross_revenue_minor,
    'fees_minor', s.fees_minor,
    'refunds_minor', s.refunds_minor,
    'chargebacks_minor', s.chargebacks_minor,
    'net_revenue_minor', s.net_revenue_minor,
    'payouts_minor', s.payouts_minor,
    'ending_available_balance_minor', s.ending_available_balance_minor,
    'finalized_at', s.finalized_at
  ) order by s.period_start desc, s.currency), '[]'::jsonb)
  into rows
  from (
    select * from public.publisher_finance_statements
    where publisher_user_id = actor
      and status = 'FINALIZED'
      and internal_test = false
    order by period_start desc
    limit lim
  ) s;

  return jsonb_build_object('ok', true, 'items', rows);
end;
$$;

revoke all on function public.get_my_publisher_finance_statements(integer) from public, anon;
grant execute on function public.get_my_publisher_finance_statements(integer) to authenticated, service_role;

create or replace function public.service_record_payout_reconciliation_issue(
  p_issue_code text,
  p_publisher_user_id uuid default null,
  p_payout_request_id uuid default null,
  p_local_amount_minor bigint default null,
  p_provider_amount_minor bigint default null,
  p_currency text default null,
  p_provider_payout_ref text default null,
  p_safe_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  issue_id uuid;
begin
  insert into public.publisher_payout_reconciliation_issues (
    publisher_user_id, payout_request_id, issue_code, local_amount_minor, provider_amount_minor,
    currency, provider_payout_ref, safe_context
  ) values (
    p_publisher_user_id, p_payout_request_id, p_issue_code, p_local_amount_minor, p_provider_amount_minor,
    p_currency, p_provider_payout_ref, coalesce(p_safe_context, '{}'::jsonb)
  )
  returning id into issue_id;

  insert into public.publisher_finance_audit_events (
    event_type, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'PAYOUT_RECONCILIATION_MISMATCH', p_publisher_user_id, 'reconciliation_issue', issue_id,
    'recon:' || issue_id::text,
    jsonb_build_object('issue_code', p_issue_code)
  );

  return jsonb_build_object('ok', true, 'issue_id', issue_id);
end;
$$;

revoke all on function public.service_record_payout_reconciliation_issue(text, uuid, uuid, bigint, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_record_payout_reconciliation_issue(text, uuid, uuid, bigint, bigint, text, text, jsonb)
  to service_role;

commit;
