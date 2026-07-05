# Forum Channel Placeholder

Status: post-MVP placeholder

Forum channels are planned as future structured discussion spaces inside Picom communities. This placeholder documents the safe architecture without changing the current text/voice channel runtime behavior.

## MVP stance

- Forum channels are not enabled in the current MVP runtime.
- Existing text and voice channel switching remains unchanged.
- No `forum` channel type is added to active UI or mock data yet.
- No forum post list replaces MessageList in the current app.

## Future channel type

A future schema may extend channel type values with:

- `text`
- `voice`
- `forum`

Before enabling this, all channel render paths must safely handle unknown or future channel types with clear fallbacks.

## Future data model placeholder

Forum posts can either use a dedicated table or reuse a future thread model.

Potential `forum_posts` fields:

- `id`
- `community_id`
- `channel_id`
- `title`
- `body_message_id` optional
- `created_by_id`
- `created_at`
- `updated_at`
- `locked_at`
- `archived_at`
- `deleted_at`

Potential tags table:

- `id`
- `community_id`
- `name`
- `color_token`

## Supabase/RLS expectations

- Users can list forum posts only if they can view the forum channel.
- Private forum channels must not leak post titles or counts.
- Creating posts requires send/post permission in the channel.
- Locking, archiving, or deleting posts requires moderator/admin permissions.
- Search must respect forum channel visibility.

## Future UI placeholder

Potential `ForumChannelView` should include:

- compact post list
- search/filter placeholder
- create post button
- tag chips
- reply count
- last activity
- locked/archived status

It must preserve the desktop shell and avoid mobile layouts.

## Navigation behavior

Future behavior:

- Switching to a forum channel renders `ForumChannelView`.
- Text channels continue to render MessageList and MessageComposer.
- Voice channels continue to render voice room entry/placeholder behavior.
- If forum feature flag is disabled, selecting a forum channel shows a safe unavailable state.

## Feature flag behavior

A future `enableForumChannels` flag should hide forum creation and block unsupported deep links safely. Backend RLS and permissions remain mandatory.

## Implementation decision

This task is documentation-only. Runtime channel types, Supabase migrations, and ForumChannelView UI are intentionally deferred.

## Manual verification

- Confirm existing text and voice channel switching still works.
- Confirm no forum channel appears in the MVP sidebar.
- Confirm MessageList still renders for current text channels.
