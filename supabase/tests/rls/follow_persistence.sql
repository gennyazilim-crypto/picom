-- Follow persistence/RLS tests. Run against an isolated Supabase test database.
begin;
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','follow-a@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','follow-b@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','follow-c@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('b1000000-0000-4000-8000-000000000001','follow-a','Follow A','online','Test','#007571'),
('b1000000-0000-4000-8000-000000000002','follow-b','Follow B','online','Test','#10C2BB'),
('b1000000-0000-4000-8000-000000000003','follow-c','Follow C','online','Test','#FF772E');
insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Follow fixture','Test','#007571','private',false);
insert into public.roles(id,community_id,name,color,level,permissions) values
('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{}'),
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{}');
insert into public.community_members(id,community_id,user_id,role_id) values
('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001'),
('b4000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select ok(public.follow_user('b1000000-0000-4000-8000-000000000002'),'visible profile can be followed');
select ok(public.follow_user('b1000000-0000-4000-8000-000000000002'),'duplicate follow is idempotent');
select is((select count(*) from public.user_follows where follower_id=auth.uid()),1::bigint,'duplicate follow creates one row');
select throws_like($$select public.follow_user('b1000000-0000-4000-8000-000000000001')$$,'%FOLLOW_TARGET_INVALID%','self follow is rejected');
select throws_like($$select public.follow_user('b1000000-0000-4000-8000-000000000003')$$,'%PROFILE_NOT_VISIBLE%','unrelated hidden profile cannot be followed');
select ok(public.unfollow_user('b1000000-0000-4000-8000-000000000002'),'unfollow succeeds');
select ok(public.unfollow_user('b1000000-0000-4000-8000-000000000002'),'duplicate unfollow is idempotent');
select is((select count(*) from public.user_follows where follower_id=auth.uid()),0::bigint,'unfollow removes the relationship');
reset role;

select * from finish();
rollback;
