# Task 433 - Release Artifact Provenance

## Summary

Prepared release provenance metadata for Picom desktop packages.

## Completed

- Added build metadata fields to `appConfig`.
- Added safe version/build metadata to diagnostics.
- Added Settings > Advanced build metadata card.
- Added `scripts/generate-release-provenance.mjs`.
- Added `release:provenance:smoke`.
- Added `docs/release-provenance.md`.

## Validation

- `npm run release:provenance:smoke`
- `npm run react:hooks:smoke`
- `npm run typecheck`
- `npm run build`

## Safety notes

- No real artifacts were published.
- No signing keys or credentials were added.
- Build machine is recorded as `ci` or `local`, not as a private hostname.

