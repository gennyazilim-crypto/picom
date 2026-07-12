# Feed Query Performance V1

## Query shape

`get_feed_page` performs one server query. It materializes access-approved canonical items before adding user signals or ranking. Engagement values come from event-driven rollups, so page reads do not aggregate the full event history. The final order is `(group_priority, final_score DESC, source_created_at DESC, feed_item_id DESC)` under one stable `as_of`.

No OFFSET, DM source, one-way follow, or full content scan is part of the V1 query.

## Index contract

- `feed_items`: source uniqueness, community/channel/author time, engagement time, score version/moderation.
- `feed_engagement_rollups`: version/raw-score/time.
- `feed_user_states`: user/seen, user/saved, user/unread, user/opened.
- `content_mentions`: recipient/source lookup.
- `friendships`: normalized low/high user indexes.
- Source reaction/reply/save tables retain their existing source/actor indexes.

## EXPLAIN evidence

Run `scripts/explain-ranked-feed-v1.sql` with an authenticated test identity against staging-safe seeded data. Record total execution time, returned rows, shared buffer reads, sequential scans, and index choices.

Current repository checkpoint: **BLOCKED for real EXPLAIN ANALYZE evidence** because no disposable/hosted Supabase execution target is configured in this isolated worktree. Static query/index contracts pass locally. Task 688 must attach redacted output and must not label performance acceptable if the plan shows unbounded scans or exceeds the approved staging threshold.

## Review thresholds for Task 688

- Page size: 20 (maximum 50).
- No sequential scan of unbounded engagement event tables.
- No per-card network query.
- Stable second-page results with no duplicate IDs under the same `as_of`.
- Query target: p95 below 300 ms on the reviewed staging fixture; otherwise release remains blocked and indexes/query shape must be revised.

