-- Picom Supabase RLS tests for message ownership and attachment metadata.
-- Run with: supabase test db --file supabase/tests/rls/message_ownership_and_storage.sql
-- Storage object policies are covered in the test plan; this SQL validates the
-- public attachment metadata table that renderer code can query.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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
  ('98000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner-storage@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('98000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-author-storage@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('98000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-other-storage@picom.local', crypt('PicomDev123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (id, username, display_name, status, status_text, accent_color)
values
  ('98000000-0000-4000-8000-000000000001', 'rls-storage-owner', 'RLS Storage Owner', 'online', 'Testing RLS', '#007571'),
  ('98000000-0000-4000-8000-000000000002', 'rls-storage-author', 'RLS Storage Author', 'online', 'Testing RLS', '#10C2BB'),
  ('98000000-0000-4000-8000-000000000003', 'rls-storage-other', 'RLS Storage Other', 'online', 'Testing RLS', '#FF772E')
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  status = excluded.status,
  status_text = excluded.status_text,
  accent_color = excluded.accent_color;

insert into public.communities (id, owner_id, name, description, accent_color, visibility, public_read_enabled)
values ('99000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'RLS Ownership Community', 'Ownership fixture.', '#007571', 'public', true);

insert into public.roles (id, community_id, name, color, level, permissions)
values
  ('99100000-0000-4000-8000-000000000001', '99000000-0000-4000-8000-000000000001', 'Owner', '#007571', 100, '{"sendMessages":true}'::jsonb),
  ('99100000-0000-4000-8000-000000000002', '99000000-0000-4000-8000-000000000001', 'Member', '#FF772E', 10, '{"sendMessages":true}'::jsonb);

insert into public.community_members (community_id, user_id, role_id)
values
  ('99000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', '99100000-0000-4000-8000-000000000001'),
  ('99000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000002', '99100000-0000-4000-8000-000000000002'),
  ('99000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000003', '99100000-0000-4000-8000-000000000002');

insert into public.channels (id, community_id, name, type, is_private, public_read_enabled, position)
values ('99200000-0000-4000-8000-000000000001', '99000000-0000-4000-8000-000000000001', 'ownership-general', 'text', false, true, 1);

insert into public.messages (id, community_id, channel_id, author_id, body, client_message_id)
values ('99300000-0000-4000-8000-000000000001', '99000000-0000-4000-8000-000000000001', '99200000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000002', 'Original body.', 'rls-ownership-message');

insert into public.message_reactions (message_id, user_id, emoji)
values ('99300000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000002', ':thumbsup:');

insert into public.attachments (id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes, attachment_type, status)
values ('99400000-0000-4000-8000-000000000001', '99300000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000002', 'communities/99000000-0000-4000-8000-000000000001/channels/99200000-0000-4000-8000-000000000001/attached/owned.png', 'owned.png', 'image/png', 18, 'image', 'attached');

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select lives_ok(
  $$ update public.messages set body = 'Edited by author.', edited_at = now() where id = '99300000-0000-4000-8000-000000000001' $$,
  'author can edit own message'
);
select is((select body from public.messages where id = '99300000-0000-4000-8000-000000000001'), 'Edited by author.', 'author edit is visible after update');
select is((select count(*) from public.attachments where id = '99400000-0000-4000-8000-000000000001'), 1::bigint, 'author can read own attached metadata');
reset role;

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000003', true);
set local role authenticated;
update public.messages
set body = 'Edited by other.'
where id = '99300000-0000-4000-8000-000000000001';
select is(
  (select body from public.messages where id = '99300000-0000-4000-8000-000000000001'),
  'Edited by author.',
  'other member cannot edit another user message'
);
delete from public.message_reactions
where message_id = '99300000-0000-4000-8000-000000000001'
  and user_id = '98000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select count(*) from public.message_reactions where message_id = '99300000-0000-4000-8000-000000000001' and user_id = '98000000-0000-4000-8000-000000000002'),
  1::bigint,
  'other member cannot delete another user reaction'
);
set local role authenticated;
select is((select count(*) from public.attachments where id = '99400000-0000-4000-8000-000000000001'), 1::bigint, 'other visible member can read public attachment metadata');
reset role;

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$ delete from public.messages where id = '99300000-0000-4000-8000-000000000001' $$,
  'owner can delete visible community message'
);
select is((select count(*) from public.messages where id = '99300000-0000-4000-8000-000000000001'), 0::bigint, 'owner delete removes the message row');
reset role;

select * from finish();
rollback;
