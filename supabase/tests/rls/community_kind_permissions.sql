-- Task 442 pgTAP matrix. Run only against an isolated local/staging Supabase database.
begin;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','kind-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','kind-admin@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000000','authenticated','authenticated','kind-mod@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','kind-member@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','kind-visitor@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('a1000000-0000-4000-8000-000000000001','kind-owner','Kind Owner','online','RLS matrix','#007571'),
('a1000000-0000-4000-8000-000000000002','kind-admin','Kind Admin','online','RLS matrix','#10C2BB'),
('a1000000-0000-4000-8000-000000000003','kind-mod','Kind Mod','online','RLS matrix','#FF772E'),
('a1000000-0000-4000-8000-000000000004','kind-member','Kind Member','online','RLS matrix','#6B7F8C'),
('a1000000-0000-4000-8000-000000000005','kind-visitor','Kind Visitor','online','RLS matrix','#752C05');

insert into public.communities(id,owner_id,kind,name,description,accent_color,visibility,public_read_enabled) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','text','Kind Text','Text fixture','#007571','public',true),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','radio','Kind Radio','Radio fixture','#10C2BB','public',true),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','podcast','Kind Podcast','Podcast fixture','#C24D0F','private',false);

insert into public.roles(id,community_id,name,color,level,permissions) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"manageCommunity":true,"manageTextCommunity":true}'::jsonb),
('a3000000-0000-4000-8000-000000000011','a2000000-0000-4000-8000-000000000001','Admin','#10C2BB',80,'{"manageCommunity":true,"manageTextCommunity":true}'::jsonb),
('a3000000-0000-4000-8000-000000000012','a2000000-0000-4000-8000-000000000001','Moderator','#FF772E',60,'{"moderateMessages":true}'::jsonb),
('a3000000-0000-4000-8000-000000000013','a2000000-0000-4000-8000-000000000001','Member','#6B7F8C',10,'{"sendMessages":true}'::jsonb),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','Owner','#007571',100,'{"manageCommunity":true,"hostRadio":true,"listenRadio":true}'::jsonb),
('a3000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000002','Admin','#10C2BB',80,'{"manageCommunity":true,"hostRadio":true}'::jsonb),
('a3000000-0000-4000-8000-000000000022','a2000000-0000-4000-8000-000000000002','Moderator','#FF772E',60,'{"moderateRadioComments":true,"listenRadio":true}'::jsonb),
('a3000000-0000-4000-8000-000000000023','a2000000-0000-4000-8000-000000000002','Member','#6B7F8C',10,'{"listenRadio":true}'::jsonb),
('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000003','Owner','#007571',100,'{"manageCommunity":true,"publishPodcasts":true,"commentOnPodcasts":true}'::jsonb),
('a3000000-0000-4000-8000-000000000031','a2000000-0000-4000-8000-000000000003','Admin','#10C2BB',80,'{"manageCommunity":true,"publishPodcasts":true}'::jsonb),
('a3000000-0000-4000-8000-000000000032','a2000000-0000-4000-8000-000000000003','Moderator','#FF772E',60,'{"moderatePodcastComments":true,"commentOnPodcasts":true}'::jsonb),
('a3000000-0000-4000-8000-000000000033','a2000000-0000-4000-8000-000000000003','Member','#6B7F8C',10,'{"listenPodcasts":true,"commentOnPodcasts":true,"reactToPodcasts":true}'::jsonb);

insert into public.community_members(community_id,user_id,role_id) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000011'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000012'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000013'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000021'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000022'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000023'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000031'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000032'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000033');

