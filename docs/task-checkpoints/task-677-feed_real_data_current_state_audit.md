# Task 677 Checkpoint: Feed Real-Data Current-State Audit

Status: Complete  
Date: 2026-07-12  
Baseline: `1c8d2b2`

## Scope completed

- Audited the current mock and Supabase Feed paths.
- Audited legacy mention, unified-feed, cache, realtime, read/save, and renderer integration.
- Audited existing message, attachment, reaction, reply, save, friendship, radio, podcast, and mention schema inputs.
- Compared the production RPC with the approved Score V1 contract.
- Identified privacy, performance, pagination, and production-mock-bootstrap risks.
- Mapped every confirmed gap to Tasks 678-688.

## Key findings

- Supabase Feed services do not intentionally fall back to mock data, but App bootstrap still starts from mock mention state.
- The unified production Feed is currently mention-only and therefore cannot nominate ordinary popular content.
- Existing ranking is follow-based and does not implement Score V1.
- Accepted friendships exist, but the Feed still uses `user_follows`.
- Existing RLS/source visibility helpers are suitable foundations and must be preserved.
- Unique message-view evidence and event-driven source-neutral rollups are missing.

## Files created

- `docs/feed-real-data-current-state-audit.md`
- `docs/feed-algorithm-gap-map.md`
- `docs/task-checkpoints/task-677-feed_real_data_current_state_audit.md`

## Product changes

None. Task 677 was documentation-only and did not change renderer, service, schema, RLS, or runtime behavior.

## Release state

The real-data Feed Algorithm V1 remains **BLOCKED** pending Tasks 678-688 and hosted evidence.
