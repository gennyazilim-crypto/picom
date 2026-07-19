begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_function('public','list_ranked_unified_feed',array['text','timestamp with time zone','numeric','timestamp with time zone','uuid','text[]','timestamp with time zone','boolean','boolean','integer'],'ranked Feed RPC remains available');
select ok(pg_get_functiondef('public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer)'::regprocedure) like '%least(coalesce(result_limit,20),51)%','Feed RPC reserves one look-ahead row for exact keyset pagination');
select has_index('public','content_mentions','content_mentions_ranked_feed_idx','unified Feed source/rank index exists');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_follows'),'follow changes are published for Feed reconciliation');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='saved_audio_items'),'saved audio changes are published for Feed reconciliation');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='audio_feed_read_states'),'Feed state changes are published for realtime reconciliation');
select is((select relreplident::text from pg_class where oid='public.user_follows'::regclass),'f'::text,'follow deletes expose a complete reconciliation identity');
select is((select relreplident::text from pg_class where oid='public.saved_audio_items'::regclass),'f'::text,'saved audio deletes expose a complete reconciliation identity');
select is((select relreplident::text from pg_class where oid='public.audio_feed_read_states'::regclass),'f'::text,'audio read-state deletes expose a complete reconciliation identity');
select is((select relrowsecurity from pg_class where oid='public.content_mentions'::regclass),true,'content mention RLS remains enabled');
select ok(pg_get_functiondef('public.can_view_content_mention(public.content_mentions)'::regprocedure) like '%can_view_message%','Feed visibility remains source-authorized by RLS');
select ok(has_function_privilege('authenticated','public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer)','EXECUTE'),'authenticated clients can query the RLS-aware Feed');

select * from finish();
rollback;
