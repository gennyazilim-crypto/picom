# Task 664 - Voice and Screen UI, Settings, Diagnostics, and Help

## Scope

- Reuse one production `ConnectedVoiceCard` across Mention Feed, Profile, and Direct Messages navigation surfaces.
- Keep microphone, deafen, leave, return-to-room, screen-share, reconnect, participant-count, and Standard Noise Shield state connected to `voiceService`.
- Preserve the existing member-authorized Voice Room and Electron screen picker implementations.
- Extend safe diagnostics with release-gate, server-managed provider, token-exchange state, connection state, picker availability, local/remote share counts, attempt counters, and redacted error codes.
- Add local Help and Support guidance for joining, permissions, source selection, stopping, reconnecting, and Windows microphone troubleshooting.

## Safety boundaries

- The renderer never receives or exports the LiveKit API secret, API key, access token, room identity, or provider URL.
- Provider credentials and access-token creation remain in the protected Supabase Edge Function boundary.
- Ordinary active membership, not Owner/Admin/Moderator status, controls normal microphone and screen-share access.
- Visitors, non-members, banned members, timeouts, deleted memberships, and inaccessible private channels remain denied by the existing service and RLS contracts.
- Camera, meeting, recording, and system-audio capture are not exposed by this V1 surface.
- `voiceRooms` and `screenShare` remain release-gated until Tasks 665-668 produce hosted, packaged-Windows, security, and final release evidence.

## Validation contract

- `npm run voice:screen:ui:smoke`
- `npm run voice:mini-card:test`
- `npm run voice:settings:smoke`
- `npm run diagnostics:smoke`
- `npm run settings:diagnostics:smoke`
- `node scripts/help-support-workspace-smoke.mjs`
- `npm run voice:client:smoke`
- `npm run screen-share:publish:full-mvp:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run performance:budget:ci`

## Remaining release evidence

- Task 665: protected hosted two-client voice and screen-share validation.
- Task 666: packaged Windows microphone, speaker, picker, remote-render, stop, and cleanup certification.
- Task 667: security, abuse, reconnect, and cleanup gate.
- Task 668: only after all evidence passes, include Voice Rooms and Screen Share in the Picom V1 registry and resume final release execution.
