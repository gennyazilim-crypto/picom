# Security Team Permission Matrix (Task 17)

| Capability | root_owner | platform_admin | security_manager | security_analyst | support_* | moderator |
|---|---|---|---|---|---|---|
| View SOC alerts | F | F | F | F | — | — |
| Triage / assign alerts | F | F | F | W | — | — |
| Link to incidents | F | F | F | W | — | — |
| Manage security team | F | F | F | — | — | — |
| Account takeover actions | F | A | F | Limited | — | — |
| DM evidence access | F | A | E | E | — | E (case) |
| Finance / ads config | — | scoped | — | — | — | — |
| Audit security actions | F | F | F | R | — | — |
| Grant security_* roles | F | A | — | — | — | — |

E = evidence-only for assigned cases.

Roles: `security_manager`, `security_analyst` in catalog; module `security_team`.
