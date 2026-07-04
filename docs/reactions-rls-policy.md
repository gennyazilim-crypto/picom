# Reactions RLS policy

Task 136 adds RLS policies for `public.message_reactions`.

## Policies

- `message_reactions_select_visible_message`: users can read reactions only for messages they can view.
- `message_reactions_insert_own_visible_message`: users can add only their own reaction rows to visible messages.
- `message_reactions_delete_own_visible_message`: users can remove only their own reaction rows from visible messages.

## Security notes

Reaction rows can reveal that a private message exists, so reads must follow `public.can_view_message(message_id)`.

Reaction rows are treated as immutable. The MVP API should add/remove rows instead of updating them.

## Test steps

1. Apply migrations locally.
2. Sign in as a user who can view a channel and select reactions for visible messages.
3. Confirm reactions on private or unrelated-community messages are not visible.
4. Insert a reaction with `user_id = auth.uid()` on a visible message; it should succeed.
5. Try inserting a reaction for another `user_id`; it should fail.
6. Delete your own reaction; it should succeed.
7. Try deleting another user's reaction; it should fail.