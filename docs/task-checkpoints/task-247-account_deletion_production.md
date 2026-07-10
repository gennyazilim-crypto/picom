# Task 247 checkpoint: account deletion production

- Preserved exact-username confirmation, database ownership-transfer enforcement, 14-day grace period, cancellation, and global session revocation.
- Added an internal idempotent anonymization RPC that rechecks all destructive prerequisites and preserves messages plus append-only audit/security events.
- Added a default-disabled, secret-authenticated worker for Supabase Auth soft deletion and retryable partial-failure state.
- Kept renderer roles unable to invoke finalization or mutate request/audit rows directly.
- Finalization scheduling remains blocked on legal/operations approval and live staging evidence; no production destructive job runs by default.

Validation: `npm run auth:account-deletion:smoke`, `npm run supabase:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`. Live RLS/Auth soft-delete testing requires Supabase CLI or staging.
