begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users(id,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('71000000-0000-4000-8000-000000000001','dm-complete-one@picom.test','test',now(),now(),now()),
('71000000-0000-4000-8000-000000000002','dm-complete-two@picom.test','test',now(),now(),now()),
('71000000-0000-4000-8000-000000000003','dm-complete-three@picom.test','test',now(),now(),now()) on conflict(id) do nothing;
insert into public.profiles(id,username,display_name,dm_privacy) values
('71000000-0000-4000-8000-000000000001','dm_complete_one','DM Complete One','everyone'),
('71000000-0000-4000-8000-000000000002','dm_complete_two','DM Complete Two','everyone'),
('71000000-0000-4000-8000-000000000003','dm_complete_three','DM Complete Three','everyone') on conflict(id) do update set dm_privacy='everyone';
insert into public.direct_conversations(id,created_by,participant_low_id,participant_high_id) values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003') on conflict(id) do nothing;
insert into public.direct_conversation_participants(conversation_id,user_id) values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001'),('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001'),('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003') on conflict(conversation_id,user_id) do nothing;
insert into public.direct_messages(id,conversation_id,author_id,body,client_message_id) values
('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','First conversation parent','dm-complete-parent-one'),
('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','Second conversation parent','dm-complete-parent-two') on conflict(id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select results_eq($$select public.create_direct_conversation('71000000-0000-4000-8000-000000000002')$$,array['72000000-0000-4000-8000-000000000001'::uuid],'create-or-open returns canonical pair');
select lives_ok($$select public.send_direct_message_v2('72000000-0000-4000-8000-000000000001','Idempotent message','dm-complete-idempotent',null)$$,'participant sends through atomic RPC');
select throws_like($$select public.send_direct_message_v2('72000000-0000-4000-8000-000000000001','Different retry payload','dm-complete-idempotent',null)$$,'%DM_IDEMPOTENCY_CONFLICT%','idempotency key rejects a different Direct Message payload');
select results_eq($$select count(*)::bigint from public.direct_messages where client_message_id='dm-complete-idempotent'$$,array[1::bigint],'client message id prevents duplicate rows');
select throws_ok($$insert into public.direct_messages(conversation_id,author_id,body,reply_to_message_id) values('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','cross reply','73000000-0000-4000-8000-000000000002')$$,'cross-conversation reply is rejected');
select lives_ok($$select public.edit_direct_message('73000000-0000-4000-8000-000000000001','Edited by owner')$$,'author edits own active message');
select lives_ok($$select public.delete_direct_message('73000000-0000-4000-8000-000000000001')$$,'author soft deletes own message');
select results_eq($$select count(*)::bigint from public.direct_messages where id='73000000-0000-4000-8000-000000000001' and deleted_at is not null and body is null$$,array[1::bigint],'soft delete redacts message body');
select throws_ok($$delete from public.direct_messages where id='73000000-0000-4000-8000-000000000001'$$,'hard delete is denied');
select lives_ok($$select public.set_direct_conversation_preferences('72000000-0000-4000-8000-000000000001',now()+interval '1 hour',true)$$,'participant can archive and mute own conversation state');
select lives_ok($$select public.mark_direct_conversation_read('72000000-0000-4000-8000-000000000001')$$,'participant updates precise read state');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select results_eq($$update public.direct_messages set body='other edit' where client_message_id='dm-complete-idempotent' returning id$$,array[]::uuid[],'participant cannot edit another author message');
select lives_ok($$insert into public.direct_message_reactions(message_id,user_id,emoji) select id,'71000000-0000-4000-8000-000000000002','ok' from public.direct_messages where client_message_id='dm-complete-idempotent'$$,'participant can react to active message');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
select results_eq($$select count(*)::bigint from public.direct_messages where conversation_id='72000000-0000-4000-8000-000000000001'$$,array[0::bigint],'non-participant cannot read messages');
select results_eq($$select count(*)::bigint from public.direct_conversations where id='72000000-0000-4000-8000-000000000001'$$,array[0::bigint],'non-participant cannot read conversation metadata');
select throws_ok($$insert into public.direct_message_attachments(message_id,url,file_name) values('73000000-0000-4000-8000-000000000001','blocked/path.png','path.png')$$,'non-participant cannot attach to a message');

select * from finish();
rollback;
