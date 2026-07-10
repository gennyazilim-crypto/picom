# Task 320 - Database migration rollback drill

## Result

**BLOCKED / NOT RUN** as of 2026-07-10. No approved staging target, backup/PITR point, Supabase CLI, operator
approval, or synthetic test identities are available. No staging or production database was contacted and no
destructive command was run.

## Prepared procedure

- Backup and target identity gates before migration.
- Additive, forward-fix-only, and restore-required classification.
- Candidate apply with timed schema/RLS/Storage/Realtime/core desktop validation.
- Explicit Compensating migration, Forward-fix, or Restore/PITR recovery branch.
- Full post-recovery validation and corrected reapply/roll-forward proof.
- Linear migration history, redacted evidence, RPO/RTO, and No-Go criteria.

## Validation

- `npm run database:migration:rollback-drill:smoke`
- `npm run release:v2:migration:checklist:smoke`
- `npm run backup:verify:smoke`
- `npm run supabase:rls:production-safe`

Typecheck/build are skipped because this task changes operational documentation and a documentation-only
smoke script; no runtime source, schema, dependency, UI, or desktop behavior changed.

## Unblock requirements

Provision an isolated staging project, verified pre-migration backup/PITR recovery point, approved candidate
migration, CLI/provider operator access, five-role synthetic identities, and Windows/Linux/macOS QA capacity.
Execute the timed procedure and store only redacted evidence privately before claiming a pass.
