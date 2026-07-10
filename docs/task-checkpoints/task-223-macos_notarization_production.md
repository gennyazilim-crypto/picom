# Task 223 checkpoint: macOS notarization production

## Result

- Added a separate production-only electron-builder override for hardened runtime, reviewed entitlements and notarization while preserving unsigned local defaults.
- Added a manual protected CI candidate workflow using ephemeral certificate/notary credentials from secrets, with guaranteed temporary key cleanup and no publishing step.
- Added fail-closed deep signature, entitlement, Gatekeeper and stapled-ticket verification before checksum/provenance generation.
- Kept microphone and screen-capture permission purpose strings and least-privilege entitlement guidance explicit.

## Remaining production evidence

No signed/notarized artifact was produced because Apple Developer credentials and a protected macOS release approval are unavailable here. Public macOS distribution remains blocked until a real candidate passes notary review, clean-host quarantine/install/permission tests and final release approval.

## Validation

- `npm run macos:notarization:production:smoke`
- `npm run packaging:smoke`
- `npm run secrets:smoke`
