begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('a2000000-0000-4000-8000-000000000001', 'siv-owner@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000002', 'siv-outsider@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000003', 'siv-admin@picom.test', 'test', now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values
  ('a2000000-0000-4000-8000-000000000001', 'siv_owner', 'SIV Owner'),
  ('a2000000-0000-4000-8000-000000000002', 'siv_outsider', 'SIV Outsider'),
  ('a2000000-0000-4000-8000-000000000003', 'siv_admin', 'SIV Admin')
on conflict (id) do nothing;

insert into public.organizations (id, display_name, legal_name, status, created_by)
values
  ('a2100000-0000-4000-8000-000000000001', 'SIV Published Org', 'SIV Published Legal', 'active', 'a2000000-0000-4000-8000-000000000001'),
  ('a2100000-0000-4000-8000-000000000002', 'SIV Draft Org', 'SIV Draft Legal', 'active', 'a2000000-0000-4000-8000-000000000001'),
  ('a2100000-0000-4000-8000-000000000003', 'SIV Suspended Org', 'SIV Suspended Legal', 'suspended', 'a2000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, created_by)
values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'organization_owner', 'a2000000-0000-4000-8000-000000000001'),
  ('a2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'organization_owner', 'a2000000-0000-4000-8000-000000000001'),
  ('a2100000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'organization_owner', 'a2000000-0000-4000-8000-000000000001')
on conflict (organization_id, user_id) do nothing;

insert into public.business_profiles (organization_id, slug, display_name, legal_name, public_status, published_at)
values
  ('a2100000-0000-4000-8000-000000000001', 'siv-published', 'SIV Published', 'SIV Published Legal', 'published', now()),
  ('a2100000-0000-4000-8000-000000000002', 'siv-draft', 'SIV Draft', 'SIV Draft Legal', 'draft', null)
on conflict (organization_id) do nothing;

insert into public.business_applications (
  id, organization_id, applicant_user_id, legal_name, brand_name, company_type,
  registered_country, registered_address, representative_name, status, submitted_at, internal_review_notes
)
values (
  'a2300000-0000-4000-8000-000000000001',
  'a2100000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'SIV Published Legal',
  'SIV Published',
  'limited_company',
  'DE',
  'Private Street 1',
  'Owner',
  'submitted',
  now(),
  'SIV_INTERNAL_NOTES'
)
on conflict (id) do nothing;

insert into public.business_products (
  id, organization_id, name, slug, product_type, currency, status, moderation_status, created_by, published_at, price_amount_minor
)
values
  ('a2400000-0000-4000-8000-000000000001', 'a2100000-0000-4000-8000-000000000001', 'SIV Public Product', 'siv-public-product', 'software', 'USD', 'published', 'approved', 'a2000000-0000-4000-8000-000000000001', now(), 1999),
  ('a2400000-0000-4000-8000-000000000002', 'a2100000-0000-4000-8000-000000000001', 'SIV Draft Product', 'siv-draft-product', 'software', 'USD', 'draft', 'pending', 'a2000000-0000-4000-8000-000000000001', null, 500)
on conflict (id) do nothing;

insert into public.business_posts (id, organization_id, author_user_id, post_type, body, status, sponsorship_state, published_at)
values
  ('a2500000-0000-4000-8000-000000000001', 'a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'brand_update', 'SIV public organic post', 'published', 'organic', now()),
  ('a2500000-0000-4000-8000-000000000002', 'a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'brand_update', 'SIV draft post', 'draft', 'organic', null)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_posts' and column_name = 'publishing_status'
  ) then
    update public.business_posts
    set publishing_status = 'published',
        commercial_disclosure_state = coalesce(commercial_disclosure_state, 'organic')
    where id = 'a2500000-0000-4000-8000-000000000001';
  end if;
end;
$$;

insert into public.brand_assets (
  id, organization_id, asset_type, storage_path, mime_type, file_size, sha256, status, uploaded_by
)
values (
  'a2600000-0000-4000-8000-000000000001',
  'a2100000-0000-4000-8000-000000000001',
  'primary_logo',
  'siv/published-logo.png',
  'image/png',
  1024,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'active',
  'a2000000-0000-4000-8000-000000000001'
), (
  'a2600000-0000-4000-8000-000000000002',
  'a2100000-0000-4000-8000-000000000002',
  'primary_logo',
  'siv/draft-logo.png',
  'image/png',
  1024,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'active',
  'a2000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.verification_badges (id, subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, is_primary)
values
  ('a2700000-0000-4000-8000-000000000001', 'user', 'a2000000-0000-4000-8000-000000000001', 'verified', 'Verified', 'SIV public badge', 'a2000000-0000-4000-8000-000000000003', 'active', true),
  ('a2700000-0000-4000-8000-000000000002', 'organization', 'a2100000-0000-4000-8000-000000000001', 'business', 'Business', 'SIV business badge', 'a2000000-0000-4000-8000-000000000003', 'active', true)
on conflict (id) do nothing;

insert into public.verification_badges (id, subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, revoked_at, is_primary)
values (
  'a2700000-0000-4000-8000-000000000003',
  'user',
  'a2000000-0000-4000-8000-000000000002',
  'verified',
  'Revoked',
  'SIV revoked badge',
  'a2000000-0000-4000-8000-000000000003',
  'revoked',
  now(),
  false
)
on conflict (id) do nothing;

insert into public.app_admins (user_id) values ('a2000000-0000-4000-8000-000000000003') on conflict (user_id) do nothing;

select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_profile_badges'::regclass),
  'public_profile_badges uses security_invoker'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_business_profiles'::regclass),
  'public_business_profiles uses security_invoker'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_brand_assets'::regclass),
  'public_brand_assets uses security_invoker'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_business_products'::regclass),
  'public_business_products uses security_invoker'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_business_posts'::regclass),
  'public_business_posts uses security_invoker'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.business_application_owner_views'::regclass),
  'business_application_owner_views uses security_invoker'
);

select ok(has_table_privilege('anon', 'public.public_profile_badges', 'select'), 'anon can select public_profile_badges');
select ok(has_table_privilege('anon', 'public.public_business_profiles', 'select'), 'anon can select public_business_profiles');
select ok(not has_table_privilege('anon', 'public.business_application_owner_views', 'select'), 'anon cannot select owner application views');
select ok(not has_table_privilege('anon', 'public.public_business_profiles', 'insert'), 'anon cannot mutate public_business_profiles');
select ok(not has_column_privilege('anon', 'public.business_profiles', 'legal_name', 'select'), 'anon cannot select business_profiles.legal_name');
select ok(not has_column_privilege('authenticated', 'public.business_applications', 'internal_review_notes', 'select'), 'clients cannot select internal_review_notes');
select ok(not has_column_privilege('authenticated', 'public.organizations', 'legal_name', 'select'), 'clients cannot select organizations.legal_name');
select ok(not has_column_privilege('authenticated', 'public.verification_badges', 'internal_reason_code', 'select'), 'clients cannot select badge internal_reason_code');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select results_eq(
  $$ select count(*)::bigint from public.public_business_profiles where slug = 'siv-published' $$,
  array[1::bigint],
  'anon can read a published business profile through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_profiles where slug = 'siv-draft' $$,
  array[0::bigint],
  'anon cannot read an unpublished business profile through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_products where id = 'a2400000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'anon can read a published approved product through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_products where id = 'a2400000-0000-4000-8000-000000000002' $$,
  array[0::bigint],
  'anon cannot read a draft product through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_posts where id = 'a2500000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'anon can read a published organic post through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_posts where id = 'a2500000-0000-4000-8000-000000000002' $$,
  array[0::bigint],
  'anon cannot read a draft post through the public view'
);
select results_eq(
  $$ select count(*)::bigint from public.public_brand_assets where id = 'a2600000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'anon can read an active brand asset of a published business'
);
select results_eq(
  $$ select count(*)::bigint from public.public_brand_assets where id = 'a2600000-0000-4000-8000-000000000002' $$,
  array[0::bigint],
  'anon cannot read a brand asset that belongs only to an unpublished business'
);
select results_eq(
  $$ select count(*)::bigint from public.public_profile_badges where id = 'a2700000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'anon can read an active public badge'
);
select results_eq(
  $$ select count(*)::bigint from public.public_profile_badges where id = 'a2700000-0000-4000-8000-000000000003' $$,
  array[0::bigint],
  'anon cannot read a revoked badge'
);
select throws_ok(
  $$ select legal_name from public.business_profiles where organization_id = 'a2100000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'anon cannot read private legal_name from the underlying profile table'
);
select throws_ok(
  $$ select uploaded_by from public.brand_assets where id = 'a2600000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'anon cannot read brand asset uploader identity'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq(
  $$ select count(*)::bigint from public.public_business_profiles where slug = 'siv-published' $$,
  array[1::bigint],
  'authenticated owner can read the public published profile'
);
select results_eq(
  $$ select count(*)::bigint from public.business_application_owner_views where id = 'a2300000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'organization owner can read the owner application view'
);
select throws_ok(
  $$ select internal_review_notes from public.business_applications where id = 'a2300000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'owner cannot read internal_review_notes from the application table'
);
select throws_ok(
  $$ select registered_address from public.business_applications where id = 'a2300000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'owner cannot read registered_address from the application table'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$ select count(*)::bigint from public.public_business_profiles where slug = 'siv-published' $$,
  array[1::bigint],
  'authenticated outsider can read another organization public profile'
);
select results_eq(
  $$ select count(*)::bigint from public.public_profile_badges where subject_id = 'a2000000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'authenticated outsider can read another user public badge'
);
select results_eq(
  $$ select count(*)::bigint from public.public_business_profiles where slug = 'siv-draft' $$,
  array[0::bigint],
  'authenticated outsider cannot read another organization unpublished profile'
);
select results_eq(
  $$ select count(*)::bigint from public.business_profiles where organization_id = 'a2100000-0000-4000-8000-000000000002' $$,
  array[0::bigint],
  'authenticated outsider cannot read an unpublished profile from the table'
);
select results_eq(
  $$ select count(*)::bigint from public.business_products where id = 'a2400000-0000-4000-8000-000000000002' $$,
  array[0::bigint],
  'authenticated outsider cannot read a draft product from the table'
);
select results_eq(
  $$ select count(*)::bigint from public.business_application_owner_views $$,
  array[0::bigint],
  'authenticated outsider cannot read another owner application view'
);
select results_eq(
  $$ select count(*)::bigint from public.business_applications $$,
  array[0::bigint],
  'authenticated outsider cannot read another application from the table'
);
select throws_ok(
  $$ select legal_name from public.organizations where id = 'a2100000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'authenticated outsider cannot read organization legal_name'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select results_eq(
  $$ select count(*)::bigint from public.business_applications where id = 'a2300000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'platform admin can still read application owner-safe columns'
);
select throws_ok(
  $$ select internal_review_notes from public.business_applications where id = 'a2300000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'platform admin client role cannot select internal notes from the table'
);

reset role;
set local role service_role;
select results_eq(
  $$ select internal_review_notes from public.business_applications where id = 'a2300000-0000-4000-8000-000000000001' $$,
  array['SIV_INTERNAL_NOTES'::text],
  'service_role backend access to internal notes remains available'
);
select results_eq(
  $$ select count(*)::bigint from public.business_products where id = 'a2400000-0000-4000-8000-000000000002' $$,
  array[1::bigint],
  'service_role can still read draft products for backend jobs'
);

select * from finish();
rollback;
