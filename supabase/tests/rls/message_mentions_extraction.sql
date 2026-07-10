-- Trusted mention extraction, reconciliation, and isolation tests.
-- Run only against an isolated Supabase test database after all migrations.

begin;
select plan(8);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values
('b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-owner@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-target@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-display@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-duplicate-a@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-duplicate-b@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','extract-outsider@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('b1000000-0000-4000-8000-000000000001','extract-owner','Extract Owner','online','Test','#007571'),
('b1000000-0000-4000-8000-000000000002','extract-target','Canonical Target','online','Test','#10C2BB'),
('b1000000-0000-4000-8000-000000000003','extract-display','Unique Display','online','Test','#FF772E'),
('b1000000-0000-4000-8000-000000000004','extract-duplicate-a','Duplicate Display','online','Test','#7C6FE8'),
('b1000000-0000-4000-8000-000000000005','extract-duplicate-b','Duplicate Display','online','Test','#D56583'),
('b1000000-0000-4000-8000-000000000006','extract-outsider','Outside User','online','Test','#65717E');

insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Extraction private','Fixture','#007571','private',false);
insert into public.roles(id,community_id,name,color,level,permissions) values
('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"sendMessages":true}'),
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{"sendMessages":true}');
insert into public.community_members(id,community_id,user_id,role_id) values
('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001'),
('b4000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002'),
('b4000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002'),
('b4000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000002'),
('b4000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000002');
insert into public.channels(id,community_id,name,type,topic,is_private,public_read_enabled,position) values
('b5000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','mention-extraction','text','Private fixture',true,false,1);

insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values
('b6000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Hello @extract-target @extract-target @"Unique Display" @"Duplicate Display" @extract-outsider @extract-owner and mail@example.com','extract-mentions');

select is((select count(*) from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000001'),2::bigint,'extracts only unique eligible targets');
select ok(exists(select 1 from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000001' and mentioned_user_id='b1000000-0000-4000-8000-000000000002'),'extracts canonical username');
select ok(exists(select 1 from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000001' and mentioned_user_id='b1000000-0000-4000-8000-000000000003'),'extracts unique quoted display name');
select is((select count(*) from public.message_mentions where mentioned_user_id in('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000006')),0::bigint,'rejects self, ambiguous, and outside-community targets');

update public.messages set body='Edited @extract-target' where id='b6000000-0000-4000-8000-000000000001';
select is((select count(*) from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000001'),1::bigint,'edit reconciles stale mention rows');

update public.messages set deleted_at=now() where id='b6000000-0000-4000-8000-000000000001';
select is((select count(*) from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000001'),0::bigint,'soft delete removes mention rows');

insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values
('b6000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Private @extract-target','extract-private');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
set local role authenticated;
select is((select count(*) from public.message_mentions where message_id='b6000000-0000-4000-8000-000000000002'),0::bigint,'RLS hides private mention rows from outsider');
select throws_like($$insert into public.message_mentions(message_id,mentioned_user_id) values('b6000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000006')$$,'%permission denied%','normal client cannot forge mention rows');
reset role;

select * from finish();
rollback;
