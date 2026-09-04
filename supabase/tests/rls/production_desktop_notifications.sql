begin;

select plan(22);

select has_table('public', 'notifications', 'desktop notification records extend the durable inbox');
select col_is_null('public', 'notifications', 'notification_type', 'legacy inbox rows remain valid');
select has_column('public', 'notifications', 'safe_metadata', 'safe metadata is persisted server-side');
select has_column('public', 'notifications', 'delivery_attempted_at', 'delivery attempts are distinct from seen state');
select has_column('public', 'notifications', 'seen_at', 'seen state is persisted separately');
select has_column('public', 'notifications', 'dismissed_at', 'dismissal state is persisted separately');
select has_index('public', 'notifications', 'notifications_recipient_dedupe_key_once_idx', 'recipient dedupe index exists');
select has_index('public', 'notifications', 'notifications_recipient_desktop_undelivered_idx', 'bounded reconnect candidate index exists');
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'notification inbox keeps RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'insert'), 'authenticated users cannot create trusted notifications');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'delete'), 'authenticated users cannot delete notification records');
select ok(has_table_privilege('authenticated', 'public.notifications', 'select'), 'recipients can read their own inbox through RLS');
select has_function('public', 'claim_desktop_notification', array['uuid'], 'recipient delivery claim RPC exists');
select has_function('public', 'list_recent_desktop_notification_delivery_candidates', array['integer'], 'bounded reconnect RPC exists');
select has_function('public', 'mark_desktop_notification_seen', array['uuid'], 'seen RPC exists');
select has_function('public', 'dismiss_desktop_notification', array['uuid'], 'dismiss RPC exists');
select has_function('public', 'mark_desktop_notification_read', array['uuid'], 'read RPC exists');
select ok(has_function_privilege('authenticated', 'public.claim_desktop_notification(uuid)', 'execute'), 'authenticated user may claim only own notification under RLS');
select ok(not has_function_privilege('anon', 'public.claim_desktop_notification(uuid)', 'execute'), 'anonymous user cannot claim notifications');
select ok(not has_function_privilege('authenticated', 'public.insert_trusted_desktop_notification(uuid,uuid,text,text,uuid,text,text,text,jsonb,text)', 'execute'), 'trusted notification creation is not client callable');
select has_trigger('public', 'direct_messages', 'create_direct_message_desktop_notifications', 'persisted direct messages are a trusted producer');
select has_trigger('public', 'friend_request_notifications', 'bridge_friend_request_desktop_notification', 'friend request events are a trusted producer');

select * from finish();

rollback;
