# LiveKit in Electron

Task 214 documents the renderer-side LiveKit token fetch path for Picom.

## Token rule

The Electron renderer must never generate LiveKit tokens. Tokens are fetched from:

```text
supabase/functions/livekit-token/index.ts
```

Renderer service boundary:

```text
src/services/livekit/livekitTypes.ts
src/services/livekit/livekitService.ts
src/services/voiceService.ts
```

## Flow

1. `VoiceRoomView` asks `voiceService` to join a voice channel.
2. `voiceService` asks `liveKitService.fetchToken()`.
3. `liveKitService` invokes the Supabase `livekit-token` Edge Function with the user's Supabase session.
4. The Edge Function validates auth, RLS channel access, voice channel type, and room naming.
5. The renderer receives a short-lived token and connects with `livekit-client`.

## Security notes

- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` stay in Supabase function secret storage.
- Tokens are runtime values only and should not be stored in local settings, diagnostics, logs, or screenshots.
- Room names use `picom:{communityId}:{channelId}` and must not include private user data.
- Screen capture must use a future Electron preload/main bridge. React components must not call `desktopCapturer` directly.

## Failure handling

The LiveKit service separates:

- missing Supabase configuration
- Edge Function token failure
- incomplete token response
- room connection failure
- microphone permission failure

The UI should show user-friendly messages and keep developer details redacted.

Renderer voice errors use safe states:

- `permission_denied` for microphone permission/device failures
- `token_error` for Edge Function token failures
- `error` for room connection failures, unavailable room operations, and unexpected voice runtime failures

Network failures while invoking the token Edge Function are caught and converted into a safe token failure message. Raw stack traces, tokens, and provider details are not shown in the voice room UI.

## Join behavior

Joining a voice room performs two steps:

1. Connect to the LiveKit room with the short-lived Edge Function token.
2. Try to enable the local microphone.

If the room connection succeeds but microphone permission is denied or no input device is available, Picom keeps the user in the room as muted and shows a clear warning. This avoids dropping the room connection just because audio capture is unavailable.

## Leave behavior

Leaving a room must release local capture resources before disconnecting:

- Stop local published tracks.
- Disconnect from the LiveKit room.
- Clear participants, muted/deafened state, room name, and user-facing errors.
- Future screen-share tracks should use the same cleanup path.

## Microphone mute behavior

- Muting disables the local microphone track through LiveKit.
- Unmuting enables the local microphone track and may trigger OS/browser permission checks.
- If unmute fails, Picom keeps the user muted and shows a permission/device warning.
- Successful mute/unmute clears stale microphone errors.

## Deafen behavior

- Deafen controls remote audio output only.
- Current remote audio publications are unsubscribed while deafened.
- Newly connected participants are also kept unsubscribed if the user is already deafened.
- Undeafen resubscribes remote audio publications.
- Deafen does not expose tokens, device IDs, or audio metadata.

## Speaking indicator behavior

- Speaking state is derived from LiveKit `ActiveSpeakersChanged` room events.
- Picom stores only participant identities in renderer memory for the current room.
- The UI highlights connected users while they are actively speaking.
- Speaking state is cleared on participant disconnect, room disconnect, leave, and reconnect cleanup paths.
- No audio samples, device identifiers, tokens, or secrets are logged or persisted.

## Participant list behavior

- The participant list is read from the active LiveKit room in renderer memory.
- The list includes the local user first, then remote connected participants.
- Track mute/unmute, publish/unpublish, name changes, active speaker changes, and participant join/leave events refresh the list.
- Rows show compact states for local user, connected users, muted microphones, and speaking users.
- The list does not expose device IDs, tokens, IP addresses, or raw LiveKit secrets.

## Audio device selection placeholder

- The MVP UI shows system default input/output placeholders without enumerating devices on startup.
- Device enumeration should only happen after an explicit user action because it may trigger OS/browser permission prompts.
- Future input switching should use LiveKit local track APIs rather than storing raw device identifiers in settings or logs.
- Future output switching should use supported safe browser/Electron audio output APIs where available, with a graceful fallback when unsupported.
- macOS may require microphone permission before input devices are visible; Windows and Linux can also hide devices depending on privacy and audio server settings.

## Screen capture source picker

- Screen/window sources are collected only in the Electron main process through `desktopCapturer`.
- The renderer uses the preload bridge and receives sanitized source DTOs only.
- IPC is restricted to the whitelisted `picom:screen-capture-get-sources` channel.
- Source loading happens after an explicit user click and is not triggered during app startup.
- macOS users may need Screen Recording permission before window/screen thumbnails are available.

## Start screen share behavior

- The renderer starts sharing only after the user has joined a LiveKit room and selected a source from the Electron bridge.
- Picom uses the selected Electron `sourceId` with `navigator.mediaDevices.getUserMedia()` and publishes the returned video track as `Track.Source.ScreenShare`.
- The renderer never imports or calls Electron `desktopCapturer` directly.
- Screen sharing failures are converted into safe user-facing voice errors.
- Leaving the room stops local published tracks and clears the `screenSharing` state.

## Stop screen share behavior

- Stopping screen share unpublishes the screen track from LiveKit and stops the local media track.
- If the user stops sharing through the operating system/browser capture UI, Picom also runs the same cleanup path.
- If LiveKit unpublish fails, Picom still stops the local media track and clears the UI sharing state.
- Leaving the voice room also stops any active local screen-share track.

## Platform notes

- Windows: microphone access depends on Windows privacy settings.
- Linux: microphone and screen sharing may depend on PulseAudio/PipeWire, Wayland/X11, and portal setup.
- macOS: microphone and screen recording require System Settings permissions.
