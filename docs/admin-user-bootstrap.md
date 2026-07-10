# Admin User Bootstrap

The finalized operator process is `docs/admin-bootstrap.md`. This older implementation note describes the
guarded development placeholder and must not be used as a production grant command.

Picom needs an operator-only way to create the first app-level administrator later, but the MVP must not automatically create privileged users or expose credentials.

## Current status

- Production data seed never creates app-admins; see `docs/production-data-seeding-policy.md`.
- Bootstrap is a guarded placeholder script, not a production account creator.
- Admin bootstrap must not run automatically in production or during normal app startup.
- Command: `npm run create-admin-user -- --email=admin@example.com --confirm-create-admin`
- Alias: `npm run admin:create:placeholder -- --email=admin@example.com --confirm-create-admin`
- The script requires `PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE=true`.
- The script refuses raw password input.
- The script does not log passwords, tokens, Supabase service-role keys, or session data.

## Intended production flow

1. Operator verifies a staging or production maintenance window.
2. Operator creates or invites the user through Supabase Auth Admin API.
3. Operator grants app-admin authorization through a restricted `app_admins` table or equivalent server-only claim process.
4. Backend admin routes check app-admin authorization on every request.
5. Admin Operations UI remains hidden from normal users and should be available only after verified app-admin authorization.
6. All bootstrap and admin actions are audit logged without secrets.

## App-admin model placeholder

Use a separate app-level authorization model instead of adding a self-editable flag to user profiles.

Recommended placeholder table:

```sql
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
```

Security notes:

- Normal authenticated users must not insert, update, or delete rows in `app_admins`.
- App-admin checks must happen on the backend or through carefully reviewed RLS functions.
- Community owners/admins are not automatically app admins.
- Do not store raw passwords in Picom tables.
- Do not pass raw passwords to maintenance scripts.

## Development verification

Run:

```powershell
npm run admin:bootstrap:smoke
npm run admin:create:placeholder -- --email=operator@example.com --confirm-create-admin
```

The second command should only be used with:

```powershell
$env:PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE="true"
```

Without that explicit environment variable, the command must refuse to run.

## Production TODO

- Implement a real Supabase Edge Function or controlled operator script using the Supabase service role in a secure runtime.
- Store service-role credentials only in CI/production secret management.
- Add audit events for bootstrap attempts and successful grants.
- Add backend tests proving non-admin users cannot access app-admin routes.
- Keep Admin Operations hidden until app-admin authorization exists.
