# Picom admin bootstrap production process

## No automatic production admin creation

Picom never creates app admins or community admins during install, startup, migration, production seed,
desktop login, or normal signup. No `predev`, `dev`, `postinstall`, `build`, `package`, or `prepare` script may
invoke admin bootstrap. Bootstrap is an operator change with explicit confirmation, two-person review, and
separate staging verification.

App admin and community admin are distinct:

- **App admin** can access restricted Picom operations through `public.app_admins` and server-enforced RPCs.
- **Community Owner/Admin/Moderator** has tenant-scoped permissions only and is never implicitly app admin.

## Existing enforcement

- `public.app_admins` has RLS enabled and all direct access revoked from `anon` and `authenticated`.
- `public.is_app_admin()` is the read-only security-definer check exposed to authenticated sessions.
- App-admin operational RPCs independently call `is_app_admin()` and fail with `APP_ADMIN_REQUIRED`.
- `admin_operations_audit` is append-only through a guarded RPC; direct table access is revoked.
- Renderer `adminOperationsService.getAccess()` fails closed on missing client, RPC error, or false result.
- There is no renderer/API mutation route for `app_admins`.

Frontend hiding is not authorization. Community role assignment never mutates `app_admins`.

## App admin bootstrap prerequisites

1. Approved change ticket: environment, reason, duration/permanence, requested user UUID fingerprint, owners,
   rollback/revoke owner, and maintenance window. Keep personal details in the restricted system only.
2. Two-person approval from Operations/Security plus the accountable product/engineering owner.
3. Target project fingerprint independently confirmed as staging or production; no local/dev project alias.
4. User already exists through Supabase Auth invitation/signup, owns the approved email, completed password
   setup outside Picom scripts, and is MFA-ready where the provider/plan supports it.
5. `profiles` row exists and account is not deleted, suspended, shared, or a local `@picom.local` fixture.
6. Latest migrations and app-admin RLS/RPC tests are applied; audit/incident contacts are available.

Do not accept or log passwords, recovery links, JWTs, refresh tokens, authorization headers, service-role
keys, database passwords, session cookies, or MFA recovery codes. Operators obtain credentials only through
the approved secret manager/provider console; they never enter the repository or command arguments.

## Safe preflight

The repository helper validates explicit intent and prints only the final eight characters of the UUID. It
makes no network/database connection and performs no grant:

```powershell
$env:PICOM_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP_PREFLIGHT="true"
npm run admin:bootstrap:production:preflight -- `
  --environment=production `
  --user-id=<APPROVED_USER_UUID> `
  --confirm=PICOM_APP_ADMIN_BOOTSTRAP_REVIEWED
```

Staging uses `--environment=staging` and does not need the production preflight environment flag. Any
password/token/secret/service-role argument is rejected.

## App admin grant procedure

1. Start the approved operator session in Supabase Dashboard SQL Editor or protected CI/operator tooling.
2. Reconfirm environment/project and compare the target UUID fingerprint with the ticket; do not look up by
   an ambiguous display name or email copied into logs.
3. In one reviewed transaction, verify exactly one non-deleted `auth.users` and `profiles` row for the UUID,
   then insert `(user_id, granted_by)` into `public.app_admins` with retry-safe `on conflict do nothing`.
   The first bootstrap may have `granted_by = null`; provider/change-ticket audit identifies the external
   operator. Never grant through an authenticated renderer session.
4. Confirm exactly one row for the target and no unexpected app-admin count change.
5. Sign in as the synthetic/staging target and verify `is_app_admin() = true`; verify a normal account returns
   false and cannot select/insert/update/delete `app_admins`.
6. Verify Admin Operations opens only for target, each protected RPC rejects normal users, and
   `append_admin_operations_audit` records a content-free `app_admin_bootstrap_verified` event.
7. Revoke the bootstrap session, retain redacted provider operation ID/timestamp/approvers, and close or roll
   back the change. Do not record SQL containing real UUIDs in public repository evidence.

The exact mutation SQL remains in protected operator tooling, not this public repository. A service-role or
database-owner session bypasses RLS and therefore needs the stronger external approval/audit boundary.

## Revoke app-admin

1. Confirm incident/change authority and target fingerprint with two people.
2. Remove only the approved `app_admins` row through protected operator tooling; do not delete the user/profile.
3. Revoke active sessions through Supabase Auth when access must end immediately.
4. Verify `is_app_admin() = false`, Admin Operations is hidden/denied, normal community membership is unchanged,
   and no other app-admin row changed.
5. Record redacted reason, operator/provider operation ID, time, and incident/ticket reference externally.

## Community admin bootstrap

- The creator receives Owner membership only through the transactional community-creation backend path.
- Owner may assign Admin/Moderator through server/RLS-enforced role hierarchy; users cannot elevate themselves.
- Community role changes are scoped to one community, audited, retry-safe, and cannot call app-admin tooling.
- Production seed never creates community owners/admins. See `docs/production-data-seeding-policy.md`.

## Failure and incident handling

Stop if target/environment is uncertain, duplicate/missing profile exists, normal users can mutate/read the
table, audit fails, or counts differ. Do not retry with broader permissions. Revoke the row/session if safe,
rotate any exposed credential, preserve redacted evidence, and use incident response for suspected privilege
leak. No production grant is complete until staging and negative-access tests pass.
