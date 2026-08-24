begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(38);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('72000000-0000-0000-0000-000000000001', 'vb-owner@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000002', 'vb-unrelated@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000003', 'vb-analyst@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000004', 'vb-content@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000005', 'vb-business@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000006', 'vb-root@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000007', 'vb-advertiser@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values
  ('72000000-0000-0000-0000-000000000001', 'vb_owner', 'VB Owner'),
  ('72000000-0000-0000-0000-000000000002', 'vb_unrelated', 'VB Unrelated'),
  ('72000000-0000-0000-0000-000000000003', 'vb_analyst', 'VB Analyst'),
  ('72000000-0000-0000-0000-000000000004', 'vb_content', 'VB Content'),
  ('72000000-0000-0000-0000-000000000005', 'vb_business', 'VB Business'),
  ('72000000-0000-0000-0000-000000000006', 'vb_root', 'VB Root'),
  ('72000000-0000-0000-0000-000000000007', 'vb_advertiser', 'VB Advertiser')
on conflict (id) do nothing;

insert into public.organizations (id, display_name, status, created_by)
values
  ('82000000-0000-0000-0000-000000000001', 'RLS Organization A', 'active', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', 'RLS Organization B', 'active', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000003', 'RLS Suspended Org', 'suspended', '72000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, created_by)
values
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'organization_owner', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000003', 'analyst', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000004', 'content_manager', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000005', 'business_admin', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'organization_owner', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', 'organization_owner', '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000004', 'content_manager', '72000000-0000-0000-0000-000000000001')
on conflict (organization_id, user_id) do nothing;

insert into public.business_profiles (organization_id, slug, display_name, legal_name, public_status, published_at)
values
  ('82000000-0000-0000-0000-000000000001', 'rls-org-a', 'RLS Org A', 'RLS Org A LLC', 'published', now()),
  ('82000000-0000-0000-0000-000000000002', 'rls-org-b', 'RLS Org B', 'RLS Org B LLC', 'draft', null)
on conflict (organization_id) do nothing;

insert into public.business_applications (id, organization_id, applicant_user_id, legal_name, brand_name, company_type, registered_country, registered_address, representative_name, status, submitted_at, internal_review_notes)
values ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'RLS Org A LLC', 'RLS Org A', 'limited_company', 'DE', 'Test Street 1', 'Owner', 'submitted', now(), 'INTERNAL_ONLY_NOTES')
on conflict (id) do nothing;

