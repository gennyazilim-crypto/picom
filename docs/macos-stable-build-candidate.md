# macOS Stable Build Candidate

Status date: 2026-07-10  
Candidate status: **Blocked pending macOS build/sign/notarization host**

## Configuration status

- General Electron packaging verification: Passed.
- Production notarization workflow smoke: Passed static checks.
- Configured targets: dmg x64 and zip x64.
- Release-only config enables hardened runtime, notarization, and reviewed entitlement templates.
- Microphone and screen-capture usage descriptions are present.
- Apple credentials are documented as protected CI-only values and are not committed.

## Build attempt

`electron-builder --mac zip --x64` was invoked with a unique temp output on Windows. Electron Builder correctly refused:

`Build for macOS is supported only on macOS.`

No macOS artifact was created or claimed.

## Required macOS execution

On an approved macOS x64 runner/host:

```bash
npm ci
npm run typecheck
npm run mock:smoke
npm run build
npm run package:mac:signed-candidate
```

Protected CI/operator steps must then verify:

1. Developer ID signature for the app and nested helpers.
2. Successful notarization and stapling.
3. Gatekeeper assessment on a clean machine.
4. DMG and zip launch, custom titlebar/window controls, and no unwanted native menu.
5. Login/register/session restore and core Picom flows.
6. First-run microphone denial/approval/retry.
7. First-run screen-recording denial, System Settings recovery, relaunch, sharing, and stop.
8. Reinstall and uninstall behavior.
9. SHA-256 and provenance records.

Unsigned/quarantined local artifacts must not be presented as stable downloads. RB-08 remains open.

## Task 401 closure attempt

The macOS hardened-runtime/notarization workflow contract passed on 2026-07-10. No native macOS runner or Apple credential was available, so signing, notarization, stapling, Gatekeeper, permission, and clean-machine checks did not run. See `docs/macos-signing-notarization-staple-validation.md`.

## Task 410 real execution

Native macOS signing, notarization, staple, permissions, and screen-share certification remained **BLOCKED**. No macOS artifact or Apple submission exists; see `docs/macos-notarization-screen-share-certification.md`.
