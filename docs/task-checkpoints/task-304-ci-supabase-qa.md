# Task 304 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added the Supabase QA gate to the Windows/Linux CI workflow.

## Completed

- Added `npm run qa:supabase` to `.github/workflows/qa.yml`.
- Documented the CI Supabase QA scope.
- Updated README quality gate commands.

## Validation

Run:

```powershell
npm run qa:supabase
npm run qa:smoke
npm run typecheck
npm run build
```
