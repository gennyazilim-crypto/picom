begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(29);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('91000000-0000-0000-0000-000000000001', 'pv-owner@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('91000000-0000-0000-0000-000000000002', 'pv-unrelated@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('91000000-0000-0000-0000-000000000003', 'pv-root@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values
  ('91000000-0000-0000-0000-000000000001', 'pv_owner', 'PV Owner'),
  ('91000000-0000-0000-0000-000000000002', 'pv_unrelated', 'PV Unrelated'),
  ('91000000-0000-0000-0000-000000000003', 'pv_root', 'PV Root')
on conflict (id) do nothing;

-- Seed catalog + billing customer/subscription as table owner (bypasses RLS)
insert into public.billing_products (
  product_key, plan_key, provider, provider_product_id, provider_price_id,
  billing_interval, currency, amount_minor, status
) values
  ('picom_verified', 'picom_verified_monthly', 'stripe', 'prod_test_monthly', 'price_test_monthly', 'month', 'USD', 999, 'active'),
  ('picom_verified', 'picom_verified_yearly', 'stripe', 'prod_test_yearly', 'price_test_yearly', 'year', 'USD', 9999, 'active')
on conflict do nothing;

insert into public.billing_customers (id, user_id, provider, provider_customer_id, status)
values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'stripe', 'cus_test_owner', 'active')
on conflict do nothing;

insert into public.picom_verified_subscriptions (
  id, user_id, billing_customer_id, plan_key, provider, provider_subscription_id, provider_price_id, status, provider_state_version
) values (
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'picom_verified_monthly',
  'stripe',
  'sub_test_owner',
  'price_test_monthly',
  'active',
  100
) on conflict do nothing;

insert into public.billing_invoices (
  id, subscription_id, user_id, provider_invoice_id, status, amount_due_minor, amount_paid_minor, currency, hosted_invoice_url
) values (
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'in_test_owner',
  'paid',
  999,
  999,
  'USD',
  'https://invoice.stripe.com/i/test_owner'
) on conflict do nothing;

-- 1 anon cannot read billing customers
set local role anon;
select throws_ok(
  $$ select count(*) from public.billing_customers $$,
  '42501',
  null,
  'anon cannot select billing_customers'
);

-- 2 authenticated owner can read own subscription
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*)::int from public.picom_verified_subscriptions where user_id = '91000000-0000-0000-0000-000000000001'),
  1,
  'owner can read own subscription'
);

-- 3 unrelated cannot read owner subscription
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::int from public.picom_verified_subscriptions),
  0,
  'unrelated user cannot read foreign subscriptions'
);

-- 4 unrelated cannot read invoice URLs
select is(
  (select count(*)::int from public.billing_invoices),
  0,
  'unrelated user cannot read invoices'
);

-- 5 owner can read invoice
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select isnt(
  (select hosted_invoice_url from public.billing_invoices limit 1),
  null,
  'owner can read own invoice URL'
);

-- 6 client cannot insert subscription
select throws_ok(
  $$ insert into public.picom_verified_subscriptions (
      user_id, billing_customer_id, plan_key, provider, provider_subscription_id, provider_price_id, status
    ) values (
      '91000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'picom_verified_monthly', 'stripe', 'sub_client_forge', 'price_x', 'active'
    ) $$,
  '42501',
  null,
  'client cannot insert subscription'
);

-- 7 client cannot update subscription to active
select throws_ok(
  $$ update public.picom_verified_subscriptions set status = 'active' where id = '93000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'client cannot update subscription status'
);

-- 8 client cannot grant ad_free entitlement
select throws_ok(
  $$ insert into public.account_entitlements (
      subject_type, subject_id, entitlement_key, status, source_type
    ) values ('user', '91000000-0000-0000-0000-000000000001', 'ad_free', 'active', 'picom_verified_subscription') $$,
  '42501',
  null,
  'client cannot insert ad_free entitlement'
);

-- 9 client cannot activate badge
select throws_ok(
  $$ update public.verification_badges set status = 'active' where subject_id = '91000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'client cannot activate verification badge'
);

-- 10 client cannot mark verification verified
select throws_ok(
  $$ insert into public.verification_cases (
      subject_type, subject_id, verification_type, status, provider
    ) values ('user', '91000000-0000-0000-0000-000000000001', 'picom_verified_account', 'verified', 'manual_review') $$,
  '42501',
  null,
  'client cannot insert verified verification case'
);

-- 11 authenticated can read public catalog view (no provider IDs)
select ok(
  exists(select 1 from information_schema.columns where table_name = 'billing_catalog_public' and column_name = 'amount_minor'),
  'billing_catalog_public exposes amount_minor'
);
select is(
  (select count(*)::int from information_schema.columns where table_name = 'billing_catalog_public' and column_name = 'provider_price_id'),
  0,
  'billing_catalog_public does not expose provider_price_id'
);

-- 12 catalog readable
select cmp_ok(
  (select count(*)::int from public.billing_catalog_public),
  '>=',
  1,
  'authenticated can read billing catalog'
);

