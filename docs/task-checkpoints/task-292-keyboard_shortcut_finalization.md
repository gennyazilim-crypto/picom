# Task 292 - Keyboard shortcut finalization

## Status

Implemented for focused Windows, Linux and macOS desktop renderer sessions.

## Delivered

- Existing command palette, settings, visible-channel navigation, lock and Escape controls retained.
- Configurable microphone mute and deafen shortcuts execute only while voice is connected.
- Duplicate binding and expanded OS/Chromium-reserved shortcut rejection remain centralized.
- Settings buttons announce current bindings and provide conflict/error status plus reset-to-defaults.
- Documentation distinguishes app-focused shortcuts from unsupported system-wide global hotkeys.

## Safety boundary

Shortcuts do not run from text inputs/editable controls, do not join voice automatically, and do not intercept voice keys while disconnected. Native OS-reserved shortcuts are intentionally unavailable.
