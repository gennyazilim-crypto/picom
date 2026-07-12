# Self-Hosted Active-Member Voice Client

Status: **CLIENT_READY / HOSTED_STAGING_EVIDENCE_BLOCKED**

Picom Voice Rooms remain visible and active in V1. Missing infrastructure produces an explicit unavailable/error state; it does not remove Voice navigation or redirect users away from rooms.

## Authorization boundary

- Every authenticated, accepted, active community member can see and join a Voice channel.
- Owner, Admin, Moderator, Member, and roleless active Member need no special role grant to join, subscribe, publish microphone audio, or request Screen Share permission.
- Visitor, pending/non-member, removed, banned, suspended/timed-out, deleted, unauthenticated, and cross-community callers are denied.
- Moderator mute/remove/end-room controls remain separate role/hierarchy permissions.
- Frontend active-member checks are UX only; the Supabase authorization RPC and token Function are authoritative.

## Existing client path

The existing production stack is reused:

1. `App` confirms active membership and sends canonical community/channel context to `voiceService.join`.
2. `voiceService` prevents duplicate joins, disposes an old Room when switching, and asks `liveKitService` for authorization.
3. `liveKitService` invokes the authenticated Supabase `livekit-token` Function. It has no provider key, direct server API, renderer URL fallback, or silent mock fallback.
4. The Function response supplies the short-lived token and self-hosted WSS URL.
5. `voiceService` creates one LiveKit `Room`, subscribes to participant/track/speaking/quality/reconnect/disconnect events, applies selected input/output devices and Standard Noise Shield, and publishes microphone only when authorized and unmuted.
6. Leave/window-close cleanup stops tracks, removes listeners, disconnects the Room, and clears session state.

## User-visible states

- no microphone/permission denied: remain connected muted where possible and show permission guidance;
- expired/missing session: ask the user to sign in again;
- inactive membership/access revoked: explain active membership requirement;
- rate limited: ask the user to wait before retrying;
- self-hosted server unavailable: show temporary provider outage and retry path;
- room ended: show ended-room guidance and allow another channel;
- token response invalid/failure: show safe token error without payload details;
- reconnect: preserve room context and use bounded reconnect behavior;
- duplicate click/join: return the current in-flight snapshot rather than creating another Room.

## Devices and privacy

Settings-selected microphone/speaker preferences are applied through `voiceDeviceService`. Standard Noise Shield uses the existing processor/fallback path. No raw audio, token, device ID, IP address, provider URL, or secret is written to diagnostics. Microphone capture starts only after explicit join/unmute behavior.

## Evidence

- Source client contract covers active-member gating, one token path, one Room, events, errors, devices, Noise Shield, cleanup, and moderator separation.
- Task 659 runs two sandboxed Electron clients against a real local self-hosted LiveKit Server and proves bidirectional synthetic microphone RTP, speaking state, mute/unmute, reconnect, and cleanup.
- Task 664 hosted token/authorization/media orchestration is prepared but blocked until real self-hosted staging exists.

Public release remains blocked until Tasks 671-674 add LAN/internet/TURN/native-package/security evidence. That release blocker does not hide or disable the V1 feature.
