-- Voice room sidebar chat: allow durable text messages on voice channels in text communities.

create or replace function public.can_send_message_to_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.channels channel
    join public.communities community on community.id = channel.community_id
    where channel.id = target_channel_id
      and community.kind = 'text'::public.community_kind
      and community.archived_at is null
      and channel.type in ('text', 'voice')
      and public.is_community_member(channel.community_id)
      and public.can_view_channel(channel.id)
      and public.effective_community_permission(channel.community_id, 'sendMessages', 'channel', channel.id)
  );
$$;
comment on function public.can_send_message_to_channel(uuid) is
  'Authorizes text and voice-channel chat sends for active text-community members with sendMessages permission.';
