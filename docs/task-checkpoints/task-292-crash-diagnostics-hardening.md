# Task 292 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Hardened renderer crash diagnostics.

## Completed

- Added diagnostics snapshots to crash recovery records.
- Included app/runtime/service status in copied crash diagnostics.
- Added a crash diagnostics smoke test.
- Documented manual crash QA.

## Validation

Run:

```powershell
npm run crash:smoke
npm run diagnostics:smoke
npm run typecheck
npm run mock:smoke
```
