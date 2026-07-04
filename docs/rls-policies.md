# Supabase RLS policies

This document summarizes the current Row Level Security policy model for Picom.

Picom is an Electron desktop chat app for Windows, Linux, and macOS. The renderer must never bypass RLS for client-side Supabase access.

## Source of truth

RLS is the source of truth for data access. Frontend UI hiding is only a usability improvement and must not be treated as security enforcement.

## Helper functions

| Function | Purpose |
| --- | --- |
| `public.is_community_member(community_id)` | Checks whether `auth.uid()` belongs to a community. |
| `public.is_community_owner(community_id)` | Checks whether `auth.uid()` owns a community. |
| `public.can_view_channel(channel_id)` | Checks whether the current user can view a channel. |
| `public.can_send_message_to_channel(channel_id)` | Checks whether the current user can send to a visible text channel. |
| `public.can_view_message(message_id)` | Checks whether the current user can view the message channel. |
| `public.can_attach_file_to_message(message_id)` | Allows pending uploads or attachment to the current user's own visible message. |

All helpers use fixed `search_path = public` and are scoped to authenticated users where needed.

## Table policies

| Table | Read policy | Write policy |
| --- | --- | --- |
| `profiles` | Users can read their own profile and profiles of users sharing a community. | Users can update their own profile. |
| `communities` | Owners and members can read communities. | Authenticated users can create communities they own; owners can update. |
| `community_members` | Members can read membership rows for their own communities. | Community owners can manage membership rows. |
| `channels` | Members can read non-private channels; private channels are owner-only for the MVP. | Community owners can create, update, and delete channels. |
| `messages` | Reads follow channel visibility. | Users can create their own messages in visible text channels; users can edit their own messages; users or community owners can delete. |
| `attachments` | Reads follow message visibility, with own pending uploads visible to uploader. | Uploaders can create/manage own pending or own-message attachments; owners can delete visible message attachments. |
| `message_reactions` | Reads follow message visibility. | Users can add/remove only their own reactions. |

## Private channel behavior

The current MVP policy is conservative: private channels are visible to community owners only.

Role-based private channel grants are intentionally deferred until channel/role permission tasks. Until then, private channel messages and attachments remain hidden from normal members and outsiders.

## Tests and verification docs

- `docs/member-only-community-access-test.md`
- `docs/private-channel-access-boundaries-test.md`
- `supabase/tests/member_only_community_access.sql`
- `supabase/tests/private_channel_access_boundaries.sql`

## Policy detail docs

- `docs/profiles-rls-policy.md`
- `docs/communities-rls-policy.md`
- `docs/community-members-rls-policy.md`
- `docs/channels-rls-policy.md`
- `docs/messages-rls-policy.md`
- `docs/attachments-rls-policy.md`
- `docs/reactions-rls-policy.md`

## Security notes

- Never call Supabase with elevated privileges from the Electron renderer.
- Do not expose service-role keys to the desktop app.
- Realtime subscriptions must respect the same channel/message visibility boundaries.
- Search and notification queries must reuse channel/message visibility rules.
- Storage bucket policies are still required before real Supabase Storage uploads are enabled.

## Manual verification checklist

1. Apply migrations and seed data locally.
2. Verify member-only community access.
3. Verify private channel boundaries.
4. Verify a user cannot insert a message for another `author_id`.
5. Verify a user cannot upload attachment metadata for another `uploader_id`.
6. Verify a user cannot add/delete reactions for another `user_id`.
7. Verify views such as `public.message_attachments` respect RLS.