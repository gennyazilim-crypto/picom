# Picom Windows code signing finalization

## Status and release boundary

Picom Windows development/internal packages remain unsigned by default. Production/stable Windows distribution is blocked until a qualified organization/publisher certificate, protected signing workflow, trusted timestamp, verification evidence, and clean-host installer smoke test are approved.

No certificate, private key, password, PIN, cloud signing token, account credential, timestamp credential, or real signing URL is committed. `electron-builder.yml` contains comments only and does not enable signing.

## Local unsigned behavior

### Unsigned local builds

Developers may build an unsigned x64 NSIS installer or unpacked directory:

```powershell
npm ci
npm run package:win:dir
npm run package:win
```

Expected local behavior:

- `Get-AuthenticodeSignature` reports `NotSigned`.
- Windows may show an Unknown publisher/SmartScreen warning.
- Unsigned packages are for development/internal testing only, clearly labeled, and must not be promoted as stable/public trusted artifacts.
- Checksum/provenance still verify byte identity but do not establish publisher identity.
- Local builds must not search a repository path for certificate material or silently sign from a developer's personal certificate store.

Do not disable Windows security controls to make an unsigned build appear trusted. Testers who explicitly accept an internal unsigned build must receive its checksum through the approved internal channel.

## Protected CI candidate workflow

`.github/workflows/windows-signed-release.yml` is manual-only, has read-only repository permissions, uses the protected `windows-production-signing` environment, and never runs on pull requests. It expects `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` as CI secrets and the approved publisher subject as an environment variable. Missing values fail closed without printing them.

The workflow produces an expiring candidate evidence artifact only; it does not publish a GitHub Release or update feed. Run `scripts/verify-windows-signature.ps1` after electron-builder and before checksums/provenance. A real release still requires environment approval, clean-host smoke and the final stable gate below.

## NSIS and MSI signing

NSIS x64 is Picom's configured Windows target. electron-builder must sign the application executable, helper/uninstaller binaries it controls, and final NSIS installer according to the approved signing provider. Verification covers the final installer and clean-host installed executable.

MSI is not configured. If enterprise MSI packaging is approved later, introduce it as a separate reviewed target; use the same protected identity, publisher, timestamp, post-signing checksum/provenance and install/upgrade/uninstall verification. Never assume a signed NSIS artifact proves a separately produced MSI is signed.

## Production signing model decision

Preferred order:

1. **Managed/hardware-backed signing service** on a protected Windows release runner. The private key is non-exportable; the CI identity submits digests/artifacts under policy and MFA/approval controls.
2. **Protected organization certificate in OS/hardware key store**, accessed only by the dedicated release identity/host.
3. **Encrypted PFX/PKCS#12 through `CSC_LINK` and `CSC_KEY_PASSWORD`** only if managed signing is unavailable and security approves the exportable-key risk. Material is injected ephemerally, never cached/uploaded, and securely removed after the job.

Select exactly one reviewed path. Do not combine multiple automatic certificate-discovery methods; the wrong personal/expired/test certificate must not be selected silently.

The certificate publisher subject must match the approved Picom legal publisher shown in installer UI. Organization identity, certificate type, vendor/CA, issuance validation, expiry/renewal, cost, revocation contact, and supported signing toolchain are private operational decisions requiring legal/security/release approval.

## CI secrets and access

Potential CI secret names (values remain blank/uncommitted):

- Managed signing tenant/account/key-profile identifiers and short-lived workload identity.
- `CSC_LINK` (protected reference or base64 certificate only if approved).
- `CSC_KEY_PASSWORD`.
- Hardware/cloud signing PIN/token only through provider-approved secretless/ephemeral mechanism.
- Timestamp configuration only if the approved service requires authentication.

Controls:

- Protected release tag/branch and manual environment approval.
- Dedicated Windows runner with current security patches and restricted administration.
- Individual MFA identities; no shared owner account.
- Least privilege: signing identity can sign approved Picom artifacts, not read production application data.
- CI masks values and forbids environment/debug dumps.
- Fork/pull-request jobs never receive signing access.
- Cache/artifact upload excludes temporary certificate/key/token files.
- Signing events are audited by commit, release version, artifact digest, identity, timestamp, and result without exposing secrets.
- Rotation/revocation on personnel change, suspected compromise, policy change, or certificate lifecycle event.

Renderer/Vite variables are public. Never use a `VITE_` signing variable or bundle signing metadata beyond safe publisher/certificate summary and artifact provenance.

## electron-builder integration

Current config keeps:

- `win.target = nsis` x64
- `requestedExecutionLevel = asInvoker`
- Picom icon/executable/artifact name
- commented placeholders only

Production CI should let the approved signing method integrate with electron-builder through its supported environment or a reviewed sign hook. Do not hardcode certificate paths/passwords in YAML, package scripts, source, `.env`, logs, or command history.

Before activation:

1. Test signing on a disposable internal artifact with a non-production workflow/project where applicable.
2. Prove no secret appears in source, npm logs, electron-builder debug output, process listing, cache, temporary artifacts, diagnostics, provenance, or release upload.
3. Confirm the installer and application executable are both signed by the intended publisher.
4. Confirm retries are idempotent and do not publish mixed signed/unsigned files under one version.

## Timestamping

Use an approved reliable Authenticode/RFC 3161 timestamp service compatible with the certificate/signing provider. Timestamping proves the artifact was signed while the certificate was valid and can preserve signature validity after normal certificate expiry.

Release rules:

- Timestamp failure, missing timestamp, untrusted timestamp chain, wrong signing time, or unexpected server is a failed stable signing job.
- Do not publish first and timestamp later; signing changes bytes and therefore checksum/provenance.
- An alternate timestamp service needs preapproval and compatibility testing, not an incident-time arbitrary URL change.
- Record timestamp signer/certificate/result with restricted release evidence.

