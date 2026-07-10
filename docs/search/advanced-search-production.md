# Advanced Search Production Architecture

## Status

Picom has a production-oriented unified search RPC plus permission-aware local search. The desktop Command Palette continues to use local state for immediate results; Supabase search APIs are ready for a future async results surface without bypassing RLS/visibility rules.

## Search scopes

- Communities.
- Channels.
- Members.
- Messages.
- Mentions of the current user.
- Current user's saved messages.
- Local attachment/media metadata remains local-only in the existing Command Palette.

## Local search

`advancedSearchService.searchLocal()` uses the existing community access helpers:

- Visitor searches only public-readable communities/channels/messages.
- Private channels are removed through `canViewChannel()` before body/media checks.
- Member names are searched only when `canViewMemberList` is true.
- Mentions are rechecked against community/channel visibility.
- Saved records are returned only when their community/channel remains visible.

The optional saved-message input preserves existing call compatibility while allowing Command Palette results to include private user bookmarks safely.

## Production Supabase RPC

`search_accessible_entities(query_text, category_filter, result_limit)` is authenticated, bounded, and security-definer with explicit authorization in every result branch.

### Communities

Returned only when the requester is a member or the community is public and public-read enabled. Private community metadata is not searchable by outsiders.

### Channels

Every row requires `can_view_channel(channel.id)`. Visitor/public and private member behavior therefore follows the same backend visibility function as normal channel access.

### Members

The requester must be a member of the same community. Visitors cannot enumerate community member profiles through search.

### Messages

Every message must be undeleted and pass `can_view_channel(message.channel_id)`. Private channel bodies cannot enter the result CTE without authorization.

### Mentions

Only visible undeleted messages containing the authenticated user's own username mention are returned. Mention search does not expose mentions of unrelated users as a separate index.

### Saved messages

Every row requires `saved_messages.user_id = auth.uid()`, undeleted message state, and current channel visibility. Losing channel access removes the saved message from search.

## Query and result limits

- Authentication required.
- Query length: 2-80 characters.
- `%` and `_` wildcards removed server-side and client-side.
- Category is allowlisted.
- Result limit clamped to 1-80.
- Labels/details are bounded safe projections.
- No raw SQL fragments, table names, arbitrary filters, or sort expressions are accepted.

## Indexing

The migration adds:

- Generated `messages.search_vector` using the `simple` dictionary.
- Partial GIN full-text index for undeleted messages.
- Partial trigram index for message-body fallback/typo matching.
- Trigram indexes for community/channel/profile display fields.

`pg_trgm` is installed in the Supabase `extensions` schema. Search ranking combines full-text rank, trigram similarity, and recency ordering. Production `EXPLAIN (ANALYZE, BUFFERS)` evidence is still required against representative data.

## Security boundary

- Search is not a separate permission system.
- Security-definer use is constrained by explicit `auth.uid()` and visibility checks in every union branch.
- RPC is unavailable to `anon`.
- Private channel messages, attachments, member lists, and community metadata remain inaccessible to unauthorized users.
- Result labels never include tokens, auth headers, invite secrets, report content, audit logs, storage paths, or moderation notes.
- Frontend category filtering cannot broaden backend access.

## Visitor limitations

Authenticated visitors may search public-readable communities, public channels, and visible messages. They cannot search member lists, private communities/channels/messages, or another user's saved items. Normal send/reaction/join restrictions remain unchanged.

## Realtime and stale results

A search result is only a pointer. Opening a result must re-run normal community/channel/message access. Deleted messages or revoked permissions should show a safe unavailable state instead of cached content. Search results must not be persisted as a private content cache.

## Operational controls

- Add per-user/IP-hash backend rate limits before a dedicated global search UI.
- Debounce interactive remote queries (recommended 250-400 ms).
- Cancel stale requests on query change.
- Paginate beyond the current bounded first page.
- Monitor query latency/error ratio with content-free metrics; never log query text by default.
- Apply kill switch/degraded state if search causes database pressure.
- Review index storage/write amplification before production rollout.

## Current limitations

- Command Palette remains local-first and does not merge async Supabase results yet.
- English/Turkish stemming is not enabled; `simple` dictionary favors predictable language-neutral tokenization.
- Attachment OCR/content search is not included.
- Direct-message search is intentionally excluded from this community-scoped task.
- Ranking quality requires staging/production-like data measurement.
- Live migration, RLS, and query-plan tests require Supabase CLI or staging.

## Verification matrix

- Member finds accessible community/channel/member/message.
- Visitor finds only public-readable community/channel/message.
- Outsider cannot find private community/channel/message/member.
- User cannot find another user's saved message.
- Mention results contain only current-user mentions in visible channels.
- Revoked channel access removes message/saved results.
- Deleted messages never appear.
- Short/invalid categories/oversized limits fail safely.
- Query plans use expected GIN/trigram indexes on representative datasets.

