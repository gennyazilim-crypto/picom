# Task 398 - Message sequence numbers

## Summary

Prepared stable per-channel message ordering with an optional `sequence` field while preserving `createdAt` fallback behavior.

## Changes

- Added Supabase migration `20260704002500_message_sequence_numbers.sql`.
- Added nullable `sequence bigint` to messages.
- Backfilled existing messages with per-channel row numbers.
- Added positive check, unique channel/sequence index, and ordering index.
- Added a trigger that assigns sequence on insert using a transaction-scoped advisory lock per channel.
- Updated message service/list/send DTOs and Supabase database types.
- Updated local message state sorting to prefer sequence when available.
- Updated realtime metadata to carry message sequence when available.
- Documented the deployment and pagination limitations.
- Added a smoke test for the sequence foundation.

## Verification

Commands to run:

```powershell
npm run messages:sequence:smoke
npm run typecheck
npm run build
```

Manual verification:

1. Apply migrations to a clean Supabase database.
2. Send several messages in one channel and confirm sequence values increment.
3. Send messages in another channel and confirm its sequence starts independently.
4. Open Picom and confirm message order remains stable in mock and Supabase modes.

## Known limitations

- Compound cursor pagination is not yet implemented.
- Supabase mode requires the sequence migration before querying the new field.
