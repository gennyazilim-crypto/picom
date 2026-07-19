drop policy if exists "message attachments upload own pending" on storage.objects;
drop policy if exists "message attachments read attached visible community" on storage.objects;
drop policy if exists "message attachments delete own pending" on storage.objects;
create policy "message attachments upload own pending"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = 'communities'
  and (storage.foldername(name))[3] = 'channels'
  and (storage.foldername(name))[5] = 'pending'
  and (storage.foldername(name))[6] = auth.uid()::text
  and exists (
    select 1
    from public.community_members cm
    join public.channels c
      on c.community_id = cm.community_id
    where cm.user_id = auth.uid()
      and cm.community_id::text = (storage.foldername(name))[2]
      and c.id::text = (storage.foldername(name))[4]
  )
);
create policy "message attachments read attached visible community"
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
      from public.attachments a
      join public.messages m
        on m.id = a.message_id
      join public.community_members cm
        on cm.community_id = m.community_id
      where a.storage_path = storage.objects.name
        and a.status = 'attached'
        and cm.user_id = auth.uid()
    )
  )
);
create policy "message attachments delete own pending"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[5] = 'pending'
  and (storage.foldername(name))[6] = auth.uid()::text
);
