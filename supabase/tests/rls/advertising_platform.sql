-- Advertising platform RLS / ACL contract (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

select has_table('public', 'ad_spend_ledger', 'ad_spend_ledger table');
select has_table('public', 'ad_delivery_decisions', 'ad_delivery_decisions table');
select has_table('public', 'ad_placements', 'ad_placements table');
select has_table('public', 'campaign_budget_reservations', 'campaign_budget_reservations table');
select has_table('public', 'ad_partner_attributions', 'ad_partner_attributions table');
select has_function(
  'public',
  'resolve_ad_delivery',
  array['uuid', 'text', 'text', 'jsonb', 'text'],
  'resolve_ad_delivery'
);
select has_function(
  'public',
  'record_ad_impression',
  array['uuid', 'numeric', 'integer', 'text', 'uuid', 'text'],
  'record_ad_impression'
);
select has_function(
  'public',
  'record_ad_click',
  array['uuid', 'text', 'uuid'],
  'record_ad_click'
);
select has_function(
  'public',
  'reserve_campaign_budget',
  array['uuid', 'uuid', 'bigint', 'text', 'text'],
  'reserve_campaign_budget'
);
select has_function(
  'public',
  'root_toggle_advertising_global',
  array['boolean'],
  'root_toggle_advertising_global'
);

select ok(
  not has_function_privilege('anon', 'public.ads_allow_internal_transition()', 'EXECUTE'),
  'anon cannot execute ads_allow_internal_transition'
);
select ok(
  not has_function_privilege('authenticated', 'public.ads_allow_internal_transition()', 'EXECUTE'),
  'authenticated cannot execute ads_allow_internal_transition'
);
select ok(
  not exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'ads_allow_internal_transition'
      and grantee = 'PUBLIC'
      and privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute ads_allow_internal_transition'
);
select ok(
  has_function_privilege('service_role', 'public.ads_allow_internal_transition()', 'EXECUTE'),
  'service_role retains ads_allow_internal_transition execute'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$ insert into public.ad_spend_ledger (
      advertiser_account_id, entry_type, gross_amount_minor, credit_amount_minor,
      cash_amount_minor, currency, idempotency_key
    ) values (
      '91000000-0000-4000-8000-000000000099', 'impression_charge', 1, 0, 1, 'USD', 'client-insert'
    ) $$,
  '42501',
  null,
  'authenticated client cannot insert spend ledger'
);

reset role;

-- Append-only trigger fires for privileged updater (owner path).
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values (
  '91000000-0000-4000-8000-000000000001',
  'ads-rls@picom.test',
  'test',
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
) on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values ('91000000-0000-4000-8000-000000000001', 'ads_rls', 'Ads RLS')
on conflict (id) do nothing;

insert into public.advertiser_accounts (
  id, owner_type, owner_id, advertiser_type, display_name, advertising_status
) values (
  '91000000-0000-4000-8000-000000000010',
  'user',
  '91000000-0000-4000-8000-000000000001',
  'individual',
  'Ads RLS Fixture',
  'active'
) on conflict (id) do nothing;

insert into public.ad_spend_ledger (
  id, advertiser_account_id, entry_type, gross_amount_minor, credit_amount_minor,
  cash_amount_minor, currency, idempotency_key, status
) values (
  '91000000-0000-4000-8000-000000000020',
  '91000000-0000-4000-8000-000000000010',
  'impression_charge',
  1,
  0,
  1,
  'USD',
  'ads-rls-fixture-ledger-1',
  'confirmed'
) on conflict (id) do nothing;

select throws_ok(
  $$ update public.ad_spend_ledger
       set status = 'reversed'
     where id = '91000000-0000-4000-8000-000000000020' $$,
  '55000',
  null,
  'spend ledger update path is append-only guarded'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'platform_role_catalog'),
  'platform_role_catalog RLS enabled'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_live_screen_sessions'
      and column_name = 'metadata'
  ),
  'live screen session metadata column present'
);
select ok(
  not has_table_privilege('anon', 'public.platform_role_catalog', 'INSERT'),
  'anon cannot insert platform_role_catalog'
);
select ok(
  (
    select coalesce(
      (select (setting_value #>> '{}') from public.ad_platform_settings where setting_key = 'advertising_global_enabled'),
      'false'
    ) = 'false'
  ),
  'advertising_global_enabled remains off'
);

select * from finish();
rollback;
