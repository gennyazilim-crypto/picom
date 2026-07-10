# Production Supabase Validation

Status date: 2026-07-10  
Overall result: **Partial hosted evidence; blocked for stable release**

## Proven hosted staging results

- Dedicated project `picom-staging` in `eu-west-1` used synthetic data only.
- Every committed migration is applied and local/remote parity reaches `20260710258000`.
- Auth account creation, profile trigger, login, session availability, session restore, invalid-password rejection, logout, and cleanup passed.
- Anonymous, owner, admin, moderator, member, and visitor RLS checks passed for public read plus private channel/message/attachment/Storage boundaries.
- No service-role credential was passed to the hosted RLS runner.
- Private Storage remained non-public and followed message visibility.

## Hosted failures and blocked scope

- Private Realtime Presence subscription returned `Unauthorized` for authenticated owner/member clients. The two-client insert/update/delete/reconnect run therefore did not complete and is not marked passed.
- Edge Functions were not deployed or exercised with provider secrets, so JWT/CORS/authorization behavior remains blocked.
- The complete Mention Feed/Profile/DM/saved-content access-loss matrix was not run.
- Historical signed-URL refresh and restored Storage-object behavior remain unproven.

## Local/static validation

| Area | Result |
| --- | --- |
| Environment and renderer secret contracts | PASS |
| Schema/migration inventory | PASS |
| Components behind service layers | PASS static |
| RLS policy inventory | PASS static |
| Hosted RLS role matrix | PASS for executed fixture set |
| Hosted Realtime | FAIL/BLOCKED |
| Hosted Edge Functions | BLOCKED |

## Safe rerun commands

```powershell
npm run supabase:rls:hosted:test
npm run realtime:staging:test
npm run edge:staging:test
npm run rate-limit:staging:test
```

Use only protected synthetic staging variables. Renderer builds may receive the project URL and publishable/anon key, never service-role, database, provider, or signing secrets.

## Release decision impact

RB-01, RB-02, and RB-03 remain open with narrower evidence gaps. Stable distribution remains **No-Go**. See `docs/hosted-supabase-staging-execution.md`.

## Task 419 private Presence status

The canonical topic/client/policy contract passes locally, but protected hosted credentials and project linkage were unavailable for a rerun on 2026-07-11. Private Realtime Presence remains **BLOCKED** and the previous authenticated `Unauthorized` result is not replaced by local evidence.

## Task 420 Edge Functions status

`livekit-token` is the only Edge Function required by the locked Full MVP scope. Its local security contract passes, but it was not deployed or exercised against hosted staging because project linkage and provider secrets were unavailable. Edge Functions remain **BLOCKED**; 501 placeholders and post-MVP functions are not counted as release evidence.
