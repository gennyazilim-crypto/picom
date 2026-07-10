# Task 169 checkpoint: Data retention enforcement

## Result

- Reviewed message/attachment and entity deletion policies.
- Defined separate retention/enforcement paths for active/deleted messages, attachment metadata/objects/thumbnails, local/backend logs, security events, audit logs, backups, exports, and support bundles.
- Added a guarded dry-run CLI placeholder with zero candidates.
- Confirmed `--apply` is blocked without explicit environment and confirmation inputs and remains intentionally unimplemented even with both.
- Kept audit logs out of message retention and added no destructive job or renderer privilege.

## Validation

- `npm run retention:plan`
- `npm run retention:enforcement:test`
- `npm run message-retention:smoke`
- `npm run audit-logs:immutability:smoke`
- `npm run uploads:cleanup:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Approved retention periods, policy schema/RLS, legal holds, trusted worker/queue, verified backup/restore drill, staging dry-run/apply evidence, monitoring/on-call, and production change approval are required before enforcement.