No timestamp server is hardcoded until the certificate/provider choice is finalized.

## Build and signing order

1. Checkout the approved clean tag/commit on protected Windows CI.
2. `npm ci` with approved Node/npm versions.
3. Run quality/security/packaging gates.
4. Build the final NSIS/unpacked artifacts once.
5. Sign through the approved method and timestamp every required Windows executable/package according to electron-builder/provider behavior.
6. Verify signature/publisher/chain/timestamp before upload.
7. Generate SHA-256 checksums **after signing**.
8. Generate provenance referencing the final signed artifact names/digests and source commit.
9. Malware scan/clean-host install smoke.
10. Upload immutable signed artifacts, checksums, provenance, release notes, and public verification instructions.

Never rebuild or modify an artifact after checksum/provenance. A changed byte requires a new signing, verification, checksum, provenance, and release candidate decision.

## Signature verification

On a clean, updated supported Windows host:

```powershell
$installer = '.\release\Picom-<version>-Windows-x64.exe'
Get-AuthenticodeSignature -FilePath $installer |
  Format-List Status,StatusMessage,Path,SignerCertificate,TimeStamperCertificate
```

After installation, locate the installed executable through the approved install location/test harness (do not hardcode a user name) and run:

```powershell
Get-AuthenticodeSignature -FilePath '<installed-path>\Picom.exe' |
  Format-List Status,StatusMessage,Path,SignerCertificate,TimeStamperCertificate
```

Release expectations:

- `Status` is `Valid`.
- Signer subject/organization/publisher and certificate thumbprint match the private approved release record.
- Certificate chain is trusted and valid for code signing at signing time.
- Timestamp certificate is present/trusted and time is plausible.
- Installer UAC/Windows UI shows the expected verified publisher (Picom legal publisher, not a developer name or Unknown).
- Installer and installed executable version/product metadata match release provenance.
- Final SHA-256 matches `SHA256SUMS.txt` generated after signing.

Do not paste full certificate/private operational identifiers into public logs unless release/security approves them as public verification data.

## Installer and upgrade smoke

Test on clean supported Windows versions/architectures in the release matrix:

1. Download from the intended distribution path and verify checksum/signature before opening.
2. Confirm SmartScreen/UAC publisher text and no unexpected unsigned helper executable.
3. Install per-user without elevation (`asInvoker`) and with custom install location.
4. Start Picom; verify custom titlebar, auth, community/chat, uploads, voice/screen share permissions, protocol link, tray/notifications where enabled.
5. Upgrade from previous known-good signed version; preserve settings/session/local migrations safely.
6. Repair/reinstall if supported and uninstall; verify shortcuts/protocol registration cleanup.
7. Inspect installed executables/uninstaller/helper binaries expected to be signed by the release process.
8. Verify no certificate/password/temp signing file exists in app resources, ASAR, installer temp leftovers, logs, diagnostics, or environment output.

## SmartScreen expectations

A valid Authenticode signature establishes publisher identity and artifact integrity; it does **not** guarantee immediate SmartScreen reputation or warning-free installation. New certificates, new publishers, low-download beta artifacts, unusual distribution paths, or changed files may still trigger reputation warnings.

- Do not tell users to disable SmartScreen/Defender.
- Publish only from stable HTTPS/approved channels with consistent publisher, product, version, checksum, and filename.
- Build reputation gradually through legitimate signed distribution.
- Investigate warnings for signature/publisher/chain/timestamp/download-origin errors before assuming reputation alone.
- Document beta warning expectations honestly and provide verification steps.
- Do not use EV/OV marketing claims until the selected certificate and current platform behavior are verified by counsel/security/release.

## Failure and compromise response

### Missing/invalid/wrong signature

- Stop upload/promotion and quarantine candidate.
- Preserve logs/artifact/digest privately.
- Fix configuration and rebuild/sign from approved commit; do not patch checksum or version metadata manually.
- Check whether any unsigned/wrong-publisher file was distributed and communicate through incident response.

### Timestamp outage

- Pause stable finalization.
- Use only a preapproved alternate service or wait/retry within release window.
- Never publish an artifact that policy requires timestamped while reporting it as fully signed.

### Certificate/key/token compromise

- Open security incident, freeze signing/releases, revoke/disable signing credential, rotate CI identities/secrets, audit all signing events/digests, notify CA/provider, assess distributed artifacts, obtain replacement, and publish a reviewed user communication/remediation plan.
- Preserve signing audit evidence; do not delete it during containment.

### Certificate expiry/renewal

- Start renewal well before expiry.
- Test new chain/publisher continuity/timestamp on internal ring.
- Keep old signed artifacts and their timestamp evidence immutable; never re-sign old bytes under the same release identity without a documented reason/new checksums.

## Final stable gate

- [ ] Legal publisher and certificate/vendor/method approved.
- [ ] Private key non-exportability decision and risk accepted.
- [ ] Protected Windows CI and least-privilege signing identity configured.
- [ ] Secrets masked; fork/PR/cache/artifact exposure tests passed.
- [ ] Valid installer and installed executable signatures.
- [ ] Trusted timestamp and publisher verified on clean Windows.
- [ ] Final post-signing checksum/provenance generated and verified.
- [ ] Install/upgrade/uninstall/protocol/core-flow smoke passed.
- [ ] SmartScreen behavior recorded without advising bypass.
- [ ] Renewal, revocation, compromise, rollback, and owner/on-call paths approved.

Until every item is evidenced, public stable Windows signing is not finalized; local/internal unsigned builds remain the explicit behavior.
