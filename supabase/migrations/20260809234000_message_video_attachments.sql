-- Secure text-channel video attachments. Keep the private bucket and fail-closed
-- scan workflow; only MP4 and WebM are allowed.
alter table public.attachments drop constraint if exists attachments_attachment_type_check;
alter table public.attachments add constraint attachments_attachment_type_check
  check (attachment_type in ('image', 'video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
