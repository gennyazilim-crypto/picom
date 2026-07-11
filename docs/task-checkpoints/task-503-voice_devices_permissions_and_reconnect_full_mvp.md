# Task 503 Checkpoint: Voice Devices, Permissions, and Reconnect Full MVP

## Status

Implemented locally. Native sleep/wake and real provider reconnect certification remain environment-specific manual checks.

## Completed

- Active-room input/output preference application remains service-owned.
- Device removal falls back safely and reports the recovery to the user.
- Windows, macOS, and Linux microphone permission guidance is shown in Settings and the Voice Room.
- Desktop resume refreshes devices and reconnects only retained, recoverable sessions.
- Reconnect attempts are bounded, deduplicated, and canceled on leave or room switch.
- Mute/deafen state, participant cleanup, and listener cleanup remain intact.
- Diagnostics now expose redacted categorical/count-only voice health.
- No audio recording or raw audio logging was introduced.

## Automated validation

```powershell
npm run voice:reconnect:full-mvp:smoke
npm run voice:devices:test
npm run voice:settings:smoke
npm run voice:recovery:test
npm run voice:client:smoke
npm run diagnostics:smoke
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
npm run performance:budget:ci
```

## Manual/native evidence still required

- Windows, Linux, and macOS: deny then grant microphone access and verify guidance/recovery.
- Remove the selected microphone and speaker while connected.
- Suspend/wake each packaged desktop app while two staging clients share a LiveKit room.
- Interrupt and restore the network, verify one participant per identity, preserved mute/deafen, and no duplicate audio.
- Provider-backed checks require protected staging credentials; no success is claimed without them.
