begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('71000000-0000-0000-0000-000000000001', 'verification-owner@picom.test', 'test', now(), now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'verification-viewer@picom.test', 'test', now(), now(), now()),
  ('71000000-0000-0000-0000-000000000003', 'verification-admin@picom.test', 'test', now(), now(), now())
on conflict (id) do nothing;
insert into public.profiles(id, username, display_name)
values
  ('71000000-0000-0000-0000-000000000001', 'verification_owner', 'Verification Owner'),
  ('71000000-0000-0000-0000-000000000002', 'verification_viewer', 'Verification Viewer'),
  ('71000000-0000-0000-0000-000000000003', 'verification_admin', 'Verification Admin')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select lives_ok($$ insert into public.profile_verifications(user_id, type, reason) values ('71000000-0000-0000-0000-000000000001', 'verified_user', 'Requesting profile ownership review') $$, 'user can request own verification');
select results_eq($$ select count(*)::bigint from public.profile_verifications where user_id = '71000000-0000-0000-0000-000000000001' and status = 'pending' $$, array[1::bigint], 'user can read own pending verification');
select throws_ok($$ update public.profile_verifications set status = 'approved' where user_id = '71000000-0000-0000-0000-000000000001' $$, 'user cannot self-approve verification');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select results_eq($$ select count(*)::bigint from public.profile_verifications where user_id = '71000000-0000-0000-0000-000000000001' $$, array[0::bigint], 'other user cannot read pending verification');

reset role;
update public.profile_verifications set status = 'approved', reviewed_by = '71000000-0000-0000-0000-000000000003', reviewed_at = now() where user_id = '71000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select results_eq($$ select count(*)::bigint from public.profile_verifications where user_id = '71000000-0000-0000-0000-000000000001' and status = 'approved' $$, array[1::bigint], 'approved verification is readable');
select throws_ok($$ select public.review_profile_verification((select id from public.profile_verifications where user_id = '71000000-0000-0000-0000-000000000001'), 'revoked', 'Attempted by a normal user') $$, 'non-reviewer cannot review verification');
select lives_ok($$ insert into public.profile_verifications(user_id, type, reason) values ('71000000-0000-0000-0000-000000000002', 'creator_verified', 'Creator verification review request') $$, 'second user can request own creator verification');

reset role;
insert into public.app_admins(user_id) values ('71000000-0000-0000-0000-000000000003') on conflict (user_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select lives_ok($$ select public.review_profile_verification((select id from public.profile_verifications where user_id = '71000000-0000-0000-0000-000000000002'), 'approved', 'Approved after Picom trust review') $$, 'app admin can approve verification');
select results_eq($$ select (count(*) > 0) from public.verification_audit_logs where target_id = '71000000-0000-0000-0000-000000000002' and action = 'approved' $$, array[true], 'verification decision creates audit log');

select * from finish();
rollback;
