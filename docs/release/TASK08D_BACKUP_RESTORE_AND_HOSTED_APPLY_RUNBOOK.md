# TASK 08D — Backup / Restore and Hosted Apply Runbook (pre-apply only)

This document does **not** perform production mutation.

## Exact refs

| Role | Ref |
| --- | --- |
| Production | `cqnsetsmcduraryemhbi` |
| Staging | `ufmtvqtsklqsmqxefbbs` |

## Pre-apply stop conditions

- `PICOM_ENVIRONMENT` / production mutation guard not ALLOWED → STOP
- Migration manifest SHA mismatch → STOP
- Hosted-only `20260803221951` not reconciled in repo → STOP
- Clean reset FAIL → STOP
- Production checkpoint upgrade FAIL → STOP
- Full pgTAP FAIL → STOP
- Storage JWT matrix FAIL → STOP
- Feature flags / placements / real payouts enabled → STOP

## Backup metadata checklist (read-only)

Record before any future apply task:

1. Supabase project health  
2. PITR / backup retention window  
3. Last successful backup timestamp  
4. Logical dump command and encrypted destination  
5. Restore target (ephemeral) and ownership  
6. Dual-control approval ticket  

If credentials/metadata unavailable:

**BACKUP METADATA: BLOCKED**

Do not invent backup evidence.

## Guarded apply order (future task only)

1. Confirm production remote tip includes `20260803221951`  
2. Confirm repo materialization SHA matches audit  
3. Apply pending local-only versions after remote tip (`210000`/`220000` if missing, then `225000`…`270000`) using controlled CLI with mutation guard  
4. Canary prefix only  
5. No payout / ads enablement  

## Rollback posture

Forward-fix only for financial/audit tables. Disable via kill switches / feature flags. Do not delete ledger rows.
