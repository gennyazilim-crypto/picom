# Task 659 Checkpoint: Supabase Staging Link, Secrets, and Hosted Environment

## Result

**PARTIAL PASS - real hosted environment configured; authenticated local CLI link BLOCKED.**

## Completed provider/dashboard work

- Selected the real `picom-staging` Supabase project.
- Installed five required LiveKit/server-gate secret names in Supabase Edge Function secrets.
- Created GitHub environment `hosted-staging`.
- Restricted deployment to `main`.
- Added required reviewer `gennyazilim-crypto`, prevented self-review, and disabled administrator bypass.
- Added protected `SUPABASE_ACCESS_TOKEN`, staging URL, and publishable-key secret names.
- Added `SUPABASE_PROJECT_REF` environment variable.
- Created separate staging renderer public configuration contract.

## Security result

No secret value entered source, docs, terminal output, command-line arguments, local env files, diagnostics, or artifacts. The LiveKit API secret remains only in Supabase Edge secrets.

## Evidence

- `docs/evidence/task-659-hosted-staging-redacted.json`
- `docs/v1-hosted-staging-environment.md`
- `.env.staging.example`
- `scripts/v1-hosted-staging-environment-smoke.mjs`

## Validation

- Real Supabase custom secret names: PASS_REAL
- Real GitHub environment creation: PASS_REAL
- Main-only deployment rule: PASS_REAL
- Required reviewer/self-review/admin-bypass policy: PASS_REAL
- Protected deployment token/project ref: PASS_REAL
- Renderer/server secret separation contract: PASS_LOCAL
- Authenticated local Supabase CLI link: BLOCKED (browser/OS clipboard isolation; no unsafe workaround used)

## Next task

Task 660 replaces the superseded role/channel ordinary-media restrictions with active-membership authorization while preserving role-aware moderation. Task 661 then deploys migration/function revisions through the protected hosted-staging path.