# Task 354 checkpoint: Production Supabase validation

## Result

- Local/static Supabase contracts: **Passed**.
- Hosted production-like validation: **Blocked**.
- Stable gate: **Not ready**.

## Commands

- `npm run supabase:env:validate`
- `npm run supabase:cli:check`
- `npm run supabase:smoke`
- `npm run supabase:api-regression`
- `npm run supabase:rls:production-safe`
- Hosted RLS, Realtime, Edge, and rate-limit preflight commands.

## Fix

The environment validator now recognizes the explicitly approved public password-reset/email-verification/OAuth redirect URL names without weakening its secret-name checks.

## Blockers retained

No hosted tests ran because the CLI, approved project, confirmation, and synthetic fixtures were unavailable. No secret values were printed or committed.
