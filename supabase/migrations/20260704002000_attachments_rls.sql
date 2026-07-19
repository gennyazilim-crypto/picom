-- RLS policies for public.attachments
-- Attachment access follows the linked message when attached, while pending uploads stay private to the uploader.

create or replace function public.can_view_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages message
    where message.id = target_message_id
      and public.can_view_channel(message.channel_id)
  );
$$;
create or replace function public.can_attach_file_to_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_message_id is null
    or exists (
      select 1
      from public.messages message
      where message.id = target_message_id
        and message.author_id = auth.uid()
        and public.can_view_channel(message.channel_id)
    );
$$;
grant execute on function public.can_view_message(uuid) to authenticated;
grant execute on function public.can_attach_file_to_message(uuid) to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
alter table public.attachments enable row level security;
drop policy if exists "attachments_select_visible_message_or_own_pending" on public.attachments;
create policy "attachments_select_visible_message_or_own_pending"
on public.attachments
for select
to authenticated
using (
  (message_id is null and uploader_id = auth.uid())
  or public.can_view_message(message_id)
);
drop policy if exists "attachments_insert_own_pending_or_own_message" on public.attachments;
create policy "attachments_insert_own_pending_or_own_message"
on public.attachments
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and public.can_attach_file_to_message(message_id)
);
drop policy if exists "attachments_update_own_pending_or_own_message" on public.attachments;
create policy "attachments_update_own_pending_or_own_message"
on public.attachments
for update
to authenticated
using (
  uploader_id = auth.uid()
  and (
    message_id is null
    or public.can_attach_file_to_message(message_id)
  )
)
with check (
  uploader_id = auth.uid()
  and public.can_attach_file_to_message(message_id)
);
drop policy if exists "attachments_delete_own_or_owner_visible_message" on public.attachments;
create policy "attachments_delete_own_or_owner_visible_message"
on public.attachments
for delete
to authenticated
using (
  uploader_id = auth.uid()
  or exists (
    select 1
    from public.messages message
    where message.id = attachments.message_id
      and public.is_community_owner(message.community_id)
      and public.can_view_channel(message.channel_id)
  )
);
-- Keep the compatibility view from bypassing table RLS in Supabase/Postgres 15+.
drop view if exists public.message_attachments;
create view public.message_attachments
with (security_invoker = true)
as
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
