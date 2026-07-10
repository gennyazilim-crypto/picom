# Task 222 checkpoint: Windows signing production

## Result

- Added a manual, protected Windows signed-candidate workflow with read-only repository permissions and no PR trigger or publishing step.
- Signing material is accepted only from protected CI secrets; no certificate, password, publisher identity, token, or production URL is committed.
- Added fail-closed Authenticode verification for valid status, approved publisher and timestamp evidence before checksums/provenance.
- Kept local NSIS packages unsigned and documented the separate MSI signing requirement if MSI is later approved.

## Remaining production evidence

No real signed installer was produced because approved certificate secrets and protected release approval are unavailable in this workspace. Public promotion remains blocked until the workflow succeeds and clean-host installer/application signature plus install/upgrade/uninstall smoke evidence is reviewed.

## Validation

- `npm run windows:signing:smoke`
- `npm run windows:signing:production:smoke`
- `npm run packaging:smoke`
- `npm run secrets:smoke`
