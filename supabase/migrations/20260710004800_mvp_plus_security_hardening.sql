-- MVP+ security hardening. Renderer checks remain UX only; these database rules are authoritative.

-- A DM attachment must be attached to the uploader's own message, not another participant's message.
drop policy if exists "direct_attachments_insert_uploader_member" on public.direct_message_attachments;
create policy "direct_attachments_insert_uploader_author"
on public.direct_message_attachments for insert to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.direct_messages message
    where message.id = message_id
      and message.author_id = auth.uid()
      and public.is_direct_conversation_member(message.conversation_id)
  )
);

-- Public events must not reveal a private or cross-community linked channel.
drop policy if exists "events_select_member_or_public" on public.community_events;
create policy "events_select_visible_channel_member_or_public"
on public.community_events for select to anon, authenticated
using (
  (channel_id is null or exists (
    select 1 from public.channels channel
    where channel.id = channel_id
      and channel.community_id = community_id
      and public.can_view_channel(channel.id)
  ))
  and (
    public.is_community_member(community_id)
    or exists (
      select 1 from public.communities community
      where community.id = community_id
        and community.visibility = 'public'
        and community.public_read_enabled = true
    )
  )
);

drop policy if exists "events_insert_manager" on public.community_events;
create policy "events_insert_manager_visible_channel"
on public.community_events for insert to authenticated
with check (
  created_by = auth.uid()
  and (public.is_community_owner(community_id) or public.has_community_role_level(community_id, 80))
  and (channel_id is null or exists (
    select 1 from public.channels channel
    where channel.id = channel_id
      and channel.community_id = community_id
      and public.can_view_channel(channel.id)
  ))
);

revoke update on public.community_events from authenticated;
grant update (title, description, starts_at, ends_at, cancelled_at, updated_at) on public.community_events to authenticated;

-- Report creation validates that the target belongs to the visible community context.
drop policy if exists "reports_submit_visible_target" on public.reports;
create policy "reports_submit_visible_target"
on public.reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and community_id is not null
  and (
    (target_type = 'community' and target_id = community_id and exists (
      select 1 from public.communities community
      where community.id = community_id
        and (community.visibility = 'public' or public.is_community_member(community.id))
    ))
    or (target_type = 'message' and exists (
      select 1 from public.messages message
      where message.id = target_id
        and message.community_id = community_id
        and public.can_view_channel(message.channel_id)
    ))
    or (target_type = 'user' and exists (
      select 1 from public.community_members membership
      where membership.community_id = community_id
        and membership.user_id = target_id
        and (public.is_community_member(community_id) or public.can_read_public_community(community_id))
    ))
  )
);

revoke update on public.reports from authenticated;
grant update (status, reviewed_by, updated_at) on public.reports to authenticated;
drop policy if exists "reports_moderator_update" on public.reports;
create policy "reports_moderator_update"
on public.reports for update to authenticated
using (community_id is not null and public.can_moderate_community_reports(community_id))
with check (
  community_id is not null
  and public.can_moderate_community_reports(community_id)
  and (reviewed_by is null or reviewed_by = auth.uid())
);

-- Managers may list webhook metadata but never select the credential hash through the client role.
revoke select on public.webhooks from authenticated;
grant select (id, community_id, channel_id, name, avatar_url, created_by, revoked_at, created_at, updated_at)
on public.webhooks to authenticated;
