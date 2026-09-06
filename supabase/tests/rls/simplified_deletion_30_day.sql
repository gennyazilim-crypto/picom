-- Server-authoritative deletion lifecycle coverage.
-- Run against a lineage-compatible local/staging Supabase database only:
-- supabase test db --file supabase/tests/rls/simplified_deletion_30_day.sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('b6100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('b6100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-member@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('b6100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-moderator@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('b6100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-finalizer@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','')
on conflict (id) do nothing;

insert into public.profiles(id,username,display_name,status,status_text,accent_color)
values
  ('b6100000-0000-4000-8000-000000000001','delete-owner','Delete Owner','online','QA','#007571'),
  ('b6100000-0000-4000-8000-000000000002','delete-member','Delete Member','online','QA','#10C2BB'),
  ('b6100000-0000-4000-8000-000000000003','delete-moderator','Delete Moderator','online','QA','#4466AA'),
  ('b6100000-0000-4000-8000-000000000004','delete-finalizer','Delete Finalizer','online','QA','#334455')
on conflict (id) do update set username = excluded.username, display_name = excluded.display_name;

insert into public.communities(id,owner_id,kind,name,accent_color,visibility,public_read_enabled,discovery_listed)
values ('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','text','Thirty Day Delete QA','#007571','public',true,true)
on conflict (id) do update set owner_id = excluded.owner_id, visibility = 'public', public_read_enabled = true, discovery_listed = true,
  deletion_requested_at = null, scheduled_deletion_at = null, deletion_cancelled_at = null, deleted_at = null, deletion_restore_state = null;

insert into public.roles(id,community_id,name,color,level,permissions)
values
  ('b6300000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','Owner','#007571',100,'{"manageCommunity":true}'::jsonb),
  ('b6300000-0000-4000-8000-000000000002','b6200000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{}'::jsonb),
  ('b6300000-0000-4000-8000-000000000003','b6200000-0000-4000-8000-000000000001','Moderator','#4466AA',70,'{"manageCommunity":true}'::jsonb)
on conflict (id) do update set name = excluded.name, level = excluded.level;

insert into public.community_members(id,community_id,user_id,role_id)
values
  ('b6400000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6300000-0000-4000-8000-000000000001'),
  ('b6400000-0000-4000-8000-000000000002','b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000002','b6300000-0000-4000-8000-000000000002'),
  ('b6400000-0000-4000-8000-000000000003','b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000003','b6300000-0000-4000-8000-000000000003')
on conflict (community_id,user_id) do update set role_id = excluded.role_id;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b6100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_like($$select * from public.request_community_deletion('b6200000-0000-4000-8000-000000000001')$$,'%COMMUNITY_OWNER_REQUIRED%','member cannot request community deletion');
select throws_like($$select * from public.cancel_community_deletion('b6200000-0000-4000-8000-000000000001')$$,'%COMMUNITY_OWNER_REQUIRED%','foreign owner cannot cancel community deletion');
reset role;

select set_config('request.jwt.claim.sub','b6100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_like($$select * from public.request_community_deletion('b6200000-0000-4000-8000-000000000001')$$,'%COMMUNITY_OWNER_REQUIRED%','moderator cannot request community deletion');
reset role;

select set_config('request.jwt.claim.sub','b6100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select * from public.request_community_deletion('b6200000-0000-4000-8000-000000000001')$$,'owner schedules a 30-day deletion');
select ok((select scheduled_deletion_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' from public.communities where id='b6200000-0000-4000-8000-000000000001'),'community schedule is server-issued for 30 days');
select ok((select visibility='private' and not public_read_enabled and not discovery_listed from public.communities where id='b6200000-0000-4000-8000-000000000001'),'pending deletion leaves discovery and public access');
select throws_like($$insert into public.community_members(community_id,user_id,role_id) values('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000002','b6300000-0000-4000-8000-000000000002')$$,'%COMMUNITY_DELETION_PENDING%','pending deletion disables new joins');
select lives_ok($$select * from public.cancel_community_deletion('b6200000-0000-4000-8000-000000000001')$$,'owner can cancel own pending deletion');
select ok((select scheduled_deletion_at is null and visibility='public' and public_read_enabled and discovery_listed from public.communities where id='b6200000-0000-4000-8000-000000000001'),'community cancellation restores the saved public settings');
reset role;

select set_config('request.jwt.claim.sub','b6100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select lives_ok($$select * from public.begin_current_user_account_deletion()$$,'account deletion begins with email pending only');
select is((select status from public.account_deletion_requests where user_id='b6100000-0000-4000-8000-000000000002' order by requested_at desc limit 1),'email_pending','no confirmation leaves account deletion email pending');
select is((select scheduled_deletion_at from public.account_deletion_requests where user_id='b6100000-0000-4000-8000-000000000002' order by requested_at desc limit 1),null::timestamptz,'no confirmation starts no deletion countdown');
select throws_like($$select public.issue_account_deletion_email_confirmation('00000000-0000-4000-8000-000000000000','b6100000-0000-4000-8000-000000000002',repeat('a',64),now()+interval '1 hour')$$,'%SERVICE_ROLE_REQUIRED%','normal user cannot issue an email confirmation credential');
select throws_like($$insert into public.account_deletion_requests(user_id,status) values('b6100000-0000-4000-8000-000000000001','pending_deletion')$$,'%permission denied%','foreign account deletion mutation is denied');
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select lives_ok($$insert into public.account_deletion_email_confirmations(request_id,user_id,token_hash,created_at,expires_at,sent_at) values((select id from public.account_deletion_requests where user_id='b6100000-0000-4000-8000-000000000002' and status='email_pending' order by requested_at desc limit 1),'b6100000-0000-4000-8000-000000000002',repeat('c',64),now()-interval '2 hours',now()-interval '1 hour',now()-interval '2 hours')$$,'service fixture creates an expired confirmation credential');
select throws_like($$select * from public.confirm_account_deletion_email_confirmation(repeat('c',64))$$,'%DELETION_CONFIRMATION_EXPIRED%','expired confirmation token is denied');
select lives_ok($$select public.issue_account_deletion_email_confirmation((select id from public.account_deletion_requests where user_id='b6100000-0000-4000-8000-000000000002' and status='email_pending' order by requested_at desc limit 1),'b6100000-0000-4000-8000-000000000002',repeat('b',64),now()+interval '1 hour')$$,'service issues only a hashed confirmation credential');
select is((select count(*) from public.account_deletion_email_confirmations where token_hash=repeat('b',64)),1::bigint,'confirmation storage contains the hash, never a raw token');
select lives_ok($$select * from public.confirm_account_deletion_email_confirmation(repeat('b',64))$$,'valid email confirmation schedules account deletion');
select ok((select scheduled_deletion_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' from public.account_deletion_requests where user_id='b6100000-0000-4000-8000-000000000002' order by requested_at desc limit 1),'account confirmation creates a 30-day schedule');
select throws_like($$select * from public.confirm_account_deletion_email_confirmation(repeat('b',64))$$,'%DELETION_CONFIRMATION_ALREADY_USED%','reused confirmation token is denied');
reset role;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b6100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok($$select * from public.cancel_current_user_account_deletion()$$,'authenticated account owner can cancel during recovery');
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select lives_ok($$insert into public.account_security_events(user_id,event_type) values('b6100000-0000-4000-8000-000000000001','provider_linked')$$,'deletion migration preserves existing security audit event types');
select set_config('picom.community_deletion_lifecycle','trusted',true);
update public.communities set deletion_requested_at=now()-interval '31 days', scheduled_deletion_at=now()-interval '1 minute' where id='b6200000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.finalize_due_community_deletions(10)$$,'service finalizer finalizes due communities');
select ok((select deleted_at is not null from public.communities where id='b6200000-0000-4000-8000-000000000001'),'service finalizer is idempotent tombstone cleanup');
select lives_ok($$select * from public.finalize_due_community_deletions(10)$$,'service finalizer safely retries empty batch');

insert into public.account_deletion_requests(user_id,status,requested_at,email_confirmed_at,scheduled_deletion_at)
values ('b6100000-0000-4000-8000-000000000004','pending_deletion',now()-interval '31 days',now()-interval '31 days',now()-interval '1 minute');
insert into public.user_device_sessions(id,user_id,device_id,session_hash,device_label,platform_label,runtime_label)
values ('b6500000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000004','deletionqa','deletion-finalizer-session','Deletion QA','Windows','desktop');
select lives_ok($$select * from public.finalize_due_account_deletions(10)$$,'service finalizer prepares a due account deletion');
select ok((select profile.is_deleted and request.status='reviewing' and request.finalization_status='profile_anonymized'
  from public.profiles profile
  join public.account_deletion_requests request on request.user_id=profile.id
  where profile.id='b6100000-0000-4000-8000-000000000004'),'account finalizer removes the profile from public discovery');
select ok((select revoked_at is not null from public.user_device_sessions where id='b6500000-0000-4000-8000-000000000001'),'account finalizer revokes registered device sessions');
select lives_ok($$select * from public.finalize_due_account_deletions(10)$$,'account finalizer safely retries an empty batch');
reset role;

select * from finish();
rollback;
