# Messages RLS policy

Task 134 adds RLS policies for `public.messages`.

## Policies

- `messages_select_visible_channel`: authenticated users can read messages only when they can view the message channel.
- `messages_insert_author_visible_text_channel`: users can create their own messages only in text channels they can view.
- `messages_update_own_visible_message`: users can update only their own messages in visible channels.
- `messages_delete_own_or_owner`: users can hard-delete their own messages; community owners can delete messages in visible channels.

## Helper function

`public.can_send_message_to_channel(target_channel_id uuid)` checks that the target channel is visible to the current user and has `type = 'text'`.

This keeps voice channels from accepting text messages through client-side API calls.

## Security notes

Message RLS depends on `public.can_view_channel()` from the channel RLS task. This prevents private channel messages from leaking through direct queries.

The desktop UI may optimistically send or edit local messages, but Supabase RLS remains the source of truth for API mode.

## Test steps

1. Apply migrations locally.
2. Sign in as a community member and select messages from a public text channel in that community.
3. Confirm messages from unrelated communities are not visible.
4. Confirm messages from private channels are not visible to non-owner members.
5. Insert a message where `author_id = auth.uid()` into a visible text channel; it should succeed.
6. Try inserting a message as another `author_id`; it should fail.
7. Try inserting into a voice channel; it should fail.
8. Try editing another user's message as a non-owner; it should fail.