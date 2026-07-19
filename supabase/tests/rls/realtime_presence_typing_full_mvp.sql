begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_function('public','subject_effective_community_permission',array['uuid','uuid','text','text','uuid'],'subject-scoped mature permission helper exists');
select has_function('public','can_access_picom_realtime_topic_for_subject',array['text','text','text'],'Realtime subject authorization exists');
select ok(pg_get_functiondef('public.can_access_picom_realtime_topic_for_subject(text,text,text)'::regprocedure) like '%dm:conversation:%','DM topic contract is recognized');
select ok(pg_get_functiondef('public.can_access_picom_realtime_topic_for_subject(text,text,text)'::regprocedure) like '%all-visible-channels%','community-wide unread topic is recognized');
select ok(pg_get_functiondef('public.can_access_picom_realtime_topic_for_subject(text,text,text)'::regprocedure) like '%viewPrivateChannels%','private channel topics use mature role permissions');
select ok(pg_get_functiondef('public.can_access_picom_realtime_topic_for_subject(text,text,text)'::regprocedure) like '%direct_conversation_participants%blocked_at%','DM typing requires active participant');
select is(public.can_access_picom_realtime_topic_for_subject('00000000-0000-0000-0000-000000000001','unknown:topic','broadcast'),false,'unauthorized Realtime topics are denied');
select is(public.can_access_picom_realtime_topic_for_subject('not-a-uuid','presence:community:00000000-0000-0000-0000-000000000001','presence'),false,'invalid JWT subjects are denied safely');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='picom members receive private realtime topics'),'private topic receive policy exists');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='picom members send private realtime topics'),'private topic send policy exists');
select ok(coalesce((select qual from pg_policies where schemaname='realtime' and tablename='messages' and policyname='picom members receive private realtime topics'),'') like '%can_access_picom_realtime_topic_for_subject%','receive policy uses canonical subject authorization');
select ok(has_function_privilege('authenticated','public.can_access_picom_realtime_topic_for_subject(text,text,text)','EXECUTE'),'authenticated Realtime authorization may execute the helper');

select * from finish();
rollback;
