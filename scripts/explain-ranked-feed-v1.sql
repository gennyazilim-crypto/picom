-- Run only against disposable/staging-safe data after Task 680-682 migrations.
-- Replace neither IDs nor credentials here; this query uses the authenticated SQL test role/session.
explain (analyze,buffers,format text)
select * from public.get_feed_page('feed',null,null,null,null,null,null,false,false,20,null);

