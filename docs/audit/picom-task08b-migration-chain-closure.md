# TASK 08B — Migration Chain Closure

Generated: 2026-08-04T00:35:00+02:00  
Branch: `feat/community-rebuild`  
HEAD before: `d68b486e5ef5a911ab10a8e58fae3f8a426c20d7`  
Repair / new RC: `0384b93ec89c462c80f0d0713beab8f993791ea1`  
Old RC (invalid after repair): `02d712948bdabd4faed9e9f326d7276c808ae757`

## 1. Executive verdict

**PARTIALLY READY**

- Sealed `20260803240000` delimiter repair was eligible and applied (minimal `as $` → `as $$`).
- Docker clean reset **PASS** through `20260803260000` (261 local migrations).
- Hosted apply **NOT DONE**; production mutation **BLOCKED**.
- Full pgTAP suite **not** all-PASS (advertising / partner payout fixtures fail); catalog RLS PASS.
- Local storage static / business storage contract PASS; hosted private-access matrix FAIL (expected without hosted matrix).

## 2. Git identity

| Item | Value |
| --- | --- |
| Branch | `feat/community-rebuild` |
| Start HEAD | `d68b486e5ef5a911ab10a8e58fae3f8a426c20d7` |
| Repair eligibility | `SAFE_TO_REPAIR_UNAPPLIED_SEALED_MIGRATION = true` |

## 3. Broken migration diagnosis

File: `supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql`

- Function: `public.ads_allow_internal_transition()`
- Defect: lines 742/744 used invalid single-dollar delimiters `as $` / `$;`
- Language: `sql` / `stable` / `search_path = public, pg_temp`
- Clean reset SQLSTATE: `42601`
- Additive supersede cannot bypass: parser stops inside `240000`; later timestamps never run; skip/history-repair is not a clean chain.

## 4. Hosted history verification (read-only, 2026-08-04)

| Environment | Ref | Status | Latest migration | `20260803240000` | `ads_allow_internal_transition` |
| --- | --- | --- | --- | --- | --- |
| Production | `cqnsetsmcduraryemhbi` | ACTIVE | `20260803221951` (`live_screen_session_metadata`) | **absent** | **absent** |
| Staging | `ufmtvqtsklqsmqxefbbs` | ACTIVE | `20260803172000` | **absent** | **absent** |
| Staging-v2 | `kbdotviopwlcqviggtrc` | INACTIVE | unreachable / timeout | unverified (inactive) | n/a |
| Local | docker | applied | `20260803260000` | present (repaired) | present |

Note: Production also contains `20260803173000`, then hosted-only `20260803221951` (not in repo migrations). Old sealed SHA content was never recorded as `20260803240000` on accessible ACTIVE projects.

## 5. Repair eligibility decision

`SAFE_TO_REPAIR_UNAPPLIED_SEALED_MIGRATION = true`  
Accessible ACTIVE production + staging histories do not contain `20260803240000`.

## 6. Exact migration diff

```diff
 language sql
 stable
 set search_path = public, pg_temp
-as $
+as $$
   select coalesce(nullif(current_setting('picom.ads_internal', true), ''), '') = '1';
-$;
+$$;
```

Lines changed: **742, 744 only**.

## 7. Old / new SHA (LF-normalized)

| | SHA-256 |
| --- | --- |
| Old | `91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9` |
| New | `ca8f0de91b8ed06021046ce2992eac2e1fffc028f3cc909f7da3c69a79bb461e` |
| Additive `225000` | `8c0242941f4cdd9c9ae63e3d876fcdb201b71305add54ce26f7e9ce61cf7d53e` |

## 8. Seal exception

See `docs/release/MIGRATION_SEAL_EXCEPTION_20260803240000.md`.

## 9. SQL function contract (local)

| Check | Result |
| --- | --- |
| Parse / create | PASS (clean reset) |
| Signature | `ads_allow_internal_transition()` → `boolean` |
| Language | sql / stable |
| SECURITY DEFINER | false |
| search_path | `public, pg_temp` |
| Without GUC | `false` |
| With `picom.ads_internal=1` | `true` |
| PUBLIC EXECUTE | **present** (pre-existing omission in revoke list; not changed by delimiter repair) |
| Delivery / payout regressions | PASS |

## 10. Clean reset

| Item | Value |
| --- | --- |
| Result | **PASS** (`Finished supabase db reset`, exit 0) |
| Applied count | 261 |
| First (sample) | `20260704000100` |
| Latest | `20260803260000` |
| Skip / repair | none |
| Failed SQLSTATE | none |

## 11. Incremental upgrades

