# Channels RLS policy

Task 133 adds RLS policies for `public.channels`.

## Policies

- `channels_select_visible_to_member`: community members can read non-private channels in communities they belong to.
- `channels_insert_owner`: community owners can create channels.
- `channels_update_owner`: community owners can update channels.
- `channels_delete_owner`: community owners can delete channels.

## Helper function

`public.can_view_channel(target_channel_id uuid)` centralizes channel visibility checks for future message, attachment, search, and realtime policies.

For the MVP, private channels are visible only to community owners. Role/member-specific private channel grants are intentionally deferred to later permission tasks.

## Security notes

Channels control message and attachment visibility. Client-side UI may hide private channels, but RLS remains the source of truth.

Do not bypass these policies from the desktop client. Any future privileged channel management flow should use trusted server-side code or Supabase Edge Functions only when justified.

## Test steps

1. Apply migrations locally.
2. Sign in as a community member and select public channels for that community.
3. Confirm channels from unrelated communities are not visible.
4. Confirm private channels are not visible to non-owner members.
5. Confirm the community owner can create, update, and delete channels.
6. Confirm a non-owner cannot create, update, or delete channels.