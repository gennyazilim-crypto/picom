# TASK 08C — Security and Migration History Closure

Generated: 2026-08-04T01:15:00+02:00  
Branch: `feat/community-rebuild`  
HEAD before: `5d168177a1b30ed80ac26edab8b6b2b2b4e7b9dd`  
Code RC: `d63025c4fa6ab0f700066b570da2e8fd07a395d8`

## 1. Executive verdict

**PARTIALLY READY**

08C-targeted advertising/partner pgTAP, ACL/RLS hardening, hosted `221951` reconciliation, dedicated incremental paths, Storage JWT matrix, clean reset, and builds PASS. Broader repo pgTAP suites outside this task’s root-cause set still fail on pre-existing plan-count / fixture issues (e.g. business_application / picom_verified), so full-repo Failed=0 is not claimed.

## 2. Git identity

| Item | Value |
| --- | --- |
| Previous code RC (08B seal) | `0384b93ec89c462c80f0d0713beab8f993791ea1` |
| New code RC | `d63025c4fa6ab0f700066b570da2e8fd07a395d8` |

## 3. Starting state

Clean reset PASS at 08B; advertising/partner pgTAP FAIL (test bugs); PUBLIC execute on transition helpers; `platform_role_catalog` RLS off; hosted-only `221951` unreconciled.

## 4–6. pgTAP

Inventory: `docs/audit/task08c-pgtap-failure-inventory.md`  
Advertising: **20/20 PASS**  
Partner: **26/26 PASS**  
Business catalog: **10/10 PASS**  
Critical skipped: **0**

## 7. Function ACL

Old: PUBLIC + postgres + service_role EXECUTE  
New: postgres + service_role only (PUBLIC/anon/authenticated revoked)

## 8. Role catalog RLS

Old: RLS disabled  
New: RLS enabled; admin/root select policy; `platform_role_catalog_public_safe` security_invoker view

## 9. Security migration

`20260803270000_advertising_acl_role_catalog_rls_and_test_hardening.sql`  
LF SHA `2468189af3abf322b982c633cf07f21288ac3634c84018004ebb1c292cc680c0`

## 10–11. Hosted-only migration

EXACT_RECONSTRUCTABLE → materialized `20260803221951_live_screen_session_metadata.sql`  
LF SHA `87d557e440a68257b41d426552dc702b09e958600d49d819fc99c55818ed4919`  
History mutation: **no** · Hosted apply: **no**

## 12–15. Incremental upgrades

| Path | Result |
| --- | --- |
| A empty→latest clean reset | PASS · 263 migrations · latest `20260803270000` |
| B `130000`→latest | PASS |
| C repo-ordered through `221951`→latest | PASS |
| C-accurate `173000`→`221951`→latest | PASS |
| D `230000`→latest | PASS |

## 16–17. Storage / inventory

Storage JWT matrix: **PASS**  
`platform_role_catalog` RLS on; `rlsDisabled=[]` in fingerprint sample; ads PUBLIC execute gone; placements disabled; real payouts off

## 18–22. Fingerprint / manifests / builds

| Artifact | SHA |
| --- | --- |
| Schema fingerprint | `7a856bc08203f3ef813235a58c36f5222822d40bf82098b2b6a3cba4d8698694` |
| Migration manifest | `7cfac125f2fcf2f9c3b69b70f3ce9b90e2733abd6049cc38c4f7d8b1609a4b9d` |
| Release manifest | `c08bf3835be0af490993a0e968d67a8d0ce3f3f2bbff565cbdaa79ec855e05ac` |

Typecheck / Account / Web / Desktop / delivery + payout regressions: **PASS** (provider E2E BLOCKED)

## 23–24. Backup / hosted pre-apply

BACKUP METADATA: **BLOCKED** (credentials/metadata not available this task)  
HOSTED PRODUCTION MUTATION: **BLOCKED**  
Hosted apply: **not_done**

## 25. Remaining external blockers

Provider · worker image digests · legal · backup/PITR metadata · mutation env vars

## 26. Final verdict

**PARTIALLY READY**

Targeted 08C security/history gates closed; full-repo pgTAP Failed=0 not claimed; hosted mutation/backup/provider gates remain BLOCKED.
