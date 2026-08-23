# TASK 08C — pgTAP Failure Inventory (pre-fix)

| Suite | Test file | Plan | Assertion | Description | Expected | Actual | SQLSTATE | Role | Related object | Class | Root cause | Intended fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| advertising | advertising_platform.sql | 20 (wrong) | 1–10 | has_table/has_function 2-arg | object exists | FAIL | n/a | postgres | ads tables/fns | **test bug** | pgTAP 2-arg form treats first arg as name | Use 3+/4-arg forms + correct plan |
| advertising | advertising_platform.sql | | 11 | client insert spend ledger | 42501 | 23503 FK | 23503 | postgres (superuser) | ad_spend_ledger | **test bug** | Superuser bypasses ACL | `set local role authenticated` |
| advertising | advertising_platform.sql | | 12 | append-only update | exception | no exception | n/a | postgres | ads_prevent_mutation | **test bug** | `UPDATE … WHERE false` never fires | Fixture row + real UPDATE |
| partner | partner_payout_finance_operations.sql | 24 | 1–16,20–23 | has_* 2-arg | exists | FAIL | n/a | postgres | payout objects | **test bug** | Same arity mistake | 3+/4-arg forms |
| partner | partner_payout_finance_operations.sql | | 17–18 | tax/onboarding guards | exception | none | n/a | postgres | payout_guard_* | **test bug** | `WHERE false` | Fixture UPDATE without GUC |
| partner | partner_payout_finance_operations.sql | | 19 | insert payout_batches | 42501 | 23502 | 23502 | postgres | payout_batches | **test bug** | Superuser insert | authenticated role |
| schema | n/a | | | ads_allow_internal_transition PUBLIC EXECUTE | revoked | PUBLIC grant | n/a | all | helper ACL | **schema** | Missing revoke in 240000 | Additive revoke |
| schema | n/a | | | platform_role_catalog RLS | enabled | disabled | n/a | PostgREST | catalog | **schema** | RLS never enabled | Additive enable + policies |

Post-fix: advertising **20/20 PASS**; partner **26/26 PASS** (after ACL migration + corrected tests).
