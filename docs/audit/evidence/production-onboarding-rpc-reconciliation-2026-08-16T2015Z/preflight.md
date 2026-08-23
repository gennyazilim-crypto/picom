# PHASE A checklist

| Gate | Result |
|---|---|
| Migration SHA exact | PASS |
| Production target exact | PASS (`picom-production / cqnsetsmcduraryemhbi`) |
| Current legacy 3-arg confirmed | PASS |
| 5-arg client/type contract | PASS (`onboarding:rpc-contract:smoke` exit 0) |
| SQL scope reviewed | PASS |
| No conflicting active 3-arg consumer | PASS |
| Recovery / backup gate | BLOCKED (org plan=free; no PITR/backup timestamp) |
| Rollback prepared | PASS (not executed) |
| Apply mechanism scoped to this migration | PASS (MCP apply_migration; no db push) |
| Operator approval phrase | ABSENT |

```text
PHASE A PRECHECK:
BLOCKED

PRODUCTION RECOVERY GATE:
BLOCKED

PRODUCTION APPLY:
AWAITING_OPERATOR_APPROVAL
```
