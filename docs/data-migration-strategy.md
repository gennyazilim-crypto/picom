# Data Migration Strategy

Picom uses Supabase Postgres for the MVP backend. Schema migrations must be predictable, reviewed, reversible where possible, and compatible with released desktop clients on Windows, Linux, and macOS.

## Status

- Scope: database and Supabase schema migration planning
- Runtime behavior change: none
- Production migrations: manual approval required
- Rollback: limited by schema change type

## Goals

- Keep local, staging, and production database changes consistent.
- Avoid destructive migrations without backups and rollback planning.
- Protect user messages, communities, memberships, roles, attachments, and audit/security records.
- Maintain compatibility with older desktop clients during staged rollouts.

## Migration sources of truth

Preferred migration artifacts:

- Supabase SQL migration files under the project migration directory if present.
- RLS policy changes committed with schema changes.
- Seed scripts separated from production migrations.
- Documentation updates for destructive or compatibility-sensitive changes.

Do not make manual production database edits without recording the equivalent migration.

## Local migration workflow

1. Start local Supabase/Postgres development services.
2. Apply migrations to a disposable local database.
3. Run seed data only in local development.
4. Run auth/community/channel/message smoke flows.
5. Verify RLS behavior with at least owner, moderator, member, and guest-like test users.
6. Reset the local database when migration order changes during development.

Local seed data may include known development users, but never production credentials or private user exports.

## Staging migration workflow

1. Confirm staging backup or snapshot is available.
2. Apply migration to staging.
3. Run staging smoke test:
   - auth register/login
   - community list/create
   - channel list/create
   - message fetch/send/edit/delete
   - reactions
   - attachment upload metadata
   - RLS private channel checks
   - realtime subscription sanity check
4. Verify desktop app can connect to staging using staging env vars.
5. Record migration result in release notes or deployment checklist.

Staging should represent production-like RLS and storage rules, not mock-only shortcuts.

## Production migration workflow

1. Review migration SQL and RLS changes before deployment.
2. Confirm backup verification is complete.
3. Confirm rollback or forward-fix plan is documented.
4. Apply migration during an approved release window.
5. Watch health, readiness, auth, message send, realtime, and upload metrics.
6. Run production smoke checks with safe test accounts only.
7. Keep a rollback decision window open after deployment.

Production migrations must not rely on seed data.

## Backup before migration

Before any risky staging or production migration:

- verify recent database backup exists
- verify restore procedure has been tested recently
- capture schema version or migration commit hash
- document expected data transformations
- identify tables with high-risk user data

High-risk tables include users/profiles, communities, members, roles, channels, messages, attachments, reactions, read states, sessions, invites, reports, notifications, audit logs, and storage metadata.

## Rollback limitations

Not every database migration can be safely rolled back.

Usually reversible:

- adding nullable columns
- adding indexes concurrently where supported
- adding new tables unused by old clients
- adding permissive RLS policies for new features after review

Risky or not safely reversible:

- dropping columns or tables
- changing column types with data conversion
- tightening RLS policies without client compatibility testing
- deleting data
- renaming fields used by released clients
- changing enum values used by the desktop app

If rollback is unsafe, prefer a forward-fix migration and disable the affected feature through config/feature flags.

## Zero-downtime placeholder

For future stable releases, prefer expand-and-contract migrations:

1. Expand: add new nullable fields/tables while old client still works.
2. Deploy backend/client code that writes both old and new fields if needed.
3. Backfill data in a safe job.
4. Verify all supported clients read the new shape.
5. Contract: remove old fields only after minimum supported client version advances.

## Breaking schema change process

A breaking schema change requires:

- issue or release note reference
- affected desktop client versions
- API contract update
- RLS policy review
- backup verification
- staging smoke test
- rollback or forward-fix plan
- clear user impact statement

## Seed data policy

The authoritative environment and production rules are in `docs/production-data-seeding-policy.md`.
Production seed is empty; community defaults are transactional tenant creation, and app-admin bootstrap is a
separate operator workflow.

Seed data is for development and staging-like test environments only.

Seed scripts must:

- use fake users and generated content
- hash passwords if auth credentials are included
- avoid production exports
- be idempotent or safely reset development data
- clearly mark development credentials as non-production

Seed scripts must not run automatically in production.

## Migration testing checklist

- Schema applies from a clean database.
- Schema applies from the previous release schema.
- RLS policies allow valid actions and deny invalid access.
- Supabase Auth profile creation still works.
- Community/channel/message core flows still work.
- Attachments metadata still links to messages safely.
- Realtime subscriptions still receive valid events.
- Existing desktop app version remains compatible if required.
- `npm run typecheck`, smoke tests, and build still pass.

## Handling failed migrations

If a migration fails:

1. Stop further deploy steps.
2. Capture logs and failing SQL safely without secrets.
3. Determine whether partial changes were applied.
4. If safe, roll forward with a corrective migration.
5. If unsafe, restore from verified backup in staging or follow production rollback runbook.
6. Disable related feature flags if app behavior is affected.
7. Document the incident or near-miss.

## Desktop client compatibility

The backend must support the currently allowed desktop client versions.

Before deploying schema changes, verify:

- old desktop clients can still login or receive a clear update-required state
- message DTOs remain compatible
- realtime event fields are additive where possible
- removed fields are not used by supported clients
- `minimumSupportedClientVersion` is updated only when necessary

## Known risks

- RLS changes can silently block valid users or expose private data.
- Storage metadata and database attachment rows can drift.
- Realtime payload changes can break older clients.
- Seed scripts can accidentally overwrite development state if not guarded.
- Rollback can be impossible after destructive data changes.

## References to use during release

- `docs/database-migration-rollback-drill.md`
- `docs/production-deployment-checklist.md` if present
- `docs/rollback-runbook.md` if present
- `docs/database-backup-restore.md` if present
- `docs/staging-smoke-test.md` if present
- `docs/api-compatibility.md` if present
