# Hosted Supabase Staging Execution

Status date: 2026-07-10  
Execution status: **PARTIAL / NOT READY**

## Hosted inventory

| Field | Evidence |
| --- | --- |
| Project | `picom-staging` (`ufmtvqtsklqsmqxefbbs`) |
| Region | West EU (Ireland), `eu-west-1` |
| Plan | Supabase Free, dedicated synthetic staging data only |
| CLI | Supabase CLI `2.109.1` |
| Applied migration | `20260710258000` |
| Services observed | Auth, Postgres, Storage, Realtime enabled; Edge Functions not deployed/validated |
| Realtime config | Presence enabled; public-channel allowance retained while private topics use RLS |

Credentials were held only in `%LOCALAPPDATA%\Picom\staging` during execution. No secret value, password, JWT, API key, or connection string is recorded here or committed.

## Real evidence matrix

| Case | Result | Evidence |
| --- | --- | --- |
| Apply all committed migrations | PASS | `supabase db push --include-all`; local/remote parity through `20260710258000` |
| Account create and profile trigger | PASS | Synthetic account created; matching profile appeared automatically |
| Login, active session, restore, logout | PASS | Hosted Auth proof returned true for every state |
| Invalid credentials | PASS | Wrong password rejected |
| Anonymous public read/private denial | PASS | Hosted RLS runner |
| Owner private channel/message/attachment/Storage | PASS | Hosted RLS runner |
| Admin private channel/message/attachment/Storage | PASS | Hosted RLS runner |
| Moderator private denial under current policy | PASS | Hosted RLS runner |
| Member private denial | PASS | Hosted RLS runner |
| Visitor/non-member private denial | PASS | Hosted RLS runner |
| Private Storage object denial | PASS | Unauthorized download failed; owner/admin download succeeded |
| Two-client Postgres Changes/typing/presence | FAIL/BLOCKED | Private Presence join returned `Unauthorized` for authenticated owner/member; no PASS claimed |
| Edge Function JWT/CORS matrix | BLOCKED | Functions/provider secrets were not deployed to this staging project |
| Full Mention/Profile/DM/lost-access matrix | BLOCKED | Broader release-scoped fixture matrix was not executed |

## Defects found and fixed

Real deployment exposed issues that local structural checks did not catch:

- UTF-8 BOMs in migration JSON/SQL discovery paths were removed.
- `message_attachments` gained the baseline-compatible `public_url` column.
- Unsupported `COMMENT ON POLICY` syntax was removed.
- `digest` was schema-qualified as `extensions.digest`.
- Supabase API role grants are now RLS-aware.
- UUID mention resolution no longer calls unsupported `min(uuid)`.
- Community role definitions now have a member/owner read policy.
- Realtime room-topic and JWT-subject authorization foundations were added.

## Commands executed

```powershell
npx -y supabase@2.109.1 db push --include-all --password <protected>
npx -y supabase@2.109.1 migration list --password <protected>
npm run supabase:rls:hosted:test
npm run realtime:staging:test
```

Auth/fixture proof scripts ran from a protected local staging directory and were not committed.

## Release impact

RB-01 is narrowed but remains open for the broader lost-access/DM/profile matrix. RB-02 remains open for signed-URL refresh and historical object recovery despite the private-object boundary PASS. RB-03 remains open because private Realtime Presence and Edge Function validation did not pass.

Recommendation: **Not ready**.

## Task 419 rerun status

Task 419 completed a fresh static and local contract review on 2026-07-11. Topic construction, private client configuration, JWT-subject RLS, cleanup, schema smoke, typecheck, build, and QA smoke passed.

The hosted matrix was not rerun because the current operator session had no Supabase CLI/project link, no protected `PICOM_REALTIME_*` variables, and no connected browser automation interface. The prior private Presence `Unauthorized` failure therefore remains authoritative. No PASS was inferred from static checks.

## Task 420 Edge Functions status

The `livekit-token` release boundary and local JWT/CORS/method/secret contracts passed on 2026-07-11. No linked project, protected Edge staging variables, or LiveKit provider secrets were available, so no function was deployed or called. Placeholder functions were explicitly excluded rather than deployed for checklist coverage. Hosted Edge Functions remain **BLOCKED**.
