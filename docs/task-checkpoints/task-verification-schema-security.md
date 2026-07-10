# Task checkpoint: Verification schema and security

## Result

Profile and community verification request tables, app-admin/trust reviewer authorization, safe RLS visibility, admin-only review functions, Picom badge projection, and append-only audit logging are prepared.

## Security boundaries

- Users cannot approve, reject, revoke, or otherwise update verification status directly.
- Users can request only eligible verification types for their own profile.
- Community verification requests require owner/admin authority.
- Approved status is readable through safe columns for badge rendering.
- Request reasons are not exposed through public badge reads.
- No identity-document or paid-verification workflow is included.

## Validation

```powershell
npm run verification:badges:smoke
npm run supabase:smoke
npm run supabase:rls:smoke
npm run typecheck
npm run build
```

Live pgTAP execution remains `npm run supabase:rls:test` when Supabase CLI is available.
