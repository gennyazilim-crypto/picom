# Installer Code Signing and Notarization Review

## Review status

Picom has protected configuration/documentation paths for Windows signing,
macOS signing/notarization, and future Linux repository signing. Local builds
remain unsigned by design. No credential is stored in this repository.

| Platform | Prepared control | Evidence still required | Public release |
| --- | --- | --- | --- |
| Windows | NSIS package, production signing workflow contract, post-sign checks | Trusted code-signing certificate, protected CI signing, Windows signature/SmartScreen evidence | No-Go |
| macOS | Hardened release override, entitlements templates, notarization/staple workflow | Developer ID identity, protected Apple credentials, native signature/Gatekeeper/notary/staple evidence | No-Go |
| Linux | AppImage/DEB metadata, repository distribution and signing design | Native packages, package/repository signature and install evidence for chosen distribution channel | No-Go for signed repository claim |

## Windows requirements

- Keep certificate material and passwords only in a protected release signer or
  CI secret store.
- Sign the final `.exe`, verify publisher identity/timestamp, then run install
  smoke tests on supported Windows versions.
- Generate SHA256 and provenance after signing.
- Follow `docs/release/windows-code-signing-final.md` and
  `docs/windows-code-signing.md`.

## macOS requirements

- Use protected release configuration; local `hardenedRuntime: false` is not a
  production signing claim.
- Review microphone and screen-recording entitlements/usage descriptions.
- Sign with Developer ID, notarize, staple, verify Gatekeeper, and test the DMG
  on a clean supported macOS host.
- Generate SHA256 and provenance after stapling.
- Follow `docs/release/macos-signing-notarization-final.md` and
  `docs/macos-notarization.md`.

## Linux requirements

- AppImage/DEB files may be produced for testing, but repository trust requires
  an approved signing key lifecycle and protected CI.
- Do not claim RPM support; it is not an enabled target.
- Verify desktop entry, dependencies, package ownership, upgrade/removal, and
  signatures on target distributions.
- Follow `docs/linux-repository-distribution.md`.

## Secret handling

Never commit certificate files, passwords, private keys, Apple IDs, app-specific
passwords, notary API keys, repository signing keys, or updater keys. Logs and
provenance must contain no credentials. Emergency rotation follows
`docs/secrets-management.md`.

## Release order

1. Build candidate in protected CI.
2. Sign/notarize final platform bytes.
3. Verify signatures and install behavior on the native platform.
4. Generate SHA256 and provenance.
5. Run staging/RC/Go-No-Go checks.
6. Publish only after required owners approve evidence.

Checksums do not replace publisher authentication; unsigned local package
success does not satisfy production signing requirements.

## Task 401 evidence update

The production notarization workflow smoke passed without credentials. No Developer ID signature, Apple submission, staple, Gatekeeper assessment, or native permission matrix occurred; the macOS release gate remains blocked.

## Task 410 real execution

No native macOS signing/notarization command ran. The release-only configuration remains prepared, but Apple trust and permission evidence are absent.
