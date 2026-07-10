# Task 270 - Reply system production persistence

## Outcome

- Added nullable `messages.reply_to_message_id` with an indexed self-reference.
- Enforced active, same-channel, same-community, immutable reply targets in a trigger-only database function.
- Persisted reply IDs through Supabase send/list/realtime row mappings and generated database types.
- Preserved reply IDs through optimistic sends, offline queue retries, and server reconciliation.
- Retained existing deleted/unavailable reply preview fallback without copying target content.
- Added static contract and isolated pgTAP coverage for same-channel validation and private-channel isolation.

## Validation contract

- `npm run replies:production:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- `supabase/tests/rls/reply_system_production.sql` when Supabase CLI is available

Supabase CLI-dependent pgTAP is not considered passed unless an isolated local database executes it successfully.
