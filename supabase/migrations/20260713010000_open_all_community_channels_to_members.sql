-- Product decision: remove per-channel privacy for joined community members.
-- Every active community member can view and join ALL channels of communities they
-- belong to. Community visibility remains intact: a private community is not made
-- public by this migration.
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

-- 3) Normalize existing channels to the member-open model. Visitor public-read is
--    left as-is and private community visibility is deliberately preserved.
update public.channels
  set is_private = false
  where is_private is distinct from false;

commit;
