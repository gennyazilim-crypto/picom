# Data Corruption Detection Plan

Picom stores community chat data across Supabase/Postgres, Storage, Realtime, and local desktop caches. This plan defines read-only checks for detecting corrupted or inconsistent data before users notice broken communities, missing messages, or permission leaks.

Checks are read-only by default. Auto-fix must never run without explicit confirmation and a reviewed runbook.

## Detection scope

Monitor these corruption patterns:

- Messages without valid channel.
- Channels without valid community.
- Community members without valid user.
- Roles missing default Member role.
- Communities without owner.
- Attachments without message.
- Read states pointing to invalid channels.
- Duplicate `clientMessageId` issues.
- Invalid permission JSON or malformed permission arrays.
- Orphaned uploads in object storage.

## Read-only SQL placeholders

Adapt table/column names to the active Supabase schema before running.

```sql
-- messages without valid channel
select m.id from messages m left join channels c on c.id = m.channel_id where c.id is null;

-- channels without valid community
select ch.id from channels ch left join communities co on co.id = ch.community_id where co.id is null;

-- community members without valid user
select cm.id from community_members cm left join users u on u.id = cm.user_id where u.id is null;

-- communities without owner
select co.id from communities co left join community_members cm on cm.community_id = co.id and cm.user_id = co.owner_id where co.owner_id is null or cm.id is null;

-- roles missing default Member role
select co.id from communities co where not exists (select 1 from roles r where r.community_id = co.id and lower(r.name) = 'member');

-- attachments without message
select a.id from attachments a left join messages m on m.id = a.message_id where m.id is null;

-- read states pointing to invalid channels
select rs.id from read_states rs left join channels c on c.id = rs.channel_id where c.id is null;

-- duplicate clientMessageId values
select client_message_id, count(*) from messages where client_message_id is not null group by client_message_id having count(*) > 1;
```

## Invalid permission JSON placeholder

If permissions are stored as `jsonb` or arrays:

- Verify permissions are arrays/objects of known permission keys.
- Reject unknown keys in future write paths.
- Report rows with invalid shapes for manual review.
- Do not auto-rewrite role permissions without owner/admin approval.

## Orphaned uploads

Object storage checks should compare storage objects against attachment metadata.

- Objects without attachment rows are candidates for cleanup.
- Attachment rows without accessible storage objects should be reported.
- Private channel attachment objects must never be made public during repair.
- Cleanup must require explicit confirmation and dry-run output first.

## Script placeholder

Use:

```bash
npm run data:integrity:check
```

The current script is read-only and prints the check plan. Future database-backed implementation should require a staging/production target and should default to dry-run.

Do not run auto-fix unless a future command requires explicit confirmation such as:

```bash
$env:PICOM_DATA_INTEGRITY_FIX_CONFIRM="reviewed-manual-fix"
```

## Alerting placeholder

Create an alert or operations ticket when:

- Any private-channel access relationship is inconsistent.
- Messages/channels/communities have orphaned core relations.
- Duplicate client message IDs are detected in confirmed messages.
- Permission JSON cannot be parsed or contains unknown permission keys.
- Orphaned uploads exceed cleanup threshold placeholder.

## Response steps

1. Stop destructive cleanup jobs.
2. Snapshot affected IDs and counts.
3. Verify backup state using `docs/backup-verification.md`.
4. Determine if the issue is schema, migration, code, RLS, or storage-policy related.
5. Fix via reviewed migration or manual maintenance script only.
6. Run staging smoke and targeted production read-only checks after mitigation.
7. Use `docs/incident-response.md` if user data or private channel access may be affected.

## Related documents

- `docs/database-integrity.md` if present
- `docs/backup-verification.md`
- `docs/database-restore-drill.md`
- `docs/incident-response.md`
- `docs/rollback-runbook.md`
