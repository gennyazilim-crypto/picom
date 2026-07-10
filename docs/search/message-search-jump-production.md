# Message Search Jump Production

## Current behavior

Picom command search indexes only communities, channels, messages, mentions, saved messages, media, and people currently present in the authorized desktop state. Local message results exclude deleted records and channels the current user cannot view.

Clicking a message-like result performs a second navigation-time resolution:

1. Require community, channel, and message IDs.
2. Confirm the community still exists in current state.
3. Recompute the user's current community access.
4. Confirm the channel exists and `canViewChannel` still allows it.
5. Confirm the message belongs to that channel and is not deleted.
6. Switch to community view, preserve/select community and channel, clear unread state, scroll to the message, and highlight it for 2.2 seconds.

Failure uses one generic response: the message is no longer available or access is unavailable. It does not reveal whether a private channel, deleted message, removed membership, or stale ID exists.

Saved-message navigation uses the same `jumpToMessage` permission/deletion check. `MessageList` locates the exact `data-message-id`, scrolls it into the center, and applies the existing design-token highlight without page-level scrolling.

## Private channels and backend enforcement

Local search filters through `getCommunityAccess` and `canViewChannel`. The Supabase `search_accessible_entities` RPC independently requires authentication, excludes deleted messages, and calls backend `can_view_channel`; client filtering is UX defense-in-depth, not the security boundary.

Attachments/media inherit their parent message and channel visibility. Search never returns private attachment URLs as result metadata.

## Context loading

The current command palette consumes local search results, so every clickable message is already loaded. The remote search service exists but is not wired into the palette. Therefore Picom does not pretend that unloaded historical context can be fetched today: an unloaded/stale target fails safely instead of switching to an empty channel.

Before remote results are enabled, add an RLS-protected `get_message_context` backend path that returns a bounded window around the target, rechecks channel visibility on every call, excludes deleted content, and reconciles into the channel store before highlighting. It must handle pagination, retention, channel deletion, membership changes, and duplicate realtime events.

## Accessibility and UX

- Search result activation works through existing keyboard/button command palette behavior.
- Highlight is temporary and does not alter message content.
- Deleted/inaccessible targets show actionable but non-enumerating copy.
- Switching preserves fixed desktop sidebars and independent chat scroll.
- No mobile routing or new page-level overflow is introduced.

## Verification

Run `npm run message:search-jump:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run supabase:smoke`, and `npm run build`.

Manual tests:

- click a result in the active channel;
- jump across channel and community;
- verify exact scroll/highlight and unread clearing;
- delete a result before click;
- remove membership/private-channel permission before click;
- open a stale saved/mention/media result;
- confirm generic failure reveals no private target details;
- run live RLS search with two users when Supabase CLI/staging is available.

## Remaining gate

Historical unloaded context is not production-enabled. Remote palette integration requires the dedicated bounded context endpoint and live RLS tests. Current local-result jump is complete and fail-safe.
