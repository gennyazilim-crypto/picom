# Task 097 Checkpoint: Advanced Search Production

## Outcome

Added a unified, authenticated Supabase search architecture and completed permission-aware local saved-message search without changing the desktop layout.

## Changes

- Added full-text/trigram message and metadata indexes.
- Added one typed RPC for communities, channels, members, messages, current-user mentions, and user-owned saved messages.
- Added explicit access checks in every search branch.
- Replaced direct remote ILIKE helpers with scoped RPC wrappers.
- Added saved-message results to the local Command Palette path with visibility rechecks.

## Safety

- Private community/channel/message data cannot enter results without backend access.
- Visitors cannot enumerate member lists.
- Saved results are restricted to `auth.uid()` and current channel visibility.
- Queries/categories/limits are bounded and raw query text is not logged.
- Opening results still uses normal access paths.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live FTS/RLS/query-plan validation requires Supabase CLI or staging and is not claimed by structural smoke alone.
