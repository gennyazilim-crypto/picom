begin;
select plan(12);
select has_function('public','get_feed_item_metadata',array['uuid[]'],'batch metadata RPC exists');
select has_function('public','set_feed_user_state_v1',array['uuid','text'],'user state RPC exists');
select has_function('public','record_feed_impressions_v1',array['uuid','uuid[]','integer[]','text','timestamp with time zone'],'batch impression RPC exists');
select ok(has_function_privilege('authenticated','public.get_feed_item_metadata(uuid[])','EXECUTE'),'authenticated may hydrate visible items');
select ok(not has_function_privilege('anon','public.get_feed_item_metadata(uuid[])','EXECUTE'),'anonymous cannot hydrate Feed items');
select ok(not has_function_privilege('authenticated','public.feed_source_payload_v1(uuid)','EXECUTE'),'source payload helper remains internal');
select ok(pg_get_functiondef('public.get_feed_item_metadata(uuid[])'::regprocedure) like '%public.can_view_feed_item(item.id)%','metadata rechecks source visibility');
select ok(pg_get_functiondef('public.get_feed_item_metadata(uuid[])'::regprocedure) like '%limit 50%','metadata batch is bounded');
select ok(pg_get_functiondef('public.set_feed_user_state_v1(uuid,text)'::regprocedure) like '%FEED_ITEM_ACCESS_LOST%','state changes recheck access');
select ok(pg_get_functiondef('public.record_feed_impressions_v1(uuid,uuid[],integer[],text,timestamptz)'::regprocedure) like '%item_count>50%','impression batch is bounded');
select ok(pg_get_functiondef('public.record_feed_impressions_v1(uuid,uuid[],integer[],text,timestamptz)'::regprocedure) not like '%body%','impression RPC stores no body');
select ok(pg_get_functiondef('public.feed_source_payload_v1(uuid)'::regprocedure) not like '%storage_path%','payload exposes no internal storage path');
select * from finish();
rollback;

