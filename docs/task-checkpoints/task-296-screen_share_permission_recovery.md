# Task 296 - Screen share permission recovery

## Result

- Electron source enumeration now rejects untrusted renderer senders.
- macOS denied/restricted screen-recording permission returns a dedicated safe error.
- Empty source lists and source enumeration failures are distinguished.
- Browser/non-Electron runtimes fail safely when desktop capture is unavailable.
- The picker shows platform-specific macOS, Windows, or Linux guidance and an in-place retry action.
- Capture permission is still never requested during startup; sources load only after explicit user action.

## Validation

- `npm run screen-share:recovery:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual checks

1. On macOS, deny Screen Recording and confirm the picker points to System Settings > Privacy & Security > Screen Recording.
2. Enable permission, restart Picom if macOS requires it, and select Try again.
3. On Windows, confirm protected/no-source failures show guidance and retry without crashing.
4. On Linux/Wayland, deny the desktop portal request and confirm portal guidance appears.
5. Run the renderer without the Electron bridge and confirm a safe unsupported state.
