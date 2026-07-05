# Task 297 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added desktop-only UI smoke testing.

## Completed

- Added `npm run desktop:smoke`.
- Added desktop-only scan to `npm run qa:smoke`.
- Documented desktop-only QA expectations.

## Validation

Run:

```powershell
npm run desktop:smoke
npm run qa:smoke
npm run typecheck
```
