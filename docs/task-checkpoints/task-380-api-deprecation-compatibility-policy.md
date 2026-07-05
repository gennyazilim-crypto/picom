# Task 380 - API Deprecation and Compatibility Policy

## Scope

Documented the API compatibility and deprecation rules for Picom desktop clients.

## Completed

- Added API versioning and breaking-change definitions.
- Documented additive change policy and deprecation process.
- Added placeholder deprecation headers.
- Documented error, pagination, realtime, Supabase, LiveKit, and release checklist compatibility expectations.
- Added a focused smoke test.

## Validation

- `npm run api:compatibility:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- This task is documentation-only for runtime behavior.
- No production auto-update behavior was enabled.
