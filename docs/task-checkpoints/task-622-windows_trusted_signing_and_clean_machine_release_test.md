# Task 622 Checkpoint - Windows Trusted Signing and Clean Machine

## Result

**BLOCKED.** No trusted certificate, local signing tool, protected GitHub environment, signed workflow run, signed installer, post-signing hash or clean Windows target was available.

## Applied safeguards

- Added immutable full-SHA and exact `1.0.0` inputs to the protected signing workflow.
- Made source/version/channel mismatches fail before dependency install/build/signing.
- Preserved signature, publisher and timestamp verification before checksum/provenance.
- Added a deterministic guard contract.
- Updated V1 clean-machine scope to exclude hidden Voice/Screen Share.
- Documented SmartScreen and `deleteAppDataOnUninstall: false` behavior without claiming runtime proof.

## Local evidence

- Signing control smoke: PASS; no certificate loaded.
- Production signing workflow contract: PASS.
- V1 signing readiness guard: PASS and reports package-version BLOCKED.
- Checksum/provenance fixture contracts: PASS; no real artifact hash generated.
- Actual signing and clean-machine matrix: BLOCKED.

## Remaining blocker

RB-06 stays open. The prescribed commit message records Task 622 work only; it does not mean a signed candidate was produced.
