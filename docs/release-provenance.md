# Release Artifact Provenance

Picom release artifacts should include provenance metadata so the team can trace each Windows/Linux/macOS desktop package back to its source version and build context.

## Status

- Provenance generation path: prepared
- Artifact publishing: not enabled by this task
- Signing keys: not added
- Auto-update metadata: not enabled

## Metadata fields

Generated provenance includes:

- app version
- release channel
- git commit
- short commit hash
- build date
- build machine class placeholder (`ci` or `local`)
- desktop runtime
- Electron version
- Node.js version
- frontend build hash placeholder
- backend API compatibility version placeholder
- artifact file names found in the release directory

No secrets, signing keys, certificate passwords, private hostnames, or production credentials should be included.

## Generate provenance

After package artifacts are produced:

```bash
npm run generate-provenance
```

Default output:

```text
release/provenance.json
```

Custom paths:

```bash
node scripts/generate-release-provenance.mjs --artifacts-dir=release --output=release/provenance.json
```

## App visibility

The desktop app exposes basic build metadata in Settings > Advanced:

- Picom version
- release channel
- build date
- short commit hash
- desktop runtime
- backend API compatibility placeholder

Diagnostics also include safe version/channel/build metadata for support workflows.

## CI/release placeholder

The QA workflow runs `npm run release:provenance:smoke` against dummy artifacts. A future release workflow should run the real provenance command after packaging and before artifact upload.

Recommended release order:

1. Build Windows/Linux/macOS packages.
2. Run `npm run generate-checksums`.
3. Run `npm run generate-provenance`.
4. Upload packages, `SHA256SUMS.txt`, and `provenance.json` together.
5. Verify metadata matches the release tag/commit before promotion.

## Relationship to checksums

Checksums verify artifact bytes. Provenance explains where those artifact bytes came from. Both should be published together for beta/stable releases.

## Security notes

- Provenance is public metadata.
- Do not include environment variables wholesale.
- Do not include local usernames, private machine names, signing identities, or secret manager paths.
- Regenerate provenance whenever artifacts are rebuilt.

