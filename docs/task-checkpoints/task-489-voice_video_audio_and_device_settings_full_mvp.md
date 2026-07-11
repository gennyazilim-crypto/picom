# Task 489 - Voice Video Audio and Device Settings Full MVP

## Completed

- Preserved explicit, user-initiated microphone permission and post-permission device enumeration.
- Added temporary microphone level testing, speaker test tone, input sensitivity, and capability-gated echo/noise/gain options.
- Persisted only safe device identifiers and preferences; no capture media is recorded or stored.
- Applied selected input/output and capture options to active LiveKit voice rooms.
- Applied selected output to Radio/Podcast playback with a system-default fallback and exposed the existing playback volume default.
- Added safe permission-denied, no-device, removed-device, unsupported-output, camera policy, and screen-share guidance states.

## Validation

- `npm run voice:settings:smoke`
- `npm run voice:devices:test`
- `npm run voice:recovery:test`
- `npm run audio:player:smoke`
- `npm run livekit:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

## Manual platform validation

Real microphone labels, output routing, OS permission recovery, LiveKit switching, and screen-share permission prompts require Windows/Linux/macOS hardware runs. They remain manual platform checks; this checkpoint does not fabricate them.
