# Feed Rollup Reconciliation

## Event path

Feed Algorithm V1 uses row-level triggers to synchronize only the changed source and rebuild only its rollup. Message edits and attachment state changes recalculate text/image/video classification. Reaction, reply/comment, save, opened-impression, source lifecycle, and moderation events refresh the affected item.

Canonical actor eligibility excludes the author, bots/system profiles, deletion-pending accounts, and active community bans. Source deletion/moderation changes invalidate items instead of leaving stale candidates.

## Operational repair

The migration adds two operator-only functions:

- `reconcile_feed_sources_v1(scope, cursor, limit)` creates or repairs source rows in bounded batches.
- `reconcile_feed_rollups_v1(cursor, limit)` recomputes existing rollups in bounded batches.

Use `scripts/rebuild-feed-rollups.sql` only in a reviewed local/staging SQL session. Repeat each scope with the returned `next_cursor` until `processed` is zero. These functions are deliberately not granted to `authenticated`, `anon`, or renderer clients.

## Safety

- The process is idempotent through `(source_type, source_id)` and `feed_item_id` uniqueness.
- It stores no source body or credentials.
- It uses keyset UUID cursors and a maximum batch size of 2,000.
- It never performs a full-feed rescore inside a page request.
- Hosted before/after counts and SQL execution evidence are deferred to Task 688.

