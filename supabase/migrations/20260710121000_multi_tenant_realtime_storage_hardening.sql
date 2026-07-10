-- Task 121: close private-channel attachment object and Broadcast/Presence topic gaps.
-- Postgres Changes continue to use source-table RLS; this migration authorizes
-- only the client Broadcast/Presence topics used by Picom typing and presence.

drop policy if exists "message attachments read attached visible community" on storage.objects;
create policy "message attachments read attached visible message"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and (
    (
      (storage.foldername(name))[5] = 'pending'
      and (storage.foldername(name))[6] = auth.uid()::text
    )
    or exists (
      select 1
      from public.attachments attachment
      where attachment.storage_path = storage.objects.name
        and attachment.status = 'attached'
        and attachment.message_id is not null
        and public.can_view_message(attachment.message_id)
    )
  )
);

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

revoke all on function public.can_access_picom_realtime_topic(text,text) from public, anon;
grant execute on function public.can_access_picom_realtime_topic(text,text) to authenticated;

alter table realtime.messages enable row level security;

drop policy if exists "picom members receive private realtime topics" on realtime.messages;
create policy "picom members receive private realtime topics"
on realtime.messages
for select
to authenticated
using (
  extension in ('broadcast', 'presence')
  and public.can_access_picom_realtime_topic((select realtime.topic()), extension::text)
);

drop policy if exists "picom members send private realtime topics" on realtime.messages;
create policy "picom members send private realtime topics"
on realtime.messages
for insert
to authenticated
with check (
  extension in ('broadcast', 'presence')
  and public.can_access_picom_realtime_topic((select realtime.topic()), extension::text)
);

comment on function public.can_access_picom_realtime_topic(text,text) is
  'Authorizes Picom private typing Broadcast topics by visible member channel and Presence topics by active community membership.';

