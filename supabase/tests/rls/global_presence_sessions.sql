-- Structural pgTAP contract for private multi-session presence.
begin;
select plan(8);
select has_table('public','user_presence_sessions','global presence session table exists');
select ok((select relrowsecurity from pg_class where oid='public.user_presence_sessions'::regclass),'global presence sessions have RLS');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='user_presence_sessions' and policyname='user_presence_sessions_self_read' and qual like '%auth.uid%'),'only the owning user can inspect session rows');
select ok(not has_table_privilege('authenticated','public.user_presence_sessions','INSERT') and not has_table_privilege('authenticated','public.user_presence_sessions','UPDATE') and not has_table_privilege('authenticated','public.user_presence_sessions','DELETE'),'session writes are RPC-only');
select ok(exists(select 1 from pg_proc where oid='public.set_my_presence_session(uuid,text,boolean)'::regprocedure and prosecdef),'presence heartbeat RPC is security definer');
select ok(exists(select 1 from pg_proc where oid='public.clear_my_presence_session(uuid)'::regprocedure and prosecdef),'presence cleanup RPC is security definer');
select ok(exists(select 1 from pg_proc where oid='public.refresh_my_aggregated_presence()'::regprocedure and prosrc like '%bool_or%' and prosrc like '%expires_at%'),'aggregation preserves active sessions and expires stale sessions');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='user_presence_sessions_user_expiry_idx'),'session expiry lookup is indexed');
select * from finish();
rollback;
