# Task 319 - Supabase backup and PITR review

## Completed

- Documented Free, Pro, Team, and Enterprise managed backup retention and PITR availability.
- Recorded PITR Small compute prerequisite, hourly/estimated monthly costs, and Spend Cap exclusion.
- Defined Picom beta minimum and stable recommendation as `PENDING APPROVAL`, not automatic configuration.
- Documented database-only restore gaps for Storage objects, Edge Functions, Auth/Realtime settings, secrets,
  and desktop release artifacts.
- Linked backup verification and staging restore drills with RPO/RTO and private-access release gates.
- Added Storage/config recovery and cost/monitoring companion requirements.

No production Supabase setting was changed, no project was contacted, and no credential or secret was added.

## Validation

- `npm run supabase:backup:pitr:review:smoke`
- Existing restore/backup smoke documents remain the execution references.
- Typecheck/build skipped because this task changes documentation and a documentation-only smoke script;
  no runtime source, dependency, schema, UI, or desktop behavior changed.

## Remaining approvals

Finance, Operations, Security/Privacy, and Engineering must select the production plan, PITR retention,
RPO/RTO, Storage backup, region, budget alerts, and restore owner after rechecking official pricing.
