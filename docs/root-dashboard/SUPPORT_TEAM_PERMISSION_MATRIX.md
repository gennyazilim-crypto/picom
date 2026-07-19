# Support Team Permission Matrix (Task 15)

| Capability | root_owner | platform_admin | support_manager | support_agent | other roles |
|---|---|---|---|---|---|
| View all tickets | F | F | F | Assigned + unassigned queue* | — |
| Create / edit ticket fields | F | F | F | W (assigned) | — |
| Assign / reassign | F | F | F | Limited self-assign | — |
| Change priority / SLA | F | F | F | — | — |
| Merge / close | F | F | F | W (policy) | — |
| Manage support team roster | F | F | F | — | — |
| Export ticket PII | F | A | A | — | — |
| View unrelated security/T&S | — | scoped | — | — | per their matrix |
| Role grant support_* | F | A | — | — | — |

\* Queue visibility configurable; default minimizes cross-agent private note leak.

F=full W=write A=approve/dual —=none

Enforcement: `platform_role_assignments` roles `support_manager` / `support_agent`; list module `support_team`; helpers `has_platform_role`.
