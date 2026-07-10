# Task 084 Checkpoint: Real Auto-Update Implementation Plan

## Outcome

Created a production-oriented Electron auto-update plan while leaving Picom's placeholder updater behavior disabled.

## Covered

- Proposed `electron-updater` and `electron-builder` integration boundary.
- Separate `dev`, `beta`, and `stable` channels.
- Update manifest and immutable artifact hosting requirements.
- Windows code-signing dependency.
- macOS signing, hardened runtime, notarization, and stapling dependency.
- Linux AppImage, package-manager, and sandboxed-package limitations.
- Main-process, preload, renderer, and `updateService` boundaries.
- Failure states, staged rollout, pause, and rollback strategy.
- Explicit secret-management and production enablement gates.

## Safety

- Production auto-update was not enabled.
- No updater package, endpoint, signing key, credential, or publishing token was added.
- No runtime code or UI behavior changed.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
