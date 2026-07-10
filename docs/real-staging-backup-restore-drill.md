# Real Staging Backup, Restore, and Destructive Lifecycle Drill

Status date: 2026-07-10  
Result: **PARTIAL / BLOCKED**

## Safety boundary

- Source: dedicated synthetic `picom-staging` project only.
- Project ref: `ufmtvqtsklqsmqxefbbs`; region: `eu-west-1`.
- Source migration: `20260710258000`.
- No production project, production user, or production secret was accessed.
- Evidence is stored outside the repository under `%LOCALAPPDATA%\Picom\staging-backups\20260710-230450`.

## Real export evidence

Supabase CLI `2.109.1` produced provider-compatible SQL dumps after Docker `29.4.2` became available.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 610634 | `530587CCBAA6BC6C5034102D4938CEEA8E9762C48ABEFA7D919BF999D79BB88E` |
| `public-data.sql` | 42434 | `D33F1B01DFF3341A95C9DEE98EAABF5711A8DEA85E3EB44389E358526460813E` |
| `auth-storage-data.sql` | 36708 | `9E46D8FCE8EFEEA0660C3359D41702E8F3A92FEACDEAC70E8368F4824AB92625` |
| `roles.sql` | 297 | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |

The data dump warned about circular foreign keys involving `messages`, `direct_messages`, and `threads`. This is a restore-planning risk, not a successful restore result.

## Restore attempts

| Attempt | Result | Evidence |
| --- | --- | --- |
| Raw Supabase Postgres container as `postgres` | FAIL | `permission denied for schema auth` |
| Raw Supabase Postgres container as `supabase_admin` | FAIL | managed Auth schema mismatch: `auth.users.is_sso_user` missing |
| Supabase CLI local stack | BLOCKED | port `54322` is allocated by unrelated `Nexus_app`; that project was not stopped or modified |

Each temporary restore container used a `picom-restore-drill-*` name and was removed in `finally`. No failed target was promoted or treated as verified.

## Destructive lifecycle

Not executed. Account deletion/anonymization, ownership transfer/delete, leave/kick/ban, message/attachment deletion, invite/verification/DM/audio lifecycle and session revocation require a successfully restored isolated target first.

## Required closure

1. Provision an isolated Supabase-compatible restore target with matching managed Auth/Storage schema versions and non-conflicting ports.
2. Restore roles, schema, Auth/Storage metadata, and public data with a reviewed circular-FK strategy.
3. Run the read-only integrity matrix and compare row counts.
4. Verify Auth-linked profiles, RLS, private Storage objects, Realtime, and Edge behavior.
5. Only then run destructive lifecycle cases and cleanup the target.

RB-11 remains open. Stable release is **No-Go**.