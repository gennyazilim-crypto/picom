# Task 326 - Content deletion and retention user messaging

Status: implemented.

- Deleted messages remain in conversation order as content-free placeholders.
- Missing/anonymized authors display as `Deleted User`; another member is never substituted.
- Privacy & Safety explains current retention, purge, audit, backup, cache and account-deletion behavior.
- Normal message deletion remains a soft-delete; no destructive retention job was enabled.
- Final public retention periods and legal language remain pending review.

Validation:
- `npm run content:deletion:messaging:test`
- `npm run messages:editing-conflicts:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
