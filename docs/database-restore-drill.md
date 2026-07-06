# Database Restore Drill Runbook

This runbook defines a safe staging-focused restore drill for Picom. It verifies that database backups can be restored and that the Electron desktop app can operate against restored data.

Do not run restore drills against production by default. Do not include real credentials in this document, scripts, screenshots, or logs.

## Drill purpose

- Prove that backups are restorable.
- Practice restore steps before an incident.
- Validate core Picom data integrity after restore.
- Estimate restore duration and recovery confidence.
- Identify tooling gaps before production rollback pressure exists.

## Frequency placeholder

- Beta phase: monthly or before major schema changes.
- Stable production: quarterly at minimum, plus before destructive migrations.
- After failed backup verification: rerun after fix.

## Approval placeholder

Required approvers before staging restore drill:

- Operations owner placeholder
- Database owner placeholder
- Engineering owner placeholder
- Security/privacy owner if sensitive datasets are involved

## Expected duration placeholder

| Phase | Target duration |
| --- | ---: |
| Prepare staging target | 15-30 min |
| Restore backup | 15-60 min depending on size |
| Integrity checks | 15-30 min |
| Application smoke test | 30-45 min |
| Cleanup/report | 15 min |

## Staging restore steps

1. Confirm the target is staging or an isolated temporary development database.
2. Confirm production users will not receive notifications or emails from the restored environment.
3. Confirm backup file/source is the intended backup.
4. Record backup timestamp and source environment.
5. Create or reset a staging restore database.
6. Restore the backup using approved tooling placeholder.
7. Run schema and integrity validation queries.
8. Point a staging backend/API environment to the restored database.
9. Run desktop smoke tests against the restored staging API.
10. Record results, duration, blockers, and follow-up tasks.
11. Destroy temporary restore database only if it is verified non-production and approved.

## Validation queries placeholder

Use read-only checks unless explicitly approved otherwise.

```sql
-- Core table existence placeholders
select count(*) from users;
select count(*) from communities;
select count(*) from channels;
select count(*) from messages;
select count(*) from attachments;
select count(*) from roles;
select count(*) from community_members;
select count(*) from audit_logs;

-- Relationship checks placeholders
select count(*) from messages m left join channels c on c.id = m.channel_id where c.id is null;
select count(*) from channels ch left join communities co on co.id = ch.community_id where co.id is null;
select count(*) from community_members cm left join users u on u.id = cm.user_id where u.id is null;
select count(*) from attachments a left join messages m on m.id = a.message_id where m.id is null;
```

Adapt table names to the active Supabase schema if names differ.

## Data integrity checks

- Auth users/profiles load.
- Communities load.
- Channels load.
- Recent messages load.
- Upload metadata exists.
- Roles/permissions load.
- Audit logs load and remain immutable.
- Community members point to valid users.
- Messages point to valid channels.
- Attachments point to valid messages.
- No private channel policy is loosened by restore configuration.

## Application smoke test after restore

Run against the restored staging environment:

1. Auth login works.
2. Session restore works after app restart.
3. Communities load in ServerRail.
4. Channels load in CommunitySidebar.
5. Recent messages load in MessageList.
6. Send a staging-only test message.
7. Upload a staging-safe image attachment.
8. Roles/permissions prevent unauthorized private channel access.
9. Audit logs can be viewed by authorized admin/owner placeholder.
10. Realtime two-client test works or degraded state is visible.
11. Windows desktop app connects to restored staging API.
12. Linux desktop app connects to restored staging API.
13. macOS desktop app connects if macOS release is in scope.

## Rollback if restore fails

If restore drill fails:

1. Stop the drill and preserve redacted logs.
2. Do not promote releases relying on that backup path.
3. Identify whether failure is backup corruption, tooling mismatch, schema drift, or environment config.
4. Re-run `docs/backup-verification.md` workflow after fixes.
5. Escalate through `docs/incident-response.md` if production recoverability is at risk.
6. Create follow-up owners and due dates in the drill report.

## Drill report template

- Drill date:
- Backup timestamp/source:
- Target environment:
- Duration by phase:
- Restore result: pass/fail/blocked
- Integrity checks result:
- Application smoke result:
- Issues found:
- Follow-up actions:
- Approver sign-off:

## Related documents

- `docs/backup-verification.md`
- `docs/rollback-runbook.md`
- `docs/incident-response.md`
- `docs/staging-smoke-test.md`
- `docs/production-deployment-checklist.md`
