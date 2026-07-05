# Task 417 - Safe Mode Startup Foundation

## Status

Implemented.

## Scope

- Added `safeModeService`.
- Added `SafeModeBanner`.
- Added optional service guards for startup, realtime, typing, presence, tray, and maintenance refresh.
- Added corrupted settings safe-mode trigger placeholder.
- Added Safe Mode docs and smoke test.

## Safety Notes

- Safe Mode loads default local settings instead of custom settings.
- Reset settings preserves auth sessions.
- Clear cache preserves auth sessions and drafts.
- Export logs uses redacted logging output.
- Hook order is preserved because realtime/typing/presence hooks are still called with `enabled: false`.

## Manual Test

1. Launch the renderer with `?safeMode`.
2. Confirm the Safe Mode banner is visible.
3. Confirm community UI still renders.
4. Confirm Reset settings, Clear cache, and Export logs show toast feedback.
5. Click Restart normally and confirm the banner is removed after reload.
