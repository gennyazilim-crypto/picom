-- Member-only community access RLS verification
-- Run this against a local Supabase database after migrations and seed data are applied.
-- This file is intentionally read-only except for transaction-local role/JWT settings.

begin;

-- Replace these placeholders with seeded/local IDs before running manually:
--   :member_user_id      -> a user who belongs to the target community
--   :outsider_user_id    -> a user who does not belong to the target community
--   :community_id        -> the target community
--   :public_channel_id   -> a non-private channel in the target community
--   :private_channel_id  -> a private channel in the target community, if available

-- Member should see the community they belong to.
select set_config('request.jwt.claim.sub', ':member_user_id', true);
set local role authenticated;
select id, name
from public.communities
where id = ':community_id'::uuid;

-- Member should see non-private channels for their community.
select id, name, is_private
from public.channels
where community_id = ':community_id'::uuid
order by position;

-- Member should see messages only from visible channels.
select id, channel_id, body
from public.messages
where channel_id = ':public_channel_id'::uuid
order by created_at desc
limit 10;

reset role;

-- Outsider should not see the target community.
select set_config('request.jwt.claim.sub', ':outsider_user_id', true);
set local role authenticated;
select id, name
from public.communities
where id = ':community_id'::uuid;

-- Outsider should not see channels or messages in that community.
select id, name, is_private
from public.channels
where community_id = ':community_id'::uuid;

select id, channel_id, body
from public.messages
where channel_id = ':public_channel_id'::uuid
order by created_at desc
limit 10;

reset role;
rollback;