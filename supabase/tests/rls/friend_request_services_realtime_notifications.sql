-- Structural pgTAP contract for realtime friend state and private notifications.
begin;
select plan(9);

select ok((select relreplident = 'f' from pg_class where oid = 'public.friend_requests'::regclass), 'friend requests publish complete realtime rows');
select ok((select relreplident = 'f' from pg_class where oid = 'public.friendships'::regclass), 'friendships publish complete realtime rows');
select ok((select relreplident = 'f' from pg_class where oid = 'public.friend_request_notifications'::regclass), 'friend notifications publish complete realtime rows');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='friend_request_notifications_event_once_idx' and indexdef like '%UNIQUE%'), 'notification events are idempotent per request recipient');
select ok((select relrowsecurity from pg_class where oid='public.friend_request_notifications'::regclass), 'friend notifications have RLS enabled');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='friend_request_notifications' and policyname='friend_request_notifications_recipient_read_v2' and qual like '%recipient_id%'), 'only the recipient can read a friend notification');
select ok(not has_table_privilege('authenticated','public.friend_request_notifications','INSERT') and not has_table_privilege('authenticated','public.friend_request_notifications','UPDATE') and not has_table_privilege('authenticated','public.friend_request_notifications','DELETE'), 'notification writes remain server-side only');
select ok(exists(select 1 from pg_proc where oid='public.send_friend_request(uuid)'::regprocedure and prosecdef), 'friend request send remains a security-definer service RPC');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='friend_requests_one_pending_pair_idx'), 'symmetric duplicate request protection remains active');

select * from finish();
rollback;
