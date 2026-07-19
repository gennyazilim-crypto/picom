# Ads Permission Matrix (Task 21)

| Capability | root_owner | platform_admin | ads_manager | ads_operator | ads_reviewer | finance_viewer |
|---|---|---|---|---|---|---|
| Create / edit campaigns | F | F | F | W | — | — |
| Submit for review | F | F | F | W | — | — |
| Approve / reject creatives | F | F | A | — | F | — |
| Change budget below threshold | F | F | F | Limited | — | R |
| Budget above threshold | F | A | A† | — | — | R |
| Billing / invoice config | F | A | — | — | — | R |
| Private user data | — | scoped | — | — | — | — |
| Audience aggregates | F | F | R‡ | R‡ | R‡ | — |
| Manage ads team | F | F | F | — | — | — |
| Grant ads_* roles | F | A | — | — | — | — |

† Two-person approval above configured thresholds.
‡ Privacy threshold / k-anonymity style floors when estimates exposed.

Catalog today seeds `ads_manager`, `ads_operator`; `ads_reviewer` enforced as capability in review flows / follow-on catalog extend.
