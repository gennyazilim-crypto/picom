# Task 531 - Supabase meeting schema and migration foundation

## Result

- Added seven indexed, metadata-only meeting tables.
- Linked rooms to communities, voice channels, scheduled events and optional chat channels with same-community validation.
- Added room mode/status/policy/capability/host/lock/schedule fields.
- Added session, participant, waiting-room, invite, event and attendance lifecycles.
- Added idempotency and provider-event uniqueness for retry-safe ingestion.
- Added fail-closed RLS state pending Task 532 policies.
- Added generated Supabase types and deterministic local seed/mock parity.
- Added nullable meeting references to immutable audit history.
- Documented append-only forward-fix and destructive rollback limitations.

## Validation

- `node scripts/meeting-schema-foundation-smoke.mjs`
- `npm run supabase:migrations:check`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run qa:smoke`
- `npm run build`

Supabase CLI database reset/application is external evidence. If the CLI/local database is unavailable, structural checks may pass but hosted migration execution remains BLOCKED.

## Files

- `supabase/migrations/20260711153100_meeting_schema_foundation.sql`
- `src/services/supabase/database.types.ts`
- `supabase/seed.sql`
- `scripts/meeting-schema-foundation-smoke.mjs`
- `docs/meeting-schema-foundation.md`
- `docs/task-checkpoints/task-531-supabase_meeting_schema_and_migration_foundation.md`

Expected commit: `feat add supabase meeting schema`.
