# Task 389 - Shared Types Package

## Scope

Added a lightweight type-only shared package without changing existing runtime imports.

## Completed

- Created `packages/shared`.
- Added DTO, permission, pagination, API error, and realtime event types.
- Added shared package TypeScript config.
- Documented security rules and integration decision.
- Added focused smoke and typecheck scripts.

## Validation

- `npm run shared:types:check`
- `npm run shared:types:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- No Prisma/database-only models are imported into shared types.
- Sensitive fields are excluded.
- Existing app imports remain unchanged.
