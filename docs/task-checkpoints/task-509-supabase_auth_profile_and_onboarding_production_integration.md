# Task 509 Checkpoint: Supabase Auth, Profile, and Onboarding

## Delivered

- Removed Supabase-to-mock sign-in fallback.
- Separated email-verification-pending signup from authenticated signup.
- Added server validation and near-expiry refresh to session restoration.
- Kept first launch, auth, legal acceptance, and onboarding route guards ordered.
- Added atomic profile/follow/theme onboarding RPC and account theme persistence.
- Removed local onboarding authority from Supabase mode while preserving mock mode.
- Added a deterministic production contract smoke test and migration-order guard.

## Validation

- `npm run auth:onboarding:production:smoke` - PASS
- `npm run first-launch:smoke` - PASS
- auth email/password/session smoke and production contracts - PASS
- `npm run supabase:migrations:check` - PASS
- `npm run supabase:qa` - PASS with hosted CLI-dependent execution truthfully blocked when unavailable
- `npm run typecheck` - PASS
- `npm run mock:smoke` - PASS
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS

## Evidence boundary

No staging Supabase project, disposable verified inbox, or provider credentials are available in this checkout. Real hosted register/verify/revoke/OAuth and cross-device onboarding evidence remains **BLOCKED**, not passed. Follow the matrix in `docs/supabase-auth-onboarding-production.md` when protected staging credentials are available.
