-- Real pgTAP coverage for Task 440. Run only against isolated local/staging Supabase.
begin;
select plan(18);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('44000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task440-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','',''),
('44000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task440-visitor@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('44000000-0000-4000-8000-000000000001','task440-owner','Task 440 Owner','online','Testing podcast','#007571'),
('44000000-0000-4000-8000-000000000002','task440-visitor','Task 440 Visitor','online','Testing access','#10C2BB');
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true); set local role authenticated;
select lives_ok($$select * from public.create_podcast_community_with_defaults('44000000-0000-4000-8000-000000000010','Task 440 Podcast','Original publishing library',null,'#007571','public',true)$$,'owner can atomically create Podcast community');
select is((select count(*) from public.communities where creation_request_id='44000000-0000-4000-8000-000000000010'),1::bigint,'one Podcast community exists');
select is((select kind::text from public.communities where creation_request_id='44000000-0000-4000-8000-000000000010'),'podcast','community kind is podcast');
select is((select count(*) from public.roles role join public.communities community on community.id=role.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010' and role.name in ('Owner','Podcast Publisher','Podcast Editor','Member')),4::bigint,'Owner Publisher Editor and Member roles exist');
select is((select role.name from public.community_members member join public.roles role on role.id=member.role_id join public.communities community on community.id=member.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010' and member.user_id='44000000-0000-4000-8000-000000000001'),'Owner','creator receives Owner membership');
select ok(exists(select 1 from public.podcast_community_settings settings join public.communities community on community.id=settings.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010' and settings.about='Original publishing library' and settings.listener_discussion_enabled=false and settings.listener_discussion_channel_id is null),'Podcast settings preserve About and disable Listener Discussion');
select is((select (select count(*) from public.channel_categories category where category.community_id=community.id)+(select count(*) from public.channels channel where channel.community_id=community.id) from public.communities community where community.creation_request_id='44000000-0000-4000-8000-000000000010'),0::bigint,'Podcast bootstrap creates no primary text structure');
select is((select count(*) from public.podcast_episodes episode join public.communities community on community.id=episode.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010'),0::bigint,'episode library contains no fake publication');
select is((select count(*) from public.podcast_series series join public.communities community on community.id=series.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010'),0::bigint,'series library starts safely empty');
select ok(exists(select 1 from public.roles role join public.communities community on community.id=role.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010' and role.name='Podcast Publisher' and role.permissions->>'publishPodcasts'='true' and role.permissions->>'managePodcastSeries'='true'),'Publisher capabilities are initialized');
select ok(exists(select 1 from public.roles role join public.communities community on community.id=role.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010' and role.name='Podcast Editor' and role.permissions->>'editPodcastMetadata'='true' and role.permissions->>'moderatePodcastComments'='true'),'Editor capabilities are initialized');
select lives_ok($$select * from public.create_podcast_community_with_defaults('44000000-0000-4000-8000-000000000010','Task 440 Podcast','Original publishing library',null,'#007571','public',true)$$,'same Podcast request retries safely');
select is((select count(*) from public.communities where creation_request_id='44000000-0000-4000-8000-000000000010'),1::bigint,'retry does not duplicate library');
reset role;
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select count(*) from public.podcast_community_settings settings join public.communities community on community.id=settings.community_id where community.creation_request_id='44000000-0000-4000-8000-000000000010'),1::bigint,'authenticated visitor can read public Podcast settings');
select is((with changed as (update public.podcast_community_settings set about='tampered' where community_id=(select id from public.communities where creation_request_id='44000000-0000-4000-8000-000000000010') returning 1) select count(*) from changed),0::bigint,'visitor cannot change Podcast settings');
reset role;
create function pg_temp.fail_task440_settings() returns trigger language plpgsql as $$begin raise exception 'PODCAST_TEMPLATE_TEST_FAILURE';end$$;
create trigger task440_force_failure before insert on public.podcast_community_settings for each row execute function pg_temp.fail_task440_settings();
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true); set local role authenticated;
select throws_like($$select * from public.create_podcast_community_with_defaults('44000000-0000-4000-8000-000000000020','Rollback Podcast')$$,'%PODCAST_TEMPLATE_TEST_FAILURE%','publishing child failure propagates');
reset role; drop trigger task440_force_failure on public.podcast_community_settings;
select is((select count(*) from public.communities where creation_request_id='44000000-0000-4000-8000-000000000020'),0::bigint,'publishing failure rolls back community roles and settings');
select set_config('request.jwt.claim.sub','',true); set local role authenticated;
select throws_like($$select * from public.create_podcast_community_with_defaults('44000000-0000-4000-8000-000000000030','Anonymous Podcast')$$,'%AUTH_REQUIRED%','unauthenticated Podcast creation is rejected');
reset role; select * from finish(); rollback;
