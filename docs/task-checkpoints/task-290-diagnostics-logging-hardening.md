# Task 290 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Hardened diagnostics and logging without changing the MVP desktop UI.

## Completed

- Added a diagnostics service for app/runtime/service status snapshots.
- Added realtime status tracking for diagnostics exports.
- Added last API/Supabase/network error summary support.
- Expanded redaction coverage for Supabase, LiveKit, signing, access, and refresh secrets.
- Added a lightweight diagnostics smoke test.
- Documented diagnostics QA steps.

## Validation

Run:

```powershell
npm run diagnostics:smoke
npm run typecheck
npm run mock:smoke
```
