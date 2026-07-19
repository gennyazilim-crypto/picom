-- Structural pgTAP contract for friend presence and suggestion privacy.
begin;
select plan(10);
select has_table('public','friend_presence','friend presence table exists');
select ok((select relrowsecurity from pg_class where oid='public.friend_presence'::regclass),'friend presence has RLS');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='friend_presence' and policyname='friend_presence_self_or_friend_read' and qual like '%share_presence%'),'presence is visible only when shared to self, friends, or DM peers');
select ok(not has_table_privilege('authenticated','public.friend_presence','INSERT') and not has_table_privilege('authenticated','public.friend_presence','UPDATE') and not has_table_privilege('authenticated','public.friend_presence','DELETE'),'presence writes are RPC-only');
select ok(exists(select 1 from pg_proc where oid='public.set_my_friend_presence(text,boolean)'::regprocedure and prosecdef),'presence heartbeat RPC is security definer');
select ok(exists(select 1 from pg_proc where oid='public.list_friend_presence(uuid[])'::regprocedure and prosrc like '%are_friends%'),'presence list enforces accepted friendship');
select ok(exists(select 1 from pg_proc where oid='public.list_friend_presence(uuid[])'::regprocedure and prosrc not like '%status_text%'),'presence response does not expose custom profile status text');
select ok(exists(select 1 from pg_proc where oid='public.list_friend_suggestions(integer)'::regprocedure and prosrc like '%can_send_friend_request%' and prosrc like '%community_members%'),'suggestions enforce privacy and mutual-community context');
select ok(exists(select 1 from pg_proc where oid='public.list_friend_suggestions(integer)'::regprocedure and prosrc like '%user_follows%' and prosrc like '%friend_requests%'),'suggestions use follow signal and exclude pending requests');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='friend_requests_one_pending_pair_idx'),'duplicate pending request protection remains active');
select * from finish();
rollback;
