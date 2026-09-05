# Post-Failure Read-Only Verification — Desktop Notifications

## Atomicity result

The migration began with an explicit transaction. After the SQL failure, safe
read-only checks confirmed that it did not commit:

```text
REMOTE_MIGRATION_20260904100000: ABSENT
public.notifications.notification_type: ABSENT
notifications_recipient_dedupe_key_once_idx: ABSENT
FEATURE_FLAG: UNCHANGED_OFF
```

The compatibility shim for the already-applied legacy remote version
`20260808220000` was removed from the release worktree after verification and
was never committed or executed.

## Follow-up boundary

The original notification migration remains unapplied and must not be edited in
place if a new release is prepared. A new reviewed forward migration, fresh
tests, a new SHA/manifest, and a new exact-one dry-run are required before any
subsequent production attempt.
