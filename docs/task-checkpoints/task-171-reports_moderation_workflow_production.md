# Task 171 checkpoint: Reports moderation workflow production

## Result

- Hardened report submission to require a visible community context and redact secret/control-character content.
- Fixed the moderator queue to start empty and load only after permission approval.
- Added explicit mock/service permission checks for report status updates.
- Added an allowed transition state machine in service/UI and a Supabase trigger preventing terminal reports from reopening.
- Added reviewer/reviewed timestamp metadata while keeping target/reason/description immutable through hardened column grants.
- Preserved community-scoped moderator RLS, target visibility checks, and append-only audit logging after successful transitions.
- Added no message-body copy or unrelated private moderation context.

## Validation

- `npm run reports:production:test`
- `npm run audit-logs:immutability:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Supabase CLI is unavailable locally, so deployed RLS/trigger behavior tests remain required.
- Trusted rate limiting, duplicate suppression, cursor pagination, reporter receipts, evidence access auditing, operational escalation, and approved retention/appeal policy remain production work.
