# RBAC Permission Matrix (Task 03)

Legend: **F** = full · **R** = read · **W** = write within policy · **A** = approve / dual-control · **—** = none · **E** = evidence-only / minimized

Roles are keys in `platform_role_catalog` (plus catalog extensions for ads_reviewer / finance_operator where gated in follow-on migration).

| Capability | root_owner | platform_admin | support_manager | support_agent | ads_manager | ads_operator | security_manager | security_analyst | trust_safety_manager | moderator | finance_viewer | analytics_viewer | read_only_auditor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Open Panel / shell | F | F | R | R | R | R | R | R | R | R | R | R | R |
| Overview KPIs | F | F | R* | R* | R* | R* | R* | R* | R* | R* | R* | R | R* |
| User management | F | F | R | — | — | — | R | R | W | R | — | — | R |
| Community ops | F | F | R | — | — | — | R | — | W | W | — | — | R |
| Content / feed ops | F | F | — | — | — | — | — | — | W | W | — | — | R |
| DM safety (metadata) | F | F | — | — | — | — | R | R | E | E | — | — | R |
| Voice / LiveKit ops | F | F | — | — | — | — | R | R | R | R | — | — | R |
| Support tickets | F | F | F | W | — | — | — | — | — | — | — | — | R |
| Support team admin | F | F | F | — | — | — | — | — | — | — | — | — | R |
| Security SOC | F | F | — | — | — | — | F | W | R | — | — | — | R |
| Security team admin | F | F | — | — | — | — | F | — | — | — | — | — | R |
| T&S cases | F | F | — | — | — | — | R | R | F | W | — | — | R |
| Moderation sanctions | F | F | — | — | — | — | — | — | F | W† | — | — | R |
| Ad campaigns | F | F | — | — | F | W | — | — | — | — | R | — | R |
| Ad creative review | F | F | — | — | A | — | — | — | R‡ | — | — | — | R |
| Revenue / MRR read | F | F | — | — | R | — | — | — | — | — | R | — | R |
| Finance approvals | F | A | — | — | — | — | — | — | — | — | R | — | R |
| Feature flags | F | F | — | — | — | — | R | — | — | — | — | — | R |
| Incidents | F | F | R | — | — | — | F | W | R | — | — | — | R |
| Audit log read | F | F | R | — | R | — | F | R | R | — | R | R | F |
| Assign / revoke roles | F | A§ | — | — | — | — | — | — | — | — | — | — | — |
| Analytics aggregates | F | F | — | — | R | — | — | — | — | — | — | R | R |

\* Module-scoped KPI strips only where role has module access.
† Sanction duration limits + escalation; no protected-category dumps.
‡ Brand-safety adjacent read only when configured.
§ Dual-control / root for highly privileged grants.

## Enforcement

- Catalog: `platform_role_catalog`
- Assignments: `platform_role_assignments` (`revoked_at`, `expires_at`)
- Helpers: `has_platform_role(text)`, `is_root_owner()`, `is_app_admin()` / `is_admin()`
- List/overview RPCs currently require `is_app_admin()`; finer role filters land with mutation/RBAC migration.

## Next

See `TASK_03_RBAC_REPORT.md` → Task 04 Panel navigation.
