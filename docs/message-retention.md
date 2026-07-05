# Message Retention and Archiving

Picom must treat message and attachment retention as a production safety feature, not as an automatic destructive cleanup shortcut. This foundation documents how retention and archiving should work before any destructive background job is enabled.

## Status

- Runtime deletion job: not enabled
- Production destructive purge: disabled by default
- Current behavior: existing messages and attachments remain unchanged
- Scope: Supabase Postgres message data, attachment metadata, and future storage cleanup coordination
- Desktop UI changes: none

## Goals

- Make message and attachment retention expectations explicit.
- Avoid accidental deletion of active community data.
- Separate message retention from audit log retention.
- Prepare future archiving jobs without running destructive work by default.
- Keep MVP chat flows stable while production policy is finalized.

## Retention setting placeholders

Future retention configuration may include:

```ts
export type RetentionSettings = {
  globalRetentionDays: number | null;
  communityRetentionDays: number | null;
  deletedMessageRetentionDays: number | null;
  attachmentRetentionDays: number | null;
};
```

Placeholder defaults:

- `globalRetentionDays`: `null` means retain until a policy is finalized.
- `communityRetentionDays`: `null` means use global/default policy.
- `deletedMessageRetentionDays`: retain deleted-message metadata long enough for moderation review.
- `attachmentRetentionDays`: must coordinate database metadata and object storage cleanup.

## Data categories

### Active messages

Active messages should not be purged automatically until community-level or app-level policy is reviewed, documented, and tested.

### Deleted messages

Deleted messages may be represented as:

- soft-deleted rows with `deleted_at`
- placeholder body such as deleted message copy
- retained metadata for moderation/audit integrity

Do not purge deleted messages until moderation, audit, and data export implications are clear.

### Attachments

Attachment retention must handle both:

- database metadata rows
- Supabase Storage objects

A future cleanup job must never delete storage objects that are still referenced by non-deleted message attachment rows.

### Audit logs

Audit logs must be retained separately from message retention. Normal message retention jobs must not delete audit logs.

### Reports and moderation context

Reports may reference messages or users. Retention must preserve enough context for moderation review without exposing unnecessary private content.

## Future background jobs

Prepared job names:

- `archiveOldMessages`
- `purgeExpiredDeletedMessages`
- `cleanupExpiredAttachments`

Default behavior:

- local development: dry-run only unless explicitly enabled
- staging: dry-run first, then limited test run with seeded data
- production: disabled until policy, backup, restore, and legal/privacy review are complete

## Dry-run first policy

Every retention job must support a dry-run mode that reports:

- communities scanned
- channels scanned
- candidate messages
- candidate attachments
- storage objects that would be touched
- skipped records and reasons
- errors

Dry-run output must not include message content, tokens, passwords, or signed attachment URLs.

## Safety checks before destructive cleanup

A destructive retention job must verify:

- explicit environment/config flag is enabled
- latest backup verification completed
- target community/global retention policy is active
- candidate rows are older than grace period
- message is not referenced by active reports where retention requires preservation
- attachment storage object is not referenced by an active message
- audit log retention is not affected

## Supabase/RLS considerations

Retention jobs should run server-side with controlled privileges, not from the Electron renderer. Renderer code must not receive service-role keys or storage admin credentials.

RLS remains required for normal user access. Administrative retention jobs must be isolated from user-facing APIs.

## Desktop UI placeholder

Future Community Settings > Privacy/Safety or Advanced may show read-only retention information:

- current retention policy placeholder
- deleted message retention note
- attachment retention note
- contact/support note for data requests

This task does not add UI. The current desktop layout remains unchanged.

## Staging verification

Before production retention:

1. restore or seed staging data
2. run dry-run retention job
3. verify candidate counts
4. run limited destructive test only on staging data
5. verify chat load, search, attachments, reports, and audit logs
6. verify storage objects are not orphaned or over-deleted

## Production rollout

Production retention must require:

- approved retention policy
- backup verification
- restore drill confidence
- dry-run report review
- explicit enable flag
- monitoring and alerting
- rollback/restore decision path

## Rollback limitations

Deleted database rows and storage objects may not be recoverable without backup restore. Rollback must be treated as restore-from-backup or forward-fix, not simple undo.

## Known risks

- Purging messages can break moderation reports.
- Purging attachments can leave message attachment grids broken.
- Storage cleanup can delete the wrong object if paths are not validated.
- Retention policy can conflict with user data export or account deletion requests.
- Audit logs can lose integrity if retention jobs cascade incorrectly.

## Implementation TODOs

- Add retention policy table only after product/legal decision.
- Add dry-run retention Edge Function or backend script.
- Add staging-only destructive test path.
- Add object storage reference checks.
- Add retention status to admin/operations documentation.
