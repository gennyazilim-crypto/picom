-- Partner payout / tax / reconciliation RLS contract (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select has_table('public', 'payout_profiles', 'payout_profiles table');
select has_table('public', 'tax_profiles', 'tax_profiles table');
select has_table('public', 'payout_batches', 'payout_batches table');
select has_table('public', 'payout_items', 'payout_items table');
select has_table('public', 'payout_item_accruals', 'payout_item_accruals table');
select has_table('public', 'finance_holds', 'finance_holds table');
select has_table('public', 'finance_reserves', 'finance_reserves table');
select has_table('public', 'financial_adjustments', 'financial_adjustments table');
select has_table('public', 'financial_reconciliation_runs', 'financial_reconciliation_runs table');
select has_table('public', 'ad_transparency_archive', 'ad_transparency_archive table');
select has_function(
  'public',
  'resolve_payout_eligibility',
  array['uuid', 'text'],
  'resolve_payout_eligibility'
);
select has_function(
  'public',
  'compute_partner_balance',
  array['uuid', 'text'],
  'compute_partner_balance'
);
select has_function(
  'public',
  'create_payout_batch',
  array['timestamptz', 'timestamptz', 'text', 'text', 'text'],
  'create_payout_batch'
);
select has_function(
  'public',
  'preview_payout_batch',
  array['timestamptz', 'timestamptz', 'text', 'text'],
  'preview_payout_batch'
);
select has_function(
  'public',
  'approve_payout_batch',
  array['uuid'],
  'approve_payout_batch'
);
select has_function(
  'public',
  'claim_payout_batch_for_processing',
  array['uuid'],
  'claim_payout_batch_for_processing'
);
select has_function(
  'public',
  'get_public_ad_transparency_archive',
  array['integer'],
  'get_public_ad_transparency_archive'
);
select has_function(
  'public',
  'materialize_ad_transparency_archive',
  array['uuid'],
  'materialize_ad_transparency_archive'
);
select has_function(
  'public',
  'apply_provider_payout_item_event',
  array['text', 'text', 'text', 'text'],
  'apply_provider_payout_item_event'
);
select has_function(
  'public',
  'root_toggle_payout_setting',
  array['text', 'boolean'],
  'root_toggle_payout_setting'
);

select ok(
  not has_function_privilege('authenticated', 'public.payout_allow_internal_transition()', 'EXECUTE'),
  'authenticated cannot execute payout_allow_internal_transition'
);
select ok(
  not has_table_privilege('authenticated', 'public.payout_batches', 'INSERT'),
  'authenticated cannot insert payout_batches'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$ insert into public.payout_batches (
      batch_key, period_start, period_end, currency, status, idempotency_key, created_by
    ) values (
      'client-batch', now(), now() + interval '1 day', 'USD', 'draft', 'client-batch',
      '92000000-0000-4000-8000-000000000001'
    ) $$,
  '42501',
  null,
  'authenticated client cannot insert payout batches directly'
);

reset role;

-- Fixture for transition guards (owner path, no internal GUC, no platform admin).
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values (
  '92000000-0000-4000-8000-000000000001',
  'payout-rls@picom.test',
  'test',
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
) on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values ('92000000-0000-4000-8000-000000000001', 'payout_rls', 'Payout RLS')
on conflict (id) do nothing;

insert into public.monetization_accounts (
  id, subject_type, subject_id, program_type, badge_status, monetization_status,
  payout_onboarding_status, compliance_status
) values (
  '92000000-0000-4000-8000-000000000010',
  'user',
  '92000000-0000-4000-8000-000000000001',
  'creator',
  'active',
  'active',
  'incomplete',
  'clear'
) on conflict (id) do nothing;

insert into public.payout_profiles (
  id, owner_type, owner_id, monetization_account_id, payee_type, legal_name,
  country_code, payout_currency, onboarding_status, payout_status
) values (
  '92000000-0000-4000-8000-000000000020',
  'user',
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000010',
  'individual',
  'Payout RLS User',
  'US',
  'USD',
  'pending',
  'disabled'
) on conflict (id) do nothing;

insert into public.tax_profiles (
  id, owner_type, owner_id, payout_profile_id, tax_entity_type,
  tax_residency_country, tax_form_status
) values (
  '92000000-0000-4000-8000-000000000030',
  'user',
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000020',
  'individual',
  'US',
  'submitted'
) on conflict (id) do nothing;

select throws_ok(
  $$ update public.tax_profiles
       set tax_form_status = 'verified'
     where id = '92000000-0000-4000-8000-000000000030' $$,
  '42501',
  null,
  'tax verified transitions are guarded'
);

select throws_ok(
  $$ update public.payout_profiles
       set onboarding_status = 'complete'
     where id = '92000000-0000-4000-8000-000000000020' $$,
  '42501',
  null,
  'payout onboarding complete is guarded'
);

select ok(
  (
    select coalesce(
      (select (setting_value #>> '{}') from public.payout_platform_settings where setting_key = 'real_payouts_enabled'),
      'false'
    ) = 'false'
  ),
  'real_payouts_enabled remains off'
);

select * from finish();
rollback;
