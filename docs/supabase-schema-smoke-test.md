# Supabase schema smoke test

Task 121 adds a lightweight smoke test workflow for the Supabase schema foundation.

## Script

```powershell
npm run supabase:smoke
```

The default smoke test is safe and non-destructive. It checks:

- Required migration files exist.
- `supabase/seed.sql` exists.
- `database.types.ts` exists.
- Seed data references the core public tables.
- Supabase CLI availability, if installed.

## Optional local reset

To run a full local Supabase reset after intentionally confirming the local database can be reset:

```powershell
npm run supabase:smoke -- --reset
```

This runs:

```powershell
supabase db reset
```

Use this only for local development databases. Do not run it against shared, staging, or production data.

## Verification commands

```powershell
npm run supabase:smoke
npm run typecheck
npm run build
```

## RLS and security notes

The smoke test validates that the schema workflow is present. It does not prove RLS policy correctness. RLS policy behavior should be tested separately after policy tasks are implemented.