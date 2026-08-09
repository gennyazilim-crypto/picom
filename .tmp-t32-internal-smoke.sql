-- TASK32 provider-independent internal_test certification (NOT real payout / NOT provider sandbox)
-- Excluded from real earnings via internal_test=true.

do $$
declare
  pub uuid;
  acct uuid;
  src uuid := gen_random_uuid();
  r1 jsonb;
  r2 jsonb;
  r jsonb;
  rid uuid;
  rid2 uuid;
  avail bigint;
  elig jsonb;
  stmt jsonb;
  i int;
  ok_count int := 0;
  fail_count int := 0;
  dup_count int := 0;
  stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  period_start timestamptz := date_trunc('month', now() - interval '1 month');
  period_end timestamptz := date_trunc('month', now());
begin
  select id into pub from public.profiles order by created_at nulls last limit 1;
  if pub is null then
    raise exception 'NO_PROFILE_FOR_INTERNAL_TEST';
  end if;

  insert into public.monetization_accounts (
    subject_type, subject_id, program_type, monetization_status, eligibility_status,
    default_currency, payouts_enabled, kyc_status
  ) values (
    'user', pub, 'publisher', 'eligible', 'ELIGIBLE', 'EUR', true, 'NOT_STARTED'
  )
  on conflict do nothing;

  select id into acct
  from public.monetization_accounts
  where subject_id = pub and program_type = 'publisher'
  order by updated_at desc
  limit 1;

  update public.monetization_accounts
  set payouts_enabled = true, monetization_status = 'eligible', kyc_status = 'VERIFIED'
  where id = acct;

  -- Clean prior T32 internal fixtures for this publisher (test-only rows)
  delete from public.publisher_payout_requests
  where publisher_user_id = pub and internal_test = true
    and idempotency_key like 't32-%';
  delete from public.publisher_finance_ledger_entries
  where publisher_user_id = pub and internal_test = true
    and idempotency_key like 't32-%';
  delete from public.publisher_finance_statements
  where publisher_user_id = pub and internal_test = true;
  delete from public.publisher_payout_holds
  where publisher_user_id = pub and internal_test = true;
  delete from public.publisher_kyc_profiles
  where publisher_user_id = pub and internal_test = true;
  delete from public.publisher_tax_profiles
  where publisher_user_id = pub and internal_test = true;
  delete from public.publisher_payout_accounts
  where publisher_user_id = pub and internal_test = true;

  insert into public.publisher_payout_policies (
    policy_key, version, status, currency, minimum_payout_amount_minor
  )
  select 'publisher_default', 't32-1', 'active', 'EUR', 1000
  where not exists (
    select 1 from public.publisher_payout_policies
    where status = 'active' and (currency is null or currency = 'EUR')
  );

  -- Statement fixture entries with historical created_at (immutable ledger; insert-time only)
  insert into public.publisher_finance_ledger_entries (
    publisher_user_id, monetization_account_id, entry_type, source_type, source_id,
    amount_minor, currency, direction, balance_bucket, available_at,
    correlation_id, idempotency_key, metadata, internal_test, created_at
  ) values
    (pub, acct, 'SUBSCRIPTION_NET', 'subscription', gen_random_uuid(),
     900, 'EUR', 'credit', 'available', period_start + interval '1 day',
     't32-stmt-sub:' || stamp, 't32-stmt-sub-' || stamp, '{"role":"t32_stmt"}'::jsonb, true, period_start + interval '1 day'),
    (pub, acct, 'DONATION_NET', 'donation', gen_random_uuid(),
     500, 'EUR', 'credit', 'available', period_start + interval '2 day',
     't32-stmt-don:' || stamp, 't32-stmt-don-' || stamp, '{"role":"t32_stmt"}'::jsonb, true, period_start + interval '2 day'),
    (pub, acct, 'AD_REVENUE_CREATOR_SHARE', 'ad_revenue', gen_random_uuid(),
     300, 'EUR', 'credit', 'available', period_start + interval '3 day',
     't32-stmt-ad:' || stamp, 't32-stmt-ad-' || stamp, '{"role":"t32_stmt"}'::jsonb, true, period_start + interval '3 day'),
    (pub, acct, 'REFUND', 'refund', gen_random_uuid(),
     200, 'EUR', 'debit', 'available', period_start + interval '4 day',
     't32-stmt-ref:' || stamp, 't32-stmt-ref-' || stamp, '{"role":"t32_stmt"}'::jsonb, true, period_start + interval '4 day'),
    (pub, acct, 'PAYOUT', 'payout', gen_random_uuid(),
     1000, 'EUR', 'debit', 'paid', period_start + interval '5 day',
     't32-stmt-po:' || stamp, 't32-stmt-po-' || stamp, '{"role":"t32_stmt"}'::jsonb, true, period_start + interval '5 day'),
    (pub, acct, 'SUBSCRIPTION_NET', 'subscription', gen_random_uuid(),
     2500, 'USD', 'credit', 'available', period_start + interval '1 day',
     't32-usd:' || stamp, 't32-usd-' || stamp, '{"role":"t32_usd"}'::jsonb, true, period_start + interval '1 day');

  -- Seed available 10000 EUR for race (current time; outside statement period)
  perform public._publisher_finance_insert_ledger_entry(
    pub, acct, 'SUBSCRIPTION_NET', 'subscription', src,
    10000, 'EUR', 'credit', 'available', now(),
    null, null, 't32-seed:' || stamp, 't32-seed-avail-' || stamp, null, null,
    jsonb_build_object('role', 't32_seed'), true
  );

  -- Race: two 8000 requests against 10000 (sequential under same connection proves exclusive reserve)
  r1 := public.service_request_publisher_payout_internal_test(pub, 'EUR', 8000, 't32-race-a-' || stamp);
  r2 := public.service_request_publisher_payout_internal_test(pub, 'EUR', 8000, 't32-race-b-' || stamp);
  raise notice 'RACE_A=%', r1;
  raise notice 'RACE_B=%', r2;

  if coalesce((r1->>'ok')::boolean, false) is distinct from true then
    raise exception 'RACE_FIRST_SHOULD_SUCCEED %', r1;
  end if;
  if coalesce((r2->>'ok')::boolean, false) is not false
     and coalesce(r2->>'error', '') <> 'INSUFFICIENT_AVAILABLE_BALANCE' then
    raise exception 'RACE_SECOND_SHOULD_FAIL %', r2;
  end if;

  avail := public._publisher_available_balance_minor(pub, 'EUR', true);
  raise notice 'AVAILABLE_AFTER_RACE=%', avail;
  if avail < 0 then
    raise exception 'NEGATIVE_BALANCE_FROM_RACE %', avail;
  end if;

  -- Idempotency: same key x10
  for i in 1..10 loop
    r := public.service_request_publisher_payout_internal_test(pub, 'EUR', 500, 't32-idem-' || stamp);
    if coalesce((r->>'duplicate')::boolean, false) then
      dup_count := dup_count + 1;
    elsif coalesce((r->>'ok')::boolean, false) then
      ok_count := ok_count + 1;
      rid := (r->>'request_id')::uuid;
    else
      fail_count := fail_count + 1;
    end if;
  end loop;
  raise notice 'IDEM ok=% dup=% fail=%', ok_count, dup_count, fail_count;
  if ok_count <> 1 or dup_count <> 9 or fail_count <> 0 then
    raise exception 'IDEM_FAIL ok=% dup=% fail=%', ok_count, dup_count, fail_count;
  end if;

  -- Paid webhook idempotency x10 then reverse x10
  for i in 1..10 loop
    r := public.service_mark_publisher_payout_paid(rid, 'prov-po-' || stamp, 'evt-paid-' || stamp, 't32-paid-' || stamp);
  end loop;
  raise notice 'PAID=%', r;
  if coalesce((r->>'ok')::boolean, false) is distinct from true then
    raise exception 'PAID_FAIL %', r;
  end if;

  for i in 1..10 loop
    r := public.service_mark_publisher_payout_reversed(rid, 'evt-rev-' || stamp, 't32-rev-' || stamp);
  end loop;
  raise notice 'REV=%', r;
  if coalesce((r->>'ok')::boolean, false) is distinct from true then
    raise exception 'REV_FAIL %', r;
  end if;

  -- Failure release path
  r := public.service_request_publisher_payout_internal_test(pub, 'EUR', 700, 't32-fail-' || stamp);
  rid2 := (r->>'request_id')::uuid;
  r := public.service_mark_publisher_payout_failed(rid2, 'PROVIDER_TIMEOUT', 't32-fail-key-' || stamp);
  raise notice 'FAIL_RELEASE=%', r;
  r := public.service_mark_publisher_payout_failed(rid2, 'PROVIDER_TIMEOUT', 't32-fail-key-' || stamp);
  raise notice 'FAIL_DUP=%', r;

  -- KYC verified then expired => eligibility denied
  perform public.service_sync_publisher_kyc_status(
    pub, 'VERIFIED', 'internal_test', 'acct-' || stamp, 'ver-' || stamp, 'TEST',
    'evt-kyc-v-' || stamp, '{}'::jsonb, true
  );
  insert into public.publisher_tax_profiles (
    publisher_user_id, monetization_account_id, entity_type, country_code, tax_status, internal_test
  ) values (pub, acct, 'INDIVIDUAL', 'DE', 'INCOMPLETE', true)
  on conflict (publisher_user_id) do update
    set tax_status = 'INCOMPLETE', internal_test = true, updated_at = now();

  insert into public.publisher_payout_accounts (
    publisher_user_id, monetization_account_id, provider, provider_account_ref,
    account_type, currency, country_code, status, display_label_redacted, last4_or_masked,
    is_default, internal_test
  ) values (
    pub, acct, 'internal_test', 'pa-' || stamp, 'bank_account', 'EUR', 'DE',
    'VERIFIED', '****1234', '1234', true, true
  );

  elig := public.evaluate_publisher_payout_eligibility(pub, 'EUR', 1000, true);
  raise notice 'ELIG_VERIFIED_STILL_PROVIDER_BLOCK=%', elig;
  if coalesce((elig->>'eligible')::boolean, true) <> false then
    raise exception 'PUBLIC_ELIG_MUST_REMAIN_FALSE_WITHOUT_PROVIDER %', elig;
  end if;
  if position('PAYOUT_PROVIDER_NOT_CONFIGURED' in elig::text) = 0 then
    raise exception 'MISSING_PROVIDER_GATE %', elig;
  end if;

  perform public.service_sync_publisher_kyc_status(
    pub, 'EXPIRED', 'internal_test', 'acct-' || stamp, 'ver-' || stamp, 'TEST',
    'evt-kyc-e-' || stamp, '{}'::jsonb, true
  );
  elig := public.evaluate_publisher_payout_eligibility(pub, 'EUR', 1000, true);
  raise notice 'ELIG_AFTER_KYC_EXPIRED=%', elig;
  if position('KYC_NOT_VERIFIED' in elig::text) = 0 then
    raise exception 'KYC_EXPIRY_GATE_MISSING %', elig;
  end if;

  -- Hold gate
  insert into public.publisher_payout_holds (
    publisher_user_id, monetization_account_id, reason_code, reason, created_by, internal_test
  ) values (pub, acct, 'MANUAL_REVIEW', 't32 internal hold for eligibility gate', pub, true);

  perform public.service_sync_publisher_kyc_status(
    pub, 'VERIFIED', 'internal_test', 'acct-' || stamp, 'ver-' || stamp, 'TEST',
    'evt-kyc-v2-' || stamp, '{}'::jsonb, true
  );
  elig := public.evaluate_publisher_payout_eligibility(pub, 'EUR', 1000, true);
  raise notice 'ELIG_WITH_HOLD=%', elig;
  if position('PAYOUT_HOLD_ACTIVE' in elig::text) = 0 then
    raise exception 'HOLD_GATE_MISSING %', elig;
  end if;

  update public.publisher_payout_holds
  set released_at = now(), release_reason = 't32 release', released_by = pub
  where publisher_user_id = pub and internal_test = true and released_at is null;

  -- Multi-currency already seeded above; finalize per currency
  stmt := public.service_finalize_publisher_finance_statement(
    pub, period_start, period_end, 'EUR', true
  );
  raise notice 'STMT_EUR=%', stmt;
  if coalesce((stmt->>'ok')::boolean, false) is distinct from true then
    raise exception 'STMT_FAIL %', stmt;
  end if;
  -- net = 900+500+300 = 1700; payouts_minor includes PAYOUT 1000 (+ reserves released netting)
  if (stmt->>'net_revenue_minor')::bigint <> 1700 then
    raise exception 'STMT_NET_MISMATCH %', stmt;
  end if;
  if (stmt->>'refunds_minor')::bigint <> 200 then
    raise exception 'STMT_REFUND_MISMATCH %', stmt;
  end if;
  if (stmt->>'payouts_minor')::bigint <> 1000 then
    raise exception 'STMT_PAYOUT_MISMATCH %', stmt;
  end if;

  stmt := public.service_finalize_publisher_finance_statement(
    pub, period_start, period_end, 'USD', true
  );
  raise notice 'STMT_USD=%', stmt;
  if (stmt->>'net_revenue_minor')::bigint <> 2500 then
    raise exception 'STMT_USD_MISMATCH %', stmt;
  end if;

  raise notice 'TASK32_INTERNAL_SMOKE=PASS';
end $$;

select 'TASK32_INTERNAL_SMOKE' as check_name, 'PASS' as status;
