begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_function('public','send_direct_message_v3',array['uuid','text','text','uuid','jsonb'],'Atomic DM send RPC exists');
select ok(pg_get_functiondef('public.send_direct_message_v3(uuid,text,text,uuid,jsonb)'::regprocedure) like '%DM_IDEMPOTENCY_CONFLICT%','idempotency key rejects a different Direct Message payload');
select ok(pg_get_functiondef('public.send_direct_message_v3(uuid,text,text,uuid,jsonb)'::regprocedure) like '%jsonb_to_recordset%' and pg_get_functiondef('public.send_direct_message_v3(uuid,text,text,uuid,jsonb)'::regprocedure) like '%direct_message_attachments%','DM message and attachment metadata commit through one RPC');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='dm attachments author upload' and with_check like '%can_send_direct_message%'),'DM pending uploads require an authorized participant');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='dm attachments participant read' and qual like '%direct_message_attachments%'),'DM attachment reads require committed participant-visible metadata');
select ok((select relrowsecurity from pg_class where oid='public.friend_requests'::regclass) and (select relrowsecurity from pg_class where oid='public.friendships'::regclass) and (select relrowsecurity from pg_class where oid='public.blocked_users'::regclass),'Friend lifecycle and blocks remain RLS protected');
select ok(pg_get_functiondef('public.can_send_direct_message(uuid)'::regprocedure) like '%users_are_blocked%' and to_regprocedure('public.list_friend_suggestions(integer)') is not null,'Blocks, privacy, and suggestions stay backend enforced');
select ok(not exists(select required.table_name from (values('direct_messages'),('direct_message_reactions'),('direct_message_attachments'),('direct_conversation_participants'),('friend_requests'),('friendships')) required(table_name) where not exists(select 1 from pg_publication_tables published where published.pubname='supabase_realtime' and published.schemaname='public' and published.tablename=required.table_name)),'Friends and Direct Messages Realtime publications cover production tables');

select * from finish();
rollback;
