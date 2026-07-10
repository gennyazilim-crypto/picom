# Task 424 Checkpoint: Linux Native Packages and Screen Share

## Status

**BLOCKED**

## Local contracts passed

- Electron packaging configuration.
- Linux repository/distribution policy.
- Installer branding and first-launch structure.
- Screen-share permission recovery.
- Screen-share preview and stop controls.

## Native execution attempt

The existing `Picom Native Package Matrix` has a real `ubuntu-latest` job for AppImage and DEB generation. Manual workflow dispatch failed with HTTP 403 because the authenticated GitHub account lacks repository administration rights. A validation-only branch was then pushed, but GitHub rejected PR creation with `must be a collaborator`; the branch was immediately deleted and no workflow run was created.

## Missing evidence

- Native Linux runner/session metadata.
- AppImage build, executable bit, launch, and checksum.
- DEB build, install, desktop entry/icon, launch, remove, and reinstall.
- X11/Wayland, PipeWire, portal backend, and audio stack.
- Interactive source selection, remote view, cancel/deny/retry/stop.
- Native final checksum/signing evidence.

No Windows cross-build was treated as Linux evidence. RB-05 and RB-07 remain open.

