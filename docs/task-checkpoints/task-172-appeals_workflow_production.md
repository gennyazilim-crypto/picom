# Task 172 checkpoint: Appeals workflow production

## Result

- Added typed appeal model/statuses and matching service/database state machine.
- Added a trusted backend-only moderation action ledger so production submit is bound to the actual affected user.
- Added self-only submit/list RLS and community-scoped moderator review RLS.
- Added duplicate/action/deadline/appealable checks, bounded secret-redacted text, reviewer timestamps, and terminal transition guard.
- Added append-only audit events after successful review decisions.
- Kept reversal, UI expansion, email, attachments, and final legal policy out of scope.

## Validation

- `npm run appeals:production:test`
- `npm run audit-logs:immutability:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Existing moderation transactions do not yet write `moderation_action_records`; a trusted backend/Edge Function transaction is required before production appeals can be submitted.
- Supabase CLI is unavailable locally, so deployed RLS/trigger behavior tests remain required.
- Reviewer independence, rate limits, notifications, reversal transactions, retention/appeal windows, support ownership, and legal copy need approval.
