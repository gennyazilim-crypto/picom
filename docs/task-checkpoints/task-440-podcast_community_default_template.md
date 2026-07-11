# Task 440 - Podcast Community Default Template

## Status

Implemented a dedicated Full MVP Podcast shell and atomic publishing-library bootstrap for mock and Supabase modes.

## Delivered

- Podcast creation uses the stable wizard request UUID and `create_podcast_community_with_defaults`.
- Bootstrap creates Owner, Podcast Publisher, Podcast Editor, and Member roles with separate capabilities.
- The creator receives Owner membership and retries restore invariants without duplication.
- `podcast_community_settings` preserves About content and keeps Listener Discussion disabled by default.
- `podcast_series` and optional episode `series_id` provide the publishing hierarchy.
- No fake episode, series, category, or text channel is seeded.
- `podcastCommunity` opens `PodcastCommunityShell` directly after ServerRail without CommunitySidebar.
- Episodes, Series, permitted-only Drafts, Hosts, and About are the primary navigation.
- Listener Discussion appears only after a protected channel is explicitly linked.
- Existing private podcast storage and explicit-play episode detail remain the media boundary.

## Security and rollback

- Ownership comes from `auth.uid()`, never a renderer-supplied user ID.
- Internal bootstrap is not executable by client roles.
- Publisher and Editor capabilities are distinct; Editors can update metadata and moderate comments without gaining publish/delete ownership.
- RLS protects settings, series, drafts, comments, and episode metadata.
- A child setup error rolls back the community, roles, membership, and library settings in the same transaction.

## Evidence

- `npm run community:podcast-template:smoke` validates route, shell identity, service separation, role capabilities, schema/RLS, and rollback contracts.
- `supabase/tests/rls/podcast_community_default_template.sql` provides real isolated pgTAP coverage.
- pgTAP execution is BLOCKED when Supabase CLI/local database is unavailable; static checks are not reported as hosted evidence.
- Visual/E2E contract commands describe coverage only and do not claim an Electron UI run.

## Manual test path

1. Create a Podcast community from the typed wizard.
2. Confirm ServerRail opens the dedicated Podcast shell directly.
3. Confirm CommunitySidebar, text categories, and Radio navigation are absent.
4. Navigate Episodes, Series, Drafts, Hosts, and About.
5. Confirm Drafts is visible only with publishing/editor access.
6. Confirm the episode and series empty states contain no fake publication.
7. Confirm Listener Discussion is hidden by default.
8. Retry the same UUID against isolated staging and confirm one library exists.

## Remaining external validation

- Apply migrations to isolated Supabase staging and run the pgTAP file.
- Exercise owner/publisher/editor/visitor access in two Electron windows before release certification.
