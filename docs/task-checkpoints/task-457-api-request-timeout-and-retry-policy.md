# Task 457 checkpoint: API request timeout and retry policy

## Status

Complete.

## Changed files

- `src/services/apiClient.ts`
- `docs/api-request-timeout-retry.md`
- `scripts/api-timeout-retry-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-457-api-request-timeout-and-retry-policy.md`

## Validation

- `npm run api:timeout-retry:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

This adds a generic typed API client foundation without changing existing Supabase service flows. It supports timeout, abort, safe GET retries, idempotency-key retries for unsafe operations, and user-friendly error formatting.
