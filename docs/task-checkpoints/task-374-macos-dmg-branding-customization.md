# Task 374 checkpoint: macOS DMG branding customization

## Implemented

- Added original Picom DMG background artwork.
- Configured app and Applications shortcut placement.
- Added clear drag-to-Applications copy.
- Documented microphone/screen recording and signing/notarization boundaries.

## Validation

- `npm run installer:branding:smoke`
- `npm run package:verify`
- `npm run macos:notarization:production:smoke`

macOS package build remains blocked on this Windows host; no Apple secrets were used.
