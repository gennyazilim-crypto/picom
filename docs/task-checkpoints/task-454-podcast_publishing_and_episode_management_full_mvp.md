# Task 454 checkpoint: Podcast publishing and episode management Full MVP

## Outcome

Completed the desktop Podcast publishing workspace without changing listener behavior or exposing private media. The implementation provides draft creation, metadata editing, validated private cover/audio upload and replacement, signed preview, publish, unpublish, archive, and guarded delete through the audio service layer.

## Delivered

- Added mock/Supabase data-source operations for the full episode lifecycle.
- Added a dedicated publishing service for file validation, duration inspection, private upload, signed preview, replacement cleanup, staged progress, cancellation cleanup, and deletion cleanup.
- Added a desktop Publisher workspace with metadata, media controls, native audio preview, progress, cancel/retry, confirmation, and explicit errors.
- Separated Publisher publication rights from Editor metadata rights.
- Kept unpublished work private and published listener surfaces unchanged.
- Added a publishing contract smoke test and workflow documentation.

## Security and access notes

- React components do not call Supabase directly.
- Supabase RLS and private Storage policies from Task 453 remain authoritative.
- Published episodes cannot be deleted directly.
- Managed private media is cleaned before an eligible episode is deleted.
- Supabase CLI is not installed on this workstation, so live pgTAP/RLS execution remains blocked. Structural schema and RLS contract checks passed; no hosted result is claimed.
- Supabase Storage progress is stage-based because the current SDK path does not expose transferred-byte progress or request abort. A canceled post-upload operation removes the newly created object.

## Validation

- `npm run podcast:publishing:smoke` - PASS
- `npm run podcast:data-model:smoke` - PASS
- `npm run audio:podcast:smoke` - PASS
- `npm run audio:service:smoke` - PASS
- `npm run typecheck` - PASS
- `npm run mock:smoke` - PASS
- `npm run supabase:smoke` - PASS (structural; Supabase CLI unavailable warning)
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS

Performance evidence:

- Initial JS: 1503.2 KiB (hard cap 1650.0 KiB)
- Initial CSS: 225.4 KiB (hard cap 240.0 KiB)
- Largest JS chunk: 1275.7 KiB
- Largest CSS chunk: 225.4 KiB
- Total assets: 2934.5 KiB (hard cap 3500.0 KiB)
- Generated assets: 36

## Manual verification

The deterministic contract and production build were verified locally. Interactive Supabase upload/publish and live RLS behavior require the configured staging project and remain part of hosted validation; they were not represented as completed by this local checkpoint.

## Files

- `src/services/audio/audioDataSource.ts`
- `src/services/audio/podcastPublishingService.ts`
- `src/components/audio/PodcastPublisherPanel.tsx`
- `src/components/audio/PodcastCommunityShell.tsx`
- `src/components/audio/PodcastCommunityShell.css`
- `src/App.tsx`
- `scripts/podcast-publishing-workflow-smoke.mjs`
- `docs/podcast-publishing-workflow.md`
- `package.json`
- `docs/task-checkpoints/task-454-podcast_publishing_and_episode_management_full_mvp.md`
