# Task 426 Checkpoint: Trusted Windows Signing and Clean Machine

## Status

**BLOCKED**

## Passed controls

- Windows signature verification smoke without loading a certificate.
- Protected workflow and CI-only signing input contract.
- Fail-closed publisher, timestamp, and signature verification order.
- Post-signing checksum/provenance order.
- Packaging, installer branding, and release-channel contracts.
- Typecheck and production build.

## Execution blocker

No trusted code-signing certificate, password, or managed-signing credential is present. Dispatching the protected Windows signing workflow returned HTTP 403 because the authenticated GitHub account lacks repository administration rights. No clean Windows VM/device was assigned.

## Missing evidence

- Trusted signed installer bytes.
- Verified publisher subject and timestamp.
- SHA-256 generated after signing.
- Clean-machine install, first launch, core flows, restart, uninstall, and reinstall.
- Signed-build voice and screen-share matrix.
- SmartScreen/trust behavior.

The unsigned Task 423 beta candidate is excluded from final stable inventory. RB-06 remains open.

