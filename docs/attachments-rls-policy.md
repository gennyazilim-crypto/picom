# Attachments RLS policy

Task 135 adds RLS policies for `public.attachments`.

The earlier schema task exposes a compatibility view named `public.message_attachments`, but the underlying table is `public.attachments`.

## Policies

- `attachments_select_visible_message_or_own_pending`: users can read attachments on visible messages, plus their own pending uploads.
- `attachments_insert_own_pending_or_own_message`: users can insert attachments only as themselves and only pending or attached to their own visible message.
- `attachments_update_own_pending_or_own_message`: users can update their own pending/message attachments.
- `attachments_delete_own_or_owner_visible_message`: users can delete their own attachments; community owners can delete attachments on visible messages.

## Helper functions

- `public.can_view_message(target_message_id uuid)` checks whether the current user can view the message channel.
- `public.can_attach_file_to_message(target_message_id uuid)` allows pending uploads or attachments to the current user's own visible message.

## View behavior

`public.message_attachments` is recreated with `security_invoker = true` so it does not bypass table RLS.

## Security notes

Attachment metadata can reveal private-channel content through file names, MIME types, image dimensions, and public URLs. Reads must follow message/channel visibility.

Storage object policies should be added separately when Supabase Storage buckets are introduced.

## Test steps

1. Apply migrations locally.
2. Sign in as a channel member and read attachments for messages in a visible channel.
3. Confirm private-channel attachments are hidden from non-owner members.
4. Insert a pending attachment with `message_id = null` and `uploader_id = auth.uid()`.
5. Try inserting an attachment with another user's `uploader_id`; it should fail.
6. Try attaching a file to another user's message; it should fail.
7. Query `public.message_attachments` and confirm it respects the same RLS behavior.