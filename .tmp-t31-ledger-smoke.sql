-- TASK31 internal ledger mechanics (internal_test only; not real revenue)
do $$
declare
  pub uuid;
  acct uuid;
  sub_id uuid := gen_random_uuid();
  r jsonb;
  avail bigint;
begin
  select id into pub from public.profiles limit 1;
  if pub is null then
    raise notice 'NO_PROFILE_SKIP';
    return;
  end if;

  insert into public.monetization_accounts (subject_type, subject_id, program_type, monetization_status, eligibility_status, default_currency)
  values ('user', pub, 'publisher', 'eligible', 'ELIGIBLE', 'EUR')
  on conflict do nothing;

  select id into acct from public.monetization_accounts
  where subject_id = pub and program_type = 'publisher'
  order by updated_at desc limit 1;

  r := public.service_record_subscription_revenue(
    pub, acct, sub_id, 1000, 100, 0, 'EUR', now(),
    'test-tx-t31', 'evt-t31-sub-1', 'corr-t31-1', 'idem-t31-sub-1', null, true
  );
  raise notice 'sub1=%', r;

  r := public.service_record_subscription_revenue(
    pub, acct, sub_id, 1000, 100, 0, 'EUR', now(),
    'test-tx-t31', 'evt-t31-sub-1', 'corr-t31-1', 'idem-t31-sub-1', null, true
  );
  raise notice 'sub_replay=%', r;

  select coalesce(sum(case when direction='credit' then amount_minor else -amount_minor end),0)
  into avail
  from public.publisher_finance_ledger_entries
  where publisher_user_id = pub and internal_test = true and balance_bucket in ('available','refunded_or_reversed');

  raise notice 'available_after_sub=%', avail;

  r := public.service_record_refund(
    pub, acct, 'subscription', sub_id, 900, 'EUR', null,
    'test-ref-t31', 'evt-t31-ref-1', 'corr-t31-ref', 'idem-t31-ref-1', true
  );
  raise notice 'refund=%', r;

  select coalesce(sum(case when direction='credit' then amount_minor else -amount_minor end),0)
  into avail
  from public.publisher_finance_ledger_entries
  where publisher_user_id = pub and internal_test = true and balance_bucket in ('available','refunded_or_reversed');

  raise notice 'available_after_refund=%', avail;
end $$;

select count(*) as ledger_internal_test_rows
from public.publisher_finance_ledger_entries
where internal_test = true;
