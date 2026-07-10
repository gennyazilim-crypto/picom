# Task 379 Checkpoint: Permission Explanation Setup Polish

## Result

Polished first-launch permission explanations and added an inline desktop guide
without requesting any native or media permission.

## Implemented

- Clarified notification, microphone, and screen-share request timing.
- Added Windows, macOS, and Linux guidance.
- Added `Set up later`, `View permission guide`, and existing Continue paths.
- Kept the guide within the desktop setup panel with light/dark tokens.
- Extended smoke coverage for platform and no-startup-prompt copy.

## Safety

No Electron, media, capture, device-enumeration, or permission API is called by
the setup component. Permission QA on each native platform remains required.
