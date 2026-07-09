# Task 34 Checkpoint: Windows Signing and Installer Finalization

## Scope

- Added the Windows release build and installer lifecycle runbook.
- Added the Windows signing, timestamp, verification, secret handling, and emergency response plan.
- Extended the existing Windows smoke checklist with install/upgrade/uninstall/reinstall gates.
- Preserved the working NSIS/electron-builder configuration unchanged.

## Verified configuration

- Picom / `com.picom.desktop` / NSIS x64 / `assets/brand/app-icon.ico`.
- Window default `1440x900`, minimum `1100x700`.
- Custom frameless titlebar and disabled native menu.
- Context isolation, renderer sandbox, and disabled Node integration.
- Current local `0.1.1-beta.1` installer exists and reports Authenticode `NotSigned`.

## Validation

- `npm run packaging:smoke` - passed.
- `npm run electron:security:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## Remaining release work

- Private beta can remain unsigned with checksum/warning.
- Stable public distribution requires approved certificate/signing service, valid timestamp, clean-host lifecycle smoke, checksum/provenance, and rollback evidence.
- No certificate or signing password was added.