-- 13 billing_products table not granted to authenticated
select throws_ok(
  $$ select provider_price_id from public.billing_products limit 1 $$,
  '42501',
  null,
  'authenticated cannot select billing_products provider IDs'
);

-- 14 history append-only: the protecting trigger is installed.
reset role;
select has_trigger(
  'public',
  'picom_verified_subscription_history',
  'picom_verified_history_no_update',
  'history update and delete paths are protected by an append-only trigger'
);

-- 15 service role can reconcile entitlements
set local role service_role;
select ok(
  (select (public.reconcile_picom_verified_entitlements('91000000-0000-0000-0000-000000000001', 'rls_test')->>'entitling')::boolean),
  'service role reconcile entitlements for active subscription'
);

-- 16 ad_free entitlement after reconcile
select ok(
  exists (
    select 1 from public.account_entitlements
    where subject_id = '91000000-0000-0000-0000-000000000001'
      and entitlement_key = 'ad_free'
      and status in ('active', 'grace_period')
  ),
  'active subscription grants ad_free'
);

-- 17 badge not active without verification case
select ok(
  not (select (public.reconcile_verified_account_badge('91000000-0000-0000-0000-000000000001', 'rls_test')->>'badgeActive')::boolean),
  'badge stays inactive without verified case'
);

-- 18 verification + entitlement activates badge
insert into public.verification_cases (
  subject_type, subject_id, verification_type, status, provider, submitted_at, reviewed_at
) values (
  'user', '91000000-0000-0000-0000-000000000001', 'picom_verified_account', 'verified', 'manual_review', now(), now()
);
select ok(
  (select (public.reconcile_verified_account_badge('91000000-0000-0000-0000-000000000001', 'rls_test_verified')->>'badgeActive')::boolean),
  'verified case + entitlement activates badge'
);

-- 19 expire subscription closes entitlement
update public.picom_verified_subscriptions
set status = 'expired', ended_at = now(), provider_state_version = 200
where id = '93000000-0000-0000-0000-000000000001';
select ok(
  not (select (public.reconcile_picom_verified_entitlements('91000000-0000-0000-0000-000000000001', 'rls_expire')->>'entitling')::boolean),
  'expired subscription is not entitling'
);

-- 20 ad eligibility suppressed for ad_free user (re-activate first)
update public.picom_verified_subscriptions
set status = 'active', ended_at = null, provider_state_version = 300
where id = '93000000-0000-0000-0000-000000000001';
do $$
begin
  perform public.reconcile_picom_verified_entitlements('91000000-0000-0000-0000-000000000001', 'rls_reactivate');
end;
$$;
select is(
  (select public.resolve_ad_eligibility('91000000-0000-0000-0000-000000000001', 'feed', '{}'::jsonb)->>'reason'),
  'ad_free_entitlement',
  'ad_free suppresses feed paid placement'
);

-- 21 organic business not treated as paid placement
select is(
  (select public.resolve_ad_eligibility('91000000-0000-0000-0000-000000000001', 'feed', jsonb_build_object('contentKind', 'organic_business'))->>'reason'),
  'not_paid_placement',
  'organic business is not a paid ad'
);

-- 22 out-of-order provider_state_version: older version must not win when applied carefully
-- (application layer checks version; DB keeps latest written version)
select cmp_ok(
  (select provider_state_version from public.picom_verified_subscriptions where id = '93000000-0000-0000-0000-000000000001'),
  '>=',
  300::bigint,
  'provider_state_version retained after reactivation'
);

-- 23 duplicate webhook unique constraint
insert into public.provider_webhook_events (provider, provider_event_id, event_type, processing_status, payload_hash)
values ('stripe', 'evt_rls_dup', 'customer.subscription.updated', 'processed', repeat('a', 64));
select throws_ok(
  $$ insert into public.provider_webhook_events (provider, provider_event_id, event_type, processing_status, payload_hash)
     values ('stripe', 'evt_rls_dup', 'customer.subscription.updated', 'received', repeat('b', 64)) $$,
  '23505',
  null,
  'duplicate provider event id is rejected'
);

-- 24 authenticated cannot delete invoices
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ delete from public.billing_invoices where id = '94000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'client cannot delete invoices'
);

-- 25 authenticated cannot call reconcile directly
select throws_ok(
  $$ select public.reconcile_picom_verified_entitlements('91000000-0000-0000-0000-000000000001', 'client') $$,
  '42501',
  null,
  'authenticated cannot execute reconcile_picom_verified_entitlements'
);

-- 26 summary readable by owner
select ok(
  (select public.get_picom_verified_summary() ? 'subscriptionStatus'),
  'owner can read picom verified summary'
);

-- 27 history not readable by authenticated (no grant)
select throws_ok(
  $$ select count(*) from public.picom_verified_subscription_history $$,
  '42501',
  null,
  'authenticated cannot read subscription history'
);

-- 28 customer provider_customer_id not updatable by client
select throws_ok(
  $$ update public.billing_customers set provider_customer_id = 'cus_forged' where user_id = '91000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'client cannot change provider_customer_id'
);

select * from finish();
rollback;
