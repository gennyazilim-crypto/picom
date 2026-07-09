# Task 30 Checkpoint: Production Database Migrations and RLS Verification

## Scope

- Added an approval-gated production migration runbook.
- Added a production-safe RLS access matrix covering anonymous, visitor, member, moderator, admin, owner, attachments, Mention Feed, and profile activity.
- Added a non-connecting static preflight script and package command.
- Updated the older RLS checklist to reflect existing Storage policies and current external verification gaps.

## Safety

- No migration, SQL, project link, database reset, fixture insert, or remote mutation is executed by the new script.
- Production fixture pgTAP is explicitly forbidden; local/staging tests remain transaction/rollback based.
- Service-role credentials are not used to prove end-user policy behavior.

## Validation

- `npm run supabase:rls:production-safe` - passed without a database connection; CLI unavailable warning reported.
- `npm run supabase:rls:smoke` - structural pgTAP coverage passed; real execution skipped because Supabase CLI is unavailable.
- `npm run supabase:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## External work remaining

- Install Supabase CLI and run real local/staging pgTAP.
- Apply the approved migration set only after target, backup, restore, and rollback gates pass.
- Execute the production-safe account matrix and archive redacted evidence.
