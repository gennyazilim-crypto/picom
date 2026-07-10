# Release Artifacts and Checksums

Picom desktop release artifacts should include SHA256 checksums so testers and future users can verify that downloaded Windows/Linux/macOS packages match the files produced by the release process.

## Status

- Artifact publishing: not enabled by this task
- Signing keys: not added
- Artifact naming contract: active in electron-builder configuration
- Checksum generation path: prepared with `npm run generate-checksums`

## Supported artifact targets

Current electron-builder package scripts can produce these standardized names:

- Windows NSIS installer: `Picom-<version>-<channel>-Windows-<arch>.exe`
- Linux AppImage: `Picom-<version>-<channel>-Linux-<arch>.AppImage`
- Linux Debian package: `Picom-<version>-<channel>-Linux-<arch>.deb`
- macOS dmg: `Picom-<version>-<channel>-macOS-<arch>.dmg`
- macOS zip: `Picom-<version>-<channel>-macOS-<arch>.zip`

The checksum script also recognizes `.rpm` for future Linux rpm support if that target is added.

## Version and channel policy

- `package.json` `version` is the single application/artifact version source and must be valid SemVer.
- electron-builder `${channel}` is detected from the SemVer prerelease component. For `0.1.1-beta.1`, the channel is `beta`.
- A stable release uses the channel resolved by the approved stable build configuration; inspect the candidate filename before publishing.
- Do not override artifact channel through an unreviewed environment variable.
- Version and channel metadata shown in About/provenance must match the artifact filename.
- Rebuilding different bytes under an existing artifact name is forbidden. Increment the version or build a new approved candidate.

Current beta examples:

```text
Picom-0.1.1-beta.1-beta-Windows-x64.exe
Picom-0.1.1-beta.1-beta-Linux-x86_64.AppImage
Picom-0.1.1-beta.1-beta-Linux-amd64.deb
Picom-0.1.1-beta.1-beta-macOS-x64.dmg
Picom-0.1.1-beta.1-beta-macOS-x64.zip
```

The version and channel appear separately by design even when the prerelease version already contains the channel word.

## Generate checksums

After building packages into `release/`, run:

```bash
npm run generate-checksums
```

This writes:

```text
release/SHA256SUMS.txt
```

Example output line:

```text
<sha256>  Picom-0.1.1-beta.1-beta-Linux-x86_64.AppImage
```

For CI or release verification where artifacts are required:

```bash
node scripts/generate-checksums.mjs --dir=release --output=release/SHA256SUMS.txt --strict
```

Without `--strict`, the script exits safely if `release/` does not exist or has no artifacts. This keeps local development fast and non-destructive.

Verify the generated manifest on any supported build host:

```bash
npm run verify-checksums
```

Custom path verification:

```bash
node scripts/verify-release-checksums.mjs --dir=release --manifest=release/SHA256SUMS.txt
```

Verification rejects malformed hashes, missing files, changed bytes, and paths that escape the artifact directory.

## Release checklist integration

Before publishing beta/stable packages:

- Build the Windows package.
- Build the Linux AppImage package.
- Build the Linux deb package.
- Build rpm only if rpm packaging is enabled.
- Run `npm run generate-checksums`.
- Run `npm run verify-checksums` against the final signed/notarized bytes.
- Run `npm run generate-provenance`.
- Upload artifacts and `SHA256SUMS.txt` together.
- Upload `provenance.json` with package artifacts.
- Verify at least one checksum on each target platform.

## Verification commands

Linux/macOS:

```bash
sha256sum -c SHA256SUMS.txt
```

Windows PowerShell example:

```powershell
Get-FileHash ".\\Picom Setup 0.1.0.exe" -Algorithm SHA256
```

Compare the PowerShell hash with the matching line in `SHA256SUMS.txt`.

## CI placeholder

The QA workflow runs `npm run release:checksums:smoke` to verify the checksum generator against dummy artifacts. A future release workflow should run the real command after package jobs finish and upload `SHA256SUMS.txt` with the artifacts.

## Security notes

- Checksums help detect accidental corruption, but they are not a replacement for code signing.
- Do not commit signing keys, certificate passwords, notarization credentials, updater private keys, or release secrets.
- Generate checksums from the final artifact bytes after packaging is complete.
- Reject artifacts whose app name, version, channel, platform, or architecture segment is missing or does not match provenance.
- If an artifact is rebuilt, regenerate checksums.

## Known limitations

- Local unsigned packages remain expected until production signing is configured.
- The current task does not publish artifacts.
- The current task does not add update metadata or auto-update signing.
