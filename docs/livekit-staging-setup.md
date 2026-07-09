# Picom LiveKit Staging Setup

Use a dedicated LiveKit Cloud project or isolated staging deployment. Never reuse production rooms, API credentials, recordings, or user data for beta staging.

## Security boundary

Edge/server only:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Renderer/public only when needed:

- `VITE_LIVEKIT_URL` may contain the public `wss://` endpoint.

The renderer must never generate LiveKit JWTs or receive the API secret. Tokens come only from the authenticated Supabase `livekit-token` Edge Function.

## 1. Create staging infrastructure

1. Create a LiveKit Cloud project or deploy a TLS-enabled staging server.
2. Record the public `wss://` URL, API key, and API secret in the approved secret manager.
3. Confirm staging rooms and participant telemetry are isolated from production.
4. Set short log retention and avoid recording media unless a separate consented test explicitly requires it.

## 2. Set Supabase Edge Function secrets

Link the Picom staging Supabase project, then set secrets without writing them to the shell history or repository where possible:

```powershell
supabase secrets set LIVEKIT_URL=<wss-staging-url>
supabase secrets set LIVEKIT_API_KEY=<staging-api-key>
supabase secrets set LIVEKIT_API_SECRET=<staging-api-secret>
supabase secrets list
```

Only variable names/status should be reviewed. Do not paste secret values into tickets, screenshots, diagnostics, or chat.

## 3. Deploy the token function

```powershell
supabase functions deploy livekit-token
```

The function has JWT verification enabled in `supabase/config.toml` and also resolves the authenticated Supabase user internally.

## 4. Verify token authorization

Authenticated success case:

1. Sign in to the staging desktop client.
2. Join a voice-type channel that the user can view.
3. Confirm the function returns a URL, short-lived token, derived room name, `auth.uid()` identity, participant name, intent, and expiry.

Unauthenticated denial:

```powershell
Invoke-WebRequest -Method Post `
  -Uri "https://<project-ref>.supabase.co/functions/v1/livekit-token" `
  -ContentType "application/json" `
  -Body '{"communityId":"<uuid>","channelId":"<uuid>","intent":"voice"}'
```

The response must be `401`. A signed-in user without channel visibility must receive a safe `403` and no token.

## 5. Verify room and identity strategy

- Room: `community:<communityId>:voice:<channelId>`
- Participant identity: authenticated Supabase `auth.uid()`
- Display name: bounded provider/profile metadata or request display name
- Token expiry: one hour in the current MVP
- Subscribe: enabled
- Publish: enabled for microphone audio and screen-share tracks
- Data publish: enabled for room control/presence foundations

Never accept an arbitrary room name from the renderer. The function rejects a supplied room name that does not exactly match the derived community/channel room.

## 6. Two-user voice test

Use two separate staging users in two Electron windows or two test machines:

1. Join the same permitted voice channel.
2. Confirm both participant identities appear once.
3. Speak from each client and verify the speaking indicator follows audio activity.
4. Mute client A; verify A stops publishing microphone audio.
5. Deafen client B; verify B stops hearing remote audio without changing remote publication.
6. Leave and rejoin each client; verify stale participants disappear.
7. Revoke membership/private-channel access and confirm a new token cannot be issued.

## 7. Screen-share test

1. Join voice before sharing.
2. Open the Electron desktop source picker.
3. Select a screen and start sharing.
4. Verify a remote participant sees the track and the local control shows active sharing.
5. Stop sharing from Picom and verify the remote track is removed.
6. Repeat with a window source.
7. Close or remove the shared source and verify Picom recovers without a renderer crash.
8. Confirm the source ID or thumbnail data is not written to support logs.

## Platform notes

### Windows

- Test microphone privacy permission in Windows Settings.
- Verify screen and window sources at 100%, 125%, and 150% display scale.
- Test sharing across multiple monitors and stop sharing before sleep/wake.

### Linux

- Test both X11 and Wayland where supported.
- Wayland may require PipeWire and a desktop portal for screen selection.
- Verify microphone device permissions and packaged sandbox behavior for the target distribution.

### macOS

- Provide `NSMicrophoneUsageDescription` in packaged metadata before microphone QA.
- Screen sharing requires Screen Recording permission in System Settings.
- After granting permission, macOS may require Picom to restart.
- Verify both Intel and Apple Silicon artifacts if both are distributed.

## Troubleshooting

- `VOICE_NOT_CONFIGURED`: one or more Edge Function secrets are missing.
- `401`: Supabase session is missing/expired or the Authorization header was not sent by the centralized service.
- `403`: channel RLS denied access; do not bypass it by using a service-role client in the renderer.
- Connection timeout: verify the `wss://` URL, firewall, TLS certificate, and LiveKit region.
- No microphone: inspect OS permission and selected input device, then rejoin.
- No screen sources: inspect Electron desktop capture support and OS screen-recording/portal permission.
- Duplicate participants: verify identity remains `auth.uid()` and old room connections disconnect on rejoin.

## Staging gate

Run:

```powershell
npm run livekit:smoke
npm run typecheck
npm run build
```

Then complete authenticated/unauthenticated token, two-user voice, mute/deafen, speaking, source picker, start/stop share, remote view, reconnect, and permission-denial checks manually. Do not claim staging voice ready from static smoke tests alone.
