# Task 217 checkpoint: Backup restore automated verification

## Delivered

- Upgraded the placeholder into guarded staging-only temporary restore automation.
- Added SQL/custom dump restore, core table/count and read-only integrity verification.
- Added generated temp DB naming and strict `finally` cleanup limited to that prefix.
- Added production/remote/source/confirmation/tool guards and manual fallback.

## Validation result

- `npm run backup:verify:smoke`: required safety contract verified without database access.
- A live restore was **not executed** because no approved staging backup, staging database target or protected PostgreSQL credentials were supplied.

## Safety

- Plan/smoke mode opens no database.
- Production-like targets are rejected.
- Script never accepts caller-selected deletion target.
- No secret or backup data is committed/logged.

App runtime source is unchanged, so typecheck/mock/build reruns are not required for this isolated operations script/documentation task.
