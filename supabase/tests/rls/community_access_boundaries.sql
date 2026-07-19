-- Picom Supabase RLS real access-boundary tests.
-- Run with: supabase test db --file supabase/tests/rls/community_access_boundaries.sql
-- These tests use transaction-local fixture data and never target production.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-admin@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-member@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('91000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-visitor@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (id, username, display_name, status, status_text, accent_color)
values
  ('91000000-0000-4000-8000-000000000001', 'rls-owner', 'RLS Owner', 'online', 'Testing RLS', '#007571'),
  ('91000000-0000-4000-8000-000000000002', 'rls-admin', 'RLS Admin', 'online', 'Testing RLS', '#10C2BB'),
  ('91000000-0000-4000-8000-000000000003', 'rls-member', 'RLS Member', 'online', 'Testing RLS', '#FF772E'),
  ('91000000-0000-4000-8000-000000000004', 'rls-visitor', 'RLS Visitor', 'online', 'Testing RLS', '#C24D0F')
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  status = excluded.status,
  status_text = excluded.status_text,
  accent_color = excluded.accent_color;

insert into public.communities (id, owner_id, name, description, accent_color, visibility, public_read_enabled)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'RLS Public Community', 'Public RLS fixture.', '#007571', 'public', true),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'RLS Private Community', 'Private RLS fixture.', '#752C05', 'private', false);

insert into public.roles (id, community_id, name, color, level, permissions)
values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Owner', '#007571', 100, '{"manageCommunity":true,"manageChannels":true,"sendMessages":true}'::jsonb),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Admin', '#10C2BB', 80, '{"manageChannels":true,"sendMessages":true}'::jsonb),
  ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', 'Member', '#FF772E', 10, '{"sendMessages":true}'::jsonb);

insert into public.community_members (id, community_id, user_id, role_id)
values
  ('94000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002'),
  ('94000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003');

insert into public.channels (id, community_id, name, type, topic, is_private, public_read_enabled, position)
values
  ('95000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'public-general', 'text', 'Public fixture.', false, true, 1),
  ('95000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'private-admin', 'text', 'Private fixture.', true, false, 2);

insert into public.messages (id, community_id, channel_id, author_id, body, client_message_id)
values
  ('96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Public RLS message.', 'rls-public-message'),
  ('96000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'Private RLS message.', 'rls-private-message');

insert into public.attachments (id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes, attachment_type, status)
values
  ('97000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'communities/92000000-0000-4000-8000-000000000001/channels/95000000-0000-4000-8000-000000000001/attached/public.png', 'public.png', 'image/png', 12, 'image', 'attached'),
  ('97000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'communities/92000000-0000-4000-8000-000000000001/channels/95000000-0000-4000-8000-000000000002/attached/private.png', 'private.png', 'image/png', 12, 'image', 'attached');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.communities where id = '92000000-0000-4000-8000-000000000001'), 1::bigint, 'anonymous can read public community metadata');
select is((select count(*) from public.communities where id = '92000000-0000-4000-8000-000000000002'), 0::bigint, 'anonymous cannot read private community metadata');
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000001'), 1::bigint, 'anonymous can read public non-private channel');
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000002'), 0::bigint, 'anonymous cannot read private channel');
select is((select count(*) from public.messages where id = '96000000-0000-4000-8000-000000000001'), 1::bigint, 'anonymous can read public channel message');
select is((select count(*) from public.messages where id = '96000000-0000-4000-8000-000000000002'), 0::bigint, 'anonymous cannot read private channel message');
select throws_like(
  $$ insert into public.messages (community_id, channel_id, author_id, body) values ('92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'anon cannot write') $$,
  '%permission denied%',
  'anonymous cannot insert messages'
);
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000001'), 1::bigint, 'visitor can read public non-private channel');
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000002'), 0::bigint, 'visitor cannot read private channel');
select is((select count(*) from public.attachments where id = '97000000-0000-4000-8000-000000000001'), 1::bigint, 'visitor can read attachment metadata for public message');
select is((select count(*) from public.attachments where id = '97000000-0000-4000-8000-000000000002'), 0::bigint, 'visitor cannot read attachment metadata for private message');
select throws_like(
  $$ insert into public.messages (community_id, channel_id, author_id, body) values ('92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'visitor cannot write') $$,
  '%row-level security%',
  'visitor cannot send messages without membership'
);
select lives_ok(
  $$ select * from public.join_public_community('92000000-0000-4000-8000-000000000001', null) $$,
  'authenticated visitor can self-join a public community as Member'
);
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000001'), 1::bigint, 'member can read public channel');
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000002'), 1::bigint, 'active member can read every channel in the joined community');
select lives_ok(
  $$ insert into public.messages (community_id, channel_id, author_id, body, client_message_id) values ('92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'member can send', 'rls-member-send') $$,
  'member can send in allowed text channel'
);
select throws_like(
  $$ insert into public.channels (community_id, name, type, position) values ('92000000-0000-4000-8000-000000000001', 'member-created-channel', 'text', 3) $$,
  '%row-level security%',
  'member cannot manage channels'
);
select lives_ok(
  $$ insert into public.message_reactions (message_id, user_id, emoji) values ('96000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', ':thumbsup:') $$,
  'member can react to visible messages'
);
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.channels where id = '95000000-0000-4000-8000-000000000002'), 1::bigint, 'admin-level member can read private channel');
update public.messages
set body = 'admin cannot edit owner body'
where id = '96000000-0000-4000-8000-000000000001';
select is(
  (select body from public.messages where id = '96000000-0000-4000-8000-000000000001'),
  'Public RLS message.',
  'admin cannot edit another author message with current MVP policy'
);
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.channels (community_id, name, type, position) values ('92000000-0000-4000-8000-000000000001', 'owner-created-channel', 'text', 4) $$,
  'owner can manage channels'
);
select lives_ok(
  $$ delete from public.messages where id = '96000000-0000-4000-8000-000000000001' $$,
  'owner can delete visible community messages'
);
reset role;

select * from finish();
rollback;
