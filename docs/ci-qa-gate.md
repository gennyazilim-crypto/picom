# CI QA Gate

Picom uses a lightweight GitHub Actions QA workflow for Windows and Linux.

## Workflow

`.github/workflows/qa.yml`

## Runs on

- pull requests
- pushes to `main`

## Matrix

- `windows-latest`
- `ubuntu-latest`

## Commands

```bash
npm ci
npm run qa:smoke
npm run qa:supabase
npm run typecheck
npm run build
```

## Scope

This workflow verifies the MVP desktop code path and Supabase static/API-mode regression path. It does not publish packages, sign installers, run Supabase migrations, or require production secrets.

`npm run qa:supabase` is intentionally limited to local static checks and API-mode wiring checks. It may report that Supabase CLI is missing for optional reset testing, but that warning is not required for this CI gate.

## Secret safety

The workflow must not require:

- Supabase service-role keys
- LiveKit API secrets
- signing certificates
- auth tokens
- passwords

If future jobs need secrets, add a separate workflow with explicit environment protection.
