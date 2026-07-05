# Task 294 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added runtime secret exposure smoke testing.

## Completed

- Added `npm run secrets:smoke`.
- Added runtime scanner for `src/` and `electron/`.
- Added the secret scan to `npm run qa:smoke`.
- Documented secret exposure QA expectations.

## Validation

Run:

```powershell
npm run secrets:smoke
npm run qa:smoke
npm run typecheck
```
