# Picom V1 Voice and Screen Share Scope Lock

Status date: 2026-07-12  
Current classification: **HIDDEN_FROM_V1 / BLOCKED FOR INCLUSION**

> Policy amendment (2026-07-12): Tasks 657-668 supersede the role-restricted
> ordinary-media requirements in Tasks 645-654. Every authenticated active
> community member is eligible to join, speak, subscribe, and share. Role and
> hierarchy checks remain only for moderation. See
> `docs/v1-community-member-media-policy.md` and
> `docs/v1-voice-screen-amendment.md`. This amendment does not enable the
> production feature gate.

## Purpose

This document defines the only acceptable path for adding Voice Rooms and Screen Share to the Windows-first Picom V1 release. It does not enable either capability.

## Atomic inclusion rule

Voice Rooms and Screen Share are one evidence bundle for Tasks 642-656:

- Both remain hidden while any critical evidence item is missing.
- Voice-only or Screen-Share-only partial advertising is not allowed in this task sequence.
- UI visibility cannot precede hosted and packaged-Windows evidence.
- Local mocks, structural smoke tests, screenshots of source code, dev Electron behavior and unsigned package startup are not production evidence.
- A missing provider, secret custodian, hosted account, real media client, native device, signed candidate or operator approval is `BLOCKED`, never an implicit pass.

## Included capability boundary after approval

If and only if Task 654 records a complete PASS matrix, V1 may include:

### Voice Rooms

- Join and leave an authorized community voice channel.
- Bidirectional microphone audio.
- Mute/unmute and deafen/undeafen.
- Participant list and speaking indicator.
- Approved device selection and recovery.
- Bounded reconnect/token refresh/session cleanup.
- Active-member join/speak enforcement with role-aware moderation only.
- Redacted diagnostics and clear unavailable/error states.
- Connected Voice controls in the Feed companion rail.

### Screen Share

- Explicit user-initiated source picker.
- Cancel, full-screen selection and application-window selection.
- Publish one user-selected screen track.
- Render a remote participant's shared track.
- Stop, restart and OS-ended-track handling.
- Leave/disconnect cleanup.
- Permission denial and recovery guidance.
- No storage, analytics capture, thumbnail persistence or content logging.

## Explicitly not added by this scope

- Camera/video rooms.
- Meeting workspace, stage, webinar or recording.
- Captions, transcription, AI summaries or media analytics.
- Background capture or automatic screen selection.
- Screen/audio recording or cloud egress.
- Mobile UI or mobile clients.
- Linux/macOS stable release claims.
- Radio/podcast production inclusion.
- Enhanced Noise Shield unless independently certified.
- Public room discovery.
- Bots, webhooks, plugins, enterprise, E2EE or billing.

## Production architecture lock

1. Electron renderer requests a user action through a narrow preload API.
2. Native source enumeration remains in the Electron main process.
3. Renderer receives bounded source descriptors, never raw Electron objects.
4. Supabase Auth supplies the caller identity.
5. A protected Edge Function validates the caller and server-side community/channel permission.
6. LiveKit credentials remain server-side.
7. The Edge Function returns only a short-lived, room-scoped participant token and public connection URL.
8. `livekit-client` manages room/audio/screen tracks in the renderer service layer.
9. React components never call provider or Supabase tables directly.
10. Diagnostics redact tokens, credentials, device identifiers, sensitive room metadata and captured content.

## Canonical environment boundaries

Renderer-safe names:

- `VITE_LIVEKIT_ENABLED`
- `VITE_LIVEKIT_URL` (public `wss://` endpoint only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Edge/server-only names:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- protected Supabase deployment/administrative credentials where explicitly required

Provider API key/secret values must never be stored in Vite variables, renderer code, preload DTOs, local settings, diagnostics, screenshots, support bundles, docs, package metadata or release artifacts.

## Required evidence to unlock Task 654

### Provider and custody

- Approved LiveKit hosting model.
- Dedicated staging and production projects.
- Region/data-residency decision.
- Plan/capacity/quota and TURN/network validation.
- Named least-privilege owners for provider, Supabase deployment and secret rotation.
- Protected secret presence verified without disclosure.
- Monitoring, incident, disable and rotation procedures.

### Hosted token and authorization

- Deployed immutable Edge Function revision.
- Deployed migration revision.
- Valid user token issuance.
- Invalid/missing JWT denial.
- Visitor, non-member, private-channel, banned, timed-out and disabled-community denial.
- Member/moderator/admin/owner grant matrix.
- Room/capability claim inspection without exposing token values.
- Expiry and refresh behavior.
- No credential/token leakage in logs.

### Real Voice

- Two independent authenticated clients.
- Bidirectional audio.
- Mute and deafen behavior.
- Speaking and participant state.
- Device selection/removal recovery.
- Network interruption/reconnect.
- Leave/window-close/crash cleanup.
- Moderator behavior where in scope.
- No ghost participant beyond the approved timeout.

### Packaged Windows Screen Share

- Exact immutable Windows candidate identity.
- Explicit source-picker click.
- Cancel.
- Full-screen source.
- Application-window source.
- Second-client remote render.
- Stop and restart.
- OS-ended source.
- Leave/disconnect cleanup.
- Permission denial and recovery.
- No captured content in logs, diagnostics, artifacts or storage.

### Product and security

- All hidden gates enumerated in Task 642 are updated atomically.
- Settings, help, onboarding, release copy and privacy/legal statements match real behavior.
- Kill switch and degraded-state behavior are verified.
- Security/privacy/abuse final gate passes.
- Existing V1 Chat, Feed, Profile, Friends/DM, Settings, Help and diagnostics remain stable.

## Status transition policy

| From | To | Authority |
| --- | --- | --- |
| `HIDDEN_FROM_V1` | Evidence work in progress | Tasks 643-653; no user-visible enablement |
| Evidence work | `BLOCKED` | Any missing critical provider/hosted/native/security evidence |
| Evidence work | Eligible for reclassification | Every critical Task 643-653 gate is PASS |
| Eligible | `IN_V1` | Task 654 updates registry, docs, gates and regression contracts atomically |
| `IN_V1` | Immutable RC | Task 655 only after all other V1 release blockers close |
| Immutable RC | Public release | Task 656 authorized Go decision only |

## Fail-closed behavior before Task 654

- `src/config/v1ReleaseScope.ts` remains the authority.
- Voice channels remain filtered.
- Voice/Screen settings and Feed controls remain hidden.
- Deep links cannot bypass the registry.
- Release manifests do not deploy or advertise the capability.
- Remote config cannot override the local V1 release scope.
- Dormant source, migrations and data may remain for certification work.
- No data is deleted solely because the surface is hidden.

## Decision

The scope is locked. Task 642 does not include Voice Rooms or Screen Share in V1; it defines the evidence contract required before inclusion can be considered.
