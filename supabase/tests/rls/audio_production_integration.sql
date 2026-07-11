begin;
select plan(8);

select ok(
  exists(select 1 from pg_trigger where tgname='radio_session_kind_guard' and not tgisinternal)
  and exists(select 1 from pg_trigger where tgname='podcast_episode_kind_guard' and not tgisinternal),
  'Radio and Podcast tables preserve type-specific community guards'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.radio_sessions'::regclass)
  and (select relrowsecurity from pg_class where oid='public.podcast_episodes'::regclass),
  'Radio sessions and Podcast episodes remain RLS protected'
);

select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='podcast_episodes' and policyname='podcast episodes visible according to publication and community access')
  and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='podcast audio read follows episode visibility'),
  'Podcast drafts and private media remain RLS-protected'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.radio_listeners'::regclass)
  and (select relrowsecurity from pg_class where oid='public.radio_session_reactions'::regclass)
  and (select relrowsecurity from pg_class where oid='public.podcast_episode_reactions'::regclass)
  and (select relrowsecurity from pg_class where oid='public.podcast_episode_comments'::regclass)
  and (select relrowsecurity from pg_class where oid='public.saved_audio_items'::regclass)
  and (select relrowsecurity from pg_class where oid='public.podcast_playback_progress'::regclass),
  'Listener, reaction, comment, save, and progress state stays behind RLS'
);

select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='saved_audio_items' and cmd='INSERT')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='podcast_playback_progress' and cmd='UPDATE'),
  'Saved audio and playback progress remain current-user scoped'
);

select ok(
  not (select public from storage.buckets where id='podcast-audio')
  and not (select public from storage.buckets where id='audio-covers'),
  'Radio and Podcast media buckets remain private'
);

select ok(
  not exists(
    select required.table_name
    from (values
      ('radio_sessions'),('radio_listeners'),('radio_session_reactions'),('radio_program_schedules'),('radio_program_hosts'),('radio_session_hosts'),
      ('podcast_episodes'),('podcast_episode_reactions'),('podcast_episode_comments'),('saved_audio_items'),('podcast_playback_progress')
    ) as required(table_name)
    where not exists(
      select 1 from pg_publication_tables published
      where published.pubname='supabase_realtime' and published.schemaname='public' and published.tablename=required.table_name
    )
  ),
  'Radio and Podcast Realtime publications cover production tables'
);

select ok(
  to_regprocedure('public.can_view_radio_session(uuid)') is not null
  and to_regprocedure('public.can_view_podcast_episode(uuid)') is not null
  and to_regprocedure('public.can_manage_community_audio(uuid,text)') is not null,
  'Audio visibility and permission helpers are installed'
);

select * from finish();
rollback;
