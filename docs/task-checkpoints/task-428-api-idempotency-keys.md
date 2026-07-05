# Task 428 - API Idempotency Keys

## Summary

Prepared Picom's idempotency key foundation for safe retries and duplicate prevention across future API and Edge Function write paths.

## Completed

- Added shared `Idempotency-Key` contract types.
- Added renderer-safe `idempotencyKeyService`.
- Documented client, backend, message-path, UI, and security rules.
- Added a smoke test for the idempotency contract and docs.

## Current behavior

- Existing message sending continues to use `clientMessageId` for duplicate prevention.
- No Supabase write path was changed in this task.
- No UI behavior was changed.

## Future backend TODO

- Add a short-lived server-side idempotency record table or Edge Function wrapper when stable HTTP routes exist.
- Return previous successful results for repeated matching idempotency keys.
- Reject reuse of the same key with a different request fingerprint.

## Validation

- `npm run api:idempotency:smoke`
- `npm run shared:types:check`
- `npm run typecheck`
- `npm run build`