insert into public.business_products (id, organization_id, name, slug, product_type, currency, status, moderation_status, created_by, published_at, price_amount_minor)
values
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Public Product A', 'public-product-a', 'software', 'USD', 'published', 'approved', '72000000-0000-0000-0000-000000000001', now(), 1999),
  ('84000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'Draft Product B', 'draft-product-b', 'software', 'USD', 'draft', 'pending', '72000000-0000-0000-0000-000000000001', null, 500)
on conflict (id) do nothing;

insert into public.business_posts (id, organization_id, author_user_id, post_type, body, status, sponsorship_state)
values ('85000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'brand_update', 'A real organic brand update.', 'draft', 'organic')
on conflict (id) do nothing;

insert into public.revenue_share_contracts (id, program_type, version, effective_from, platform_percentage, partner_percentage, minimum_payout_amount_minor, currency, status)
values ('86000000-0000-0000-0000-000000000001', 'creator', 'rls-v1', now(), 30.0000, 70.0000, 0, 'USD', 'active')
on conflict (id) do nothing;

insert into public.monetization_accounts (id, subject_type, subject_id, program_type, badge_status, monetization_status, payout_onboarding_status, compliance_status, contract_id)
values ('87000000-0000-0000-0000-000000000001', 'user', '72000000-0000-0000-0000-000000000001', 'creator', 'active', 'pending', 'incomplete', 'pending', '86000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.revenue_ledger (id, monetization_account_id, earning_period_start, earning_period_end, gross_revenue_minor, platform_share_minor, partner_share_minor, net_payable_minor, currency, contract_id, correlation_id, idempotency_key)
values ('88000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', now() - interval '1 day', now(), 10000, 3000, 7000, 7000, 'USD', '86000000-0000-0000-0000-000000000001', 'rls-fixture', 'rls-fixture-key-0001')
on conflict (id) do nothing;

insert into public.verification_badges (id, subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, is_primary)
values ('89000000-0000-0000-0000-000000000001', 'user', '72000000-0000-0000-0000-000000000001', 'verified', 'Verified', 'Approved through the controlled RLS test fixture.', '72000000-0000-0000-0000-000000000006', 'active', true)
on conflict (id) do nothing;

insert into public.verification_badges (id, subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, is_primary)
values ('89000000-0000-0000-0000-000000000002', 'organization', '82000000-0000-0000-0000-000000000001', 'business', 'Business verified', 'Approved through the controlled RLS test fixture.', '72000000-0000-0000-0000-000000000006', 'active', true)
on conflict (id) do nothing;

insert into public.app_admins (user_id) values ('72000000-0000-0000-0000-000000000006') on conflict (user_id) do nothing;

-- Constraint / money precision checks (service role / postgres context)
select throws_like(
  $$ insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, is_primary)
     values ('user', '72000000-0000-0000-0000-000000000001', 'verified', 'Verified Dup', 'Duplicate active verified badge must be rejected by unique index.', '72000000-0000-0000-0000-000000000006', 'active', false) $$,
  '%duplicate%',
  'duplicate active badge of the same type is rejected'
);
select throws_like(
  $$ insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, is_primary)
     values ('user', '72000000-0000-0000-0000-000000000001', 'creator', 'Creator', 'Second primary personal badge must be rejected.', '72000000-0000-0000-0000-000000000006', 'active', true) $$,
  '%duplicate%',
  'multiple primary personal badges are rejected'
);
select throws_like(
  $$ insert into public.business_products(organization_id, name, slug, product_type, currency, status, moderation_status, created_by, price_amount_minor, compare_at_price_amount_minor)
     values ('82000000-0000-0000-0000-000000000001', 'Bad Price', 'bad-price', 'software', 'USD', 'draft', 'pending', '72000000-0000-0000-0000-000000000001', 2000, 1000) $$,
  '%',
  'compare-at price below price amount is rejected (money precision contract)'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok($$ select public.submit_verification_case('user', '72000000-0000-0000-0000-000000000001', 'picom_verified', '{}'::jsonb) $$, 'resource owner can submit an own verification case');
select throws_like($$ insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by, status) values ('user', '72000000-0000-0000-0000-000000000001', 'creator', 'Creator', 'Attempted client-side badge activation must fail.', '72000000-0000-0000-0000-000000000001', 'active') $$, '%', 'user cannot self-activate a badge');
select throws_like($$ update public.verification_badges set status = 'active' where id = '89000000-0000-0000-0000-000000000001' $$, '%', 'user cannot mutate badge status to active');
select throws_like($$ insert into public.account_entitlements(subject_type, subject_id, entitlement_key, status, source_type) values ('user', '72000000-0000-0000-0000-000000000001', 'ad_free', 'active', 'client') $$, '%', 'user cannot create an ad-free entitlement');

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000002', true);
select results_eq($$ select count(*)::bigint from public.verification_cases where subject_id = '72000000-0000-0000-0000-000000000001' $$, array[0::bigint], 'unrelated user cannot read another verification case');
select results_eq($$ select count(*)::bigint from public.business_profiles where organization_id = '82000000-0000-0000-0000-000000000002' $$, array[0::bigint], 'organization B outsider cannot read an unpublished editor profile');
select throws_ok($$ select legal_name from public.business_profiles where organization_id = '82000000-0000-0000-0000-000000000001' $$, '42501', null, 'organization B outsider cannot read private legal_name of a published profile');
select results_eq($$ select count(*)::bigint from public.business_products where id = '84000000-0000-0000-0000-000000000002' $$, array[0::bigint], 'unrelated user cannot read a draft product');
select results_eq($$ select count(*)::bigint from public.advertiser_accounts $$, array[0::bigint], 'non-member cannot obtain advertiser account access');
select results_eq($$ select count(*)::bigint from public.business_application_owner_views $$, array[0::bigint], 'unrelated user cannot read application owner views');

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000003', true);
select throws_like($$ insert into public.business_products(organization_id, name, slug, product_type, currency, status, moderation_status, created_by) values ('82000000-0000-0000-0000-000000000001', 'Analyst Product', 'analyst-product', 'software', 'USD', 'draft', 'pending', '72000000-0000-0000-0000-000000000003') $$, '%', 'organization analyst cannot create a product');
select results_eq($$ select count(*)::bigint from public.business_applications $$, array[0::bigint], 'analyst cannot read billing or legal application data');
select results_eq($$ select count(*)::bigint from public.business_application_owner_views $$, array[0::bigint], 'analyst cannot read application owner views');

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000004', true);
select lives_ok($$ insert into public.business_products(organization_id, name, slug, product_type, currency, status, moderation_status, created_by) values ('82000000-0000-0000-0000-000000000001', 'Content Draft', 'content-draft', 'software', 'USD', 'draft', 'pending', '72000000-0000-0000-0000-000000000004') $$, 'organization content manager can create a draft product');
select throws_like($$ insert into public.organization_members(organization_id, user_id, role, created_by) values ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000007', 'organization_owner', '72000000-0000-0000-0000-000000000004') $$, '%', 'content manager cannot grant organization owner role');
select results_eq($$ select count(*)::bigint from public.business_applications $$, array[0::bigint], 'content manager cannot read business billing fields');
select throws_like($$ insert into public.business_post_products(post_id, product_id, position) values ('85000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000002', 0) $$, '%CROSS_ORGANIZATION_POST_PRODUCT_FORBIDDEN%', 'cross-organization product tagging is rejected');
select throws_like($$ insert into public.business_products(organization_id, name, slug, product_type, currency, status, moderation_status, created_by) values ('82000000-0000-0000-0000-000000000003', 'Suspended Draft', 'suspended-draft', 'software', 'USD', 'draft', 'pending', '72000000-0000-0000-0000-000000000004') $$, '%', 'suspended organization cannot publish or create products');

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000005', true);
select lives_ok($$ select public.upsert_business_profile('82000000-0000-0000-0000-000000000001', 'rls-org-a', 'RLS Org A Edited', '', '', null, null, null, null, null, null, null, null, null, null) $$, 'business admin can edit a brand profile through its server contract');
select throws_like($$ insert into public.revenue_ledger(monetization_account_id, earning_period_start, earning_period_end, gross_revenue_minor, platform_share_minor, partner_share_minor, net_payable_minor, currency, contract_id, correlation_id, idempotency_key) values ('87000000-0000-0000-0000-000000000001', now() - interval '1 day', now(), 1, 0, 1, 1, 'USD', '86000000-0000-0000-0000-000000000001', 'business-admin-write', 'business-admin-write-key-0001') $$, '%', 'business admin cannot mutate financial ledger rows');

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select lives_ok($$ select public.manage_organization_member('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000007', 'analyst', 'add') $$, 'organization owner can manage members through server-side role controls');
select results_eq($$ select count(*)::bigint from public.public_profile_badges where subject_id = '72000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'user can read own active public badge list');
select results_eq($$ select count(*)::bigint from public.monetization_accounts where subject_id = '72000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'creator can read own monetization status');
select results_eq($$ select count(*)::bigint from public.business_application_owner_views where id = '83000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'organization owner can read application status without needing table-level internal notes');
select throws_like($$ insert into public.revenue_ledger(monetization_account_id, earning_period_start, earning_period_end, gross_revenue_minor, platform_share_minor, partner_share_minor, net_payable_minor, currency, contract_id, correlation_id, idempotency_key) values ('87000000-0000-0000-0000-000000000001', now() - interval '1 day', now(), 1, 0, 1, 1, 'USD', '86000000-0000-0000-0000-000000000001', 'client-write', 'client-write-key-0001') $$, '%', 'client cannot insert revenue ledger rows');
select throws_like($$ delete from public.revenue_ledger where id = '88000000-0000-0000-0000-000000000001' $$, '%', 'client cannot delete revenue ledger rows');
select results_eq($$ select count(*)::bigint from public.revenue_ledger where id = '88000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'ledger row remains after denied client delete');
select lives_ok($$ select public.create_advertiser_account('user', '72000000-0000-0000-0000-000000000001', 'individual', 'Owner Ads') $$, 'user can create advertiser account without business badge');

reset role;
select throws_like($$ insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by, status) values ('user', '72000000-0000-0000-0000-000000000002', 'business', 'Business', 'Business badges require organization subjects at database level.', '72000000-0000-0000-0000-000000000006', 'active') $$, '%BUSINESS_BADGE_REQUIRES_ORGANIZATION%', 'business badge cannot be active on a user subject');
select throws_like($$ update public.revenue_ledger set net_payable_minor = 0 where id = '88000000-0000-0000-0000-000000000001' $$, '%REVENUE_LEDGER_APPEND_ONLY%', 'revenue ledger is append-only even for database writers');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select results_eq($$ select count(*)::bigint from public.public_business_profiles where slug = 'rls-org-a' $$, array[1::bigint], 'public can read a published business profile');
select results_eq($$ select count(*)::bigint from public.public_business_profiles where slug = 'rls-org-b' $$, array[0::bigint], 'anon cannot read an unpublished business profile');
select results_eq($$ select count(*)::bigint from public.public_business_products where id = '84000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'public can read published business products');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq($$ select count(*)::bigint from public.business_applications where id = '83000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'root admin can read application review data');
select ok(not has_column_privilege('authenticated', 'public.business_applications', 'internal_review_notes', 'select'), 'internal review notes are not granted to client roles');

select * from finish();
rollback;
