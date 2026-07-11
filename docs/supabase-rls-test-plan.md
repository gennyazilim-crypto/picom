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
- Direct conversation metadata, participant, message, attachment, and reaction isolation.
- Direct message author/reaction ownership and blocked-participant write denial.
- Full MVP hosted matrix for Text, Radio, Podcast, Feed/stories, Profile, Friends/DM, synced settings, audit/admin, Storage, and Realtime.

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

Hosted Full MVP preflight and execution:

```powershell
node scripts/full-mvp-rls-matrix-contract.mjs
npm run supabase:rls:hosted:preflight
npm run supabase:rls:hosted:test
```

The execution command is staging-only, requires synthetic accounts and dedicated canary fixtures, and
performs ephemeral writes. It refuses to run without both `STAGING_ONLY` and `ALLOW_EPHEMERAL_WRITES`.

## Test files

- `supabase/tests/rls/community_access_boundaries.sql`
- `supabase/tests/rls/message_ownership_and_storage.sql`
- `supabase/tests/rls/direct_messages.sql`
- `supabase/tests/hosted/full-mvp-rls-matrix.json` (deployed staging matrix; not a pgTAP file)

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

If Docker/CLI cannot be installed, follow the hosted-only staging and two-user manual matrix in
`docs/supabase-local-development.md`. Dashboard SQL Editor may deploy/inspect policy SQL, but because it
uses privileged access it cannot prove anon/authenticated RLS enforcement. Record hosted manual evidence
separately and keep local pgTAP status explicitly `not run`.

## Storage notes

The MVP stores attachment metadata in `public.attachments` and files in the private `message-attachments` bucket. SQL tests cover attachment metadata visibility because it is directly queried by the desktop app. Full storage object policy verification should be run with local Supabase Storage after `supabase start` and must confirm:

- only authenticated members can upload pending files under their own user path,
- pending files are readable only by the uploader,
- attached files are readable only when the linked message is visible,
- private channel attachments are denied to visitors and unauthorized members.

Direct Message attachment metadata follows participant-only RLS. Storage object policies and signed URL issuance must repeat the conversation-participant check; DM objects must never be served from a public bucket.

## Direct Messages privacy boundary

The canonical DM suite verifies that non-participants cannot read conversation metadata, participant rows, messages, attachments, or reactions. Participants can mutate only their own messages/reactions, and a participant with `blocked_at` cannot send. Global search and Mention Feed must not query private DM tables.

## Security constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to Electron renderer code.
- Never use production Supabase projects for destructive local tests.
- RLS is backend enforcement. Frontend permission checks are UX only.
