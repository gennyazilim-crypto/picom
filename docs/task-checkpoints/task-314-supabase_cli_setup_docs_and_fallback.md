# Task 314 - Supabase CLI setup docs and fallback

## Completed

- Documented Node.js 20+, Docker, project-local CLI installation, and official Supabase references.
- Replaced placeholder local workflow with reset, migration, seed, RLS test, status, and stop commands.
- Added a non-blocking CLI availability command; database CI can opt into a required failure.
- Documented a staging-only hosted fallback with migration ordering and redacted evidence requirements.
- Added a two-user/anon manual RLS matrix and clarified that SQL Editor bypasses behavioral RLS proof.
- Kept mock UI development fully available when Supabase CLI or Docker is absent.

## Validation

- `npm run supabase:cli:check`
- `npm run supabase:rls:smoke`
- `npm run supabase:env:validate`
- `npm run mock:smoke`

This task changes process documentation and a non-blocking availability helper only. It does not install
the CLI, start Docker, connect a hosted project, apply migrations, or claim real RLS execution.
