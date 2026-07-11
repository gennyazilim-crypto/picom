-- Task 443 pgTAP invite preview and join restriction matrix.
begin;
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','typed-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','typed-joiner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','typed-banned@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('b1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','typed-blocked@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('b1000000-0000-4000-8000-000000000001','typed-owner','Typed Owner','online','Invite test','#007571'),
('b1000000-0000-4000-8000-000000000002','typed-joiner','Typed Joiner','online','Invite test','#10C2BB'),
('b1000000-0000-4000-8000-000000000003','typed-banned','Typed Banned','online','Invite test','#FF772E'),
('b1000000-0000-4000-8000-000000000004','typed-blocked','Typed Blocked','online','Invite test','#752C05');
insert into public.communities(id,owner_id,kind,name,description,accent_color,visibility,public_read_enabled,rules_enabled) values
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','text','Typed Text','Text invite','#007571','public',true,false),
('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','radio','Typed Radio','Radio invite','#10C2BB','public',true,false),
('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','podcast','Typed Podcast','Podcast invite','#C24D0F','private',false,false);
insert into public.roles(id,community_id,name,color,level,permissions,is_default) values
('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Member','#6B7F8C',10,'{"sendMessages":true}',true),
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Member','#6B7F8C',10,'{"listenRadio":true}',true),
('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000003','Member','#6B7F8C',10,'{"listenPodcasts":true,"commentOnPodcasts":true}',true);
insert into public.community_invites(id,community_id,code,created_by,max_uses,uses,expires_at) values
('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','typedtext001','b1000000-0000-4000-8000-000000000001',10,0,now()+interval '1 day'),
('b4000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','typedradio01','b1000000-0000-4000-8000-000000000001',10,0,now()+interval '1 day'),
('b4000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000003','typedpodcast','b1000000-0000-4000-8000-000000000001',10,0,now()+interval '1 day');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select community_kind::text from public.get_community_invite_preview('typedtext001')),'text','Invite preview identifies Text');
select is((select community_kind::text from public.get_community_invite_preview('typedradio01')),'radio','Invite preview identifies Radio');
select is((select community_kind::text from public.get_community_invite_preview('typedpodcast')),'podcast','Invite preview identifies Podcast');
select is((select visibility from public.get_community_invite_preview('typedpodcast')),'private','Valid invite safely previews private community metadata');
reset role;

insert into public.community_bans(community_id,user_id,banned_by,reason) values('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','Fixture ban');
insert into public.blocked_users(blocker_id,blocked_user_id) values('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select lives_ok($$select * from public.accept_community_invite_v2('typedpodcast')$$,'Valid invite joins private Podcast community');
select throws_like($$select * from public.join_public_community('b2000000-0000-4000-8000-000000000003',null)$$,'%PRIVATE_COMMUNITY_INVITE_REQUIRED%','Private community rejects public join');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select throws_like($$select * from public.accept_community_invite_v2('typedradio01')$$,'%BANNED%','Banned user cannot join Radio invite');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
select throws_like($$select * from public.accept_community_invite_v2('typedtext001')$$,'%JOIN_BLOCKED%','Blocked user cannot join Text invite');
reset role;

select * from finish();
rollback;