| Path | Result |
| --- | --- |
| A. Empty → latest | **PASS** (clean reset) |
| B. Task 01 pre-schema → latest | **NOT RUN** (no Task 01 fixture in-session) |
| C. Production level `20260803173000` → latest | **INFERRED PASS via ordered full-chain reset**; dedicated truncated DB fixture not re-executed in 08B |
| D. Pre-`240000` checkpoint → latest | Same as C (chain includes `225000` then repaired `240000`) |

Honest gap: dedicated incremental Docker databases for B/C/D were not spun as separate instances this session.

## 12. pgTAP / RLS

| Suite | Result |
| --- | --- |
| `business:catalog:rls:test` | PASS (10) |
| `advertising:rls:test` | FAIL (prior session: 12/20) |
| `partner_payout_finance_operations` | FAIL (prior session) |
| `picom-verified` / `verification-business` / `business` | FAIL / bail (prior session) |

**Full RLS PASS: NO**

## 13. Storage

| Check | Result |
| --- | --- |
| `business:storage:test` | PASS |
| `feed:storage:security:static` | PASS |
| `storage:private-access:review:test` | FAIL — hosted metadata matrix |
| Malware provider E2E | **BLOCKED** |
| Pending/quarantine public exposure (static) | PASS (static smoke) |

## 14. Schema fingerprint

| Item | Value |
| --- | --- |
| File | `docs/release/task08b-clean-schema-fingerprint.json` |
| SHA-256 | `c871a19308adff13a4f3ae0138b7deed60944117886d8d1712f8575ec2e127d2` |
| Tables | 292 |
| Migrations | 261 / latest `20260803260000` |
| RLS disabled | `platform_role_catalog` (pre-existing critical advisory) |
| Placements | all `enabled=false` |
| `advertising_global_enabled` | false |
| `real_payouts_enabled` | false |

## 15. Static security inventory

| Check | Result |
| --- | --- |
| Migration chain static SHAs | PASS |
| Repaired function search_path | fixed |
| Repaired function PUBLIC execute | **FINDING** — still granted (pre-existing; out of delimiter-repair scope) |
| Feature / placement defaults | placements off; global advertising off; real payouts off |
| Hosted mutation | BLOCKED |
| `platform_role_catalog` RLS | disabled (pre-existing) |

## 16. Builds and regressions

| Gate | Result |
| --- | --- |
| Typecheck | PASS |
| Advertising delivery security | PASS |
| Payout worker security | PASS (provider/hosted E2E BLOCKED) |
| Account build | PASS |
| Web build | PASS |
| Desktop build | PASS |
| Unit / domain regressions | partial; advertising/partner pgTAP FAIL not claimed PASS |

## 17. Updated manifests

| Artifact | Old SHA | New SHA |
| --- | --- | --- |
| Migration manifest | `318e9b049dc675bafbdc107a0a788c3fda84b9d05c1b5909dde2937105eeb8a1` | `3a41ac5c5248e94af65b1c02f902d573ba8aef54878590ee492092b5716bf016` |
| Release manifest | `e53742cf436336ddbacbfb2b130ccfe73283878797c7fca7fea43fe59ad89b49` | `5d05335491afb3649665cc78bc6b8c47333b0976a21db8401ddfdb3513804380` |
| Release commit | `02d71294…` (stale) / `d68b486e` TASK08 tip | `0384b93ec89c462c80f0d0713beab8f993791ea1` |

## 18. Hosted pre-apply status

| Item | Status |
| --- | --- |
| Hosted migration apply | **not_done** |
| Production mutation env | **BLOCKED** |
| Old `240000` SHA hosted | **not applied** (ACTIVE prod+staging) |
| Production drift | hosted-only `20260803221951` vs repo latest `20260803260000` |

## 19. Remaining blockers

- Production mutation env variables missing
- Backup / restore rehearsal not re-run
- Malware provider E2E BLOCKED
- Payout provider E2E BLOCKED
- Legal / worker external gates BLOCKED
- Full pgTAP FAIL suites
- Hosted storage private-access matrix FAIL
- Pre-existing `platform_role_catalog` RLS disabled
- Pre-existing PUBLIC EXECUTE on `ads_allow_internal_transition` (grant hardening follow-up)
- Dedicated incremental DB fixtures B/C/D not separately instantiated

## 20. Final verdict

**PARTIALLY READY**

Migration syntax chain is repairable and clean-reset green; product RLS suite and hosted/external gates remain open. **Not** `MIGRATION CHAIN READY`. **Not** infrastructure GO. Hosted apply must not proceed.
