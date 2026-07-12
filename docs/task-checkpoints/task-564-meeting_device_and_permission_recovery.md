# Task 564 - Meeting Device and Permission Recovery

## Status

Implemented. Native hardware evidence remains blocked.

## Delivered

- Added microphone/camera permission observers without automatic permission prompts.
- Debounced device/default changes and propagated a device revision to LiveKit.
- Added one-shot system-default fallback for unavailable/busy microphones and existing camera fallback behavior.
- Added single-flight meeting recovery for permission/device/sleep-wake events.
- Preserved mute, camera, and Noise Shield preferences while reflecting actual forced-off state.
- Added meeting TopBar recovery notices and Windows/Linux/macOS guidance.
- Reused existing LiveKit tracks and replacement APIs; no parallel capture stack was added.

## Validation

- PASS: `node scripts/meeting-device-permission-recovery-smoke.mjs`
- PASS: `node scripts/voice-device-selection-smoke.mjs`
- PASS: `node scripts/voice-devices-reconnect-full-mvp-smoke.mjs`
- PASS: `npm run typecheck`
- PASS: `npm run mock:smoke`
- PASS: `npm run build`
- PASS: `npm run performance:budget:ci` (`initialJs 1185.7 KiB`, below the `1200 KiB` target)
- PASS: `npm run qa:smoke`

## Blocked evidence

- Windows/Linux/macOS hot-plug, busy device, permission revoke/grant, suspend/wake, and screen-recording tests: **BLOCKED**, requires native hardware sessions.
- Hosted LiveKit track-replacement evidence: **BLOCKED**, provider environment unavailable.
