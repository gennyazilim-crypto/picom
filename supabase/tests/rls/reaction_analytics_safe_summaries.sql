-- Aggregate reaction privacy tests. Run only in an isolated Supabase test DB.
begin;
select plan(6);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reaction-owner@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('d1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reaction-member@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('d1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reaction-visitor@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('d1000000-0000-4000-8000-000000000001','reaction-owner','Reaction Owner','online','Test','#007571'),('d1000000-0000-4000-8000-000000000002','reaction-member','Reaction Member','online','Test','#10C2BB'),('d1000000-0000-4000-8000-000000000003','reaction-visitor','Reaction Visitor','online','Test','#FF772E');
insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Reaction fixture','Fixture','#007571','public',true);
insert into public.roles(id,community_id,name,color,level,permissions) values('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"sendMessages":true}'),('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{"sendMessages":true}');
insert into public.community_members(id,community_id,user_id,role_id) values('d4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001'),('d4000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002');
insert into public.channels(id,community_id,name,type,topic,is_private,public_read_enabled,position) values('d5000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','reaction-public','text','Public',false,true,1),('d5000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','reaction-private','text','Private',true,false,2);
insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values('d6000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Public reaction','reaction-public'),('d6000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','Private reaction','reaction-private');
insert into public.message_reactions(message_id,user_id,emoji) values('d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','👍'),('d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','👍'),('d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','🔥'),('d6000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','👍');

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select reaction_count from public.list_message_reaction_summaries(array['d6000000-0000-4000-8000-000000000001'::uuid]) where emoji='👍'),2::bigint,'aggregate count includes permitted reactors');
select ok((select reacted_by_current_user from public.list_message_reaction_summaries(array['d6000000-0000-4000-8000-000000000001'::uuid]) where emoji='👍'),'summary exposes only current-user state');
select is((select count(*) from public.message_reactions where user_id<>'d1000000-0000-4000-8000-000000000002'),0::bigint,'direct table read exposes no other reactor identities');
select is((select reaction_count from public.set_message_reaction('d6000000-0000-4000-8000-000000000001','🔥',false)),0::bigint,'idempotent remove returns aggregate result'); reset role;

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is((select count(*) from public.list_message_reaction_summaries(array['d6000000-0000-4000-8000-000000000002'::uuid])),0::bigint,'private message summary is not leaked');
select throws_like($$select * from public.set_message_reaction('d6000000-0000-4000-8000-000000000001','👍',true)$$,'%REACTION_FORBIDDEN%','public visitor cannot react without membership'); reset role;

select * from finish(); rollback;
