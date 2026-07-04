-- Private channel access boundary RLS verification
-- Run this against a local Supabase database after migrations and seed data are applied.
-- The current MVP policy is conservative: private channels are visible to community owners only.

begin;

-- Replace placeholders before running manually:
--   :owner_user_id       -> owner of the target community
--   :member_user_id      -> non-owner member of the target community
--   :outsider_user_id    -> user outside the target community
--   :community_id        -> target community
--   :private_channel_id  -> private channel in the target community
--   :public_channel_id   -> public channel in the target community

-- Owner should see private channel and its messages.
select set_config('request.jwt.claim.sub', ':owner_user_id', true);
set local role authenticated;
select id, name, is_private
from public.channels
where id = ':private_channel_id'::uuid;

select id, channel_id, body
from public.messages
where channel_id = ':private_channel_id'::uuid
order by created_at desc
limit 10;
reset role;

-- Non-owner community member should see public channel, but not private channel.
select set_config('request.jwt.claim.sub', ':member_user_id', true);
set local role authenticated;
select id, name, is_private
from public.channels
where id in (':public_channel_id'::uuid, ':private_channel_id'::uuid)
order by is_private, name;

select id, channel_id, body
from public.messages
where channel_id = ':private_channel_id'::uuid
order by created_at desc
limit 10;
reset role;

-- Outsider should see neither public nor private channels for this community.
select set_config('request.jwt.claim.sub', ':outsider_user_id', true);
set local role authenticated;
select id, name, is_private
from public.channels
where community_id = ':community_id'::uuid;

select id, channel_id, body
from public.messages
where channel_id in (':public_channel_id'::uuid, ':private_channel_id'::uuid)
order by created_at desc
limit 10;
reset role;

rollback;