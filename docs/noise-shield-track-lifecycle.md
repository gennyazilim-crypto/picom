# Noise Shield microphone track lifecycle

## Ownership contract

`microphoneTrackLifecycleService` is the single renderer-side owner of Picom's local voice-chat microphone lifecycle. `voiceService` remains the only LiveKit room integration and routes every microphone enable, mute, device replacement, reconnect, room cleanup, and application shutdown through the lifecycle manager.

The manager guarantees:

- one serialized microphone operation at a time;
- one tracked local microphone and at most one attached processor;
- processor detach before capture constraints or devices are replaced;
- old media capture stop when a track is replaced or the room is released;
- generation-safe cleanup that does not release a newer room's track;
- one `beforeunload` listener, with synchronous capture stop and best-effort async processor disposal;
- bounded, privacy-safe diagnostics with redacted track/device identifiers.

LiveKit remains responsible for publication/unpublication through `setMicrophoneEnabled` and `switchActiveDevice`. The manager coordinates those calls rather than creating a second publication stack.

## Event behavior

| Event | Behavior |
| --- | --- |
| First enable | Build Standard capture constraints, enable through LiveKit, adopt and verify the microphone track. |
| Mute/unmute | Serialize the operation. Mute may retain the LiveKit track; processing is detached while capture is disabled. |
| Processing mode switch | Stop the old processing/capture generation, recreate safely, and reapply the requested supported mode. |
| Device switch/removal | Detach processing, switch LiveKit input, fall back to an available/default input, then reapply processing once. |
| Permission denied | Disable the microphone without another automatic native prompt and retain a user-readable device-service notice. |
| Permission restored | Refresh devices through the existing permission observer and reapply the desired microphone state. |
| Reconnect | Serialize restoration and prevent duplicate track/processor attachment. |
| Leave/navigation | Dispose processing, stop capture, remove LiveKit listeners, then disconnect the room. |
| Unexpected disconnect | Perform generation-checked best-effort cleanup before local track disposal. |
| Application shutdown | Stop the active microphone synchronously and dispose the processor best-effort. |
| Safe-mode startup | Remain idle; no media permission or capture starts without an explicit join/unmute action. |

## Device and permission recovery

`voiceDeviceService` is authoritative for permission observation and device enumeration. It debounces `devicechange`, normalizes a missing selection to an available/default device, publishes one preference revision, and supplies the user-readable notice. `voiceService` consumes that revision once and the lifecycle manager records only a redacted device key and safe event code. There is no automatic permission-prompt loop.

## Source isolation

The lifecycle manager accepts only `microphone`. It rejects screen-share, Radio, Podcast, media-playback, and music sources. Audio-player and screen-share code paths do not import or call Noise Shield processing.

## Diagnostics and privacy

Allowed diagnostics are event code, timestamp, generation, processing ownership state, permission state, and hashed/redacted track/device keys. The bounded buffer contains at most 64 events.

Never record raw audio, device labels, full hardware IDs, room/session objects, access tokens, or provider credentials.

## Test contract

Run `node scripts/noise-shield-track-lifecycle-smoke.mjs`. It deterministically covers initial and duplicate attach, duplicate processor prevention, replacement, removed-device fallback, permission recovery, serialized reconnect/device operations, generation-safe cleanup, shutdown listener deduplication, bounded diagnostics, and non-microphone isolation.
