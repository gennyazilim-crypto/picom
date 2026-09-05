-- Pending message attachments have no message_id yet.  The active-community
-- select guard must therefore preserve the uploader's own pending row so the
-- PostgREST INSERT ... RETURNING used by the composer can complete.

drop policy if exists "active community attachments guard" on public.attachments;

create policy "active community attachments guard"
on public.attachments as restrictive
for select to anon, authenticated
using (
  (attachments.message_id is null and attachments.uploader_id = auth.uid())
  or exists (
    select 1
    from public.messages message
    where message.id = attachments.message_id
      and public.is_active_community(message.community_id)
  )
);
