# Task 678 Checkpoint: Unified Feed Source and Content Classification

Status: Complete  
Date: 2026-07-12

## Delivered

- Added one canonical Feed contract for text messages, radio sessions/comments, and podcast episodes/comments.
- Added all seven approved text-message content kinds.
- Added a pure classifier based on normalized text and validated image/video MIME metadata.
- Excluded failed, private, quarantined, pending, suspicious, and deleted attachments from classification.
- Added direct-mention recipient extraction with author exclusion and deterministic deduplication.
- Added exact source deep links for community messages, radio sessions/comments, and podcast episodes/comments.
- Added a backward-compatible `radio_chat` to `radio_comment` adapter without adding a second Feed stack.
- Added deterministic fixtures for seven content kinds and five canonical source types.

## Files

- `src/types/feed.ts`
- `src/services/feed/feedSourceClassification.ts`
- `src/data/feedSourceClassificationFixtures.ts`
- `scripts/feed-source-classification-smoke.mjs`
- `package.json`
- `docs/task-checkpoints/task-678-unified_feed_source_and_content_classification.md`

## Validation

- `npm run feed:classification:smoke`
- `npm run typecheck`

## Boundaries

- No database migration, RPC, ranking formula, renderer layout, or Supabase access policy changed.
- Existing legacy `UnifiedFeed*` exports remain available until the service migration tasks consume the canonical contract.
- Score values are intentionally deferred to Task 679.
