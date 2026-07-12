# Task 665 - Hosted Community Member Voice and Screen Test

## Hosted test architecture

- Manual protected workflow: `Picom Hosted Member Voice Screen E2E`.
- Protected environment: `hosted-staging`.
- Fixture lifecycle: the protected Supabase Management API creates an isolated ephemeral community, Voice channel, roles, ban, profiles, and Auth identities for this run; all are deleted in the same process even when a media assertion fails.
- Hosted schema repair: forward migration `20260712166500` qualifies `community_id` references in the moderation RPC after real staging evidence exposed PostgreSQL `42702`; it does not alter ordinary member Voice/Screen grants.
- Authorization boundary: authenticated Supabase sessions call the deployed `livekit-token` Edge Function; no LiveKit provider API key or secret reaches the client or workflow output.
- Media runtime: four isolated sandboxed Electron renderer clients under Xvfb use the installed `livekit-client` SDK and Edge-issued participant tokens.
- Active actor classes: Owner, Admin, Moderator, and Member.
- Denied actor classes: Visitor, non-member, and banned member.

## Real provider evidence contract

Every active actor must join the same deterministic hosted room, publish a synthetic microphone track, publish a synthetic canvas screen track, subscribe to every other actor, receive non-zero remote RTP bytes, render every remote screen, observe speaking state, propagate mute/unmute state, reconnect, and release tracks/subscriptions on leave.

The simultaneous four-publisher matrix proves that ordinary media access is independent of Owner/Admin/Moderator status and that the active-sharer switcher has real multi-share provider input. Moderator hierarchy remains a separate RPC authorization matrix.

Synthetic media contains only generated tones, Picom test text, and changing canvas frames. The harness never records, stores, uploads, or logs microphone input or user screen content.

## Security

- Test windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- The preload exposes only validated config/command/result IPC for the ephemeral harness.
- Tokens travel to the child process over stdin and to each isolated renderer over IPC; they are never written to disk or included in evidence.
- Evidence excludes emails, passwords, access tokens, user IDs, room names, provider URLs, and private channel identifiers.
- `voiceRooms` and `screenShare` remain hidden in the V1 registry until Tasks 666-668 pass.

## Commands

- Local deterministic contract: `npm run voice:screen:hosted:contract`
- Local renderer bundle check: `npm run voice:screen:hosted:e2e -- --build-only`
- Protected hosted run: `npm run voice:screen:hosted:e2e -- --run`
- Workflow dispatch: `gh workflow run member-voice-screen-hosted.yml -R gennyazilim-crypto/picom -f staging_confirmation=STAGING_ONLY`

## Redacted evidence

- Workflow artifact: `task-665-hosted-member-voice-screen-evidence`
- Artifact file: `artifacts/evidence/task-665-hosted-member-voice-screen.json`
- Retention: 14 days

Hosted PASS must not be claimed until the protected workflow completes successfully and the redacted artifact reports `status: passed`, `containsSecrets: false`, four joined/publishing/rendering clients, three denied actor classes, reconnect success, and cleanup success.
