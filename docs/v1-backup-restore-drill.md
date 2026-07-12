# Picom V1 Isolated Backup, Restore, and Lifecycle Drill

Status date: 2026-07-12
Overall result: **PARTIAL / BLOCKED**
Database restore and database lifecycle: **PASS**
Full Storage/Auth/application recovery: **BLOCKED**

## Safety boundary

- Source is the dedicated synthetic staging snapshot from project `ufmtvqtsklqsmqxefbbs`, migration `20260710258000`.
- Evidence and dumps remain outside the repository under the local Picom staging-backup directory.
- Target image was `public.ecr.aws/supabase/postgres:17.6.1.141` in a unique temporary container.
- The container used `--network none`, published no port, used a synthetic local password, and was removed after every attempt.
- Existing Docker projects and all production systems were untouched.
- SQL used `ON_ERROR_STOP`; no dump statement, constraint, index or policy error was ignored.

## Immutable source

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 610,634 | `530587CCBAA6BC6C5034102D4938CEEA8E9762C48ABEFA7D919BF999D79BB88E` |
| `public-data.sql` | 42,434 | `D33F1B01DFF3341A95C9DEE98EAABF5711A8DEA85E3EB44389E358526460813E` |
| `auth-storage-data.sql` | 36,708 | `9E46D8FCE8EFEEA0660C3359D41702E8F3A92FEACDEAC70E8368F4824AB92625` |
| `roles.sql` | 297 | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |

## Compatible restore sequence

1. Create a fresh database from `template0` inside the versioned Supabase image.
2. Create schema `extensions` and install `pg_trgm` into that schema so `extensions.gin_trgm_ops` exists.
3. Use the provider `supabase_admin` actor; replaying the dump as restricted `postgres` cannot satisfy `SET ROLE`.
4. Restore provider role settings, schema, public data, then Auth/Storage metadata.
5. Stop on the first error; do not rewrite reserved roles or remove failed indexes.
6. Run read-only integrity/RLS checks before lifecycle fixtures.

All four restore stages passed in approximately 11 seconds for this small synthetic snapshot.

## Restored row-count evidence

| Data set | Rows |
| --- | ---: |
| Profiles / Auth users | 27 / 27 |
| Communities / memberships / roles | 5 / 20 / 20 |
| Channels / messages / attachments | 10 / 8 / 2 |
| Message reactions / read states | 0 / 0 |
| Friendships | 0 |
| Direct conversations / participants / messages | 0 / 0 / 0 |
| Auth sessions | 5 |
| Storage buckets / metadata objects | 5 / 2 |

Zero-row tables were restored correctly but required additional synthetic fixtures to exercise lifecycle behavior.

## Integrity and privacy evidence

All measured orphan counts were zero for channels, communities, owners, members, roles, messages, attachments, reactions, read states, DM conversations/messages/attachments and participants. Checked sensitive tables all retained RLS; 11 DM policies existed. All five Storage buckets remained private and no bucket was public.

A non-member fixture actor saw zero rows for a private channel, its message, a DM conversation and its DM message. A DM participant saw exactly one fixture conversation and message. No private data was made public during restore.

## Destructive lifecycle evidence

Rollback-scoped synthetic checks passed for:

- `delete_message_with_version` RPC and message tombstone;
- independent attachment delete;
- `revoke_community_invite` RPC;
- DM soft delete and conversation/participant/message/attachment/reaction cascade;
- ownership transfer at the database boundary;
- leave/kick plus active ban insertion;
- channel deletion with message/attachment cascade fallback;
- deleted-user anonymized placeholder fields;
- Auth session deletion, refresh-token revoke flag and device-session revoke timestamp;
- forward/forward-fix DDL create, alter, insert and drop.

Evidence log: `%LOCALAPPDATA%\Picom\staging-backups\20260710-230450\task624-picom-restore-task624-5a0a280f.log`. It contains operation names/statuses only, not IDs, credentials or row content.

## Unresolved full-recovery blockers

1. The SQL dump restores Storage bucket/object metadata, not the two object byte payloads. Provider-supported object backup, restore, checksum parity, private access and signed URL behavior remain unproven.
2. Database session rows and refresh-token flags were mutated successfully, but no isolated GoTrue service tested login, refresh, already-issued access-token expiry/rejection or session restore.
3. Full Electron/API smoke against the restored target, Realtime subscriptions and release-scoped Edge Functions were not executed.
4. Production backup tier/PITR, retention, owners, encryption/recovery custody and restore SLA remain unapproved.

RB-11 therefore remains open. These are real data-loss/access risks and cannot be converted to PASS by the database-only drill.

## Reproduction

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/v1-isolated-backup-restore-drill.ps1 `
  -BackupPath "<local synthetic staging backup directory>" `
  -ConfirmSyntheticStaging
```

The script is intentionally bound to the immutable synthetic snapshot hashes. A new approved snapshot requires a reviewed manifest update, not bypassing the guard.
