# Task 400 - Database transaction consistency pass

## Summary

Completed a scoped transaction consistency pass without rewriting working MVP flows.

## Changes

- Added `docs/database-transaction-consistency.md`.
- Documented current status for critical multi-step operations.
- Marked which operations should move behind SQL RPC or Edge Functions.
- Added a smoke test covering the transaction consistency document and current entry points.

## Verification

Commands to run:

```powershell
npm run database:transactions:smoke
npm run typecheck
npm run build
```

Manual verification:

1. Review `docs/database-transaction-consistency.md`.
2. Confirm destructive/privileged multi-step operations remain disabled or placeholder-only until transactional RPCs exist.
3. Confirm core MVP create/send flows still work.

## Known limitations

- This task does not implement full SQL RPC replacements.
- Community creation defaults, attachment linking, ownership transfer, invites, and audit-backed moderation still need production transaction functions before stable release.
