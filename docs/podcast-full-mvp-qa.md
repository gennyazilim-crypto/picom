# Podcast Full MVP QA

## Scope

The Podcast Full MVP gate verifies the complete desktop acceptance path:

- Podcast community creation and default role template;
- draft, metadata, private media/upload contract, publish, unpublish, archive, and delete;
- player transport, seek, speed, queue, resume, and completion state;
- save, reaction add/remove, comments, listener state, and Realtime contracts;
- Mention Feed cards, Profile audio sections, Search, exact deep links, and notification routing;
- Publisher/Editor hierarchy, reports, comment/episode moderation, copyright notices, and append-only audit;
- public/private visibility, private Storage, RLS, blocked-user, deleted-content, and visitor boundaries;
- separate Radio/Text community regression gates.

## Local command

```powershell
npm run podcast:full-mvp:qa
```

The command executes the existing feature contracts rather than replacing them. It also fails on acceptance-path placeholder/console-only behavior, direct Supabase calls from Podcast UI, external mock audio URLs, or bundled audio files without provenance review.

## Safe fixtures

No third-party or downloaded Podcast audio is bundled. Mock episodes use original Picom metadata, generated CSS/data artwork, and simulated/local playback behavior. Any future binary fixture requires documented provenance, license review, and inclusion in the third-party inventory before it can enter this gate.

## Visual and E2E evidence

The blocking visual contract now declares separate light/dark Radio Community, Podcast Community, and Podcast episode-detail surfaces. The E2E contract declares a Podcast Full MVP flow with current entry files and deterministic preflight commands.

These are coverage contracts, not screenshot or UI-runner evidence. Pixel baselines and Electron UI automation remain planned and must not be described as passing until implemented.

## Supabase and hosted evidence

Local structural tests validate migration presence, RLS policy/function contracts, Storage path restrictions, private drafts, listener state, role hierarchy, target-aware reports, moderation RPCs, and audit triggers.

The following require the protected environment:

- migration application and pgTAP execution;
- Owner/Admin/Publisher/Editor/Moderator/member/visitor cross-account RLS;
- private Storage upload/read/delete and signed URL expiry;
- two-client Realtime insert/update/delete/reaction/comment synchronization;
- Windows/Linux/macOS packaged player and file-picker behavior.

If Supabase CLI, hosted credentials, or native runners are unavailable, those items remain BLOCKED rather than passed.

## Manual desktop matrix

At 1440x900 and the supported minimum desktop size, verify light/dark Podcast library, draft workspace, upload progress/cancel/retry, publish confirmation, player controls, exact Share link, Feed/Profile/Search routing, report modal, moderation queue, role visibility, and no horizontal overflow. Repeat public/private and visitor/member role cases with two authenticated staging users before release.
