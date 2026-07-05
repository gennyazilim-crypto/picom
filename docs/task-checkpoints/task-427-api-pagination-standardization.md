# Task 427 - API Pagination Standardization

## Summary

Standardized Picom's shared cursor pagination contract for future list endpoints without changing current MVP UI behavior.

## Completed

- Extended shared pagination types with:
  - `PaginationCursor`
  - `PaginationDirection`
  - `PaginatedEndpointName`
  - `PaginationRequest`
  - `PaginationMeta`
  - `PaginatedResponse<TItem>`
- Added `docs/api-pagination.md` with the standard response shape and endpoint coverage.
- Documented compatibility rules for messages, notifications, audit logs, members, search results, reports, saved messages, account activity, and admin lists.
- Added a smoke test to prevent the shared pagination contract and documentation from drifting.

## Safety notes

- No UI behavior changed.
- Existing message pagination remains backward-compatible.
- Supabase RLS and backend permission checks remain the source of truth for data visibility.
- Unsafe mutations are explicitly excluded from automatic pagination retry behavior.

## Validation

- `npm run api:pagination:smoke`
- `npm run shared:types:check`
- `npm run typecheck`
- `npm run build`

