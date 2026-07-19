# Finance Permission Matrix (Task 24)

| Capability | root_owner | platform_admin | finance_operator | finance_viewer | ads_manager | other |
|---|---|---|---|---|---|---|
| View revenue / MRR | F | F | F | R | R (ads spend) | — |
| Request refund | F | F | W | — | — | — |
| Approve refund below threshold | F | A | A | — | — | — |
| Exceptional refund | F + MFA | — | — | — | — | — |
| Payout / billing config | F + MFA | A† | A† | — | — | — |
| Finance approval queue | F | F | F | R | — | — |
| Export finance CSVs | F | A | A | Limited | — | — |
| Moderation / SOC tools | — | scoped | — | — | — | — |
| Grant finance_* roles | F | A | — | — | — | — |

† Two-person approval for payout/billing configuration.

`finance_viewer` seeded in catalog; `finance_operator` capability in approvals module / follow-on catalog.
