# Picom LiveKit Staging Smoke Test

Run this checklist against a dedicated staging LiveKit project and staging Supabase project. Static smoke scripts do not prove hosted voice or screen sharing works.

## Preconditions

- [ ] `VITE_LIVEKIT_ENABLED=true` and the renderer-safe staging `VITE_LIVEKIT_URL` are configured locally/for the beta build.
- [ ] `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are set only in Supabase Edge Function secrets.
- [ ] `livekit-token` is deployed with JWT verification enabled.
- [ ] Two staging users can view the same voice channel.
- [ ] Target OS microphone and screen-capture permissions are understood.

## Token authorization

1. Call `livekit-token` without a Supabase session and expect `401`.
2. Call it as a user who cannot view the channel and expect `403` with no token.
3. Call it as a permitted member and confirm identity equals `auth.uid()`.
4. Confirm room is `community:<communityId>:voice:<channelId>` and cannot be overridden.
5. Confirm expiry is one hour or less for the MVP.
6. Confirm grants allow join, subscribe, microphone/screen publication, and bounded data publication.

## Two-client voice

1. Launch two Picom Electron clients with separate staging accounts.
2. Join the same voice channel from both clients.
3. Confirm each participant appears once and stale participants disappear after leave.
4. Speak from each client and verify the speaking indicator.
5. Mute/unmute client A and confirm microphone publication changes.
6. Deafen/undeafen client B and confirm remote audio playback changes without muting A.
7. Leave/rejoin both clients and verify the room remains consistent.
8. Remove channel access and confirm a new token/join is denied.

## Screen share

1. Join voice before opening the source picker.
2. Open the Electron screen/window source picker.
3. Start sharing one screen and verify the remote client receives the screen track.
4. Stop sharing and verify the remote track disappears.
5. Repeat with a window source.
6. Close the shared source and verify Picom recovers without a renderer crash.
7. Confirm source IDs, thumbnails, and media are not written to logs/diagnostics.

## Platform checks

### Windows

- Test microphone privacy denial/approval.
- Test screen capture at 100%, 125%, and 150% scaling and across multiple monitors.

### Linux

- Record distro, desktop environment, X11/Wayland, PipeWire, and portal versions.
- Test microphone access and screen/window selection in the packaged target.

### macOS

- Test microphone permission denial and approval.
- Test Screen Recording permission, including the required app restart after approval.
- Verify the packaged metadata displays Picom's permission descriptions.

## Evidence

Record build version, platform, both test user IDs (not tokens), community/channel IDs, result, timestamp, and redacted diagnostics. Never attach LiveKit secrets, Supabase access tokens, source thumbnails, or private voice content.

