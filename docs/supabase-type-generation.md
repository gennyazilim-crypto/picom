# Supabase type generation workflow

Task 119 adds a local workflow for generating TypeScript database types from Supabase.

## Script

```powershell
npm run supabase:types
```

The script runs:

```powershell
supabase gen types typescript --local --schema public > src/services/supabase/database.types.ts
```

## Requirements

- Supabase CLI installed.
- Local Supabase project started and migrations applied.
- No production secrets are required.

## Generated output

- `src/services/supabase/database.types.ts`

A lightweight placeholder file is committed so the TypeScript app can build before a local Supabase instance is available. When the CLI is available, rerun the script to overwrite it with generated types.

## Usage in app code

`src/services/supabase/supabaseClient.ts` imports the `Database` type and creates a typed Supabase client. UI components should still use service/data-source layers rather than importing Supabase directly.

## Security notes

Generated types must describe public DTO/table shapes only. They must not include service-role keys, JWT secrets, passwords, token hashes, or private deployment configuration.

## Test steps

1. Run `npm run typecheck` to confirm the placeholder types compile.
2. Start local Supabase and run migrations.
3. Run `npm run supabase:types`.
4. Run `npm run typecheck` again to confirm generated types compile.