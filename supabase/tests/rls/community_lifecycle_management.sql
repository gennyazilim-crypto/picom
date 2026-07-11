-- Real pgTAP coverage for ownership transfer and recoverable archive.
-- Run only against local/staging Supabase: supabase test db --file supabase/tests/rls/community_lifecycle_management.sql

begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('a1100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('a1100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-target@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('a1100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-outsider@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

insert into public.profiles(id,username,display_name,status,status_text,accent_color)
values
  ('a1100000-0000-4000-8000-000000000001','lifecycle-owner','Lifecycle Owner','online','QA','#007571'),
  ('a1100000-0000-4000-8000-000000000002','lifecycle-target','Lifecycle Target','online','QA','#10C2BB'),
  ('a1100000-0000-4000-8000-000000000003','lifecycle-outsider','Lifecycle Outsider','online','QA','#FF772E');

insert into public.communities(id,owner_id,kind,name,accent_color,visibility,public_read_enabled)
values
  ('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','text','Lifecycle Text','#007571','public',true),
  ('a1200000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000001','radio','Lifecycle Radio','#10C2BB','public',true),
  ('a1200000-0000-4000-8000-000000000003','a1100000-0000-4000-8000-000000000001','podcast','Lifecycle Podcast','#FF772E','public',true);

insert into public.roles(id,community_id,name,color,level,permissions)
values
  ('a1300000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','Owner','#007571',100,'{"manageCommunity":true}'::jsonb),
  ('a1300000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000001','Admin','#10C2BB',80,'{"manageCommunity":true}'::jsonb),
  ('a1300000-0000-4000-8000-000000000003','a1200000-0000-4000-8000-000000000001','Member','#FF772E',10,'{"sendMessages":true}'::jsonb);

insert into public.community_members(id,community_id,user_id,role_id)
values
  ('a1400000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','a1300000-0000-4000-8000-000000000001'),
  ('a1400000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','a1300000-0000-4000-8000-000000000003');

insert into public.channels(id,community_id,name,type,is_private,public_read_enabled,position)
values('a1500000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','lifecycle-general','text',false,true,1);

select ok(public.is_active_community('a1200000-0000-4000-8000-000000000001'), 'Text community is active before lifecycle actions');
select is((select count(*) from public.communities where kind in ('text','radio','podcast') and id in ('a1200000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000003')), 3::bigint, 'Text Radio and Podcast fixtures are isolated rows');

select set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_like($$select * from public.transfer_community_ownership('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','Lifecycle Text','Unauthorized transfer attempt')$$,'%COMMUNITY_TRANSFER_OWNER_REQUIRED%','non-owner cannot transfer ownership');
reset role;

select set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_like($$select * from public.transfer_community_ownership('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000003','Lifecycle Text','Invalid outsider target')$$,'%COMMUNITY_TRANSFER_TARGET_NOT_MEMBER%','ownership target must be a current member');
select is((select owner_id from public.communities where id='a1200000-0000-4000-8000-000000000001'),'a1100000-0000-4000-8000-000000000001'::uuid,'failed transfer rolls ownership back cleanly');
select lives_ok($$select * from public.transfer_community_ownership('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','Lifecycle Text','Approved Full MVP ownership handoff')$$,'owner can transfer ownership atomically');
reset role;

select is((select owner_id from public.communities where id='a1200000-0000-4000-8000-000000000001'),'a1100000-0000-4000-8000-000000000002'::uuid,'community owner_id changes atomically');
select is((select lower(role.name) from public.community_members membership join public.roles role on role.id=membership.role_id where membership.community_id='a1200000-0000-4000-8000-000000000001' and membership.user_id='a1100000-0000-4000-8000-000000000002'),'owner','new owner receives Owner role');
select is((select lower(role.name) from public.community_members membership join public.roles role on role.id=membership.role_id where membership.community_id='a1200000-0000-4000-8000-000000000001' and membership.user_id='a1100000-0000-4000-8000-000000000001'),'admin','previous owner receives safe non-owner role');
select is((select count(*) from public.community_member_roles link join public.community_members member on member.id=link.member_id join public.roles role on role.id=link.role_id where member.user_id='a1100000-0000-4000-8000-000000000002' and role.system_key='owner' and link.is_primary),1::bigint,'new owner receives one primary Owner role link');
select is((select count(*) from public.community_member_roles link join public.community_members member on member.id=link.member_id join public.roles role on role.id=link.role_id where member.user_id='a1100000-0000-4000-8000-000000000001' and role.system_key='owner'),0::bigint,'previous owner no longer retains Owner role links');
select is((select count(*) from public.audit_log where community_id='a1200000-0000-4000-8000-000000000001' and target_type='ownership_transfer'),1::bigint,'ownership transfer creates append-only audit evidence');

select set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_like($$select * from public.archive_community('a1200000-0000-4000-8000-000000000001','Lifecycle Text','old owner attempt')$$,'%COMMUNITY_ARCHIVE_OWNER_REQUIRED%','previous owner cannot archive after transfer');
reset role;

select set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_like($$select * from public.archive_community('a1200000-0000-4000-8000-000000000001','wrong name','wrong confirmation')$$,'%COMMUNITY_ARCHIVE_CONFIRMATION_MISMATCH%','archive requires exact community name');
select ok((select archived_at is null from public.communities where id='a1200000-0000-4000-8000-000000000001'),'failed archive leaves lifecycle state unchanged');
select lives_ok($$select * from public.archive_community('a1200000-0000-4000-8000-000000000001','Lifecycle Text','Full MVP lifecycle QA')$$,'current owner can archive without hard deletion');
select is((select count(*) from public.communities where id='a1200000-0000-4000-8000-000000000001'),0::bigint,'archived community is hidden from normal authenticated reads');
select is((select count(*) from public.channels where id='a1500000-0000-4000-8000-000000000001'),0::bigint,'archived community channel is hidden from normal authenticated reads');
reset role;

select ok((select archived_at is not null and archived_by='a1100000-0000-4000-8000-000000000002' and visibility='private' and public_read_enabled=false from public.communities where id='a1200000-0000-4000-8000-000000000001'),'archive records actor and disables public access');
select is((select count(*) from public.channels where id='a1500000-0000-4000-8000-000000000001'),1::bigint,'archive retains child data for controlled recovery');
select is((select count(*) from public.audit_log where community_id='a1200000-0000-4000-8000-000000000001' and target_type in ('ownership_transfer','community_archive')),2::bigint,'lifecycle audit history is retained');
select is((select count(*) from public.communities where id in ('a1200000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000003') and archived_at is null),2::bigint,'Text archive does not alter Radio or Podcast communities');

select * from finish();
rollback;
