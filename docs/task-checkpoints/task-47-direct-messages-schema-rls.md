# Task 47 - Direct Messages Schema and RLS

Date: 2026-07-10
Status: Complete

## Result
- Added direct conversation, membership, message, reaction, and attachment tables.
- Added membership-only RLS and author-only edit/soft-delete behavior.
- Added an atomic two-person conversation RPC so clients cannot self-join arbitrary conversations.
- Added typed Supabase service operations and generated-type placeholders.
- Added pgTAP membership isolation coverage and migration smoke registration.

## Validation
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run build`

## Remaining live check
Run `supabase test db --file supabase/tests/rls/direct_messages.sql` on a configured local/staging Supabase environment. Static smoke does not replace deployed RLS evidence.
