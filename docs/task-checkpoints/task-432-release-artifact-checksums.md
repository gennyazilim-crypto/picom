# Task 432 - Release Artifact Checksums

## Summary

Prepared SHA256 checksum generation for Picom desktop release artifacts.

## Completed

- Added `scripts/generate-checksums.mjs`.
- Added `release:checksums:smoke`.
- Added `docs/release-artifacts.md`.
- Updated release checklist and QA workflow references.

## Supported artifact extensions

- `.exe`
- `.msi`
- `.AppImage`
- `.deb`
- `.rpm`
- `.dmg`
- `.zip`

## Validation

- `npm run release:checksums:smoke`
- `npm run typecheck`
- `npm run build`

## Safety notes

- No real artifacts were published.
- No signing keys were added.
- The generator skips missing release directories unless `--strict` is used.

