-- Task 139: fail-closed scan state and Storage quarantine enforcement.

alter table public.attachments add column if not exists scan_status text;
update public.attachments set scan_status = 'pending' where scan_status is null;
alter table public.attachments alter column scan_status set default 'pending';
alter table public.attachments alter column scan_status set not null;
alter table public.attachments drop constraint if exists attachments_scan_status_valid;
alter table public.attachments add constraint attachments_scan_status_valid
  check (scan_status in ('pending','clean','suspicious','failed','skipped_development'));

create index if not exists idx_attachments_quarantine_review
  on public.attachments(scan_status, created_at)
  where scan_status in ('pending','suspicious','failed');

comment on column public.attachments.scan_status is
  'Trusted scanner result. Authenticated uploaders cannot set or update this field.';

-- Remove table-wide mutation grants so a normal uploader cannot self-mark clean.
revoke insert, update on table public.attachments from authenticated;
grant insert (message_id,uploader_id,storage_path,file_name,mime_type,size_bytes,attachment_type,width,height,public_url,thumbnail_url,status)
  on public.attachments to authenticated;
grant update (message_id,width,height,thumbnail_url,status)
  on public.attachments to authenticated;

drop view if exists public.message_attachments;
create view public.message_attachments
with (security_invoker = true)
as
select id,message_id,uploader_id,storage_path,file_name,mime_type,size_bytes,attachment_type,width,height,
  public_url,thumbnail_url,scan_status,status,created_at
from public.attachments;

drop policy if exists "message attachments read attached visible message" on storage.objects;
drop policy if exists "message attachments read attached visible community" on storage.objects;
create policy "message attachments read scanned visible object"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and exists (
    select 1
    from public.attachments attachment
    where attachment.storage_path = storage.objects.name
      and attachment.scan_status in ('clean','skipped_development')
      and (
        (attachment.status = 'pending' and attachment.message_id is null and attachment.uploader_id = auth.uid())
        or (attachment.status = 'attached' and attachment.message_id is not null and public.can_view_message(attachment.message_id))
      )
  )
);
