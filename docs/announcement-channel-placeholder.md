# Announcement Channel Placeholder

Status: post-MVP placeholder

Announcement channels are planned as future channels with restricted posting and clearer broadcast styling. This placeholder documents the safe path without changing current text channel behavior.

## MVP stance

- Announcement channels are not enabled in the current MVP runtime.
- Existing text and voice channels remain unchanged.
- MessageComposer permission states are not changed by this task.
- No new channel icon or sidebar behavior is added yet.

## Future channel fields

A future channel record can include:

- `is_announcement` boolean
- `announcement_following_enabled` placeholder
- `send_announcements_permission_key` placeholder

This should not replace existing `sendMessages` checks until backend rules are ready.

## Supabase/RLS expectations

- Users can view announcement channels only if they can view the channel.
- Posting requires a future permission such as `sendAnnouncements` or `manageChannels`.
- Unauthorized users should receive a consistent permission error.
- Private announcement channels must not leak messages, previews, or search results.

## Future UI behavior

Potential desktop UI updates:

- Channel icon variant for announcement channels using AppIcon/Coolicons only.
- MessageComposer shows read-only state when user cannot post.
- Channel settings can toggle announcement mode for permitted admins.
- Announcement messages can use subtle special styling while keeping Picom design tokens.

No mobile UI, bottom navigation, or web-first layout should be introduced.

## Future notification behavior

Announcement notifications should respect:

- notification settings
- muted communities/channels
- DND
- quiet hours
- mention override settings if configured

Notification payloads should use safe metadata and avoid tokens, authorization headers, or private raw diagnostics.

## Realtime behavior

Future announcement messages should use the normal message realtime pipeline so message ordering, duplicate prevention, and offline retry behavior stay consistent.

## Feature flag behavior

A future `enableAnnouncementChannels` flag should hide creation/toggle entry points. Backend permission checks and RLS remain mandatory.

## Implementation decision

This task is documentation-only. Runtime channel type changes, composer restrictions, and Supabase migrations are intentionally deferred.

## Manual verification

- Confirm existing channel switching still works.
- Confirm MessageComposer still works in normal text channels.
- Confirm no announcement channel UI appears in the current MVP shell.
