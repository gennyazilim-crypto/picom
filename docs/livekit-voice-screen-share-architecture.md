# LiveKit / WebRTC Voice and Screen Share Architecture Decision

Picom MVP will use LiveKit and WebRTC for real voice rooms and screen sharing when implementation reaches the voice phase.

## Decision

Use LiveKit as the managed room, participant, audio, and screen-share foundation. WebRTC should be consumed through LiveKit client APIs rather than custom peer connection code unless a future task documents a strong reason.

## Security model

LiveKit credentials are privileged secrets.

- `LIVEKIT_API_KEY` must never be bundled into the desktop renderer.
- `LIVEKIT_API_SECRET` must never be bundled into the desktop renderer.
- Access tokens must be generated server-side or through a Supabase Edge Function.
- The desktop app requests a short-lived room token for the current authenticated user and channel.
- Token generation must verify community membership, channel visibility, and voice-channel access before issuing a token.
- Tokens should be scoped to one room and user identity.

## Expected token flow

1. User clicks a voice channel in the desktop UI.
2. Renderer calls a typed voice service.
3. Voice service calls a Supabase Edge Function or server endpoint.
4. The function verifies Supabase auth and channel permissions.
5. The function generates a short-lived LiveKit token.
6. Renderer connects to LiveKit with the returned token.

## Voice room behavior

MVP voice should eventually support:

- join room
- leave room
- mute/unmute microphone
- deafen/undeafen playback
- participant list
- speaking indicator
- connection state
- screen share

Advanced voice features are not part of this architecture task.

## Screen share behavior

Screen share should use the runtime-supported desktop capture path:

- Electron renderer requests screen share through a safe service wrapper.
- Any native permission or source-selection logic stays outside ordinary React business logic where possible.
- The UI must handle permission denied and no-source-selected states gracefully.

## Platform permission notes

### Windows

- Microphone access can be controlled by Windows privacy settings.
- Screen capture generally works through Electron/Chromium desktop capture APIs.
- The app should show a clear error if the OS blocks microphone capture.

### Linux

- Microphone access depends on PulseAudio/PipeWire/session configuration.
- Screen sharing may depend on Wayland vs X11 and portal support.
- The app should document if a distro/session requires xdg-desktop-portal support.

### macOS

- Microphone permission requires OS-level consent.
- Screen recording permission requires OS-level consent.
- The app must handle first-run permission denial cleanly and guide users to System Settings.

## Environment variables

Renderer-safe:

- `VITE_LIVEKIT_URL` only if a public room server URL is needed by the client.

Server-only / Edge Function:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

## Testing expectations for future implementation

For each supported platform, test:

- join/leave room
- microphone permission denied
- mute/deafen state
- screen share start/stop
- screen share permission denied
- network interruption and reconnect
- token expiry and refresh path

## Current repository state

This task documents the voice and screen-share decision only. No LiveKit dependency, token function, or WebRTC runtime code is added here.