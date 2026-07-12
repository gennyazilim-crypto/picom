-- Operator-only staging/repair procedure. Run through a reviewed migration-capable SQL session.
-- Never paste credentials into this file. Repeat each call with the returned next_cursor.
select public.reconcile_feed_sources_v1('text_message', null, 500);
select public.reconcile_feed_sources_v1('radio_session', null, 500);
select public.reconcile_feed_sources_v1('podcast_episode', null, 500);
select public.reconcile_feed_sources_v1('podcast_comment', null, 500);
select public.reconcile_feed_rollups_v1(null, 500);

