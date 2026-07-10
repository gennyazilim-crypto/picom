# Task 315 - RLS hosted staging validation

## Result

Hosted execution is **blocked / not run** as of 2026-07-10 because no staging project configuration,
synthetic account credentials, or fixture IDs are available in this environment. No credentials were
requested, displayed, stored, or committed, and no database connection was attempted.

## Prepared validation

- Added a read-only hosted runner using only anon/publishable configuration and ordinary Auth sessions.
- Covers Owner, Admin, Moderator, Member, Visitor, and anonymous public access.
- Covers private channel, private message, attachment metadata, and private Storage object leakage.
- Requires explicit `STAGING_ONLY` confirmation and rejects service-role-like keys.
- Added preflight mode that makes no network connection and prints configuration names only.

## Evidence run

- `npm run supabase:rls:hosted:preflight` - expected pass without credentials.
- `npm run supabase:rls:hosted:test` - expected fail until staging values are injected; this is not a pass.
- `npm run supabase:rls:smoke` - structural policy/test evidence only.
- `npm run supabase:env:validate` - repository environment boundary.

See `docs/rls-hosted-staging-validation.md` for the exact fixture and rerun procedure. A successful hosted
run remains a P1 release gate and must be recorded privately with redacted output.
