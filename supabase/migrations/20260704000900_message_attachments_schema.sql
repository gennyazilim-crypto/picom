-- Message attachments table schema hardening
-- The baseline table is public.attachments; this migration hardens it for message attachment usage.

alter table public.attachments
  add column if not exists thumbnail_url text,
  add column if not exists status text not null default 'attached';

alter table public.attachments
  add constraint attachments_file_name_length check (char_length(file_name) between 1 and 180),
  add constraint attachments_storage_path_length check (char_length(storage_path) between 1 and 1024),
  add constraint attachments_mime_type_length check (char_length(mime_type) between 1 and 120),
  add constraint attachments_public_url_length check (public_url is null or char_length(public_url) <= 2048),
  add constraint attachments_thumbnail_url_length check (thumbnail_url is null or char_length(thumbnail_url) <= 2048),
  add constraint attachments_status_valid check (status in ('pending', 'attached', 'failed')),
  add constraint attachments_dimensions_positive check (
    (width is null or width > 0) and
    (height is null or height > 0)
  );

create index if not exists idx_attachments_uploader_created_at
  on public.attachments(uploader_id, created_at desc);

create index if not exists idx_attachments_message_created_at
  on public.attachments(message_id, created_at);

create index if not exists idx_attachments_status
  on public.attachments(status);

create or replace view public.message_attachments as
select
  id,
  message_id,
  uploader_id,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  attachment_type,
  width,
  height,
  public_url,
  thumbnail_url,
  status,
  created_at
from public.attachments;