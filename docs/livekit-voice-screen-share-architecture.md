# LiveKit / WebRTC voice and screen share architecture

Task 207 documents the LiveKit architecture for Picom's Windows, Linux, and macOS desktop MVP.

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

Current function boundary:

```text
supabase/functions/livekit-token/index.ts
```

Room naming should stay deterministic:

```text
picom:{communityId}:{channelId}
```

Detailed room naming rules are documented in `docs/livekit-room-naming.md`.

The token response should be treated as sensitive runtime data. It should not be persisted to local settings, diagnostics exports, crash reports, logs, or screenshots.

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

## Renderer service boundary

React components should not call LiveKit APIs directly once implementation begins. Use a service/hook layer so the UI remains testable and Electron-safe:

- `voiceService`: joins/leaves rooms, owns token request flow, and exposes room state.
- `screenShareService`: asks Electron for desktop capture sources and starts/stops screen tracks.
- `VoiceRoomView`: renders participant state, mute/deafen controls, and screen-share state.
- `livekit-token` Edge Function: remains the only place where LiveKit API credentials are used.

The renderer may receive `VITE_LIVEKIT_URL` only if the public LiveKit URL is needed for connection UX. It must never receive `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET`.

## Screen share behavior

Screen share should use the runtime-supported desktop capture path:

- Electron renderer requests screen share through a safe service wrapper.
- Any native permission or source-selection logic stays outside ordinary React business logic where possible.
- The UI must handle permission denied and no-source-selected states gracefully.
- Electron `desktopCapturer` access should go through preload/IPC with a minimal, validated API.
- Screen-share tracks should be stopped when the user leaves the room, closes the window, or toggles sharing off.

## Connection and failure states

The MVP voice layer should represent at least these states:

- `idle`
- `requesting_token`
- `connecting`
- `connected`
- `reconnecting`
- `permission_denied`
- `token_error`
- `disconnected`

User-facing errors should be clear and non-technical. Developer diagnostics may include redacted error codes but not tokens or secrets.

## Platform permission notes

### Windows

- Microphone access can be controlled by Windows privacy settings.
- Screen capture generally works through Electron/Chromium desktop capture APIs.
- The app should show a clear error if the OS blocks microphone capture.
- QA should test the app with default audio input/output devices and after device changes.

### Linux

- Microphone access depends on PulseAudio/PipeWire/session configuration.
- Screen sharing may depend on Wayland vs X11 and portal support.
- The app should document if a distro/session requires xdg-desktop-portal support.
- QA should cover at least one X11 and one Wayland/PipeWire environment before stable release.

### macOS

- Microphone permission requires OS-level consent.
- Screen recording permission requires OS-level consent.
- The app must handle first-run permission denial cleanly and guide users to System Settings.
- QA should verify behavior before and after granting Screen Recording permission.

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
- two desktop clients in the same voice room
- screen-share stop when leaving a room

## Current repository state

The Supabase `livekit-token` Edge Function boundary exists. Renderer-side LiveKit room connection, participant audio, and Electron screen-source picker are prepared for later implementation tasks and should not expose server-only credentials.
