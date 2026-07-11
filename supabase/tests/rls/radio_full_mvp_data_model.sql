-- Task 445 real pgTAP coverage. Transaction-local; never run against production.
begin;
select plan(23);

select has_table('public','radio_program_schedules','Radio program schedules table exists');
select has_table('public','radio_program_hosts','Radio program hosts table exists');
select has_table('public','radio_session_hosts','Radio session hosts table exists');
select has_table('public','radio_program_follows','Radio program follows table exists');
select has_table('public','radio_session_reactions','Radio session reactions table exists');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('b1100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','radio-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','radio-host@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','radio-member@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','radio-outsider@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('b1100000-0000-4000-8000-000000000001','radio-owner','Radio Owner','online','QA','#007571'),
('b1100000-0000-4000-8000-000000000002','radio-host','Radio Host','online','QA','#10C2BB'),
('b1100000-0000-4000-8000-000000000003','radio-member','Radio Member','online','QA','#FF772E'),
('b1100000-0000-4000-8000-000000000004','radio-outsider','Radio Outsider','online','QA','#752C05');
insert into public.communities(id,owner_id,kind,name,accent_color,visibility,public_read_enabled) values
('b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','radio','Full MVP Radio','#007571','public',true),
('b1200000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001','text','Not Radio','#10C2BB','public',true);
insert into public.roles(id,community_id,name,color,level,permissions) values
('b1300000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001','Owner','#007571',100,'{"manageCommunity":true,"hostRadio":true,"manageRadioPrograms":true,"manageRadioSchedule":true,"listenRadio":true}'::jsonb),
('b1300000-0000-4000-8000-000000000002','b1200000-0000-4000-8000-000000000001','Radio Host','#10C2BB',50,'{"hostRadio":true,"manageRadioPrograms":true,"manageRadioSchedule":true,"listenRadio":true}'::jsonb),
('b1300000-0000-4000-8000-000000000003','b1200000-0000-4000-8000-000000000001','Member','#FF772E',10,'{"listenRadio":true}'::jsonb);
insert into public.community_members(community_id,user_id,role_id) values
('b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','b1300000-0000-4000-8000-000000000001'),
('b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000002','b1300000-0000-4000-8000-000000000002'),
('b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000003','b1300000-0000-4000-8000-000000000003');

select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000001',true); set local role authenticated;
select lives_ok($$insert into public.radio_programs(id,community_id,title,slug,created_by) values('b1400000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001','Morning Desk','morning-desk','b1100000-0000-4000-8000-000000000001')$$,'manager creates Radio show series');
select lives_ok($$insert into public.radio_program_schedules(id,program_id,community_id,weekday,starts_at_local,timezone,created_by) values('b1500000-0000-4000-8000-000000000001','b1400000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001',1,'09:00','Europe/Berlin','b1100000-0000-4000-8000-000000000001')$$,'manager creates recurring Radio schedule');
select lives_ok($$insert into public.radio_program_hosts(program_id,user_id,host_role,assigned_by) values('b1400000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000002','host','b1100000-0000-4000-8000-000000000001')$$,'manager assigns existing member as program host');
select lives_ok($$insert into public.radio_sessions(id,community_id,program_id,host_user_id,title,status,starts_at) values('b1600000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001','b1400000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','Draft broadcast','draft',now()+interval '1 day')$$,'Radio sessions support draft status');
select lives_ok($$insert into public.radio_session_hosts(radio_session_id,user_id,host_role,assigned_by) values('b1600000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000002','co_host','b1100000-0000-4000-8000-000000000001')$$,'manager assigns per-session co-host');
select throws_like($$insert into public.radio_programs(community_id,title,created_by) values('b1200000-0000-4000-8000-000000000002','Cross-kind show','b1100000-0000-4000-8000-000000000001')$$,'%COMMUNITY_KIND_MISMATCH%','Radio rows cannot attach to non-radio communities');
update public.radio_sessions set status='scheduled' where id='b1600000-0000-4000-8000-000000000001';
update public.radio_sessions set status='live' where id='b1600000-0000-4000-8000-000000000001';
reset role;

select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$insert into public.radio_listeners(radio_session_id,user_id) values('b1600000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000003')$$,'member creates own listener session for live Radio');
select is((select listener_count from public.radio_sessions where id='b1600000-0000-4000-8000-000000000001'),1,'active listener sessions maintain the public aggregate count');
select lives_ok($$insert into public.radio_session_reactions(radio_session_id,user_id,emoji) values('b1600000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000003','fire')$$,'member reacts to visible live Radio');
select lives_ok($$insert into public.radio_program_follows(program_id,user_id) values('b1400000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000003')$$,'member follows visible Radio program');
select is((select count(*) from public.radio_listeners where user_id='b1100000-0000-4000-8000-000000000003'),1::bigint,'listener can read own private listening metadata');
reset role;

select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select count(*) from public.radio_listeners where user_id='b1100000-0000-4000-8000-000000000003'),1::bigint,'authorized host can inspect active listener metadata');
reset role;

select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000004',true); set local role authenticated;
select is((select count(*) from public.radio_listeners),0::bigint,'non-member cannot read private listener metadata');
select throws_like($$insert into public.radio_listeners(radio_session_id,user_id) values('b1600000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000004')$$,'%row-level security%','non-member cannot create private listener state');
reset role;

select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000001',true); set local role authenticated;
update public.radio_sessions set status='ended' where id='b1600000-0000-4000-8000-000000000001';
select throws_like($$update public.radio_sessions set status='live' where id='b1600000-0000-4000-8000-000000000001'$$,'%RADIO_STATUS_TERMINAL%','ended Radio session cannot return to live');
reset role;

select is((select public from storage.buckets where id='audio-covers'),false,'Radio cover bucket remains private');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='audio covers read follows radio or podcast visibility'),'Radio cover reads use an RLS storage policy');
select is((select count(*) from storage.buckets where id like '%radio%record%'),0::bigint,'No unlicensed automatic Radio recording bucket exists');

select * from finish();
rollback;
