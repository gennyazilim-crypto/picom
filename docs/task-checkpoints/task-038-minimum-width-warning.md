# Task 038 checkpoint - Minimum desktop width warning

## Completed

- Upgraded the existing narrow-window warning into a desktop-native warning card.
- Kept the 1100px minimum width rule.
- Preserved the main 4-column shell for supported desktop widths.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually resize the Electron window below and above 1100px.