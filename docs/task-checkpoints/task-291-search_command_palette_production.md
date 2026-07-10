# Task 291 - Search command palette production

## Status

Implemented for mock/local and Supabase modes.

## Delivered

- Unified commands, navigation, communities, channels, messages, profiles, mentions, saved items and media results.
- 180 ms debounce, visible loading and polished empty states; commands remain available immediately.
- Local and Supabase RPC results are deduplicated, bounded and blocked-user aware.
- Arrow Up/Down, Home/End, Enter and Escape navigation with ARIA dialog/listbox semantics.
- Profile and channel/message actions re-check loaded community/channel access before navigation.

## Permission boundary

Local search indexes only visible channels/messages and permitted member lists. Remote search uses `search_accessible_entities`, which requires authentication and calls `can_view_channel` for channel/message content. Renderer checks are defense-in-depth, not authorization.

## Supabase verification

Hosted staging should test private-channel exclusion, visitor public-read behavior, member-list visibility and remote message jump with two roles. Supabase CLI is unavailable locally, so hosted RPC execution is not claimed as passed.
