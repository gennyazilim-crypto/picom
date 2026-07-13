-- Product decision: remove the private-channel / private-community feature.
-- Every active community member can view and join ALL channels of communities they
-- belong to. Community membership -- not per-channel privacy -- is the access boundary.
--
-- This migration relaxes channel read access to membership only. It does NOT weaken
-- the membership gate: non-members are still denied, and existing visitor public-read
-- access is left unchanged. Moderation/management remains role-controlled.

begin;

-- 1) Channel read access: drop the is_private gating so any community member can view
--    every channel. Public (visitor) read via can_read_public_channel is preserved.
--    Message/attachment RLS reuse this function, so their access follows automatically.
create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels channel
    where channel.id = target_channel_id
      and (
        public.can_read_public_channel(channel.id)
        or public.is_community_member(channel.community_id)
      )
  );
$$;

-- 2) Direct channels SELECT policy: members see every channel in their communities.
drop policy if exists "channels_select_visible_to_member" on public.channels;
create policy "channels_select_visible_to_member"
on public.channels
for select
to authenticated
using (public.is_community_member(community_id));

-- 3) Normalize existing data to the open model. Existing private channels become
--    member-visible; visitor public-read is left as-is (not force-enabled). Existing
--    private communities become public/discoverable.
update public.channels
  set is_private = false
  where is_private is distinct from false;

update public.communities
  set visibility = 'public'
  where visibility is distinct from 'public';

commit;
