# Task 517 - Full Supabase RLS Role and Content Matrix

## Status

Local matrix contracts are complete. Real hosted execution is **BLOCKED / No-Go evidence missing** because no approved staging URL/key, synthetic account credentials, or isolated fixture IDs are available in this environment.

## Completed

- Centralized the deployed Full MVP RLS matrix in `supabase/tests/hosted/full-mvp-rls-matrix.json`.
- Covered anonymous, Owner, Admin, Moderator, Member, Visitor, blocked participant, and DM non-participant.
- Covered Text, Radio, Podcast, Feed, followed stories, Profile, Friends, Direct Messages, synced settings, audit, Storage, and Realtime.
- Added real SELECT, INSERT, UPDATE, DELETE, Storage download, and Realtime topic authorization probes.
- Added Text message/reply/reaction CRUD, DM CRUD, own-settings/cross-user isolation, Radio listener, and Podcast comment mutation suites.
- Kept the runner anon-key-only; it rejects service-role keys and never prints credentials, IDs, tokens, URLs, payloads, or content.
- Required explicit `STAGING_ONLY` and `ALLOW_EPHEMERAL_WRITES` confirmations before any connection or mutation.
- Integrated the matrix inventory into the existing structural RLS smoke gate.

## Hosted blocker

`npm run supabase:rls:hosted:preflight` is safe and lists configuration names without values. `npm run supabase:rls:hosted:test` was not run because the required staging secrets and fixtures are absent. No hosted pass was fabricated. Any future unauthorized read/write or Realtime topic authorization is an immediate release No-Go.

## Validation

Passed locally:

- `node scripts/full-mvp-rls-matrix-contract.mjs`
- `npm run supabase:rls:hosted:preflight` (no network connection)
- `npm run supabase:rls:smoke`
- `npm run supabase:qa`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run qa:smoke`
- `npm run build`

Skipped/blocked:

- `npm run supabase:rls:test`: BLOCKED because Supabase CLI/local stack is unavailable.
- `npm run supabase:rls:hosted:test`: BLOCKED because approved staging secrets, synthetic accounts, and fixture IDs are unavailable.
- Manual hosted evidence: BLOCKED for the same external staging dependency.
