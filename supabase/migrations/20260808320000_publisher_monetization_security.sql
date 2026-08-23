-- TASK31: Finance RLS, grants, balance RPCs. Least privilege.
-- dashboard.read does NOT grant finance access.
-- NORMAL users cannot mutate ledger. Publishers read aggregates via safe RPCs only.

begin;

alter table public.publisher_monetization_fee_policies enable row level security;
alter table public.publisher_subscription_products enable row level security;
alter table public.publisher_subscriptions enable row level security;
alter table public.publisher_payment_transactions enable row level security;
alter table public.publisher_donations enable row level security;
alter table public.publisher_ad_revenue_attributions enable row level security;
alter table public.publisher_finance_ledger_entries enable row level security;
alter table public.publisher_finance_audit_events enable row level security;
alter table public.publisher_finance_event_failures enable row level security;

-- Helpers
create or replace function public.publisher_finance_is_owner(target_publisher_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and auth.uid() = target_publisher_user_id;
$$;

create or replace function public.publisher_finance_has_finance_read()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Explicit finance permission only. dashboard.read is insufficient.
  select coalesce(public.is_root_owner(), false)
      or coalesce(public.has_platform_permission('finance.read'), false);
$$;

revoke all on function public.publisher_finance_is_owner(uuid) from public, anon;
revoke all on function public.publisher_finance_has_finance_read() from public, anon;
grant execute on function public.publisher_finance_is_owner(uuid) to authenticated, service_role;
grant execute on function public.publisher_finance_has_finance_read() to authenticated, service_role;

-- Fee policies: authenticated may read active/draft metadata only if finance or owner tooling later; default deny select for normal users.
drop policy if exists publisher_fee_policies_finance_select on public.publisher_monetization_fee_policies;
create policy publisher_fee_policies_finance_select
  on public.publisher_monetization_fee_policies
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

-- Subscription products: publisher owns; subscribers may see active products of a publisher via RPC (not broad table select of inactive).
drop policy if exists publisher_subscription_products_owner_select on public.publisher_subscription_products;
create policy publisher_subscription_products_owner_select
  on public.publisher_subscription_products
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or (active = true)
    or public.publisher_finance_has_finance_read()
  );

drop policy if exists publisher_subscription_products_owner_write on public.publisher_subscription_products;
create policy publisher_subscription_products_owner_write
  on public.publisher_subscription_products
  for all to authenticated
  using (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read())
  with check (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read());

-- Subscriptions: parties + finance
drop policy if exists publisher_subscriptions_party_select on public.publisher_subscriptions;
create policy publisher_subscriptions_party_select
  on public.publisher_subscriptions
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or subscriber_user_id = auth.uid()
    or public.publisher_finance_has_finance_read()
  );

-- No direct client insert/update of subscription lifecycle (webhook/service authoritative).
-- Payment transactions: publisher/payer sanitized select
drop policy if exists publisher_payment_tx_party_select on public.publisher_payment_transactions;
create policy publisher_payment_tx_party_select
  on public.publisher_payment_transactions
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or payer_user_id = auth.uid()
    or public.publisher_finance_has_finance_read()
  );

-- Donations
drop policy if exists publisher_donations_party_select on public.publisher_donations;
create policy publisher_donations_party_select
  on public.publisher_donations
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or donor_user_id = auth.uid()
    or public.publisher_finance_has_finance_read()
  );

-- Ad attributions: publisher + finance only
drop policy if exists publisher_ad_attr_owner_select on public.publisher_ad_revenue_attributions;
create policy publisher_ad_attr_owner_select
  on public.publisher_ad_revenue_attributions
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or public.publisher_finance_has_finance_read()
  );

-- Ledger: NO select for normal authenticated via table; finance role or owner via RPC only.
-- Deny direct ledger select for publishers too (force sanitized RPC). Exception: finance.read.
drop policy if exists publisher_finance_ledger_finance_select on public.publisher_finance_ledger_entries;
create policy publisher_finance_ledger_finance_select
  on public.publisher_finance_ledger_entries
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

-- Explicitly no insert/update/delete policies for authenticated on ledger (service_role bypasses RLS).

drop policy if exists publisher_finance_audit_finance_select on public.publisher_finance_audit_events;
create policy publisher_finance_audit_finance_select
  on public.publisher_finance_audit_events
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

drop policy if exists publisher_finance_failures_finance_select on public.publisher_finance_event_failures;
create policy publisher_finance_failures_finance_select
  on public.publisher_finance_event_failures
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

