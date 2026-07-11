begin;
select plan(9);

select ok(to_regclass('public.podcast_playback_progress') is not null, 'podcast playback progress table exists');
select ok(exists(select 1 from pg_trigger where tgname='podcast_episode_kind_guard' and not tgisinternal), 'podcast records require podcast community kind');
select ok(exists(select 1 from pg_trigger where tgname='podcast_episode_write_guard' and not tgisinternal), 'podcast publishing validates media and publisher permission');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='podcast_episodes' and policyname='podcast episodes visible according to publication and community access'), 'draft podcast episodes remain private');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='podcast_playback_progress' and policyname='users read own visible podcast progress'), 'playback progress belongs only to current user');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='podcast audio read follows episode visibility'), 'podcast storage enforces episode ownership');
select ok(exists(select 1 from pg_proc where proname='can_view_podcast_audio_object'), 'podcast audio object visibility helper exists');
select ok(exists(select 1 from pg_proc where proname='can_manage_podcast_cover_object'), 'podcast cover ownership helper exists');
select ok(exists(select 1 from pg_trigger where tgname='podcast_comment_reply_guard' and not tgisinternal), 'podcast comment replies remain in one episode');

select * from finish();
rollback;
