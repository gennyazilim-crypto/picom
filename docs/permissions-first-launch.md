# First Launch Permission Explanations

## Principle

Picom's first-launch setup is explanatory only. It must not request microphone,
notification, camera, screen-capture, file-system, or operating-system access.
Permission prompts belong to the feature action that needs them.

## Permission timing

- Notifications: after an appropriate in-app suggestion or from Notification
  Settings, never automatically at startup.
- Microphone: only after the user joins voice and chooses microphone use.
- Screen sharing: only after the user starts sharing and selects a source.
- Files/images: only after the user opens an attachment or upload action.

The user may choose `Set up later` and still complete first launch. Declining or
postponing permissions must not block login, text chat, community browsing, or
local settings.

## Platform notes

- Windows: permission controls are under Privacy & security. Screen source
  selection is action-scoped.
- macOS: Microphone and Screen & System Audio Recording are under System Settings
  > Privacy & Security; a restart may be required after changes.
- Linux: behavior varies across desktop portals, distribution, Wayland/X11, and
  package format. Final QA must cover supported environments.

## Security boundary

This guide does not open system settings, enumerate devices, invoke Electron
capture APIs, or call `getUserMedia`. Native calls stay behind approved preload
and service abstractions when the corresponding feature is used.
