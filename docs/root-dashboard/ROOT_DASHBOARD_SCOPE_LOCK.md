# Root Dashboard Scope Lock (Task 01)

**Locked:** 2026-07-15
**Authority:** Owner root dashboard Claude package (tasks 01–40)

## Non-negotiable product rules

1. **No fake metrics.** KPI cards, charts, and tables must reflect RPC/query results or an explicit empty / unavailable state. Hardcoded counts, placeholder graphs presented as live data, and smoke-only “success” are forbidden.
2. **Panel for authorized roles only.** The sidebar **Panel** control appears and opens only after server-backed access resolves (`adminOperationsService` / `is_app_admin` / `is_root_owner` / `has_platform_role`). Client email string comparison is not authorization.
3. **Server-side auth.** Every privileged read/mutation is enforced in Postgres RLS and/or `SECURITY DEFINER` RPCs that check `auth.uid()`. UI hiding is UX only.
4. **Owner bootstrap by `user_id`.** `f.tayboga@gmail.com` is bootstrap identity only. Migration resolves `auth.users.id` and persists `root_owners.user_id`.
5. **Honest empty states.** Loading, empty, error, permission-denied, and reconnect are required per module.
6. **Privacy / least privilege.** No bulk DM content browsing; case evidence only where assigned. Aggregates for audience/revenue with privacy thresholds where applicable.
7. **Audit & MFA.** Privileged mutations write immutable audit rows; destructive actions require MFA/step-up (hardening migration).

## In scope (`in_scope`)

| Module / capability | Notes |
|---------------------|-------|
| Owner bootstrap + Panel entry | Sidebar + Settings redirect |
| RBAC catalog & assignments | `platform_role_*`, matrices |
| Dashboard shell + IA | `RootDashboardShell`, nav groups |
| Overview KPIs | `get_root_dashboard_overview_v1` |
| Users / communities / content ops | Modules under `rootDashboard/modules/` |
| DM safety (metadata / reports) | Not inbox content dump |
| Voice / LiveKit ops | Session/health surfaces |
| Support + support team auth | Tickets + roles |
| Security SOC + security team | Abuse/security alerts |
| Trust & Safety + moderation auth | Cases / sanctions |
| Advertising + review + ads auth | Campaigns / creatives |
| Revenue + finance approvals | Subscriptions / approvals |
| Radio / podcast / notifications | Media ops modules |
| Analytics foundation + metric aggregation | Events + aggregates when warehouse present |
| System health / incidents | Infra + `platform_incidents` |
| Audit logs / roles UI / feature flags | Read + manage where permitted |
| Command center / exports / realtime / performance | Platform ops |
| Security hardening / privacy compliance | MFA, exports, retention |
| Hosted multi-role acceptance + readiness | Go/no-go gate |

## Explicitly out of scope

- Redesigning core consumer chat UX unrelated to ops.
- Fabricating warehouse/Stripe data when providers are unset.
- Client-only “admin mode” toggles.
- Replacing existing Admin Operations probes with mocks.

## Dependency map

```
auth.users → root_owners / app_admins / platform_role_assignments
         → PanelEntryButton + RootDashboardApp
         → list/overview/summary RPCs
         → module pages (honest empty until rows exist)
```

## Blocker map

| Blocker | Impact | Unlock |
|---------|--------|--------|
| Migrations not applied on hosted DB | RPCs/tables missing | `supabase db push` / CI migrate |
| Owner email not in `auth.users` | No `root_owners` row | Sign up / invite owner |
| Stripe keys missing | Live MRR sync blocked | Configure provider env |
| Hosted acceptance not run | No production go | Task 39 evidence |

## Next task

Task 02 — Root Owner Bootstrap → `ROOT_OWNER_BOOTSTRAP_REPORT.md`
