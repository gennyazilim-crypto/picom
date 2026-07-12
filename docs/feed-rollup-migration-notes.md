# Feed Rollup Migration Notes

Migration: `20260712201000_feed_rollup_schema.sql`

## Forward-fix policy

The new tables contain derived Feed metadata and per-user interaction timestamps. Apply the migration through the normal reviewed Supabase migration pipeline. If a defect is found before production writes, a local reset may be used in a disposable environment. **Do not roll back after production writes.** Add a forward migration that preserves user read/save state and either repairs or rebuilds derived items/rollups.

## Rebuildability

- `feed_items` is derived from source identity, classification, author, visibility state, and timestamps.
- `feed_engagement_rollups` is derived from qualified source events and can be rebuilt.
- `feed_user_states` and `feed_impressions` are user data and must be retained during forward fixes.
- No source body is copied, so rebuilding never requires reading content from these tables.

## Deployment order

1. Apply Task 680 schema.
2. Deploy Task 681 idempotent source synchronization and rollup functions.
3. Backfill canonical item/rollup rows in bounded batches.
4. Deploy Task 682 access-aware read RPC.
5. Deploy renderer service integration only after RPC and RLS evidence pass.

Hosted migration application is not claimed by this document. Task 688 records the real project/ref, migration output, and RLS evidence without secrets.

