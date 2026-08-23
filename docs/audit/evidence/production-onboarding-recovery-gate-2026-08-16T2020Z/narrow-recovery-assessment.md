# Narrow recovery assessment

```text
NARROW RECOVERY PACKAGE:
READY_FOR_OPERATOR_ACCEPTANCE
```

This is **not** a self-declared PASS. Operator must accept this model before any later apply task.

| Requirement | Met |
|---|---|
| Migration has no row UPDATE | YES — DDL/function replace only |
| Migration has no row DELETE | YES |
| No TRUNCATE | YES |
| Two new columns nullable/additive | YES — `ADD COLUMN IF NOT EXISTS` text, no NOT NULL |
| Old RPC exact hosted definition captured | YES — `legacy-rpc-definition.sql` from `pg_get_functiondef` oid 21328 |
| Old ACL captured | YES — `{postgres,authenticated,service_role}` EXECUTE |
| Old search_path captured | YES — `public` |
| Rollback SQL generated from hosted state | YES — `emergency-rollback.sql` (not executed) |
| Migration history baseline captured | YES — `20260816000000` ABSENT; tip `20260808430000` |
| Profile aggregate baseline captured | YES — 23 / 0 / 23 / 0 |
| No active 3-arg consumer | YES — desktop client is 5-arg; no Edge/view/trigger callers |
| Client canonical 5-arg | YES — `onboarding:rpc-contract:smoke` exit 0 |
| Expected migration SHA verified | YES — `0a1a3d88bed83e654e36e89da60c2b08a611a4da47cb2dd9eb38fad3ff1af07d` |
| Rollback does not drop new columns | YES — documented and omitted from SQL |

## Column rollback policy

If emergency rollback is ever required after apply:

- Restore the 3-arg callable function, security, search_path, and grants.
- **Do not drop** `profiles.onboarding_start_choice`
- **Do not drop** `profiles.onboarding_initial_feed`

Those columns are additive and nullable. Dropping them after production writes would lose data.
