# Task 269 - Message mentions extraction pipeline

## Outcome

- Added transaction-bound mention extraction for message create, edit, and soft delete.
- Added canonical `@username` and unambiguous `@"Display Name"` resolution.
- Restricted targets to unique, non-self members of the message community and capped each message at 20 targets.
- Kept all normalized mention writes behind a trigger-only security-definer function.
- Enabled RLS-filtered realtime changes for mention consumers without duplicating message content.
- Updated Mention Feed access fixtures to rely on the production extraction pipeline.

## Security decisions

- Renderer and service code cannot provide target user IDs or write `message_mentions`.
- Unknown, ambiguous, outside-community, self, and webhook-authored mentions are ignored.
- Existing `can_view_message` RLS remains authoritative for mention reads and private-channel isolation.
- Edit/delete reconciliation occurs in the same database transaction as the source message mutation.

## Validation contract

- `npm run mentions:extraction:smoke`
- `npm run mentions:supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP fixture: `supabase/tests/rls/message_mentions_extraction.sql`

Supabase CLI execution remains environment-dependent and must not be reported as passed unless it is available and the isolated test database runs successfully.
