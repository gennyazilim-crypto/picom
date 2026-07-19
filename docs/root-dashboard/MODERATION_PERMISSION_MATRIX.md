# Moderation Permission Matrix (Task 19)

| Capability | root_owner | platform_admin | trust_safety_manager | moderator | security_* | support_* |
|---|---|---|---|---|---|---|
| Global content actions | F | F | F | W (policy) | — | — |
| Community-scoped moderation | F | F | F | W (scoped) | — | — |
| Account sanctions | F | F | F | Limited duration† | — | — |
| Permanent ban / seal | F | A | A | — | — | — |
| Appeal review | F | A | A‡ | — | — | — |
| Protected-category data | F | A | Restricted | — | — | — |
| DM evidence | F | A | E | E (assigned) | E | — |
| Manage moderation team | F | F | F | — | — | — |
| Ads / finance tools | — | scoped | — | — | — | — |

† Duration ceilings + escalation thresholds.
‡ Appeal reviewer should not be original sanctioning moderator when dual-control enabled.

Roles: `trust_safety_manager`, `moderator`; module `moderation_team`.
