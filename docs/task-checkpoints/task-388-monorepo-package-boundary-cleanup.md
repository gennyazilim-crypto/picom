# Task 388 - Monorepo Package Boundary Cleanup

## Scope

Reviewed current repository package boundaries and documented the safe MVP decision to avoid a risky monorepo migration now.

## Completed

- Documented current root package structure.
- Documented renderer, Electron, Supabase, scripts, docs, and asset boundaries.
- Documented future monorepo target shape.
- Listed migration triggers and deferred risky cleanup.
- Added a focused smoke test.

## Validation

- `npm run package-boundaries:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- No files were moved.
- No build scripts were changed beyond adding the smoke script.
