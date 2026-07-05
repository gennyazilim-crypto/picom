# Task 420: Admin User Bootstrap

## Scope

- Hardened the guarded admin bootstrap placeholder.
- Documented the future app-admin authorization process.
- Added a smoke test to verify the placeholder remains safe.
- Did not expose credentials or create privileged users automatically.

## Safety decisions

- Raw passwords are rejected by the placeholder script.
- Production creation remains a TODO until Supabase service-role handling is placed in a secure operator runtime.
- App-admin authorization should use a restricted `app_admins` model, not a self-editable profile flag.
- Admin Operations remains a development placeholder until backend app-admin checks exist.

## Validation

- `npm run admin:bootstrap:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

The guarded command should refuse to run without explicit destructive-maintenance confirmation:

```powershell
npm run create-admin-user -- --email=operator@example.com --confirm-create-admin
```

To see the safe placeholder output in a development-only environment:

```powershell
$env:PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE="true"
npm run create-admin-user -- --email=operator@example.com --confirm-create-admin
```
