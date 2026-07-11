begin;
select plan(16);

select is((select public from storage.buckets where id='message-attachments'),false,'Text attachments remain private');
select is((select public from storage.buckets where id='direct-message-attachments'),false,'DM attachments remain private');
select is((select public from storage.buckets where id='podcast-audio'),false,'Podcast audio remains private');
select is((select public from storage.buckets where id='audio-covers'),false,'Radio and Podcast covers remain private');
select is((select public from storage.buckets where id='profile-media'),true,'profile identity media is explicitly public');
select is((select public from storage.buckets where id='community-branding'),true,'community identity media is explicitly public');
select has_function('public','list_storage_orphan_candidates',array['timestamp with time zone','integer'],'orphan inventory function exists');
select ok(has_function_privilege('service_role','public.list_storage_orphan_candidates(timestamptz,integer)','EXECUTE'),'service role can run orphan inventory');
select ok(not has_function_privilege('authenticated','public.list_storage_orphan_candidates(timestamptz,integer)','EXECUTE'),'orphan inventory is service-role only');
select ok(coalesce((select with_check from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_media_insert_own'),'') like '%avatar%cover%','profile media path and owner are constrained');
select ok(coalesce((select with_check from pg_policies where schemaname='storage' and tablename='objects' and policyname='managers upload community branding'),'') like '%manageCommunity%','community branding path requires management permission');
select ok(coalesce((select qual from pg_policies where schemaname='storage' and tablename='objects' and policyname='message attachments read scanned visible object'),'') like '%can_view_message%','cross-user private Text objects require source visibility');
select ok(coalesce((select qual from pg_policies where schemaname='storage' and tablename='objects' and policyname='dm attachments participant read'),'') like '%is_direct_conversation_participant%','cross-user private DM objects require participant visibility');
select ok(coalesce((select qual from pg_policies where schemaname='storage' and tablename='objects' and policyname='podcast audio read follows episode visibility'),'') like '%can_view_podcast_episode%','cross-user private audio objects require source visibility');
select ok(pg_get_functiondef('public.list_storage_orphan_candidates(timestamptz,integer)'::regprocedure) like '%direct_message_attachments%','orphan inventory covers DM metadata');
select ok(pg_get_functiondef('public.list_storage_orphan_candidates(timestamptz,integer)'::regprocedure) like '%radio_programs%podcast_episodes%','orphan inventory covers all audio references');

select * from finish();
rollback;