-- Grants: revoke broad mutation
revoke all on table public.publisher_monetization_fee_policies from anon, authenticated;
revoke all on table public.publisher_subscription_products from anon, authenticated;
revoke all on table public.publisher_subscriptions from anon, authenticated;
revoke all on table public.publisher_payment_transactions from anon, authenticated;
revoke all on table public.publisher_donations from anon, authenticated;
revoke all on table public.publisher_ad_revenue_attributions from anon, authenticated;
revoke all on table public.publisher_finance_ledger_entries from anon, authenticated;
revoke all on table public.publisher_finance_audit_events from anon, authenticated;
revoke all on table public.publisher_finance_event_failures from anon, authenticated;

grant select on table public.publisher_monetization_fee_policies to authenticated;
grant select, insert, update on table public.publisher_subscription_products to authenticated;
grant select on table public.publisher_subscriptions to authenticated;
grant select on table public.publisher_payment_transactions to authenticated;
grant select on table public.publisher_donations to authenticated;
grant select on table public.publisher_ad_revenue_attributions to authenticated;
grant select on table public.publisher_finance_ledger_entries to authenticated;
grant select on table public.publisher_finance_audit_events to authenticated;
grant select on table public.publisher_finance_event_failures to authenticated;

grant all on table public.publisher_monetization_fee_policies to service_role;
grant all on table public.publisher_subscription_products to service_role;
grant all on table public.publisher_subscriptions to service_role;
grant all on table public.publisher_payment_transactions to service_role;
grant all on table public.publisher_donations to service_role;
grant all on table public.publisher_ad_revenue_attributions to service_role;
grant all on table public.publisher_finance_ledger_entries to service_role;
grant all on table public.publisher_finance_audit_events to service_role;
grant all on table public.publisher_finance_event_failures to service_role;

-- Derived balance helper (excludes internal_test from real earnings unless explicitly requested)
create or replace function public._publisher_finance_signed_amount(
  p_direction text,
  p_amount_minor bigint
)
returns bigint
language sql
immutable
as $$
  select case when p_direction = 'credit' then p_amount_minor else -p_amount_minor end;
$$;

create or replace function public.get_publisher_earnings_overview(
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.currency), '[]'::jsonb)
  into result
  from (
    select
      e.currency,
      coalesce(sum(case
        when e.balance_bucket = 'pending'
          and (e.available_at is null or e.available_at > now())
        then public._publisher_finance_signed_amount(e.direction, e.amount_minor)
        when e.balance_bucket = 'pending'
          and e.available_at is not null and e.available_at <= now()
        then 0
        else 0
      end), 0)::bigint as pending_balance_minor,
      coalesce(sum(case
        when e.balance_bucket = 'available'
          or (e.balance_bucket = 'pending' and e.available_at is not null and e.available_at <= now())
        then public._publisher_finance_signed_amount(e.direction, e.amount_minor)
        else 0
      end), 0)::bigint as available_balance_minor,
      coalesce(sum(case
        when e.balance_bucket = 'paid'
        then public._publisher_finance_signed_amount(e.direction, e.amount_minor)
        else 0
      end), 0)::bigint as paid_balance_minor,
      coalesce(sum(case
        when e.balance_bucket = 'refunded_or_reversed'
        then public._publisher_finance_signed_amount(e.direction, e.amount_minor)
        else 0
      end), 0)::bigint as refunded_or_reversed_minor,
      coalesce(sum(case
        when e.entry_type in (
          'SUBSCRIPTION_GROSS', 'DONATION_GROSS', 'AD_REVENUE_GROSS'
        ) and e.direction = 'credit'
        then e.amount_minor else 0
      end), 0)::bigint as gross_revenue_minor,
      coalesce(sum(case
        when e.entry_type in ('SUBSCRIPTION_NET', 'DONATION_NET', 'AD_REVENUE_CREATOR_SHARE')
          and e.direction = 'credit'
        then e.amount_minor else 0
      end), 0)::bigint as net_revenue_minor,
      coalesce(sum(case
        when e.entry_type in ('SUBSCRIPTION_NET', 'DONATION_NET') and e.direction = 'credit' and e.source_type = 'subscription'
        then e.amount_minor
        when e.entry_type = 'SUBSCRIPTION_NET' and e.direction = 'credit'
        then e.amount_minor
        else 0
      end), 0)::bigint as subscriptions_net_minor,
      coalesce(sum(case
        when e.entry_type = 'DONATION_NET' and e.direction = 'credit'
        then e.amount_minor else 0
      end), 0)::bigint as donations_net_minor,
      coalesce(sum(case
        when e.entry_type = 'AD_REVENUE_CREATOR_SHARE' and e.direction = 'credit'
        then e.amount_minor else 0
      end), 0)::bigint as ads_net_minor
    from public.publisher_finance_ledger_entries e
    where e.publisher_user_id = actor
      and (p_include_internal_test or e.internal_test = false)
    group by e.currency
  ) x;

  return jsonb_build_object(
    'ok', true,
    'publisher_user_id', actor,
    'payouts_available', false,
    'payouts_status', 'PAYOUTS_NOT_IMPLEMENTED',
    'balances_by_currency', coalesce(result, '[]'::jsonb),
    -- dashboard.read does NOT grant finance access (documented)
    'note', 'Balances derived from immutable ledger; payouts not yet available'
  );
