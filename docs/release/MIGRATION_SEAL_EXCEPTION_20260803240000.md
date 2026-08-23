# Migration Seal Exception — 20260803240000

| Field | Value |
| --- | --- |
| Filename | `20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql` |
| Original LF SHA-256 | `91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9` |
| Corrected LF SHA-256 | `ca8f0de91b8ed06021046ce2992eac2e1fffc028f3cc909f7da3c69a79bb461e` |
| Exact defect | Invalid single-dollar delimiters `as $` / `$;` on `ads_allow_internal_transition` |
| Exact changed lines | 742 (`as $` → `as $$`), 744 (`$;` → `$$;`) |
| Reason | Clean `supabase db reset` fails with SQLSTATE 42601; additive later migrations cannot run |
| Functional behavior unchanged | Yes — delimiter-only repair; body/search_path/language unchanged |

## Hosted history evidence (read-only)

| Environment | Ref | Status | Latest migration | `20260803240000` present? | `ads_allow_internal_transition` |
| --- | --- | --- | --- | --- | --- |
| Production | `cqnsetsmcduraryemhbi` | ACTIVE_HEALTHY | `20260803173000` | **false** | absent |
| Staging | `ufmtvqtsklqsmqxefbbs` | ACTIVE_HEALTHY | `20260803172000` | **false** | absent |
| Staging-v2 | `kbdotviopwlcqviggtrc` | INACTIVE | unreachable (connection timeout) | **not in accessible history** | n/a |

**SAFE_TO_REPAIR_UNAPPLIED_SEALED_MIGRATION = true** for all accessible ACTIVE projects (production + staging). Staging-v2 is INACTIVE and SQL/list_migrations timed out; no ACTIVE project has `20260803240000`.

Authorization reference: TASK 08B user task (sealed advertising migration repair).

## Rollback implications

- Do not re-introduce `as $` / `$;`.
- If a future environment somehow recorded old SHA content without applying (impossible via normal apply), treat as incident; never `migration repair` without dual control.
- Hosted apply remains separately gated; this exception does not authorize production mutation.

## Post-repair evidence

- Clean reset: **PASS** — exit 0, latest `20260803260000`, 261 migrations, no skip/repair
- Function contract: without GUC `false`; with `picom.ads_internal=1` `true`
- Schema fingerprint SHA: `c871a19308adff13a4f3ae0138b7deed60944117886d8d1712f8575ec2e127d2`
- Repair commit / new RC: `0384b93ec89c462c80f0d0713beab8f993791ea1`
- New migration manifest SHA: `3a41ac5c5248e94af65b1c02f902d573ba8aef54878590ee492092b5716bf016`
- New release manifest SHA: `5d05335491afb3649665cc78bc6b8c47333b0976a21db8401ddfdb3513804380`
- Prior TASK08 migration manifest SHA (superseded): `318e9b049dc675bafbdc107a0a788c3fda84b9d05c1b5909dde2937105eeb8a1`
- Prior TASK08 release manifest SHA (superseded): `e53742cf436336ddbacbfb2b130ccfe73283878797c7fca7fea43fe59ad89b49`
- Closure audit: `docs/audit/picom-task08b-migration-chain-closure.md`
- Audit timestamp: 2026-08-04
