-- Mention Feed access and relationship privacy tests.
-- Run only against an isolated Supabase test database.

begin;
select plan(8);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mention-owner@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mention-member@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mention-visitor@picom.local',crypt('PicomTest123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('a1000000-0000-4000-8000-000000000001','mention-owner','Mention Owner','online','Test','#007571'),
('a1000000-0000-4000-8000-000000000002','mention-member','Mention Member','online','Test','#10C2BB'),
('a1000000-0000-4000-8000-000000000003','mention-visitor','Mention Visitor','online','Test','#FF772E');

insert into public.communities(id,owner_id,name,description,accent_color,visibility,public_read_enabled) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Mention public','Public fixture','#007571','public',true);
insert into public.roles(id,community_id,name,color,level,permissions) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Owner','#007571',100,'{"sendMessages":true}'),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Member','#10C2BB',10,'{"sendMessages":true}');
insert into public.community_members(id,community_id,user_id,role_id) values
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001'),
('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002');
insert into public.channels(id,community_id,name,type,topic,is_private,public_read_enabled,position) values
('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','public-mentions','text','Public',false,true,1),
('a5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','private-mentions','text','Private',true,false,2);
insert into public.messages(id,community_id,channel_id,author_id,body,client_message_id) values
('a6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Hello @mention-member','mention-public'),
('a6000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Private @mention-member','mention-private');
insert into public.message_mentions(message_id,mentioned_user_id) values
('a6000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002'),
('a6000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002');
insert into public.user_follows(follower_id,followed_id) values
('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select throws_like($$select * from public.list_mention_feed(null,null,20)$$,'%permission denied%','anonymous cannot execute Mention Feed');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*) from public.mention_feed_view),1::bigint,'visitor sees only public mention');
select is((select count(*) from public.mention_feed_view where channel_id='a5000000-0000-4000-8000-000000000002'),0::bigint,'visitor cannot see private mention');
select is((select source from public.mention_feed_view limit 1),'following','own follow can classify visible mention');
select is((select count(*) from public.user_follows),1::bigint,'visitor sees only relationship rows they participate in');
select throws_like($$insert into public.message_mentions(message_id,mentioned_user_id) values('a6000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003')$$,'%permission denied%','client cannot forge mention extraction');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.list_mention_feed(null,null,20)),1::bigint,'member sees only permitted channel mention');
select is((select source from public.list_mention_feed(null,null,20) limit 1),'following','following source is server-derived');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.list_mention_feed(null,null,20)),2::bigint,'owner can see public and private mentions');
reset role;

select * from finish();
rollback;
