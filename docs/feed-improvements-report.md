# Feed production improvements report

## Current implementation

- `list_ranked_unified_feed` provides deterministic ranking epochs and cursor pagination.
- `list_mention_feed` provides rich cards with attachments, reactions and comment previews.
- Feed cache is user-resettable, bounded to 200 rich items and deduplicated by message ID.
- Query page cache is bounded, has fresh/stale windows and can serve an explicit stale result during connectivity loss.
- Realtime invalidation is debounced and removes deleted message/content sources immediately.
- Read and saved projections are separated from public content.

## Change in this pass

Mock Feed datasets are now dynamically loaded only when mock mode is active. Production startup no longer eagerly imports those datasets through the two Feed service entry points.

## Remaining work

- Connect the visible list to `nextCursor`; the current screen requests a bounded first page.
- Add list windowing after profiling with at least 1,000 and 10,000 visible records.
- Replace coarse all-cache invalidation with scoped invalidation only after hosted event traces prove the correct keys.
- Add a durable offline journal for save/read/reaction/comment mutations or explicitly disable those actions while offline.
- Record two-user comment/reaction/read/delete ordering and private-channel leak tests.

## Production decision

The Feed is source-complete enough for local QA, but hosted privacy, pagination and multi-user acceptance remain release evidence blockers.
