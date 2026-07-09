# Picom Stable Release Distribution

## Current status

**Distribution is prepared but not authorized.** The latest decision in `docs/stable-go-no-go.md` is No-Go. No stable artifact, public download, release tag, or update feed exists.

This runbook applies only after a future dated Go/Go-with-known-non-blockers decision identifies exact immutable signed/notarized artifacts.

## Release artifact set

Use one stable semantic version consistently:

| Platform | Expected artifact |
| --- | --- |
| Windows x64 | `Picom-<version>-Windows-x64.exe` |
| Linux x64 AppImage | `Picom-<version>-Linux-x86_64.AppImage` |
| Linux x64 deb | generated Picom `<version>` x64 `.deb` filename recorded exactly |
| macOS x64 dmg | `Picom-<version>-macOS-x64.dmg` |
| macOS x64 zip | `Picom-<version>-macOS-x64.zip` |

Do not claim rpm, Linux arm64, macOS arm64/universal, mobile, or web distribution unless separately implemented and tested.

## Artifact finalization

For each artifact record:

- Product/version/release channel and source commit.
- Platform/architecture/format, bytes, and exact filename.
- SHA-256 generated after final signing/notarization/stapling.
- Signature publisher/certificate/timestamp or explicit approved unsigned-beta status.
- Build date/runner/tool versions and provenance metadata.
- Clean-host install/upgrade/uninstall/reinstall smoke result.
- Known issues and rollback artifact/hash.

Never replace an artifact in place while retaining its filename/hash/release record.

## Distribution gate

1. Close all `docs/stable-go-no-go.md` blockers.
2. Produce a new immutable stable RC and pass `docs/stable-rc-smoke-test.md`.
3. Obtain product, engineering, security/privacy, operations/release, legal, and support sign-offs.
4. Verify checksums/provenance/signatures/notarization.
5. Upload only to the approved controlled release location.
6. Test each uploaded artifact by downloading it as a user would and comparing hash/signature.
7. Publish final user-readable notes, known issues, install/uninstall/rollback, support, and status information together.
8. Start the safe rollout ring and 72-hour watch.

## Signing status policy

- Windows stable public artifact: valid approved Authenticode publisher and timestamp required.
- macOS stable public artifact: Developer ID signature, hardened runtime, notarization, staple, and Gatekeeper acceptance required.
- Linux direct artifacts: checksum/provenance required; package/repository signing remains a separate approved decision.
- Unsigned artifacts may be used only in explicitly private beta channels, never mislabeled stable.

## Checksums and provenance

After finalization:

```powershell
npm run generate-checksums -- --input release
npm run generate-provenance
```

Verify scripts/output against the exact release directory and review before upload. Do not include signing secrets, CI tokens, local usernames, private paths, or environment dumps in provenance.

## Release channel and auto-update

Production auto-update is not approved in Full MVP. Stable distribution uses manual download/install instructions. Do not create or point an update feed at these artifacts. A future updater requires signed metadata, rollout rings, rollback, compatibility, and update-failure recovery approval.

## Support and communication

Release page/notes must provide:

- Approved support/feedback channel.
- Public status page only when configured.
- Version/platform/hash collection guidance.
- Redacted diagnostics instructions.
- Known issues/workarounds.
- Security/privacy reporting route.
- Rollback/manual reinstall instructions.

Never link private provider dashboards or expose project refs/secrets.

## Rollback/manual reinstall

Retain previous approved artifacts and hashes. On a known bad release, pause distribution, remove the bad artifact from normal surfaces without destroying evidence, confirm backend compatibility, communicate affected version/platform, and direct users through platform-specific uninstall/manual reinstall. Do not require local-data deletion unless necessary and clearly explained.

## Publication record template

```text
Version:
Decision/sign-off record:
Source commit:
Backend migration/function versions:
Artifact inventory and hashes:
Signing/notary results:
Uploaded locations:
Download verification:
Known issues:
Previous rollback artifacts:
Support/status links:
Rollout start/ring:
72-hour watch owner:
```