select throws_like($$insert into public.radio_sessions(community_id,host_user_id,title,starts_at) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Wrong kind',now())$$,'%COMMUNITY_KIND_MISMATCH%','Text rejects Radio source rows');
select throws_like($$insert into public.podcast_episodes(community_id,author_user_id,title,status) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Wrong kind','draft')$$,'%COMMUNITY_KIND_MISMATCH%','Text rejects Podcast source rows');
select throws_like($$insert into public.podcast_series(community_id,title,created_by) values('a2000000-0000-4000-8000-000000000002','Wrong series','a1000000-0000-4000-8000-000000000001')$$,'%COMMUNITY_KIND_MISMATCH%','Radio rejects Podcast series');
select throws_like($$insert into public.radio_programs(community_id,title,created_by) values('a2000000-0000-4000-8000-000000000003','Wrong program','a1000000-0000-4000-8000-000000000001')$$,'%COMMUNITY_KIND_MISMATCH%','Podcast rejects Radio programs');

insert into public.channels(id,community_id,name,type,position) values('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','general','text',1);
select throws_like($$insert into public.radio_sessions(community_id,channel_id,host_user_id,title,starts_at) values('a2000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Wrong channel',now())$$,'%RADIO_CHANNEL_COMMUNITY_MISMATCH%','Radio rejects a channel from another community');
insert into public.podcast_series(id,community_id,title,created_by) values('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000003','Private series','a1000000-0000-4000-8000-000000000001');
select throws_like($$insert into public.podcast_episodes(community_id,series_id,author_user_id,title,status) values('a2000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Wrong series scope','draft')$$,'%COMMUNITY_KIND_MISMATCH%','Podcast episode rejects a Text community before cross-series linkage');
insert into public.radio_sessions(id,community_id,host_user_id,title,status,starts_at) values('a6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Public live','live',now());
insert into public.podcast_episodes(id,community_id,series_id,author_user_id,title,status,published_at) values('a7000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Private episode','published',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','text','manageTextCommunity'),'Text owner can administer Text');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','radio','hostRadio'),'Radio owner can host');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','publishPodcasts'),'Podcast owner can publish');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','text','manageTextCommunity'),'Text admin can administer Text');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','radio','hostRadio'),'Radio admin can host');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','publishPodcasts'),'Podcast admin can publish');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','text','manageTextCommunity'),true,'Text moderator is not admin');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','radio','hostRadio'),true,'Radio moderator cannot host');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','publishPodcasts'),true,'Podcast moderator cannot publish');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','moderatePodcastComments'),'Podcast moderator can moderate comments');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','text','manageTextCommunity'),true,'Text member is not admin');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','radio','listenRadio'),'Radio member can listen');
select ok(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','commentOnPodcasts'),'Podcast member can comment');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','podcast','commentOnPodcasts'),true,'Kind mismatch denies Podcast capability in Radio');
select lives_ok($$insert into public.messages(community_id,channel_id,author_id,body,client_message_id) values('a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','Text member message','kind-text-member')$$,'Text member can send in Text');
select lives_ok($$insert into public.podcast_episode_comments(episode_id,author_id,body) values('a7000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','Member comment')$$,'Podcast member can comment in private joined library');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','text','manageTextCommunity'),true,'Text visitor cannot administer');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000002','radio','listenRadio'),true,'Radio visitor cannot create listener state');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000003','podcast','commentOnPodcasts'),true,'Podcast visitor cannot comment');
select is((select count(*) from public.radio_sessions where id='a6000000-0000-4000-8000-000000000001'),1::bigint,'Visitor reads allowed public Radio metadata');
select is((select count(*) from public.podcast_episodes where id='a7000000-0000-4000-8000-000000000001'),0::bigint,'Visitor cannot read private Podcast metadata');
select throws_like($$insert into public.podcast_episode_comments(episode_id,author_id,body) values('a7000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','Visitor comment')$$,'%row-level security%','Visitor cannot comment on private Podcast');
select throws_like($$insert into public.radio_sessions(community_id,host_user_id,title,starts_at) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','Cross-kind visitor write',now())$$,'%COMMUNITY_KIND_MISMATCH%','Visitor cannot use a Text community as Radio source');
select isnt(public.can_manage_community_kind('a2000000-0000-4000-8000-000000000001','radio','hostRadio'),true,'Expected kind mismatch is always denied');

reset role;
select * from finish();
rollback;
