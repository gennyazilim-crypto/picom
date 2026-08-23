# TASK 13 — Packaged first-run E2E

## Verdict

TASK 13 VERDICT: BLOCKED

Packaged Windows execution happened on a fresh isolated profile. First-run chrome is visible behind a remote `Update required` gate (`minimumSupportedVersion=1.0.0` vs client `0.1.1-beta.*`). The gate is hosted remote-config policy, not a first-run logic defect. TASK 13 does not authorize changing hosted client-config or bumping the ship version to fake a pass.

## Isolation

`PICOM_USER_DATA_DIR` + `app.setPath("userData", override)` in `electron/main.cts`.

Profile: `docs/audit/evidence/first-launch-packaged-e2e-2026-08-16T1910Z/isolated-profile`

`%APPDATA%\Picom` was not deleted or copied.

## Why later scenarios are not PACKAGED_PASS

The version overlay is `blocking` when `source === "remote"`. Continue/locale/purpose controls were not operated without dismissing or bypassing that gate. No localStorage/devtools mutation was used to skip it.

## Automated first-run suites

All TASK 13 listed first-launch/i18n/onboarding runtime scripts exited 0.

## Test infra repaired (not product bypass)

- `electron:ipc-fuzz:test` — TypeScript 7 removed `transpileModule`; load `dist-electron/ipcPayloadValidation.cjs`
- `legal:acceptance:test` — Register/Settings now i18n-keyed
- global-navigation shell/badges — i18n aria-labels; TS 7 import graph avoided

## Required statuses

WINDOWS PACKAGED E2E: BLOCKED_ENVIRONMENT
MICROPHONE PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT
SPEAKER PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT
CAMERA PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT
SCREEN CAPTURE PACKAGED ACCEPTANCE: BLOCKED_ENVIRONMENT
WINDOWS NOTIFICATION CREATION: BLOCKED_ENVIRONMENT
WINDOWS TOAST VISIBILITY: BLOCKED_ENVIRONMENT
AUTH PACKAGED E2E: BLOCKED_TEST_IDENTITY
INSTALLER ACCEPTANCE: BLOCKED_ENVIRONMENT
