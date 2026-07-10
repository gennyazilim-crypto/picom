# Verification security foundation

Picom verification is an administrative review marker, not paid verification and not a legal identity, safety, quality, or endorsement guarantee. Badge artwork remains an original Picom UI treatment.

## Request and review model

- Authenticated users may request `verified_user` or `creator_verified` only for their own profile.
- `picom_staff` and `verified_bot` are operator-managed placeholders and cannot be self-requested.
- Community owners and permitted community admins may request `official_community`.
- Only app admins or active app-level trust roles may approve, reject, or revoke.
- Renderer clients have no direct status-update grant. Decisions pass through security-definer review functions.
- Approved requests create compatible entries in `verification_badges` for existing badge rendering.
- Every request and decision appends a `verification_audit_logs` record.

## Privacy

Identity documents, government identifiers, payment information, credentials, and other sensitive evidence must not be stored in these public-schema workflow tables or public Storage buckets. Future evidence handling requires a private bucket, short-lived signed access, retention limits, and reviewer-only authorization.

Authenticated users can read safe status columns for approved records and their own requests. Request reasons and reviewer identities are not granted as public badge-rendering columns. Audit metadata is visible only to verification reviewers.

## Validation

```powershell
npm run verification:badges:smoke
npm run supabase:smoke
npm run supabase:rls:smoke
```

Run `npm run supabase:rls:test` with Supabase CLI and Docker for live pgTAP enforcement verification.
