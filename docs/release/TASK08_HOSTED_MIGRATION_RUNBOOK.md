# TASK 08 / 08B / 08C — Hosted Migration Runbook

## Exact refs

| Role | Ref |
| --- | --- |
| Production | `cqnsetsmcduraryemhbi` |
| Staging | `ufmtvqtsklqsmqxefbbs` |

Invariant: `productionRef !== stagingRef` (FATAL if equal).

## Required env (values not logged)

- `PICOM_ENVIRONMENT=production`
- `SUPABASE_PRODUCTION_PROJECT_REF=cqnsetsmcduraryemhbi`
- `SUPABASE_PRODUCTION_URL=https://cqnsetsmcduraryemhbi.supabase.co`
- `SUPABASE_PRODUCTION_DB_HOST=db.cqnsetsmcduraryemhbi.supabase.co`
- `SUPABASE_PRODUCTION_ORG_ID=<org>`
- `SUPABASE_ACCESS_TOKEN` or CI identity
- `PRODUCTION_CHANGE_TICKET` (non-placeholder)
- `PRODUCTION_DEPLOY_APPROVED=true`
- `EXPECTED_RELEASE_COMMIT`
- `EXPECTED_MIGRATION_MANIFEST_SHA256`

```bash
npm run production:mutation:guard
npm run production:config:guard
```

## Hosted-only `20260803221951` (TASK 08C)

| Item | Value |
| --- | --- |
| Classification | EXACT_RECONSTRUCTABLE |
| Materialized file | `20260803221951_live_screen_session_metadata.sql` |
| LF SHA | `87d557e440a68257b41d426552dc702b09e958600d49d819fc99c55818ed4919` |
| Audit | `docs/release/HOSTED_MIGRATION_RECONCILIATION_20260803221951.md` |
| History mutation | none |
| Production-accurate upgrade | `173000` → `221951` → latest **PASS** |

## Security hardening migration (TASK 08C)

| Item | Value |
| --- | --- |
| File | `20260803270000_advertising_acl_role_catalog_rls_and_test_hardening.sql` |
| LF SHA | `2468189af3abf322b982c633cf07f21288ac3634c84018004ebb1c292cc680c0` |
| Effects | revoke transition helper PUBLIC/anon/authenticated execute; enable `platform_role_catalog` RLS; finance client write lockdown |

## Sealed migration exception (TASK 08B)

| Item | Value |
| --- | --- |
| File | `20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql` |
| Old LF SHA | `91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9` |
| New LF SHA | `ca8f0de91b8ed06021046ce2992eac2e1fffc028f3cc909f7da3c69a79bb461e` |

Do **not** treat old RC `02d71294…` or 08B RC `0384b93e…` as current after 08C code changes.

## Pre-apply gate (all required)

1. Config staging-free  
2. Mutation guard ALLOWED  
3. Migration checksum PASS  
4. Clean Docker reset PASS  
5. Incremental upgrade PASS (including production-accurate `221951`)  
6. Local pgTAP/RLS PASS (advertising + partner closed in 08C)  
7. Local Storage JWT matrix PASS  
8. Backup gate PASS  
9. Logical backup PASS  
10. Restore rehearsal PASS  
11. Paid flags off  

**TASK 08C status:** local security + migration history ready; hosted apply **STOP** — mutation env / backup / provider gates remain.

## Migration list relative to production tip `20260803221951`

Pending on production (order as applied by CLI after tip):

1. `20260803210000_…` (if missing on remote)
2. `20260803220000_…`
3. `20260803225000_…`
4. `20260803230000_…`
5. `20260803240000_…` (repaired `ca8f0de9…`)
6. `20260803250000_…`
7. `20260803260000_…`
8. `20260803270000_…` (ACL/RLS hardening)

## Failure stop conditions

- Any SQLSTATE during apply → stop  
- Manifest SHA mismatch → stop  
- Staging target detected → FATAL  
- Re-introducing old `91b3d199…` content → FATAL  
- Unreconciled hosted-only migration → FATAL  

## Forward-fix

Do not rewrite sealed `240000`. Additive hardening only. Backup/restore steps: `docs/release/TASK08D_BACKUP_RESTORE_AND_HOSTED_APPLY_RUNBOOK.md`.
