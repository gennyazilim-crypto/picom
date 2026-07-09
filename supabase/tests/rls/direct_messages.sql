begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dm-one@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dm-two@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dm-outsider@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('a1000000-0000-4000-8000-000000000001','dm-one','DM One','online','','#007571'),
('a1000000-0000-4000-8000-000000000002','dm-two','DM Two','online','','#10C2BB'),
('a1000000-0000-4000-8000-000000000003','dm-outsider','DM Outsider','online','','#FF772E');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true); set local role authenticated;
select lives_ok($$select public.create_direct_conversation('a1000000-0000-4000-8000-000000000002')$$,'member can create a two-person conversation');
select is((select count(*) from public.direct_conversations),1::bigint,'creator sees conversation');
select lives_ok($$insert into public.direct_messages(conversation_id,author_id,body) select id,'a1000000-0000-4000-8000-000000000001','private hello' from public.direct_conversations limit 1$$,'member can send');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is((select count(*) from public.direct_messages),0::bigint,'non-member cannot read direct messages');
reset role;
select * from finish(); rollback;
