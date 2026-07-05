# Task 303 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added a dedicated Supabase QA gate.

## Completed

- Added `npm run qa:supabase`.
- Added `scripts/supabase-qa-gate.mjs`.
- Documented Supabase QA behavior and CLI warning expectations.

## Validation

Run:

```powershell
npm run qa:supabase
npm run typecheck
```
