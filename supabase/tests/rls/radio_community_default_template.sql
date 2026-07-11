-- Real pgTAP coverage for Task 439. Run only against isolated local/staging Supabase.
begin;
select plan(18);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) values
('43900000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task439-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','',''),
('43900000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task439-visitor@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('43900000-0000-4000-8000-000000000001','task439-owner','Task 439 Owner','online','Testing radio','#007571'),
('43900000-0000-4000-8000-000000000002','task439-visitor','Task 439 Visitor','online','Testing access','#10C2BB');

select set_config('request.jwt.claim.sub','43900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select * from public.create_radio_community_with_defaults('43900000-0000-4000-8000-000000000010','Task 439 Radio','Dedicated station',null,'#007571','public',true)$$,'owner can atomically create Radio community');
select is((select count(*) from public.communities where creation_request_id='43900000-0000-4000-8000-000000000010'),1::bigint,'one Radio community exists');
select is((select kind::text from public.communities where creation_request_id='43900000-0000-4000-8000-000000000010'),'radio','community kind is radio');
select is((select count(*) from public.roles role join public.communities community on community.id=role.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010' and role.name in ('Owner','Radio Host','Member')),3::bigint,'Owner Radio Host and Member roles exist');
select is((select role.name from public.community_members member join public.roles role on role.id=member.role_id join public.communities community on community.id=member.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010' and member.user_id='43900000-0000-4000-8000-000000000001'),'Owner','creator receives Owner membership');
select ok(exists(select 1 from public.radio_community_settings settings join public.communities community on community.id=settings.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010' and settings.schedule_timezone='UTC' and settings.listener_chat_enabled=false and settings.listener_chat_channel_id is null),'safe UTC schedule exists with Listener Chat disabled');
select is((select count(*) from public.channel_categories category join public.communities community on community.id=category.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010'),0::bigint,'Radio bootstrap creates no text categories');
select is((select count(*) from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010'),0::bigint,'Radio bootstrap creates no text channels');
select is((select count(*) from public.radio_sessions session join public.communities community on community.id=session.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010'),0::bigint,'default schedule contains no fake broadcast');
select is((select count(*) from public.radio_programs program join public.communities community on community.id=program.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010'),0::bigint,'default program library is safely empty');
select ok(exists(select 1 from public.roles role join public.communities community on community.id=role.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010' and role.name='Radio Host' and role.permissions->>'hostRadio'='true'),'Radio Host capability is initialized');
select lives_ok($$select * from public.create_radio_community_with_defaults('43900000-0000-4000-8000-000000000010','Task 439 Radio','Dedicated station',null,'#007571','public',true)$$,'same creation request retries safely');
select is((select count(*) from public.communities where creation_request_id='43900000-0000-4000-8000-000000000010'),1::bigint,'retry does not duplicate station');
reset role;

select set_config('request.jwt.claim.sub','43900000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.radio_community_settings settings join public.communities community on community.id=settings.community_id where community.creation_request_id='43900000-0000-4000-8000-000000000010'),1::bigint,'authenticated visitor can read public station settings');
select is((with changed as (update public.radio_community_settings set schedule_timezone='Europe/Berlin' where community_id=(select id from public.communities where creation_request_id='43900000-0000-4000-8000-000000000010') returning 1) select count(*) from changed),0::bigint,'visitor cannot change station settings');
reset role;

create function pg_temp.fail_task439_settings() returns trigger language plpgsql as $$begin raise exception 'RADIO_TEMPLATE_TEST_FAILURE';end$$;
create trigger task439_force_failure before insert on public.radio_community_settings for each row execute function pg_temp.fail_task439_settings();
select set_config('request.jwt.claim.sub','43900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_like($$select * from public.create_radio_community_with_defaults('43900000-0000-4000-8000-000000000020','Rollback Radio')$$,'%RADIO_TEMPLATE_TEST_FAILURE%','station child failure propagates');
reset role;
drop trigger task439_force_failure on public.radio_community_settings;
select is((select count(*) from public.communities where creation_request_id='43900000-0000-4000-8000-000000000020'),0::bigint,'station failure rolls back community roles and settings');

select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_like($$select * from public.create_radio_community_with_defaults('43900000-0000-4000-8000-000000000030','Anonymous Radio')$$,'%AUTH_REQUIRED%','unauthenticated station creation is rejected');
reset role;
select * from finish();
rollback;
