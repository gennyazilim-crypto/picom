# LiveKit QA Gate

`npm run livekit:smoke` verifies the Picom voice and screen-share foundation without connecting to a real LiveKit room.

## Command

```powershell
npm run livekit:smoke
```

`npm run qa:smoke` includes this check.

## What it checks

- `livekit-client` dependency is present.
- Renderer voice service exposes join/leave/mute/deafen/screen-share paths.
- Renderer token service calls the Supabase `livekit-token` Edge Function.
- LiveKit token request/response types exist.
- Edge Function requires Supabase auth.
- Edge Function reads LiveKit secrets only on the server side.
- Electron screen-share source selection stays behind preload/service boundaries.

## What it does not do

- It does not require LiveKit credentials.
- It does not connect to a room.
- It does not publish audio or screen tracks.
- It does not validate operating-system screen-recording permissions.

## Manual QA

- Configure safe development LiveKit/Supabase values.
- Start Electron dev mode.
- Join a voice channel.
- Toggle mute/deafen.
- Start and stop screen share.
- Confirm no LiveKit API secret appears in renderer diagnostics or logs.
