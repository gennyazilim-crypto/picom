# Task 681 Checkpoint: Engagement Triggers and Unique Support Aggregation

Status: Complete (structural); hosted trigger execution pending Task 688  
Date: 2026-07-12

## Delivered

- Idempotent source synchronization for community messages/radio comments, radio sessions, podcast episodes, and podcast comments.
- Text/image/video reclassification after message or attachment lifecycle changes.
- Per-item rollups for unique qualified reactors, commenters, savers, and opened viewers.
- Exact Score V1 reaction/comment/save/view caps and supporter union excluding views.
- Exclusion of self, bot/system, deletion-pending, community-banned, deleted, and moderated contributions.
- Source invalidation for delete, draft/archive/cancel, webhook, empty/failed-media, and moderation-delete paths.
- Trigger coverage for source, attachment, reaction, reply/comment, save, impression, and moderation changes.
- Operator-only bounded source and rollup reconciliation functions plus repair script.
- pgTAP contract and structural smoke.

## Validation

- `npm run feed:rollup:events:smoke`
- `npm run feed:rollup:schema:smoke`
- `npm run feed:score:v1:smoke`
- `npm run typecheck`

## Evidence state

- Static trigger, grant, cap, and repair contracts: required here.
- Disposable Supabase trigger/load execution and deterministic rebuild comparison: **BLOCKED** until Task 688 has a configured hosted/local database.
- No hosted success is inferred from structural smoke.
