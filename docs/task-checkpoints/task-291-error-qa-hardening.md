# Task 291 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added a unified MVP error taxonomy and smoke test.

## Completed

- Added typed app error codes.
- Added safe user-facing error formatting.
- Wired `loggingService.formatUserError` to the unified formatter.
- Added a compatibility logging service export under `src/services/logging/`.
- Added a lightweight error-code smoke test.
- Documented error handling QA.

## Validation

Run:

```powershell
npm run errors:smoke
npm run typecheck
npm run mock:smoke
```
