begin;
select plan(8);
select has_function('public','get_feed_item_metadata_v2',array['uuid[]'],'Feed card metadata V2 exists');
select has_function('public','get_feed_author_verifications',array['uuid[]'],'approved author verification batch exists');
select ok(has_function_privilege('authenticated','public.get_feed_item_metadata_v2(uuid[])','EXECUTE'),'authenticated can hydrate visible cards');
select ok(not has_function_privilege('anon','public.get_feed_item_metadata_v2(uuid[])','EXECUTE'),'anonymous cannot hydrate cards');
select ok(pg_get_functiondef('public.feed_comment_previews_v1(uuid)'::regprocedure) like '%limit 2%','comment previews are bounded');
select ok(pg_get_functiondef('public.feed_comment_previews_v1(uuid)'::regprocedure) not like '%dangerouslySetInnerHTML%','previews are plain text');
select ok(pg_get_functiondef('public.get_feed_author_verifications(uuid[])'::regprocedure) like '%verification.status=''approved''%','only approved verification is public');
select ok(pg_get_functiondef('public.get_feed_author_verifications(uuid[])'::regprocedure) like '%verification.revoked_at is null%','revoked verification is excluded');
select * from finish();
rollback;

