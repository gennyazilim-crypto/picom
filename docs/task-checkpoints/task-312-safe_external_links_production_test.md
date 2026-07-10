# Task 312 - Safe external links production test

## Result

- Added executable allow/block tests for HTTP/HTTPS and javascript/file/data/vbscript/shell/cmd/powershell/ms-settings/ftp/internal/unknown protocols.
- HTTP(S) URLs containing username/password credentials now fail closed rather than silently stripping credentials.
- Overlong, relative, malformed, and protocol-relative values are blocked.
- Blocked URLs never reach the native preload opener.
- Browser fallback now returns a failure when `window.open` is denied instead of reporting false success.
- Message links continue to use `externalLinkService` and show the service's user-friendly blocked/open-failed toast.
- OAuth and status/help service paths remain centralized; raw `window.open` is confined to the reviewed browser fallback and raw `shell.openExternal` to Electron main.
- Picom/myapp routes remain delegated to `deepLinkService`.

## Validation

- `npm run external-links:production:test`
- `npm run external-links:smoke`
- `npm run electron:ipc-fuzz:test`
- `npm run renderer:native:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

In a development message, use synthetic safe HTTP(S) and blocked-protocol examples. Safe links should open through native IPC; blocked schemes should remain text or show Picom's blocked-link toast. Do not test with real credential-bearing URLs.
