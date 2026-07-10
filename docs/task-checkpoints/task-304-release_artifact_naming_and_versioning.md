# Task 304 - Release artifact naming and versioning

## Result

- Standardized Windows, Linux, and macOS artifact names as `Picom-${version}-${channel}-{platform}-${arch}.${ext}`.
- Applied the same name to the protected signed/notarized macOS configuration.
- Kept `package.json` SemVer as the single version source.
- Uses electron-builder's documented `${channel}` prerelease detection rather than a secret or ad hoc environment override.
- Updated packaging verification and release-artifact documentation.
- Existing CI upload/signature globs remain compatible because they wildcard the version/channel portion.

## Validation

- `npm run release:artifact-naming:test`
- `npm run packaging:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Release check

Before publishing, compare artifact filename, About metadata, provenance version/channel/platform/architecture, checksum manifest, and signed bundle metadata. Reject mismatches or rebuilt bytes under an existing name.
