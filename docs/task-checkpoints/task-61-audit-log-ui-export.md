# Task 61 - Audit Log UI and Export

- Added an append-only `audit_log` table with select-only RLS and a role-gated append RPC.
- Added central mock/Supabase audit log service and safe action taxonomy.
- Added actor, action, and date-range filters to Community Admin Panel > Audit Log.
- Added local clipboard copy and JSON download for the filtered result.
- Connected invite creation/revocation, report moderation, and channel creation producers.
- Kept community/channel/role/member action types ready for their existing service boundaries.
- Excluded tokens, passwords, invite codes, and message content from audit records.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
Live RLS execution requires the optional Supabase CLI/local stack.
