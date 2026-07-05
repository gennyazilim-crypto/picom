# Task 293 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added a combined QA smoke gate for Picom MVP safety checks.

## Completed

- Added `npm run qa:smoke`.
- Added `scripts/qa-smoke-gate.mjs`.
- Documented included checks and manual QA boundaries.

## Validation

Run:

```powershell
npm run qa:smoke
npm run typecheck
```
