# Task 305 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added a LiveKit voice and screen-share smoke gate.

## Completed

- Added `npm run livekit:smoke`.
- Added LiveKit smoke checks to `npm run qa:smoke`.
- Documented the LiveKit QA gate and manual QA boundaries.

## Validation

Run:

```powershell
npm run livekit:smoke
npm run qa:smoke
npm run typecheck
npm run build
```
