# Linux repository and channel distribution

## Decision and current status

Picom Linux repository publishing is **not enabled**. AppImage x64 and deb x64 remain the only configured Linux artifacts. rpm, apt/yum repository upload, package signing and automatic repository updates stay blocked until native build/install evidence, supported distro ownership, approved package host and protected signing keys exist.

No private key, passphrase, repository credential, real package host, signing token or public install command is committed.

## Artifact strategy

| Artifact | Intended channel | Update behavior | Current status |
| --- | --- | --- | --- |
| AppImage x64 | internal/beta direct download | manual replacement with checksum/provenance | configured, native smoke required |
| deb x64 | Debian/Ubuntu beta, future apt | local install now; apt upgrade only after signed repo approval | configured, native smoke required |
| rpm x64 | future Fedora/RHEL-family beta | dnf upgrade only after target/support approval | not configured |
| arm64 | future | format-specific | not configured |

Adding rpm is a dedicated packaging task. It must define supported distributions, dependencies, desktop integration, SELinux behavior, install/upgrade/uninstall tests and package/repository signature verification before `electron-builder.yml` changes.

## Channels and repository layout

Use separate immutable channels and never replace bytes under an existing version/path:

```text
<approved-package-host>/linux/beta/apt/
<approved-package-host>/linux/stable/apt/
<approved-package-host>/linux/beta/rpm/
<approved-package-host>/linux/stable/rpm/
<approved-package-host>/linux/direct/<version>/
```

Internal, beta and stable promotion copies already signed/verified artifacts and regenerates signed repository metadata. Dev builds never consume beta/stable repositories. Stable promotion requires beta evidence and go/no-go approval.

## Desktop and AppStream metadata contract

Before repository publication, inspect generated packages and add reviewed source metadata containing:

- application ID `com.picom.desktop`, name Picom and executable Picom;
- `Type=Application`, `Categories=Network;Chat;` and one desktop entry;
- Picom icon at required sizes without copied/Discord assets;
- `%u`/protocol behavior only after `picom://` package registration is tested;
- generic name, concise summary/description, website/help/privacy links only after approved URLs exist;
- AppStream component ID, launchable desktop ID, screenshots owned by Picom, release/version entries and content rating;
- final project/metadata license values only after the project license is chosen;
- no mobile claims, secrets, private hosts, telemetry identifiers or updater credentials.

Generated desktop/AppStream paths vary by package format. Validate with `dpkg-deb --contents`, `rpm -qlp`, `desktop-file-validate`, `appstreamcli validate`, and a real desktop menu; do not infer success from YAML alone.

## Signing and key custody

Use a dedicated Linux package/repository signing hierarchy in protected release infrastructure:

- offline/restricted root key where operationally feasible;
- short-lived online repository-signing subkey with least privilege;
- protected manual environment approval, no fork/PR access and audited signing by artifact digest;
- public key/fingerprint distributed over an approved HTTPS channel and documented independently;
- apt `InRelease`/`Release.gpg` plus repository metadata verification;
- rpm package signatures and signed `repomd.xml` metadata according to the approved toolchain;
- final package/checksum/provenance generated in the correct immutable order;
- expiry monitoring, scheduled rotation, overlap window, revocation and compromise runbook.

Never use deprecated global apt key installation. Future instructions use a scoped keyring and `signed-by=`. Never suggest disabling GPG checks, `trusted=yes`, `--allow-unauthenticated`, or `gpgcheck=0`.

## Future install and update instructions

Do not publish copy/paste repository commands until host, fingerprint, distribution/codename, package name and support matrix are approved. The release template must include:

### apt

1. Download the public signing key over approved HTTPS and verify its published fingerprint.
2. Store it in a Picom-specific system keyring with least privilege.
3. Add the channel source using `signed-by=<picom-keyring>` and the exact supported codename/component.
4. Refresh metadata and install the verified Picom package name.
5. Verify package origin/version/signature before launch.

### dnf/rpm

1. Add the HTTPS repository definition for the approved channel.
2. Verify/import the published Picom signing key fingerprint.
3. Require package and repository metadata GPG verification.
4. Install/update Picom and verify package signer/version/origin.

### AppImage/direct download

Download the immutable artifact, `SHA256SUMS.txt`, provenance and public signature evidence from the same approved release; verify before execution. AppImage does not silently add a repository.

## Publication pipeline

1. Build on clean native Linux runners from an approved commit.
2. Run quality, packaging, secret, artifact-content and native runtime tests.
3. Sign final packages in protected infrastructure.
4. Verify package signatures and generate checksums/provenance.
5. Stage immutable artifacts; generate and sign apt/rpm metadata.
6. Validate repository using a disposable clean client for each supported distro/channel.
7. Promote internal to beta to stable; never point stable metadata to untested beta bytes.
8. Monitor install/update failures and support signals; retain previous compatible versions for rollback.

## Pause, rollback and compromise

Pause on invalid/missing signature, metadata mismatch, broken dependency, launch failure, private-data issue, wrong channel/version, or key compromise. Remove affected metadata from promotion, preserve evidence, revoke/rotate keys if needed, publish corrected signed metadata/artifacts under a new immutable version, and communicate through incident response.

Repository rollback must not silently downgrade below backend minimum client version or a non-reversible local-data migration. Test downgrade/upgrade explicitly; otherwise pause and ship a forward hotfix.

## Production readiness gate

- approved distro/version/desktop matrix and support owner;
- AppImage/deb native smoke, plus rpm native smoke if enabled;
- reviewed desktop/AppStream metadata and selected project license;
- protected package/repository keys with rotation/revocation drill;
- immutable HTTPS host, access logs, backup and CDN/cache invalidation policy;
- clean-client install/update/channel-switch/rollback/uninstall tests;
- checksums, provenance, release notes, known issues and go/no-go approval.

Until all gates pass, use internal direct artifacts with explicit unsigned status and checksum verification only.
