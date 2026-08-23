-- TASK32: RLS + grants. dashboard.read does NOT grant finance/KYC/payout access.

begin;

alter table public.publisher_kyc_profiles enable row level security;
alter table public.publisher_tax_profiles enable row level security;
alter table public.publisher_payout_policies enable row level security;
alter table public.publisher_payout_accounts enable row level security;
alter table public.publisher_payout_holds enable row level security;
alter table public.publisher_payout_batches enable row level security;
alter table public.publisher_payout_requests enable row level security;
alter table public.publisher_finance_statements enable row level security;
alter table public.publisher_payout_reconciliation_issues enable row level security;

-- KYC: owner select only (safe columns via RPC preferred); finance.read cross-read
drop policy if exists publisher_kyc_owner_select on public.publisher_kyc_profiles;
create policy publisher_kyc_owner_select on public.publisher_kyc_profiles
  for select to authenticated
  using (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read());

drop policy if exists publisher_tax_owner_select on public.publisher_tax_profiles;
create policy publisher_tax_owner_select on public.publisher_tax_profiles
  for select to authenticated
  using (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read());

drop policy if exists publisher_payout_policies_finance_select on public.publisher_payout_policies;
create policy publisher_payout_policies_finance_select on public.publisher_payout_policies
  for select to authenticated
  using (public.publisher_finance_has_finance_read() or status = 'active');

drop policy if exists publisher_payout_accounts_owner_select on public.publisher_payout_accounts;
create policy publisher_payout_accounts_owner_select on public.publisher_payout_accounts
  for select to authenticated
  using (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read());

drop policy if exists publisher_payout_holds_owner_select on public.publisher_payout_holds;
create policy publisher_payout_holds_owner_select on public.publisher_payout_holds
  for select to authenticated
  using (
    (publisher_user_id = auth.uid() and released_at is null)
    or public.publisher_finance_has_finance_read()
  );

drop policy if exists publisher_payout_batches_finance_select on public.publisher_payout_batches;
create policy publisher_payout_batches_finance_select on public.publisher_payout_batches
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

drop policy if exists publisher_payout_requests_owner_select on public.publisher_payout_requests;
create policy publisher_payout_requests_owner_select on public.publisher_payout_requests
  for select to authenticated
  using (publisher_user_id = auth.uid() or public.publisher_finance_has_finance_read());

drop policy if exists publisher_statements_owner_select on public.publisher_finance_statements;
create policy publisher_statements_owner_select on public.publisher_finance_statements
  for select to authenticated
  using (
    (publisher_user_id = auth.uid() and status = 'FINALIZED')
    or public.publisher_finance_has_finance_read()
  );

drop policy if exists publisher_recon_finance_select on public.publisher_payout_reconciliation_issues;
create policy publisher_recon_finance_select on public.publisher_payout_reconciliation_issues
  for select to authenticated
  using (public.publisher_finance_has_finance_read());

-- Grants: select only for authenticated; no direct inserts/updates
revoke all on table public.publisher_kyc_profiles from anon, authenticated;
revoke all on table public.publisher_tax_profiles from anon, authenticated;
revoke all on table public.publisher_payout_policies from anon, authenticated;
revoke all on table public.publisher_payout_accounts from anon, authenticated;
revoke all on table public.publisher_payout_holds from anon, authenticated;
revoke all on table public.publisher_payout_batches from anon, authenticated;
revoke all on table public.publisher_payout_requests from anon, authenticated;
revoke all on table public.publisher_finance_statements from anon, authenticated;
revoke all on table public.publisher_payout_reconciliation_issues from anon, authenticated;

grant select on table public.publisher_kyc_profiles to authenticated;
grant select on table public.publisher_tax_profiles to authenticated;
grant select on table public.publisher_payout_policies to authenticated;
grant select on table public.publisher_payout_accounts to authenticated;
grant select on table public.publisher_payout_holds to authenticated;
grant select on table public.publisher_payout_batches to authenticated;
grant select on table public.publisher_payout_requests to authenticated;
grant select on table public.publisher_finance_statements to authenticated;
grant select on table public.publisher_payout_reconciliation_issues to authenticated;

grant all on table public.publisher_kyc_profiles to service_role;
grant all on table public.publisher_tax_profiles to service_role;
grant all on table public.publisher_payout_policies to service_role;
grant all on table public.publisher_payout_accounts to service_role;
grant all on table public.publisher_payout_holds to service_role;
grant all on table public.publisher_payout_batches to service_role;
grant all on table public.publisher_payout_requests to service_role;
grant all on table public.publisher_finance_statements to service_role;
grant all on table public.publisher_payout_reconciliation_issues to service_role;

-- Setup overview RPC for Earnings → Setup
create or replace function public.get_my_publisher_finance_setup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  kyc_status text := 'NOT_STARTED';
  tax_status text := 'NOT_STARTED';
  payout_account_status text := 'NONE';
  hold_active boolean := false;
  payouts_enabled boolean := false;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(k.status, 'NOT_STARTED') into kyc_status
  from public.publisher_kyc_profiles k
  where k.publisher_user_id = actor and k.internal_test = false;

  select coalesce(t.tax_status, 'NOT_STARTED') into tax_status
  from public.publisher_tax_profiles t
  where t.publisher_user_id = actor and t.internal_test = false;

  select coalesce(a.status, 'NONE') into payout_account_status
  from public.publisher_payout_accounts a
  where a.publisher_user_id = actor and a.internal_test = false and a.disabled_at is null
  order by a.is_default desc, a.updated_at desc
  limit 1;

  select exists (
    select 1 from public.publisher_payout_holds h
    where h.publisher_user_id = actor and h.released_at is null and h.internal_test = false
  ) into hold_active;

  select coalesce(m.payouts_enabled, false) into payouts_enabled
  from public.monetization_accounts m
  where m.subject_id = actor and m.program_type = 'publisher'
  order by m.updated_at desc limit 1;

  return jsonb_build_object(
    'ok', true,
    'kyc_status', coalesce(kyc_status, 'NOT_STARTED'),
    'tax_status', coalesce(tax_status, 'NOT_STARTED'),
    'payout_account_status', coalesce(payout_account_status, 'NONE'),
    'payout_hold_active', hold_active,
    'payouts_enabled', coalesce(payouts_enabled, false),
    'provider_capability', 'BLOCKED_PROVIDER_CONFIGURATION',
    'legal_terms', 'BLOCKED_CONTENT_APPROVAL',
    'tax_engine', 'BLOCKED_LEGAL_PROVIDER_CONFIGURATION',
    'live_payouts', 'OFF'
  );
end;
$$;

revoke all on function public.get_my_publisher_finance_setup() from public, anon;
grant execute on function public.get_my_publisher_finance_setup() to authenticated, service_role;

comment on function public.get_my_publisher_finance_setup() is
  'Publisher finance setup card. dashboard.read does NOT grant access. No fake Verified checkmarks.';

commit;
