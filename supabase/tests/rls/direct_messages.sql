begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'dm-one@picom.test', 'test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'dm-two@picom.test', 'test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'dm-outsider@picom.test', 'test', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'dm_one', 'DM One'),
  ('10000000-0000-0000-0000-000000000002', 'dm_two', 'DM Two'),
  ('10000000-0000-0000-0000-000000000003', 'dm_outsider', 'DM Outsider')
on conflict (id) do nothing;

insert into public.direct_conversations (id, created_by)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.direct_conversation_participants (id, conversation_id, user_id)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')
on conflict (conversation_id, user_id) do nothing;

insert into public.direct_messages (id, conversation_id, author_id, body, client_message_id)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'participant-only fixture', 'dm-rls-fixture')
on conflict (id) do nothing;

insert into public.direct_message_attachments (id, message_id, url, file_name, mime_type, file_size)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'dm-fixtures/attachment.png', 'attachment.png', 'image/png', 128)
on conflict (id) do nothing;

insert into public.direct_message_reactions (id, message_id, user_id, emoji)
values ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'ok')
on conflict (message_id, user_id, emoji) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq($$ select count(*)::bigint from public.direct_conversations where id = '20000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'participant can read direct conversation metadata');
select results_eq($$ select count(*)::bigint from public.direct_conversation_participants where conversation_id = '20000000-0000-0000-0000-000000000001' $$, array[2::bigint], 'participant can read direct participants');
select results_eq($$ select count(*)::bigint from public.direct_messages where conversation_id = '20000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'participant can read direct messages');
select results_eq($$ select count(*)::bigint from public.direct_message_attachments where message_id = '40000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'participant can read direct attachments');
select results_eq($$ select count(*)::bigint from public.direct_message_reactions where message_id = '40000000-0000-0000-0000-000000000001' $$, array[1::bigint], 'participant can read direct reactions');

select lives_ok($$ insert into public.direct_messages (conversation_id, author_id, body, client_message_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'own insert', 'dm-own-insert') $$, 'participant can insert a direct message');
select lives_ok($$ insert into public.direct_message_attachments (message_id, url, file_name) values ('40000000-0000-0000-0000-000000000001', 'dm-fixtures/own.png', 'own.png') $$, 'participant can insert a direct attachment');
select lives_ok($$ update public.direct_messages set body = 'edited by author', edited_at = now() where id = '40000000-0000-0000-0000-000000000001' $$, 'author can update own direct message');
select lives_ok($$ update public.direct_messages set deleted_at = now() where client_message_id = 'dm-own-insert' $$, 'author can soft delete own direct message');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select results_eq($$ update public.direct_messages set body = 'unauthorized edit' where id = '40000000-0000-0000-0000-000000000001' returning id $$, array[]::uuid[], 'participant cannot update another authors direct message');
select lives_ok($$ insert into public.direct_message_reactions (message_id, user_id, emoji) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'plus-one') $$, 'participant can add own reaction');
select lives_ok($$ delete from public.direct_message_reactions where message_id = '40000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000002' and emoji = 'plus-one' $$, 'participant can delete own reaction');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select results_eq($$ select count(*)::bigint from public.direct_conversations $$, array[0::bigint], 'non-member cannot read direct conversation metadata');
select results_eq($$ select count(*)::bigint from public.direct_conversation_participants $$, array[0::bigint], 'non-member cannot read direct participants');
select results_eq($$ select count(*)::bigint from public.direct_messages $$, array[0::bigint], 'non-member cannot read direct messages');
select results_eq($$ select count(*)::bigint from public.direct_message_attachments $$, array[0::bigint], 'non-member cannot read direct attachments');
select results_eq($$ select count(*)::bigint from public.direct_message_reactions $$, array[0::bigint], 'non-member cannot read direct reactions');
select throws_ok($$ insert into public.direct_messages (conversation_id, author_id, body) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'blocked by RLS') $$, 'non-member cannot insert direct messages');
select throws_ok($$ insert into public.direct_message_reactions (message_id, user_id, emoji) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'blocked') $$, 'non-member cannot insert direct reactions');
select throws_ok($$ insert into public.direct_message_attachments (message_id, url) values ('40000000-0000-0000-0000-000000000001', 'dm-fixtures/blocked.png') $$, 'non-member cannot insert direct attachments');

reset role;
update public.direct_conversation_participants
set blocked_at = now()
where conversation_id = '20000000-0000-0000-0000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select throws_ok($$ insert into public.direct_messages (conversation_id, author_id, body) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'blocked participant') $$, 'blocked participant cannot send direct messages');

select * from finish();
rollback;
