# Task 295 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added renderer native API boundary smoke testing.

## Completed

- Added `npm run renderer:native:smoke`.
- Added renderer scan to `npm run qa:smoke`.
- Documented renderer native API safety rules.

## Validation

Run:

```powershell
npm run renderer:native:smoke
npm run qa:smoke
npm run typecheck
```
