# Feed Score Versioning

## Current version

`FEED_SCORE_V1.version` is the canonical renderer/server compatibility version. It owns all base scores, engagement weights and caps, relevance additions, eligibility thresholds, freshness half-life, score precision, diversity limits, and result-group priorities.

No UI component may calculate or override a canonical Feed rank. SQL introduced in later tasks must mirror this configuration and be checked against the same deterministic fixture values.

## Compatibility rules

- Persist the score version with derived rollups or ranked evidence where a later interpretation would otherwise be ambiguous.
- Source records and engagement events remain version-neutral sources of truth.
- Derived rollups must be rebuildable from eligible source events.
- A stable Feed traversal uses one `as_of` and one score version.
- Keyset ordering must include group priority, rounded final score, creation time, and item ID. Floating-point score equality alone is never a cursor boundary.

## Future score migration

1. Add a new immutable config such as `FEED_SCORE_V2`; do not mutate V1 values in place.
2. Add SQL and TypeScript parity fixtures for the new version.
3. Backfill or lazily rebuild derived rollups with an explicit version marker.
4. Keep active cursors on the version with which they were issued.
5. Switch candidate RPC defaults only after shadow comparison, abuse review, and hosted evidence.
6. Retire an old version only after its cursors, caches, and release clients have expired.

Verification, role, paid status, and account age are intentionally absent from every score version unless a separately approved product and fairness review changes that contract.

