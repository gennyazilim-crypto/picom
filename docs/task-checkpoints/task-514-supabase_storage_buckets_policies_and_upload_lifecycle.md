# Task 514 - Supabase Storage Buckets, Policies, and Upload Lifecycle

## Status

Implemented locally. Hosted policy and destructive cleanup validation are BLOCKED pending an authorized Supabase staging environment.

## Completed

- Classified all Full MVP Storage buckets as deliberate public identity assets or private content.
- Reasserted MIME, size, and public/private bucket configuration idempotently.
- Removed broad public-bucket listing policies and tightened profile/community branding object paths.
- Preserved RLS/signed access for Text, DM, Radio, and Podcast media.
- Added a service-role-only, read-only orphan inventory spanning all Full MVP buckets.
- Replaced placeholder maintenance output with deterministic Storage lifecycle checks.
- Added explicit, confirmed operator cleanup with dry-run default and aggregate-only logging.
- Fixed the Text upload cancellation race and added explicit pending-object deletion.
- Added progress/cancel support to community branding and Radio cover uploads.
- Added structural, pgTAP, private-access, and cross-feature lifecycle contracts.

## Safety

- Renderer code never receives a service-role key.
- Cleanup cannot apply without `--apply` and `PICOM_CONFIRM_STORAGE_DELETE=DELETE_ORPHANS`.
- Private files remain path-backed and signed only after source authorization.
- Public identity buckets must not contain confidential content.

## Validation evidence

- `node scripts/supabase-storage-lifecycle-smoke.mjs`: PASS
- `npm run storage:check`: PASS; reports the six Full MVP bucket contracts
- `npm run uploads:cleanup:smoke`: PASS
- `npm run uploads:cleanup:dry-run`: BLOCKED safely because server-only hosted credentials are unavailable; deleted 0 objects
- `npm run storage:private-access:review:test`: PASS
- `npm run upload:ux:test`: PASS
- `npm run profile:edit-storage:smoke`: PASS
- `npm run supabase:migrations:check`: PASS
- `npm run supabase:rls:smoke`: PASS structurally; real pgTAP BLOCKED because Supabase CLI is unavailable
- `npm run supabase:api-regression`: PASS
- `npm run supabase:qa`: PASS with the explicit CLI warning
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: FAIL in the shared dirty worktree (`initialJs` 1755.1 KiB, `initialCss` 240.8 KiB); no budget, UI, or unrelated import was changed to hide it

## Manual results

All destructive behavior remained disabled. The maintenance command proved that missing credentials result in `BLOCKED` with zero deletion. Hosted cross-user object reads, signed URL expiry, and an applied orphan sweep remain BLOCKED until an authorized Supabase staging project, service-role operator environment, and CLI are available.
