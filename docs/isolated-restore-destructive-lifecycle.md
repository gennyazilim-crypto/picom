# Isolated Restore and Destructive Lifecycle

Status date: 2026-07-11  
Result: **PARTIAL / BLOCKED**

## Source backup verification

The synthetic staging export exists outside the repository under the Picom local application-data backup area. Recomputed SHA-256 values match the Task 414 inventory:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 610,634 | `530587CCBAA6BC6C5034102D4938CEEA8E9762C48ABEFA7D919BF999D79BB88E` |
| `public-data.sql` | 42,434 | `D33F1B01DFF3341A95C9DEE98EAABF5711A8DEA85E3EB44389E358526460813E` |
| `auth-storage-data.sql` | 36,708 | `9E46D8FCE8EFEEA0660C3359D41702E8F3A92FEACDEAC70E8368F4824AB92625` |
| `roles.sql` | 297 | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |

Source database and `pg_dump` version are PostgreSQL 17.6. No dump or credential was committed.

## Isolated execution environment

- Docker Engine: 29.4.2.
- Image: `public.ecr.aws/supabase/postgres:17.6.1.141`.
- Every attempt used a generated `picom-restore-task429-*` container and random free host port.
- Existing Nexus, qchat, LiveKit, and other containers were not stopped or modified.
- Every temporary restore container was removed in `finally` cleanup.
- Redacted logs remain only in the local Picom application-data evidence area.

## Restore attempts

| Attempt | Result |
| --- | --- |
| Restore roles into initialized `postgres` DB | BLOCKED: `anon` is a provider-reserved role |
| Keep provider-managed roles, restore schema into initialized DB | BLOCKED: managed `auth.users.is_sso_user` version mismatch |
| Restore into fresh `picom_restore` DB | Progressed to indexes, then BLOCKED: `extensions` schema absent |
| Bootstrap `extensions` schema in fresh DB | Progressed to indexes, then BLOCKED: `extensions.gin_trgm_ops` absent |

The final error demonstrates that a bare fresh database is still not a Supabase-compatible restore target until the provider extension bootstrap, including `pg_trgm` operator classes, matches the source environment. No automatic SQL rewrite or ignored error was used.

## Lifecycle contract remediation

Three stale/broken deterministic contracts were corrected without changing deletion semantics:

- Soft-delete coverage now validates the version-checked `delete_message_with_version` RPC and tombstone mapping instead of a removed direct update chain.
- Export/deletion coverage now validates the current allowlist, bounded rows, excluded secret categories, Edge request, and central logging-redaction module.
- The existing owner-only ownership-transfer placeholder is mounted in Community Admin Danger Zone.

The following now pass:

- deletion policy smoke,
- compliance export/deletion smoke,
- community ownership-transfer smoke,
- typecheck,
- production build,
- full QA smoke.

## Destructive lifecycle result

No destructive database lifecycle was executed because a complete isolated restore never became available. Account deletion, session revoke, community transfer/delete, leave/kick/ban, channel/message/attachment/invite/verification/DM/audio lifecycle and post-mutation integrity remain unproven against restored data.

## Required closure

1. Provision an approved Supabase-compatible isolated target with the exact Auth/Storage/extension bootstrap version.
2. Restore provider roles according to provider guidance rather than replaying reserved-role mutations.
3. Restore schema and all data without ignored errors.
4. Compare migration metadata and redacted row counts.
5. Run orphan/private-data/RLS/Storage integrity checks.
6. Execute destructive lifecycle cases and verify recovery.

RB-11 remains open. Stable release remains No-Go.

## Task 624 closure attempt

The compatibility sequence was completed without weakening the dump: fresh `template0` database, `extensions` schema, `pg_trgm` installed into `extensions`, and restore through `supabase_admin`. Roles, full schema, public data, and Auth/Storage metadata all restored. Core/auth counts, orphan checks, RLS/private visibility, message-delete and invite-revoke RPCs, and 13 database lifecycle assertions passed. All changes ran against synthetic data in a no-network/no-port container and the container was removed.

This closes the prior schema/extension restore defect. It does not close end-to-end recovery: two Storage metadata rows do not prove object bytes can be recovered, and database session deletion/revocation does not prove a running GoTrue service rejects already-issued credentials. Stable V1 remains No-Go under RB-11 until those external checks pass.

