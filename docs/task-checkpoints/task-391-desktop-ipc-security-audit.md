# Task 391: Desktop IPC Security Audit

## Scope

Audited the current Electron native bridge and documented the IPC security posture for the Picom desktop MVP.

## Changed files

- `docs/desktop-ipc-security-audit.md`
- `scripts/desktop-ipc-security-audit-smoke-test.mjs`
- `docs/task-checkpoints/task-391-desktop-ipc-security-audit.md`
- `package.json`

## Implementation notes

- No runtime UI behavior changed.
- Confirmed `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true` are present.
- Confirmed preload exposes a frozen `picomDesktop` bridge rather than raw Electron objects.
- Documented IPC channel risk levels and remaining risks for screen capture, clipboard, file dialogs, external links, and deep links.
- Added a smoke test for IPC security invariants.

## Verification commands

```bash
npm run desktop:ipc:security:smoke
npm run electron:security:smoke
npm run typecheck
npm run build
```

## Manual test notes

- Start Electron dev mode and verify custom window controls still work.
- Open a normal external `https://` link through the app and confirm it opens safely.
- Try unsafe protocols only in development diagnostics if needed; they should be blocked by service logic.

## Remaining risks

- Production CSP is handled by a separate security task.
- Screen capture and clipboard remain medium-risk native capabilities and must stay user-initiated.
- Future IPC channels must be added through the central whitelist.
