-- Authorize the private room topic used for Postgres Changes subscriptions.
-- The same community-membership and channel-visibility checks used by typing
-- topics apply, so private-only Realtime can remain enforced project-wide.
create or replace function public.can_access_picom_realtime_topic(
  target_topic text,
  target_extension text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, realtime, pg_temp
as $$
declare
  target_community_id uuid;
  target_channel_id uuid;
  uuid_pattern constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
begin
  if auth.uid() is null or target_topic is null or target_extension is null then
    return false;
  end if;

  if target_extension = 'broadcast'
    and target_topic ~ ('^typing:community:' || uuid_pattern || ':channel:' || uuid_pattern || '$') then
    target_community_id := split_part(target_topic, ':', 3)::uuid;
    target_channel_id := split_part(target_topic, ':', 5)::uuid;

    return exists (
      select 1
      from public.channels channel
      where channel.id = target_channel_id
        and channel.community_id = target_community_id
        and public.is_community_member(target_community_id)
        and public.can_view_channel(target_channel_id)
    );
  end if;

  if target_extension in ('broadcast', 'presence')
    and target_topic ~ ('^room:community:' || uuid_pattern || ':channel:' || uuid_pattern || '$') then
    target_community_id := split_part(target_topic, ':', 3)::uuid;
    target_channel_id := split_part(target_topic, ':', 5)::uuid;

    return exists (
      select 1
      from public.channels channel
      where channel.id = target_channel_id
        and channel.community_id = target_community_id
        and public.is_community_member(target_community_id)
        and public.can_view_channel(target_channel_id)
    );
  end if;

  if target_extension = 'presence'
    and target_topic ~ ('^presence:community:' || uuid_pattern || '$') then
    target_community_id := split_part(target_topic, ':', 3)::uuid;
    return public.is_community_member(target_community_id);
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function public.can_access_picom_realtime_topic(text, text) from public, anon;
grant execute on function public.can_access_picom_realtime_topic(text, text) to authenticated;

comment on function public.can_access_picom_realtime_topic(text, text) is
  'Authorizes private Picom typing, room, and presence topics through community membership and channel visibility.';
