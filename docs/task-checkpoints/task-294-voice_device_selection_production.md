# Task 294 - Voice device selection production

## Result

- Added a browser/Electron-safe media device service for audio inputs and outputs.
- Device enumeration does not request microphone permission during app startup.
- Microphone permission is requested only from the explicit settings action.
- Selected input/output IDs are persisted locally without credentials or media content.
- Device removal/change refreshes the available list and falls back safely.
- Permission denied, unsupported runtime, and empty device states are visible in Settings.
- Existing LiveKit room state is left untouched; a changed device is used on a later voice join unless the current runtime can route it safely.

## Validation

- `npm run voice:devices:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Open Settings > Voice & Video.
2. Confirm no permission prompt appears until the permission button is clicked.
3. Allow microphone access and verify input/output lists populate.
4. Select devices, close/reopen settings, and verify selection persists.
5. Deny permission and verify a safe explanation appears without crashing.
