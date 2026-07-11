-- Hosted-ready profile access matrix. Transaction-local fixtures only.
begin;

select plan(26);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-target@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-shared@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-friend@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-visitor@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-blocked@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

insert into public.profiles(id,username,display_name,status,status_text,bio,accent_color) values
('a1000000-0000-4000-8000-000000000001','profile-target','Profile Target','online','Visible status','Access matrix profile.','#007571'),
('a1000000-0000-4000-8000-000000000002','profile-shared','Profile Shared','online','Shared member',null,'#10C2BB'),
('a1000000-0000-4000-8000-000000000003','profile-friend','Profile Friend','online','Friend viewer',null,'#FF772E'),
('a1000000-0000-4000-8000-000000000004','profile-visitor','Profile Visitor','online','Visitor viewer',null,'#C24D0F'),
('a1000000-0000-4000-8000-000000000005','profile-blocked','Profile Blocked','online','Blocked viewer',null,'#752C05');

insert into public.profile_details(user_id,preferred_language,tags) values ('a1000000-0000-4000-8000-000000000001','English',array['Community','Audio']);
insert into public.profile_privacy_settings(user_id,profile_visibility,show_online_status,show_location,show_timezone,show_activity,show_media,show_communities,show_friends,show_follows,show_audio,location,timezone)
values ('a1000000-0000-4000-8000-000000000001','everyone',true,true,true,true,true,true,true,true,true,'Berlin','Europe/Berlin');

insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values
('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Profile Public','Public profile source.','#007571','public',true),
('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Profile Private','Private profile source.','#752C05','private',false);

insert into public.roles(id,community_id,name,color,level,permissions) values
('c1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"manageCommunity":true,"sendMessages":true}'),
('c1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{"sendMessages":true}'),
('c1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002','Owner','#752C05',100,'{"manageCommunity":true,"sendMessages":true}');

insert into public.community_members(id,community_id,user_id,role_id) values
('d1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001'),
('d1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003');

insert into public.channels(id,community_id,name,type,topic,is_private,public_read_enabled,position) values
('e1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','profile-public','text','Public source.',false,true,1),
('e1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','profile-private','text','Private source.',true,false,1);

insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values
('f1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Public profile activity.','profile-public-activity'),
('f1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Private profile activity.','profile-private-activity');

insert into public.attachments(id,message_id,uploader_id,storage_path,file_name,mime_type,size_bytes,attachment_type,status,scan_status,public_url) values
('a2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','profile/public.png','public.png','image/png',12,'image','attached','clean','https://example.invalid/public.png'),
('a2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','profile/private.png','private.png','image/png',12,'image','attached','clean','https://example.invalid/private.png');

insert into public.friendships(user_low_id,user_high_id) values ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003');
insert into public.blocked_users(blocker_id,blocked_user_id) values ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005');
insert into public.user_follows(follower_id,followed_id) values ('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001');
insert into public.verification_badges(id,subject_type,subject_id,badge_kind,label,scope_note,granted_by) values ('b2000000-0000-4000-8000-000000000001','user','a1000000-0000-4000-8000-000000000001','profile_reviewed','Verified user','Profile reviewed by Picom trust team.','a1000000-0000-4000-8000-000000000001');
insert into public.profile_verifications(user_id,type,status,reason) values ('a1000000-0000-4000-8000-000000000001','verified_user','pending','Pending private review metadata.');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true); set local role authenticated;
select ok((select can_view_profile from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),'visitor can read everyone-profile basics');
select is((select show_activity from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),false,'visitor cannot read profile activity without trusted relationship');
select is(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)#>>'{profile,display_name}','Profile Target','visitor receives allowed public profile basics');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),0,'visitor profile activity is empty');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'media'),0,'visitor profile media is empty');
select is((public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)#>>'{stats,followers}')::integer,0,'visitor cannot infer private follow counts');
select is((select count(*)::integer from public.list_active_verification_badges('user','a1000000-0000-4000-8000-000000000001')),1,'visitor can read approved verification for visible profile');
select is((select count(*)::integer from public.profile_details where user_id='a1000000-0000-4000-8000-000000000001'),0,'visitor cannot directly read owner-only profile details');
select is((select count(*)::integer from public.profile_verifications where user_id='a1000000-0000-4000-8000-000000000001' and status='pending'),0,'visitor cannot read pending verification review metadata');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true); set local role authenticated;
select ok((select show_activity from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),'shared member can read allowed profile activity');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),1,'shared member sees only public mutual-community activity');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'media'),1,'shared member sees only public mutual-community media');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'roles'),1,'shared member sees only mutual-community roles');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true); set local role authenticated;
select ok((select can_view_profile from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),'friend can read profile allowed by everyone policy');
select ok((select show_activity from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),'friend relationship enables activity projection');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),1,'friend still cannot read private-community source activity');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),2,'profile owner sees own public and private activity');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'media'),2,'profile owner sees own public and private media');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true); set local role authenticated;
select is((select can_view_profile from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),false,'blocked user cannot view profile basics');
select is(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'profile','null'::jsonb,'blocked user receives no profile payload');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),0,'blocked user receives no activity or private source context');
select is((select count(*)::integer from public.list_active_verification_badges('user','a1000000-0000-4000-8000-000000000001')),0,'blocked user cannot use verification query to discover profile');
reset role;

delete from public.community_members where community_id='b1000000-0000-4000-8000-000000000001' and user_id='a1000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select show_activity from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),false,'removing community access disables private profile sections');
select is(jsonb_array_length(public.get_profile_domain_v1('a1000000-0000-4000-8000-000000000001',30)->'activities'),0,'removing community access removes profile activity visibility');
reset role;

update public.profile_privacy_settings set profile_visibility='friends' where user_id='a1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true); set local role authenticated;
select is((select can_view_profile from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),false,'friends-only profile is hidden from visitor');
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true); set local role authenticated;
select ok((select can_view_profile from public.get_profile_privacy_projection_v3('a1000000-0000-4000-8000-000000000001')),'friends-only profile remains visible to friend');
reset role;

select * from finish();
rollback;
