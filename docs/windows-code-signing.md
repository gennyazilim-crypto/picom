# Picom Windows Code Signing Plan

## Current state

Committed packaging config contains only commented placeholders. No certificate file, private key, password, or token is stored in the repository. Local beta builds can be unsigned. The current `0.1.1-beta.1` local installer reports `NotSigned`.

## Stable release decision

Before public stable distribution, select an organization-validated Windows code-signing certificate and a secure signing method supported by the release CI/build host. Hardware-backed/cloud signing is preferred over exporting a reusable private key file.

Certificate/vendor procurement, legal organization validation, cost, renewal, timestamp provider, access owner, and incident rotation must be approved outside this repository.

## Secret handling

- Store certificate/private key and password/PIN only in an approved signing service or protected CI secret store.
- Restrict signing to protected release branches/tags and named maintainers.
- Never expose signing material through `VITE_`, Electron renderer, docs, logs, diagnostics, issues, or artifacts other than the resulting signature.
- Do not commit `.pfx`, `.p12`, `.cer` with private key, key containers, or passwords.
- Mask signing command output and avoid dumping environment variables.
- Rotate/revoke immediately on suspected compromise or maintainer/access change.

## electron-builder integration options

Use one reviewed option in release CI only:

1. Managed/cloud/hardware signing command integrated through the approved Electron build hook.
2. Protected certificate reference such as electron-builder-supported `CSC_LINK` plus `CSC_KEY_PASSWORD` injected by CI.
3. The existing commented `certificateFile`/`certificatePassword` config populated only through protected environment/temporary workspace if approved.

Do not activate a signing path until a CI dry run proves the secret never enters source, cache, debug logs, or uploaded build context.

## Timestamping

- Use an approved RFC 3161/Authenticode timestamp service so signatures remain valid after certificate expiry.
- Treat timestamp failure as a signed stable artifact failure, not a warning to ignore.
- Record timestamp result with release evidence.

## Verification

On the final installer and unpacked executable:

```powershell
Get-AuthenticodeSignature .\release\Picom-<version>-Windows-x64.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
Get-AuthenticodeSignature .\release\win-unpacked\Picom.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

Expected stable result:

- `Status = Valid`.
- Signer subject/publisher matches the approved Picom legal publisher.
- Certificate chain is trusted on a clean supported Windows host.
- Timestamp certificate/result is present and valid.
- Installer UI shows the expected verified publisher.

Calculate SHA-256 after signing and compare the distributed file byte-for-byte.

## Signed release smoke

1. Build/sign in protected CI or an approved clean release host.
2. Verify signature and timestamp before uploading.
3. Install on clean supported Windows accounts with normal security settings.
4. Verify publisher display, install, first launch, upgrade, uninstall, protocol callback, custom titlebar, and core MVP flows.
5. Scan the artifact and inspect logs/build output for secrets.
6. Archive signature evidence, checksum, provenance, and rollback artifact in the approved release store.

## Failure and emergency response

- Invalid/missing signature on a stable artifact: stop distribution and rebuild/sign; do not patch the published checksum in place.
- Compromised certificate/private key: pause releases, revoke certificate, notify release/security owners, rotate CI access, audit signed artifacts, obtain replacement, and publish an incident/hotfix plan.
- Timestamp outage: pause signed stable finalization or use only an approved alternate timestamp provider.
- Wrong publisher/version/artifact: reject candidate and rebuild from the approved commit.

## Stable gate

Stable public release is blocked until the selected signing method, secret access, valid signature/timestamp, clean-host smoke, checksum/provenance, and rollback process are all evidenced. Private beta can remain unsigned only with explicit tester warning and checksum verification.
