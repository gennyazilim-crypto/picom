# Task 305 - Release checksums and provenance

## Result

- Kept SHA256 manifest generation for Windows, Linux, and macOS release artifacts.
- Added a platform-independent checksum verifier that rejects malformed entries, missing files, changed bytes, and directory traversal.
- Provenance now derives version/channel safely and records commit, build date, runtime, artifact names, sizes, and SHA256 digests.
- Environment variables are not serialized wholesale; signing credentials and machine identity remain excluded.
- Updated manual release docs and protected Windows/macOS workflows to verify checksums before upload.

## Validation

- `npm run release:checksums:smoke`
- `npm run release:provenance:smoke`
- `npm run release:artifact-naming:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Release sequence

Package and finalize signing/notarization first, then generate SHA256SUMS, verify it, generate provenance from the same immutable bytes, compare version/channel/commit to the approved tag, and upload all evidence together.
