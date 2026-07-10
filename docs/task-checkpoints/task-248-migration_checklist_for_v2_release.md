# Task 248 checkpoint: migration checklist for v2 release

- Added one evidence-driven v2 checklist covering DB migration order, RLS/Edge Functions, backup restore verification, staging smoke, desktop/client compatibility, local-data migration, rollback/forward-fix, production execution, and closeout.
- Linked the checklist from production deployment and RC dry-run workflows.
- Marked account deletion finalization, live RLS checks, backup restore evidence, cross-tenant denial, and supported-client compatibility as explicit blockers.
- No runtime/UI/database behavior changed.

Validation: `npm run release:v2:migration:checklist:smoke`, `npm run data-migration:strategy:smoke`, `npm run backup:verify:smoke`. Typecheck/build were skipped because this task changes documentation and a documentation contract only.
