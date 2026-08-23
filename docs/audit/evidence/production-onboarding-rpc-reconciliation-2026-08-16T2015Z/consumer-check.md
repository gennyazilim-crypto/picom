# Active consumer check

Search: `complete_current_user_onboarding`

| Consumer | Form | Verdict |
|---|---|---|
| Packaged / repo desktop client `onboardingService.ts` | named 5-arg | requires canonical 5-arg |
| Generated `database.types.ts` | 5-arg | requires canonical 5-arg |
| Historical migration `20260711150900` | 3-arg definition | immutable history, not a live caller |
| pgTAP `account_onboarding_rpc_contract.sql` | 5-arg | already canonical |
| Production Edge Functions | no references | none |
| Hosted views/tables `pg_depend` | none | none |
| Hosted function dependents | language + namespace only | no trigger/view/policy wrapper |

No active production consumer still intentionally calls the 3-arg form. Replacing it is the release fix, not a silent break.
