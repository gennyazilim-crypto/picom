# Picom LiveKit Production Setup

This runbook prepares production voice/screen-share configuration. It does not create or mutate a LiveKit/Supabase project without explicit credentials and release approval.

## Provider decision gate

### LiveKit Cloud

Recommended default for the first production MVP because it reduces TURN, regional routing, scaling, upgrade, and media-server operations. Before approval, compare region/data-residency options, pricing/egress, observability, support, account access controls, and incident/export capabilities.

### Self-hosted LiveKit

Choose only with an assigned realtime operations owner and verified capacity for TLS, load balancing, Redis where required, TURN/STUN, UDP/firewall rules, autoscaling, upgrades, monitoring, abuse controls, backups of configuration, and regional failover. A single unmonitored host is not production-ready.

Record the selected option, region(s), owner, cost limit, data handling, rollback path, and test evidence in the private operations register. Do not mix staging and production LiveKit projects.

## Environment boundaries

Renderer-safe public values:

- `VITE_LIVEKIT_ENABLED=true`
- `VITE_LIVEKIT_URL=wss://...` only when needed for display/fallback checks

Supabase Edge Function/server-only secrets:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

The API key/secret must never enter Vite, Electron preload DTOs, local settings, diagnostics, logs, screenshots, or release artifacts. Set them through Supabase Function secret storage or the approved production secret manager.

## Token contract

- Issuer: `LIVEKIT_API_KEY`.
- Signature: HMAC SHA-256 with `LIVEKIT_API_SECRET` inside the Edge Function only.
- TTL: 3600 seconds (one hour).
- Identity: authenticated Supabase `auth.user.id`.
- Display name: bounded user metadata/email fallback, never used as authorization identity.
- Room: `community:{communityId}:voice:{channelId}`.
- Grants: room join, publish, subscribe, and data publish for the one derived room.
- Caller cannot choose an arbitrary room; supplied room name must match the derived name.

Screen sharing uses the same scoped `canPublish` grant and a LiveKit screen-share track. The desktop source selection remains explicit through Electron preload IPC. If future audience/listen-only roles are added, the token grant must be reduced server-side rather than hidden only in UI.

## Authorization flow

1. Renderer invokes the protected `livekit-token` Supabase Edge Function with the current Supabase session.
2. Function validates JWT and reads the requested channel using the user-scoped Supabase client.
3. Channel must match community, be type `voice`, and be visible to that user through RLS.
4. Function derives room/identity and returns the short-lived token, expiry, and public LiveKit URL.
5. Renderer connects and never persists the token.

Any unauthorized token issuance is a release blocker.

## Production secret setup

After independently confirming the production Supabase and LiveKit targets:

```powershell
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase secrets set LIVEKIT_URL=...
supabase secrets set LIVEKIT_API_KEY=...
supabase secrets set LIVEKIT_API_SECRET=...
supabase functions deploy livekit-token
```

Do not pass values directly in shared terminals, CI logs, or documentation. Use masked/protected variables and verify Function secret names without printing values.

## Network and provider configuration

- Use production `wss://` TLS endpoint.
- Confirm supported media regions and permitted traffic geography.
- Confirm UDP/TCP/TURN fallback from representative Windows/Linux/macOS networks.
- Configure participant/room/rate limits and abuse response.
- Set provider alerts for connection failure, packet loss, egress, room spikes, and quota limits.
- Establish secret rotation and service-disable procedure.

## Desktop permissions

### Windows

- Verify Windows Privacy microphone access for desktop apps.
- Verify screen/window sources appear through Electron `desktopCapturer`.
- Test denial, enablement, device removal, and app restart recovery.

### Linux

- Test supported distributions under X11 and Wayland where applicable.
- Verify PulseAudio/PipeWire input and xdg-desktop-portal/PipeWire screen capture.
- Record desktop environment/session because source availability differs.
- Missing portal/device must produce a safe error without crashing voice state.

### macOS

- Package must declare microphone and screen-recording usage descriptions.
- Test System Settings > Privacy & Security denial/grant/restart behavior.
- Verify the permission is associated with the final signed bundle identity, not only development Electron.

No source thumbnails, screen frames, audio samples, device IDs, IP addresses, tokens, or secrets may be written to logs/diagnostics.

## Deployment verification

1. Missing/invalid JWT returns 401 with a redacted typed error.
2. Authenticated user without voice-channel access returns 403.
3. Text channel request is rejected.
4. Arbitrary/mismatched room name is rejected.
5. Authorized voice channel returns a token with correct identity/room/expiry.
6. Decoded test token grants only the expected room operations and contains no secret.
7. Token expires and cannot be reused outside its room.
8. Function/provider logs contain no bearer token or secret.

## Rollback and disablement

- Keep the prior known-good Function bundle/version reference.
- On functional outage, show voice unavailable while core chat remains usable.
- On token/authorization leak, disable voice entry points, revoke/rotate LiveKit credentials, redeploy, and audit provider rooms/logs.
- Resume rollout only after JWT, authorization, two-user voice, and screen-share smoke pass.
