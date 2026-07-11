# Task 482: Feed Realtime, Refresh, Unread, and Cache Full MVP

## Result

Complete for repository implementation and deterministic local/static validation. Hosted two-client evidence remains blocked by unavailable Supabase CLI and staging credentials.

## Delivered

- RLS-governed Realtime invalidation covers text mentions/messages, read/save/reaction state, Radio, Podcast episodes, Podcast reactions, and Podcast comments.
- Events are coalesced into one bounded refresh and reconnect triggers an authoritative refresh.
- Source deletes remove visible text cards immediately before authoritative reconciliation.
- The in-memory mention cache deduplicates by message ID and is capped at 200 cards.
- Ranked cursor pages use a 16-page bounded cache, a 30-second fresh window, and a five-minute stale fallback.
- Explicit refresh bypasses fresh cache while retaining stale fallback on network failure.
- Feed query cache is invalidated on relevant Realtime changes.
- `mention_feed_view` and `list_mention_feed` now expose current-user `is_unread` using channel read cursors.
- Local optimistic read state is retained during short backend propagation delays; authoritative cross-client read state can still advance to read.
- Realtime diagnostics contain only status, event table/type, timestamps, and counts; no message, comment, or profile content is recorded.
- Realtime publication membership is added idempotently for required source tables.

## Validation

- `npm run feed:realtime:cache:smoke` - PASS
- `npm run mentions:supabase:smoke` - PASS
- `npm run supabase:smoke` - PASS (static schema contract)
- `npm run typecheck` - PASS
- `npm run mock:smoke` - PASS
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS (hard caps)

## Blocked External Evidence

- Local Supabase migration reset/pgTAP: BLOCKED because the Supabase CLI is not installed.
- Hosted two-client insert/update/delete/reconnect validation: BLOCKED because protected staging credentials were not available in this task.

## Remaining Non-Blocking Warnings

- The pre-existing `voiceService` static/dynamic import warning remains.
- Renderer assets remain above preferred targets but below enforced hard caps.

No secrets, message bodies, comments, or private profile content are emitted by Feed diagnostics.
