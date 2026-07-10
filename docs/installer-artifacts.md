# Installer Artifacts and SHA256 Checksums

## Naming contract

Every release candidate uses the immutable pattern:

```text
Picom-<version>-<channel>-<platform>-<arch>.<ext>
```

Current platforms are `Windows`, `Linux`, and `macOS`. The package version comes
from `package.json`; electron-builder derives the prerelease channel. Never
replace different bytes under an existing name. Use a new version/candidate.

## Current outputs

- Windows x64: NSIS `.exe`
- Linux x64: `.AppImage` and `.deb`
- macOS x64: `.dmg` and `.zip`
- RPM: recognized by checksum tooling but not enabled as a package target

## Candidate workflow

1. Build into a clean candidate directory.
2. Verify product name, version, channel, platform, architecture, and extension.
3. Complete platform signing/notarization where required.
4. Run smoke/install tests against the exact final bytes.
5. Generate `SHA256SUMS.txt` after signing/notarization.
6. Run checksum verification before upload.
7. Generate provenance for the same candidate.
8. Upload artifacts, checksums, provenance, notices, and release notes together.

Commands:

```bash
node scripts/generate-checksums.mjs --dir=release --output=release/SHA256SUMS.txt --strict
npm run verify-checksums
npm run generate-provenance
```

The non-strict `npm run generate-checksums` command safely skips an absent/empty
local `release` directory. Release CI must use `--strict`.

## Verification and collision rules

- The SHA256 manifest uses paths relative to the candidate directory.
- Manifest paths may not escape that directory.
- Missing files, malformed hashes, and changed bytes fail verification.
- Do not combine outputs from different versions/channels in one candidate.
- Do not checksum unsigned bytes and then replace them with signed bytes.
- Treat published artifact names and hashes as immutable.

SHA256 detects corruption but does not prove publisher identity. Platform code
signing/notarization and protected release provenance remain separate controls.

## Publication boundary

These scripts do not upload or publish packages and contain no credentials. A
release owner must confirm target-platform installation, signature status,
license/notices, checksum verification, and Go/No-Go approval before release.
