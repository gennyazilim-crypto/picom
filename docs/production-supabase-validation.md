# Production Supabase Validation

Status date: 2026-07-10  
Overall result: **Blocked for stable release**

## Local/static validation

| Area | Result | Evidence |
| --- | --- | --- |
| Environment contracts | Passed | Local/staging/production examples validate; renderer-safe redirects are explicitly allowlisted |
| Renderer secret boundary | Passed | No service-role reference in runtime source; tracked real env files rejected |
| Schema/migration inventory | Passed | `npm run supabase:smoke` |
| Client/service architecture | Passed static | `npm run supabase:api-regression`; components do not directly call Supabase tables |
| RLS evidence inventory | Passed static only | `npm run supabase:rls:production-safe` |
| Hosted RLS runner safety | Passed preflight only | Explicit `--run` and `STAGING_ONLY` fixtures required |
| Realtime/Edge/rate-limit runners | Passed preflight only | Required variables reported without printing values or connecting |

## Hosted validation status

The Supabase CLI is unavailable and no approved staging URL, anon key, synthetic role accounts, community/channel fixtures, or explicit staging confirmation was supplied. Therefore no remote connection, migration, seed, or destructive operation ran.

The following remain **Blocked**, not Passed:

- Register/login/logout and profile trigger against production-like Auth.
- Applied migration parity and clean deployment.
- Anonymous/visitor/member/mod/admin/owner RLS matrix.
- Private channel/message/attachment/DM denial.
- Public visitor read-only behavior.
- Storage upload, signed URL refresh, and unauthorized object denial.
- Two-client Realtime insert/update/delete/deduplication.
- Edge Functions for LiveKit token, invite acceptance, and moderation helper.
- Production seed absence and provider configuration.

## Required hosted commands

Run only against an approved disposable staging project with synthetic users:

```powershell
npm run supabase:rls:hosted:test
npm run realtime:staging:test
npm run edge:staging:test
npm run rate-limit:staging:test
```

Do not place the Supabase service-role key in Electron/Vite variables. The renderer may receive only the public URL and anon key; RLS remains the authorization boundary.

## Release decision impact

RB-01, RB-02, and RB-03 remain open. Stable distribution is No-Go until hosted evidence is archived and reviewed.

## Task 396 closure attempt

The 2026-07-10 blocker-closure pass reconfirmed all local/static Supabase, RLS, secret-boundary, TypeScript, mock, and build gates. Hosted execution remained blocked because no approved staging project, operator authentication, synthetic role fixtures, or protected test variables were available. See `docs/hosted-supabase-evidence-closure.md`; no remote result is claimed.
