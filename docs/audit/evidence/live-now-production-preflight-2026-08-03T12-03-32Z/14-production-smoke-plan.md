# Production smoke plan (NOT EXECUTED)

Status: **PLAN ONLY** — blocked from running until a distinct production Supabase project is provisioned, linked, and preflight GO.

## Internal test accounts (to create later on production)

| Role | Purpose | Marking |
|------|---------|---------|
| normal viewer | discovery / reminder / prefs | `is_bot` or internal email domain + ops tag |
| threshold_under | CTA threshold_not_met | same |
| approved Creator | go live + badge | approved application + active badge fixtures |
| dashboard.read-only | list-only negative tests | role grant without approve |
| reviewer | suspend/approve | reviewer permission grant |

Do **not** use real paying users, real revenue, or monetization flows.

## Planned steps (future)

1. Approved Creator starts live broadcast (canonical go-live path).
2. Viewer sees stream in list/count/search/featured.
3. Reminder enable/disable on publisher schedule.
4. Notification preference upsert (`all_live` / `scheduled_only` / `important_only` / `off`).
5. Reviewer suspends badge.
6. Card/count/search/featured remove via realtime.
7. Re-attempt Go Live + LiveKit gate deny.
8. Reconnect remains hidden.
9. dashboard.read cannot approve/suspend.
10. Fixture cleanup (elevated credential delete of tagged fixtures only).

## Preconditions before this plan may run

- Distinct production project ref verified
- Clean release SHA matching staging-tested tree
- Migrations APPLIED + OBJECTS verified
- Backup/PITR verified
- Workers deployed at matching SHA
- Secrets PRESENT on prod hosts (not logged)
