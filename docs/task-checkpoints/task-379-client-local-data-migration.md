# Task 379 - Client Local Data Migration

## Scope

Added a schema-versioned migration foundation for non-sensitive local desktop settings.

## Completed

- Added `schemaVersion` to local Picom settings.
- Added a small migration registry for versions `0 -> 1 -> 2`.
- Added settings normalization for theme, notifications, profile placeholders, and accessibility settings.
- Added corrupted local settings backup/reset behavior.
- Documented migration policy, corruption handling, and security boundaries.
- Added a focused smoke test.

## Validation

- `npm run local-data:migration:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- Auth/session secrets are intentionally excluded from this migration path.
- Unknown future schema versions reset to safe defaults.
