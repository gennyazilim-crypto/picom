-- Task 121 staging/local verification outline.
-- Run only against disposable Supabase with `supabase test db` after substituting
-- fixture UUIDs created by the RLS suite. This file contains no production data.

begin;
select plan(9);

-- Structural assertions catch accidental policy/function removal without
-- requiring a Realtime socket inside pgTAP.
select has_function('public', 'can_access_picom_realtime_topic', array['text', 'text'], 'private Realtime topic authorization helper exists');
select has_policy('realtime', 'messages', 'picom members receive private realtime topics', 'private Realtime receive policy exists');
select has_policy('realtime', 'messages', 'picom members send private realtime topics', 'private Realtime send policy exists');
select has_policy('storage', 'objects', 'message attachments read attached visible message', 'message attachment object reads use visible-message boundary');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000000', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(public.can_access_picom_realtime_topic('typing:community:not-a-uuid:channel:not-a-uuid', 'broadcast'), false, 'malformed typing topic is denied');
select is(public.can_access_picom_realtime_topic('presence:community:not-a-uuid', 'presence'), false, 'malformed presence topic is denied');
select is(public.can_access_picom_realtime_topic('typing:community:00000000-0000-4000-8000-000000000001:channel:00000000-0000-4000-8000-000000000002', 'presence'), false, 'typing topic cannot be used as presence');
select is(public.can_access_picom_realtime_topic('presence:community:00000000-0000-4000-8000-000000000001', 'broadcast'), false, 'presence topic cannot be used as broadcast');
select is(public.can_access_picom_realtime_topic('unknown:topic', 'broadcast'), false, 'unknown topic is denied');

select * from finish();
rollback;

-- Required two-user live checks outside this structural script:
-- 1. Member A can subscribe/send typing only in a channel visible to A.
-- 2. Member B cannot subscribe to A's private channel typing topic.
-- 3. Visitor/outsider cannot subscribe to community presence.
-- 4. A normal community member cannot select storage.objects for an attached
--    file whose linked message is in an owner/admin-only private channel.
