# Task 510 Checkpoint: Supabase Text Community Messaging Integration

## Delivered

- Text-kind and effective-permission channel creation RPC.
- Authoritative idempotent message send RPC with prior-success replay.
- Supabase author identity derived exclusively from `auth.uid()`.
- Same-channel reply validation and atomic pending attachment linking.
- Existing optimistic queue, realtime ordering/deduplication, typing, presence, unread, edit/delete, and reaction paths retained.
- New pgTAP access/idempotency fixture and deterministic structural smoke.

## Validation

- `node scripts/text-community-messaging-integration-smoke.mjs` - PASS.
- `npm run channel:private-permissions:smoke` - PASS.
- `npm run message:send-queue:smoke` - PASS.
- `npm run realtime:deduplication:smoke` - PASS.
- `npm run realtime:ordering:smoke` - PASS.
- `npm run realtime:backpressure:smoke` - PASS.
- `npm run read-state:smoke` - PASS.
- `npm run messages:editing-conflicts:smoke` - PASS.
- `npm run reactions:summaries:smoke` - PASS.
- `npm run supabase:qa` - PASS structurally; real pgTAP execution BLOCKED without Supabase CLI.
- `npm run typecheck` - PASS.
- `npm run mock:smoke` - PASS.
- `npm run build` - PASS.
- `npm run qa:smoke` - PASS.
- `npm run performance:budget:ci` - BLOCKED in the shared dirty worktree: concurrent, task-external UI edits measured `initialJs` at 1753.3 KiB against the 1650.0 KiB hard cap. No budget was raised and no unrelated UI file is included in this task checkpoint.

## External evidence

Hosted two-client insert/update/delete, optimistic echo reconciliation, private denial, typing, presence, reconnect, and persisted attachment reload remain **BLOCKED** until protected staging accounts/environment are available. No hosted PASS is claimed.
