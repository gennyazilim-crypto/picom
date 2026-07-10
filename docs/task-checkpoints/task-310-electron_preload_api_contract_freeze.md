# Task 310 - Electron preload API contract freeze

## Result

- Froze `window.picomDesktop` as contract version 1 and documented every exposed API/channel.
- Added exact contract testing for runtime/types, exposed names, IPC allowlist, no raw native object properties, and whitelist-only invoke behavior.
- All 16 main-process IPC handlers now reject untrusted renderer senders before native work.
- Existing payload validators remain required for window, notification, tray, startup, file, clipboard, external URL, deep-link, and screen-capture paths.
- No shell command, unrestricted filesystem, arbitrary protocol, Node module, or raw Electron API was added.

## Validation

- `npm run electron:preload-contract:test`
- `npm run renderer:native:smoke`
- `npm run electron:security:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual check

Use the approved packaged-development checklist in `docs/electron-preload-api.md`. Invalid IPC payload testing must use synthetic values only and must confirm no native side effect.
