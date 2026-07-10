# Task 322 - Admin bootstrap production process

## Completed

- Finalized `docs/admin-bootstrap.md` for app-admin and community-admin separation.
- Required explicit confirmation, target fingerprinting, two-person approval, MFA-ready existing Auth user,
  protected operator mutation, negative-access tests, audit evidence, and revocation/session handling.
- Added a non-mutating production/staging preflight that rejects password/token/secret/service-role inputs.
- Verified `app_admins` direct access remains revoked and protected RPCs fail closed.
- Verified normal startup/build/package scripts do not invoke admin bootstrap.

No production admin was created, no database/network connection was made, and no password, token, key, user
UUID, email, or secret was added or logged.

## Validation

- `npm run admin:bootstrap:production:test`
- `npm run admin:bootstrap:smoke`
- A synthetic staging preflight with an RFC example UUID.
- `npm run secrets:smoke`

Typecheck/build are skipped because this task adds operator documentation and non-runtime static/preflight
scripts only; renderer, schema, dependencies, UI, and desktop behavior are unchanged.

## Remaining production gate

Execute the approved process first in staging, retain redacted provider/audit evidence, and test app-admin plus
normal-user denial before any production grant.
