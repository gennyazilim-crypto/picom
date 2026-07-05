# Task 302 - Diagnostics, Logs, Test, and QA Hardening

## Summary

Added a Windows/Linux CI QA workflow.

## Completed

- Added `.github/workflows/qa.yml`.
- Runs `qa:smoke`, `typecheck`, and `build`.
- Documented CI QA scope and secret-safety boundaries.

## Validation

Local equivalent:

```powershell
npm run qa:smoke
npm run typecheck
npm run build
```
