begin;
select plan(12);

select has_table('public', 'content_mentions', 'unified content mention table exists');
select has_index('public', 'content_mentions', 'content_mentions_recipient_feed_idx', 'recipient feed index exists');
select has_index('public', 'content_mentions', 'content_mentions_source_idx', 'source lookup index exists');
select has_function('public', 'list_unified_content_mentions', array['timestamp with time zone','uuid','text[]','uuid','integer'], 'unified feed RPC exists');
select has_function('public', 'can_view_content_mention', array['content_mentions'], 'source-aware visibility helper exists');
select policies_are('public', 'content_mentions', array['content_mentions_select_visible'], 'only access-aware select policy is exposed');
select is((select relrowsecurity from pg_class where oid = 'public.content_mentions'::regclass), true, 'RLS is enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.content_mentions'::regclass), true, 'RLS is forced');
select ok(has_table_privilege('authenticated', 'public.content_mentions', 'SELECT'), 'authenticated can select through RLS');
select ok(not has_table_privilege('authenticated', 'public.content_mentions', 'INSERT'), 'normal client cannot forge unified mentions');
select ok(pg_get_functiondef('public.can_view_content_mention(public.content_mentions)'::regprocedure) like '%can_view_message%', 'text and radio chat use message access');
select ok(pg_get_functiondef('public.can_view_content_mention(public.content_mentions)'::regprocedure) like '%can_view_podcast_episode%', 'private podcast sources use episode access');

select * from finish();
rollback;
