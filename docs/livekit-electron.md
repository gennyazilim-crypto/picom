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

## Platform notes

- Windows: microphone access depends on Windows privacy settings.
- Linux: microphone and screen sharing may depend on PulseAudio/PipeWire, Wayland/X11, and portal setup.
- macOS: microphone and screen recording require System Settings permissions.
