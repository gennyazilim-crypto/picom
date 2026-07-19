begin;

create or replace function public.text_attachment_setting_allows(
  target_message_id uuid,
  target_storage_path text,
  target_uploader_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when target_message_id is not null then exists (
      select 1
      from public.messages message
      where message.id = target_message_id
        and public.text_message_setting_allows(message.channel_id, null, 'attachment')
    )
    else
      target_uploader_id = auth.uid()
      and split_part(target_storage_path, '/', 1) = 'communities'
      and split_part(target_storage_path, '/', 3) = 'channels'
      and split_part(target_storage_path, '/', 5) = 'pending'
      and split_part(target_storage_path, '/', 6) = auth.uid()::text
      and exists (
        select 1
        from public.channels channel
        where channel.id::text = split_part(target_storage_path, '/', 4)
          and channel.community_id::text = split_part(target_storage_path, '/', 2)
          and public.can_send_message_to_channel(channel.id)
          and public.text_message_setting_allows(channel.id, null, 'attachment')
      )
  end;
$$;

revoke all on function public.text_attachment_setting_allows(uuid, text, uuid) from public, anon;
grant execute on function public.text_attachment_setting_allows(uuid, text, uuid) to authenticated, service_role;

drop policy if exists "text attachment settings insert guard" on public.attachments;
create policy "text attachment settings insert guard"
on public.attachments
as restrictive
for insert
to authenticated
with check (
  public.text_attachment_setting_allows(message_id, storage_path, uploader_id)
);

commit;
