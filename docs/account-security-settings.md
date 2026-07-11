# Account Security Settings

Picom centralizes account identity and security actions under Settings > Account. Supabase Auth remains authoritative in Supabase mode; mock mode keeps deterministic local behavior without pretending an external provider is configured.

## Identity and verification

- The signed-in email and verification state are displayed without exposing access or refresh tokens.
- Verification resend uses a neutral response and cooldown to reduce account enumeration and abuse.
- Google and Apple show Available only when Supabase mode and the matching public provider flag are configured.
- Provider connection uses Supabase linkIdentity and the validated Picom OAuth callback. An opened browser is not reported as a completed link.

## Passwords

- Password reset sends a non-enumerating request to the current account email.
- Password change requires the current password, a new password of at least 12 characters, and confirmation.
- Supabase re-authenticates before updating the password, then performs global sign-out.
- Passwords are held only in controlled input state for the request and are never logged or persisted.

## Sessions and logout

- Safe device/session metadata is listed through sessionManagementService; raw tokens are never stored in the session table or rendered.
- Revoking other sessions requires an explicit confirmation and invokes both Supabase Auth scope: others and the audited device-session RPC.
- Logging out the current desktop session requires confirmation.
- Session refresh no longer recursively requests itself.

## Export and deletion

- Data export uses dataExportService and the own-user RLS/Edge Function path. Generated content is held only in the current app session until download.
- Account deletion requires the exact username, current-password re-authentication, no owned communities, and an explicit request.
- The deletion path revokes sessions, records a security event, and enters the documented 14-day review/anonymization process; it never immediately hard-deletes community history.

## Audit and external validation

Password changes, session revocation, logout, and deletion requests write redacted local account activity. Supabase session revocation and deletion migrations/functions write authoritative account security events. Production readiness still requires hosted SMTP, OAuth provider, callback, session-revocation, export, and deletion tests with protected staging configuration; missing hosted evidence must remain BLOCKED.
