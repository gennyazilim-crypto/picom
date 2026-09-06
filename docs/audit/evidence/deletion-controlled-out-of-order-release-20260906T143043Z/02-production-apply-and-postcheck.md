# PICOM 30-day deletion controlled release — production apply and post-check

**Observed through:** `2026-09-06T14:36:27Z`  
**Production target:** `picom-production` (`cqnsetsmcduraryemhbi`)

## Pre-apply gates

```text
SECOND_HISTORY_SNAPSHOT: 2026-09-06T14:32:42Z
SECOND_HISTORY_COUNT: 312
SECOND_HISTORY_LATEST: 20260906220000
SECOND_HISTORY_CANDIDATES_ABSENT: PASS

FINAL_DRY_RUN: 2026-09-06T14:33:03Z
PICOM_CONTROLLED_OUT_OF_ORDER_MIGRATION_GUARD: PASS
PENDING_COUNT: 2
PENDING_VERSIONS: 20260906120000,20260906130000

FINAL_PRE_APPLY_HISTORY: 2026-09-06T14:33:18Z
FINAL_PRE_APPLY_COUNT: 312
FINAL_PRE_APPLY_LATEST: 20260906220000
FINAL_PRE_APPLY_CANDIDATES_ABSENT: PASS
```

## Authorized exact apply

The official linked command used the sealed controlled exception:

```text
supabase db push --linked --include-all --yes
```

The CLI listed and applied only:

```text
20260906120000_simplified_30_day_deletion.sql
20260906130000_protect_profile_deletion_lifecycle.sql
```

No repair, reset, seed inclusion, manual migration-history edit, or direct SQL
history insertion was used.

## Post-apply verification

```text
POST_APPLY_HISTORY: 2026-09-06T14:34:47Z
REMOTE_COUNT: 314
REMOTE_LATEST: 20260906220000
20260906120000: EXACTLY_ONCE
20260906130000: EXACTLY_ONCE
```

A read-only production public-schema dump verified the installed community and
account lifecycle fields, confirmation-token table with RLS, deletion indexes,
deletion request/cancel/status functions, both bounded finalizer functions,
and the profile lifecycle-protection trigger.

```text
POST_APPLY_SCHEMA: PASS
POST_APPLY_FUNCTIONS_TRIGGERS_INDEXES_RLS: PASS
FEATURE_FLAGS: OFF_UNCHANGED
FINALIZER_SCHEDULERS: OFF_UNCHANGED
```

## Deliberately unrun runtime gates

No approved internal normal-JWT production test identity or approved deletion
test mailbox was available in this release task. Therefore the following are
not inferred from service-role access, schema inspection, or prior hosted test
results:

```text
PRODUCTION_RLS: BLOCKED_NO_APPROVED_NORMAL_JWT_INTERNAL_TEST_IDENTITY
COMMUNITY_CANARY: BLOCKED_NO_APPROVED_INTERNAL_TEST_COMMUNITY
ACCOUNT_CANARY: BLOCKED_NO_APPROVED_NORMAL_JWT_INTERNAL_TEST_IDENTITY
ACCOUNT_EMAIL_DELIVERY: BLOCKED_TEST_MAILBOX
```

The community and account deletion feature flags remain off, and both finalizer
schedulers remain off pending their separate normal-user and worker-runtime
certification. The controlled `--include-all` exception is now closed and
remains forbidden by default for future releases.
