-- Real pgTAP coverage for Task 438.
-- Run only against an isolated local/staging Supabase database:
-- supabase test db --file supabase/tests/rls/text_community_default_template.sql

begin;
select plan(18);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('43800000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task438-owner@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
insert into public.profiles(id, username, display_name, status, status_text, accent_color)
values ('43800000-0000-4000-8000-000000000001', 'task438-owner', 'Task 438 Owner', 'online', 'Testing templates', '#007571');

select set_config('request.jwt.claim.sub', '43800000-0000-4000-8000-000000000001', true);
set local role authenticated;

select lives_ok(
  $$ select * from public.create_text_community_with_defaults('43800000-0000-4000-8000-000000000010', 'Task 438 Text', 'Atomic template test', null, '#007571', 'public', true, 'custom') $$,
  'authenticated owner can atomically create a Text community'
);
select is((select count(*) from public.communities where creation_request_id = '43800000-0000-4000-8000-000000000010'), 1::bigint, 'one community is created');
select is((select kind::text from public.communities where creation_request_id = '43800000-0000-4000-8000-000000000010'), 'text', 'community kind is text');
select is((select count(*) from public.roles role join public.communities community on community.id = role.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and role.name in ('Owner', 'Member')), 2::bigint, 'Owner and Member roles exist');
select is((select role.name from public.community_members membership join public.roles role on role.id = membership.role_id join public.communities community on community.id = membership.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and membership.user_id = '43800000-0000-4000-8000-000000000001'), 'Owner', 'creator membership uses Owner role');
select is((select count(*) from public.channel_categories category join public.communities community on community.id = category.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010'), 3::bigint, 'default template creates three ordered categories');
select ok(exists(select 1 from public.channels channel join public.channel_categories category on category.id = channel.category_id join public.communities community on community.id = channel.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and category.name = 'Information' and channel.name = 'welcome' and channel.type = 'text'), 'Information contains welcome');
select ok(exists(select 1 from public.channels channel join public.channel_categories category on category.id = channel.category_id join public.communities community on community.id = channel.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and category.name = 'Channels' and channel.name = 'general' and channel.type = 'text'), 'Channels contains general');
select ok(exists(select 1 from public.channels channel join public.channel_categories category on category.id = channel.category_id join public.communities community on community.id = channel.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and category.name = 'Voice' and channel.name = 'focus-room' and channel.type = 'voice'), 'Voice contains focus-room');
select is((select count(*) from public.channel_categories category join public.communities community on community.id = category.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010' and lower(category.name) in ('radio', 'podcast', 'episodes', 'broadcasts')), 0::bigint, 'Text template has no Radio or Podcast publishing sections');
select lives_ok(
  $$ select * from public.create_text_community_with_defaults('43800000-0000-4000-8000-000000000010', 'Task 438 Text', 'Atomic template test', null, '#007571', 'public', true, 'custom') $$,
  'retry with the same request UUID succeeds'
);
select is((select count(*) from public.communities where creation_request_id = '43800000-0000-4000-8000-000000000010'), 1::bigint, 'retry does not duplicate community');
select is((select count(*) from public.channel_categories category join public.communities community on community.id = category.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010'), 3::bigint, 'retry does not duplicate categories');
select is((select count(*) from public.channels channel join public.communities community on community.id = channel.community_id where community.creation_request_id = '43800000-0000-4000-8000-000000000010'), 3::bigint, 'retry does not duplicate channels');
select throws_like(
  $$ select * from public.create_text_community_with_defaults('43800000-0000-4000-8000-000000000010', 'Changed Name', null, null, '#007571', 'public', true, 'custom') $$,
  '%COMMUNITY_CREATION_KEY_CONFLICT%',
  'request UUID cannot be reused for different details'
);

reset role;
create function pg_temp.fail_task438_general_channel() returns trigger language plpgsql as $$ begin if new.name = 'general' then raise exception 'TEXT_TEMPLATE_TEST_FAILURE'; end if; return new; end $$;
create trigger task438_force_template_failure before insert on public.channels for each row execute function pg_temp.fail_task438_general_channel();
select set_config('request.jwt.claim.sub', '43800000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_like(
  $$ select * from public.create_text_community_with_defaults('43800000-0000-4000-8000-000000000020', 'Rollback Text', null, null, '#007571', 'private', false, 'custom') $$,
  '%TEXT_TEMPLATE_TEST_FAILURE%',
  'template setup failure propagates'
);
reset role;
drop trigger task438_force_template_failure on public.channels;
select is((select count(*) from public.communities where creation_request_id = '43800000-0000-4000-8000-000000000020'), 0::bigint, 'template failure rolls back the community and children');

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_like(
  $$ select * from public.create_text_community_with_defaults('43800000-0000-4000-8000-000000000030', 'Anonymous Text') $$,
  '%AUTH_REQUIRED%',
  'unauthenticated calls are rejected'
);
reset role;

select * from finish();
rollback;
