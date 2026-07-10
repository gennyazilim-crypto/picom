# Native Notifications Production

## Architecture

React components use `notificationService`; they do not import Electron or call `Notification` from Electron directly. In Electron, the service invokes the narrow optional `window.picomDesktop.showNotification` bridge. Preload uses one whitelisted IPC channel, and main validates the sender URL and a bounded payload before constructing Electron `Notification`.

`contextIsolation: true` and `nodeIntegration: false` remain required. The bridge exposes no Electron object, shell, filesystem, token, session, or generic IPC method.

## Routing order

`decideNotificationRoute()` applies one centralized decision:

1. User notifications disabled: suppress desktop, inbox, and unread.
2. User mute or DND: suppress desktop; retain safe inbox/unread behavior.
3. Quiet Hours: suppress according to all/normal-message/sound-only mode; optional mention exception is explicit.
4. Mentions-only: suppress normal message desktop alerts.
5. Digest mode: group low-priority normal messages; mentions remain immediate.
6. Muted community/channel: suppress non-mentions; mentions retain priority.
7. Focused active channel near bottom: suppress because the user is reading it.
8. Focused active channel away from bottom: route in-app only.
9. Otherwise allow desktop plus inbox.

The emergency `disableNativeNotifications` kill switch overrides desktop delivery without changing authentication or deleting inbox records. Category and route context must come from trusted application state, not message text.

## Payload and privacy

Main accepts a non-empty title capped at 120 characters, optional body capped at 240 characters, and optional silent boolean. Extra renderer fields are not forwarded to Electron. Invalid payload, unsupported platform API, untrusted sender, and native failure return stable error codes without stack traces.

Do not include passwords, tokens, authorization headers, invite/webhook secrets, private file URLs, or diagnostic details. Message previews must follow the user's notification privacy setting when that setting is implemented; until then callers should prefer minimal sender/category copy for sensitive contexts.

## Permission and onboarding

Picom does not request browser notification permission at startup. Browser fallback requests only through the notification service after a user-triggered onboarding/settings flow. Electron reports bridge availability; the operating system may still suppress notifications through its own settings, Focus Assist/Do Not Disturb, application identity, or denied macOS permission.

The application must remain usable when permission is denied or notifications are unsupported. Settings show status and a user-triggered test action.

## Platform notes

- **Windows:** packaged AppUserModel identity and signed installer behavior affect attribution; Focus Assist can suppress display. Test installed, not only unpacked/dev.
- **Linux:** behavior depends on the desktop notification daemon and application metadata. Test supported target distributions; absence of a daemon is non-fatal.
- **macOS:** notification permission and signed/notarized bundle identity affect delivery. Test first request, denial, later system-settings changes, foreground/background, and focus modes.

No platform-specific API is called from renderer code.

## Production test matrix

- settings enabled/disabled and tray mute;
- DND on/off;
- quiet-hours same-day/overnight boundaries, all/normal/sound-only, mention exception;
- mention versus normal message;
- muted channel/community;
- active channel focused near bottom, focused away from bottom, background, minimized;
- digest on/off;
- kill switch active;
- invalid/oversized payload and untrusted sender;
- OS permission granted/denied/changed and unsupported API;
- Windows installed build, representative Linux desktops, signed/notarized macOS build;
- repeated tag/notification behavior and no renderer/native crash.

Run `npm run native-notifications:smoke`, `npm run notifications:routing:smoke`, `npm run renderer:native:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

## Remaining production gates

Automated smoke tests are structural and do not prove OS display. Signed installed artifacts must pass the platform matrix. Notification preview privacy controls, click/deep-link routing, and cross-platform replacement/tag semantics need explicit product/security review before richer payloads are enabled.
