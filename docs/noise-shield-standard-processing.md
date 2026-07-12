# Noise Shield Standard Processing

## Implemented modes

- **Off** requests native noise suppression off when supported.
- **Standard** requests native WebRTC noise suppression on when supported.
- Echo cancellation and automatic gain are independent settings in both modes.
- Unsupported optional constraints are omitted, not made mandatory.
- An explicitly selected input may use its existing device constraint; fallback capture uses the system-safe path.

## Real microphone integration

The existing `voiceService` microphone helper is the only publication path. It now:

1. Builds a canonical capture plan from runtime capabilities, persisted mode, and device preferences.
2. Calls LiveKit `setMicrophoneEnabled()` with that plan.
3. Resolves the resulting local `Track.Source.Microphone` publication.
4. Reads safe `MediaStreamTrack.getSettings()` booleans when available.
5. Separates requested, supported, and verified-applied state.
6. Falls back to a basic microphone without disconnecting the room if Standard capture fails.

Plain voice rooms activate the same service as Meeting Workspace. No second room or microphone stack was added.

## Truthful status

| Result | User meaning |
| --- | --- |
| `applied` + Standard | Runtime reported `noiseSuppression: true`. |
| `fallback` + Off | Microphone is active, but suppression was false or not reported. |
| `unavailable` | Runtime does not expose native suppression; basic microphone remains available. |
| Off | Suppression is disabled or unsupported; echo/gain remain independently configured. |

The service never treats a request as proof that a constraint was applied.

## Persistence

Mode is stored locally under a Noise Shield settings key when remember-for-device is enabled. Existing `voiceDeviceService` storage remains authoritative for echo cancellation, automatic gain, and physical input/output selection.

Legacy `voice_focus` persisted values normalize to the canonical `voice-focus` identifier.

## Isolation and privacy

The processing service accepts only the local microphone capture path. It has no import or callback into screen share, Radio, Podcast, uploaded audio, studio sources, or the global audio player. It records no samples, waveform, encoded audio, token, or provider object.

## Remaining conditional work

Enhanced and Voice Focus still resolve to Standard or unavailable because the official optional processor package/provider is not installed. Task 523 adds the lazy lifecycle boundary without falsely enabling those modes.