end;
$$;

create or replace function public.get_publisher_transactions(
  p_limit integer default 50,
  p_offset integer default 0,
  p_source_type text default null,
  p_currency text default null,
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  off integer := greatest(coalesce(p_offset, 0), 0);
  rows jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into rows
  from (
    select
      e.id,
      e.created_at,
      e.source_type,
      e.entry_type,
      e.amount_minor,
      e.currency,
      e.direction,
      e.balance_bucket,
      e.status,
      e.correlation_id
    from public.publisher_finance_ledger_entries e
    where e.publisher_user_id = actor
      and e.balance_bucket <> 'non_balance'
      and (p_include_internal_test or e.internal_test = false)
      and (p_source_type is null or e.source_type = p_source_type)
      and (p_currency is null or e.currency = upper(p_currency))
    order by e.created_at desc
    limit lim offset off
  ) t;

  return jsonb_build_object('ok', true, 'items', coalesce(rows, '[]'::jsonb), 'limit', lim, 'offset', off);
end;
$$;

create or replace function public.get_publisher_revenue_timeseries(
  p_bucket text default 'day',
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_currency text default null,
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  range_from timestamptz;
  range_to timestamptz;
  rows jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'INVALID_BUCKET' using errcode = '22023';
  end if;

  range_to := least(coalesce(p_to, now()), now());
  range_from := greatest(coalesce(p_from, range_to - interval '30 days'), range_to - interval '366 days');

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.bucket_start), '[]'::jsonb)
  into rows
  from (
    select
      date_trunc(p_bucket, e.created_at) as bucket_start,
      e.currency,
      coalesce(sum(case
        when e.entry_type in ('SUBSCRIPTION_NET', 'DONATION_NET', 'AD_REVENUE_CREATOR_SHARE') and e.direction = 'credit'
        then e.amount_minor
        when e.entry_type in ('REFUND', 'CHARGEBACK') and e.direction = 'debit'
        then -e.amount_minor
        else 0
      end), 0)::bigint as net_minor
    from public.publisher_finance_ledger_entries e
    where e.publisher_user_id = actor
      and e.created_at >= range_from
      and e.created_at <= range_to
      and (p_include_internal_test or e.internal_test = false)
      and (p_currency is null or e.currency = upper(p_currency))
    group by 1, 2
  ) t;

  return jsonb_build_object(
    'ok', true,
    'bucket', p_bucket,
    'from', range_from,
    'to', range_to,
    'series', coalesce(rows, '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_publisher_subscription_metrics(
  p_include_internal_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok', true,
    'active_subscribers', (
      select count(*)::bigint from public.publisher_subscriptions s
      where s.publisher_user_id = actor
        and s.status in ('ACTIVE', 'CANCEL_AT_PERIOD_END')
        and (p_include_internal_test or s.internal_test = false)
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'amount_minor', p.amount_minor,
        'currency', p.currency,
        'interval', p.billing_interval,
        'active', p.active
      ) order by p.created_at desc)
      from public.publisher_subscription_products p
      where p.publisher_user_id = actor
    ), '[]'::jsonb),
    'mrr_note', 'MRR omitted when mixed currencies or provider runtime unavailable'
  );
end;
$$;

revoke all on function public.get_publisher_earnings_overview(boolean) from public, anon;
revoke all on function public.get_publisher_transactions(integer, integer, text, text, boolean) from public, anon;
revoke all on function public.get_publisher_revenue_timeseries(text, timestamptz, timestamptz, text, boolean) from public, anon;
revoke all on function public.get_publisher_subscription_metrics(boolean) from public, anon;

grant execute on function public.get_publisher_earnings_overview(boolean) to authenticated, service_role;
grant execute on function public.get_publisher_transactions(integer, integer, text, text, boolean) to authenticated, service_role;
grant execute on function public.get_publisher_revenue_timeseries(text, timestamptz, timestamptz, text, boolean) to authenticated, service_role;
grant execute on function public.get_publisher_subscription_metrics(boolean) to authenticated, service_role;

comment on function public.get_publisher_earnings_overview(boolean) is
  'Publisher-owned earnings aggregates. dashboard.read does NOT grant access. Excludes internal_test by default.';

commit;
