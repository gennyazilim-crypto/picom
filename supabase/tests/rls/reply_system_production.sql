-- Reply persistence and isolation tests. Run only in an isolated Supabase test DB.

begin;
select plan(7);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values
('c1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reply-owner@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('c1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reply-member@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('c1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reply-visitor@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('c1000000-0000-4000-8000-000000000001','reply-owner','Reply Owner','online','Test','#007571'),
('c1000000-0000-4000-8000-000000000002','reply-member','Reply Member','online','Test','#10C2BB'),
('c1000000-0000-4000-8000-000000000003','reply-visitor','Reply Visitor','online','Test','#FF772E');
insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values
('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Reply fixture','Fixture','#007571','public',true);
insert into public.roles(id,community_id,name,color,level,permissions) values
('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"sendMessages":true}'),
('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{"sendMessages":true}');
insert into public.community_members(id,community_id,user_id,role_id) values
('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001'),
('c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000002');
insert into public.channels(id,community_id,name,type,topic,is_private,public_read_enabled,position) values
('c5000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','reply-private','text','Private',true,false,1),
('c5000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','reply-other','text','Other',false,true,2);
insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values
('c6000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Reply target','reply-target'),
('c6000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Other target','reply-other');
insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id,reply_to_message_id) values
('c6000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','Valid reply','reply-valid','c6000000-0000-4000-8000-000000000001');

select is((select reply_to_message_id from public.messages where id='c6000000-0000-4000-8000-000000000003'),'c6000000-0000-4000-8000-000000000001'::uuid,'same-channel reply persists');
select throws_like($$insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id,reply_to_message_id) values('c6000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','Cross-channel reply','reply-cross','c6000000-0000-4000-8000-000000000002')$$,'%REPLY_TARGET_CHANNEL_MISMATCH%','cross-channel reply is rejected');
select throws_like($$update public.messages set reply_to_message_id=null where id='c6000000-0000-4000-8000-000000000003'$$,'%REPLY_TARGET_IMMUTABLE%','reply target cannot be retargeted');

update public.messages set deleted_at=now() where id='c6000000-0000-4000-8000-000000000001';
select is((select reply_to_message_id from public.messages where id='c6000000-0000-4000-8000-000000000003'),'c6000000-0000-4000-8000-000000000001'::uuid,'soft-deleted target retains fallback reference');
select throws_like($$insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id,reply_to_message_id) values('c6000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','Deleted reply','reply-deleted','c6000000-0000-4000-8000-000000000001')$$,'%REPLY_TARGET_DELETED%','new reply cannot target deleted message');

select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*) from public.messages where id='c6000000-0000-4000-8000-000000000003'),0::bigint,'visitor cannot read private reply or target metadata');
select is((select count(*) from public.messages where id='c6000000-0000-4000-8000-000000000002'),1::bigint,'visitor still reads unrelated public channel message');
reset role;

select * from finish();
rollback;
