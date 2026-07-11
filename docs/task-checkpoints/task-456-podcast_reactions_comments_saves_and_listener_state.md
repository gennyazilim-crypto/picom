# Task 456 checkpoint: Podcast reactions, comments, saves, and listener state

## Outcome

Completed persistent Podcast social interactions without creating a separate social network. Save state, reactions, own-comment lifecycle, listener state, previews, counts, moderation, blocking, and practical Realtime refresh now use the canonical audio service and RLS boundaries.

## Delivered

- Replaced local-only Podcast save toggles with `podcastService` writes.
- Added idempotent reaction add and own-reaction removal.
- Added comment create, own edit, own soft delete, edited state, preview, and count updates.
- Added mark-listened and mark-unplayed controls backed by per-user progress.
- Added current-user ownership mapping for Supabase comments/reactions instead of the mock identity.
- Added Podcast Realtime subscription and debounced canonical catalog refresh.
- Kept Community, Mention Feed, and Profile selected episodes derived from current source data.
- Applied community blocked-word, mention, link, and slow-mode moderation to comments.
- Added published/visible/unblocked/member interaction RLS and separate private save/progress RLS.
- Added blocked-author filtering for visible Podcast reactions/comments.
- Added Realtime publication and replica identity configuration for Podcast interaction tables.

## Permission model

- Save/progress: authenticated, published, visible, and unblocked.
- Reaction/comment creation and comment edit: all listener-state requirements plus active community membership.
- Draft/archived episodes: no new listener interactions.
- Own cleanup: reaction removal, unsave, progress clear, and comment soft delete remain possible without granting content access.
- Moderators retain the existing manager delete policy; UI author controls never imply moderator authority.
- React components do not call Supabase directly.

## Validation

- `npm run podcast:interactions:smoke` - PASS
- `npm run typecheck` - PASS
- `npm run podcast:player:smoke` - PASS
- `npm run podcast:publishing:smoke` - PASS
- `npm run podcast:data-model:smoke` - PASS
- `npm run audio:podcast:smoke` - PASS
- `npm run audio:service:smoke` - PASS
- `npm run audio:feed:smoke` - PASS
- `npm run audio:profile:smoke` - PASS
- `npm run audio:community:smoke` - PASS
- `npm run mock:smoke` - PASS
- `npm run supabase:smoke` - PASS (structural; Supabase CLI unavailable warning)
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS

Performance evidence:

- Initial JS: 1516.4 KiB (hard cap 1650.0 KiB)
- Initial CSS: 227.1 KiB (hard cap 240.0 KiB)
- Largest JS chunk: 1288.8 KiB
- Largest CSS chunk: 227.1 KiB
- Total assets: 2954.9 KiB (hard cap 3500.0 KiB)
- Generated assets: 35

## Blocked evidence

- Supabase CLI is unavailable locally, so pgTAP policy execution is BLOCKED.
- A configured hosted project and two authenticated clients are required for real cross-user block, moderation, RLS-denial, and Realtime count evidence; these are BLOCKED and not reported as passed.

## Manual test status

The production renderer/Electron bundles and deterministic interaction contracts passed. Real hosted persistence and two-client synchronization were not manually certified in this local environment.

## Files

- `src/types/audio.ts`
- `src/services/audio/audioDataSource.ts`
- `src/services/audio/podcastService.ts`
- `src/services/audio/podcastRealtimeService.ts`
- `src/hooks/useAudioCatalog.ts`
- `src/components/audio/PodcastCommunityShell.tsx`
- `src/components/audio/PodcastEpisodeDetail.tsx`
- `src/components/audio/ProfileAudioSections.tsx`
- `src/components/audio/PodcastCommunityShell.css`
- `supabase/migrations/20260711001700_podcast_interactions_listener_state.sql`
- `supabase/tests/rls/podcast_interactions_listener_state.sql`
- `scripts/podcast-interactions-smoke.mjs`
- `scripts/audio-podcast-detail-smoke.mjs`
- `docs/podcast-interactions.md`
- `package.json`
- `docs/task-checkpoints/task-456-podcast_reactions_comments_saves_and_listener_state.md`
