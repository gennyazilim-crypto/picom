# User Activity History

Picom prepares a user-facing account activity history so people can review important security events without exposing private credentials.

## Current MVP behavior

- Settings > Account shows Account Activity.
- Activity records are local placeholders.
- Events are recorded for:
  - `login_success`
  - `logout`
  - `session_revoked`
- Additional future event types are defined:
  - `login_failed_placeholder`
  - `password_changed`
  - `email_changed_placeholder`
  - `profile_updated`
  - `account_deletion_requested`

## Safety boundaries

- Do not store passwords.
- Do not store auth tokens or refresh tokens.
- Do not store cookies or authorization headers.
- Do not store raw IP addresses.
- Location is a placeholder until product/legal requirements are finalized.
- Developer diagnostics go through `loggingService` redaction.

## Future Supabase route

Future API route:

```text
GET /account/activity
```

Requirements:

- Auth required.
- User can only see their own activity.
- Raw IP addresses should remain masked or hashed unless policy permits otherwise.
- Session revocation and account deletion events should be backend-authored.
- Pagination should use the standard cursor response shape.

## Manual QA

1. Sign in.
2. Open Settings > Account.
3. Confirm Account Activity shows a login event.
4. Log out and sign back in.
5. Confirm logout/login activity appears without tokens or raw IP addresses.
