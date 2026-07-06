# Supabase RLS Test Plan

Picom validates Supabase access boundaries with local pgTAP SQL tests plus a Node smoke script that refuses to pretend real RLS execution happened when the Supabase CLI is missing.

## Scope

- Anonymous public/private community reads.
- Visitor public channel/message reads.
- Visitor write denial.
- Public self-join for authenticated visitors.
- Member send/reaction/upload metadata access.
- Member channel-management denial.
- Admin-level private channel visibility.
- Owner channel-management and message-delete access.
- Message ownership edit boundaries.
- Attachment metadata visibility following message/channel visibility.

## Commands

Structural smoke, safe without Supabase CLI:

```powershell
npm run supabase:rls:smoke
```

Real local RLS test execution, requires Supabase CLI:

```powershell
supabase start
supabase db reset
npm run supabase:rls:test
```

Project QA gate:

```powershell
npm run qa:supabase
```

## Test files

- `supabase/tests/rls/community_access_boundaries.sql`
- `supabase/tests/rls/message_ownership_and_storage.sql`

Each test file:

- creates transaction-local fixture data,
- switches between `anon` and `authenticated` roles,
- sets `request.jwt.claim.sub` to emulate Supabase Auth users,
- verifies RLS-visible row counts and denied writes,
- ends with `rollback`.

## Supabase CLI unavailable behavior

If the CLI is unavailable:

- `npm run supabase:rls:smoke` validates that SQL tests and renderer secret checks exist, then prints a clear warning.
- `npm run supabase:rls:test` exits non-zero with setup instructions.

This is intentional. A structural smoke pass is not a claim that live RLS tests executed.

## Storage notes

The MVP stores attachment metadata in `public.attachments` and files in the private `message-attachments` bucket. SQL tests cover attachment metadata visibility because it is directly queried by the desktop app. Full storage object policy verification should be run with local Supabase Storage after `supabase start` and must confirm:

- only authenticated members can upload pending files under their own user path,
- pending files are readable only by the uploader,
- attached files are readable only when the linked message is visible,
- private channel attachments are denied to visitors and unauthorized members.

## Security constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to Electron renderer code.
- Never use production Supabase projects for destructive local tests.
- RLS is backend enforcement. Frontend permission checks are UX only.
