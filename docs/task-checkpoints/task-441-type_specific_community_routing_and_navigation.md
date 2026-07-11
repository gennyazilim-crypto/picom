# Task 441 - Type-Specific Community Routing and Navigation

## Status

Implemented centralized, per-community navigation memory for Text, Radio, and Podcast shells.

## Delivered

- `communityNavigationService` is the canonical kind-to-shell router.
- Text communities preserve the last valid text/voice channel independently per community.
- Radio communities preserve the last station section and selected session.
- Podcast communities preserve the last library section and selected episode.
- Invalid or deleted remembered IDs fall back to a valid default instead of crashing.
- Non-text communities receive a community-specific synthetic shell identity, never a stale Text channel ID.
- App diagnostics report a channel only for Text communities.
- Text-only category, channel, message, unread, typing, and message-realtime requests are skipped for Radio/Podcast.
- Deep links, ServerRail, community search, events, notifications, invites, and creation use kind-aware shell routing where no Text channel is required.
- Radio and Podcast retain lazy loading and now include fixed context side panels for station hosts/listeners and library publishers.
- Home, DM, Profile, titlebar, and window-control routes are unchanged.

## Safety behavior

- Session route memory is best-effort; storage failure never blocks navigation.
- Route memory contains only community/content IDs and section names, never secrets or message bodies.
- Draft and Listener Discussion routes are validated against current permissions/settings before restoration.
- Removed sessions/episodes are cleared rather than reopening an inaccessible detail.

## Evidence

- `npm run community:routing:smoke` executes the router logic for three kinds, two Text communities, stale IDs, section memory, and detail memory.
- Existing Text/Radio/Podcast feature smoke tests remain required regressions.
- Visual and E2E commands remain coverage contracts only until the Playwright/Electron runner is activated; no pixel or interactive pass is claimed.

## Manual test path

1. Open Text community A and select a non-default channel.
2. Open Radio, select Hosts, and open a session when available.
3. Open Podcast, select Series or an episode.
4. Switch through Home, DM, Profile, Text community B, and back to each community.
5. Confirm each community restores its own valid channel/section/detail.
6. Remove a remembered item in mock data and confirm safe fallback without an error boundary.
7. Confirm Radio/Podcast do not request text categories/messages and their side panels remain visible.

## Remaining external validation

- Interactive Electron switching and pixel screenshots are BLOCKED without an active UI automation runner.
- Supabase two-window route/access checks remain a staging validation, not a local static claim.
