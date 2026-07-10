# Installer and First-Launch QA Checklist

Status date: 2026-07-10  
Current result: **Ready with platform-branding gaps**

## Automated/local checks

- Picom package/product identity: Passed.
- Core Windows/macOS/Linux icon paths: Present.
- Installer source asset folders: Present.
- FirstLaunchSetup fresh-state guard and completion persistence: Passed structural smoke.
- Theme selection wiring: Passed.
- Permission/voice/screen-share steps contain no capture or native permission call: Passed.
- Existing mock startup and production build: Passed.
- Electron package configuration verification: Passed.

## Manual first-launch matrix

1. Clear/reset `firstLaunchSetupCompleted` in development.
2. Launch and confirm setup appears before login/register.
3. Select Light and Dark and confirm immediate visual change.
4. Move through Welcome, Permissions, Voice/Sharing, and Complete.
5. Confirm no notification, microphone, or screen picker prompt appears.
6. Complete setup and confirm login/register renders.
7. Restart and confirm setup does not reappear.
8. Sign in with incomplete account onboarding and confirm account onboarding follows setup.
9. Verify Mention Feed, Community Chat, ProfileView, window controls, and hidden native menu.

## Current gaps

- Final Windows NSIS header/sidebar artwork and copy: Task 373.
- Final macOS DMG background/layout: Task 374.
- Linux desktop metadata/comment/categories finalization: Task 375.
- Dev-only reset and corruption QA: Task 376.
- Final artwork approval: Task 377.
- Installer legal review: Task 378 and stable legal gate.
- Native package install/launch/uninstall evidence remains platform-blocked.
