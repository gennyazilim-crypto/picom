# PICOM 30-day deletion controlled out-of-order release manifest

**Manifest status:** `SEALED`  
**Sealed at:** `2026-09-06T14:30:43Z`

## Release scope

```text
RELEASE_MODE: SOLO_FOUNDER_LOW_RISK_FORWARD
RISK_CLASS: LOW_RISK_FORWARD_WITH_DESTRUCTIVE_FEATURE_DORMANT
COORDINATION_MODE: SOLO_OPERATOR_STABLE_WINDOW
EXCEPTION: CONTROLLED_OUT_OF_ORDER_MIGRATION_RELEASE
WHY_INCLUDE_ALL_REQUIRED: approved migration versions precede an already-applied remote latest version
INCLUDE_ALL_SCOPE: 20260906120000,20260906130000 only
NO_GENERAL_INCLUDE_ALL_PRECEDENT: true
```

The feature flags and finalizer schedulers are off. The migration only installs
the guarded lifecycle; no finalizer schedule is activated by this release.

## Canonical source and target

```text
CANONICAL_SOURCE_HEAD: 9e10d33fde03d6b926551f188698bf32421c0a86
CANONICAL_RELEASE_TAG: picom-canonical-production-deletion-out-of-order-apply-20260906T142727Z
TARGET_PROJECT: picom-production
TARGET_REF: cqnsetsmcduraryemhbi
TARGET_REGION: eu-central-1
```

## Immutable migration set

| Ordered version | File | LF-normalized SHA-256 |
| --- | --- | --- |
| `20260906120000` | `simplified_30_day_deletion.sql` | `6C09430E47183B990D13A4F9D6214AE8738732AAA4A96026CAF146828A819FA5` |
| `20260906130000` | `protect_profile_deletion_lifecycle.sql` | `A3C74397554070FF45C03C609FB0F5D33906CDDA73E885F963757E3AEA1E3138` |

## Required gates

```text
CANONICAL_HISTORY: GO_EXACT_RECONCILED
UNEXPLAINED_REMOTE_MIGRATIONS: 0
PRE_DRY_RUN_HISTORY: count=312; latest=20260906220000; 120000=absent; 130000=absent
DELETION_SCHEMA_COMPATIBILITY: GO
HOSTED_PGTAP: PASS 41/41
HOSTED_RLS: GO
PITR: GO
FEATURE_FLAGS: OFF
FINALIZER_SCHEDULERS: OFF
```

The read-only compatibility review confirmed the current `profiles` lifecycle
columns and Account Center profile RPCs. The candidate migrations contain no
top-level table/column drop or `TRUNCATE`; their destructive capability is
inside separately disabled finalizer paths.

## Controlled CLI proof

The official linked command was:

```text
supabase db push --linked --include-all --dry-run
```

The complete output was consumed by
`scripts/controlled-out-of-order-migration-release-guard.mjs`. It recorded:

```text
PICOM_CONTROLLED_OUT_OF_ORDER_MIGRATION_GUARD=PASS
pendingCount=2
pendingVersions=20260906120000,20260906130000
```

The worktree-local, comments-only compatibility shim for already-applied
legacy version `20260808220000` was verified ignored and removed after the
dry-run. It is not canonical source, cannot be pending, and cannot execute.

## Operator and residual governance facts

```text
OPERATOR_TYPE: AUTHENTICATED_SOLO_FOUNDER_RELEASE_OPERATOR
OPERATOR_SCOPE: SUPABASE_ORGANIZATION_OWNER_CURRENTLY_BROADER_THAN_IDEAL
SECURITY_DEBT: CREATE_DEDICATED_SCOPED_RELEASE_PRINCIPAL
TWO_PERSON_CONFIRMATION: NOT_REQUIRED_SOLO_FOUNDER_POLICY
RESTORE_DRILL_CURRENT: PENDING_PERIODIC_DR_CERTIFICATION
NO_ENFORCEABLE_CROSS_OPERATOR_FREEZE: true
```

## Final apply boundary

Before any apply, the release operator must read migration history again and
confirm count `312`, latest `20260906220000`, and both approved versions absent.
The official `--include-all --dry-run` command must then pass the same exact-set
guard again. Any difference aborts the release; no repair, reset, seed,
manual history mutation, or non-sealed migration is permitted.
