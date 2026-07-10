# Audit log admin review and export

## Access boundary

- The Community Admin Panel exposes Audit Log only when the resolved community permission set includes `viewAuditLog`.
- `auditLogService.list` rejects callers without that permission in UI/mock mode.
- Supabase RLS independently invokes `can_view_community_audit_log(community_id)`; frontend visibility is not security enforcement.
- Export performs a second explicit permission check through `exportForAdmin`. The UI cannot generate a payload for an unauthorized caller and disables empty/unauthorized actions.
- Owner/admin status does not bypass database RLS. A custom role must receive the approved permission through existing role policy.

## Review and export behavior

Authorized admins can filter the bounded latest record set by actor identifier, action type, and 7/30-day/all-time range. Copy and JSON download export only the filtered records, with:

- format version;
- export timestamp;
- bounded record count;
- sanitized community, actor, target, reason, and timestamp fields.

The export does not include message content, attachment content/paths, email, IP address, session/auth tokens, cookies, authorization headers, API/service keys, passwords, or provider secrets. IDs are normalized to a conservative character set and free-text fields pass through central secret/control-character redaction.

## Immutability

- Review/export is read-only.
- `auditLogService` exposes append, list, and export; it has no update/delete/truncate method.
- Database mutation privileges remain revoked and the append-only trigger rejects normal update/delete operations.
- Export does not mark, mutate, redact-in-place, delete, or change retention of source records.
- Retention is a separate approved process and normal community/account/message flows do not delete audit entries.

## Privacy and operational handling

- An export is sensitive administrative evidence even after redaction.
- The desktop download stays user-initiated and local; Picom does not upload it to a support/provider endpoint.
- Admins should store exports in approved access-controlled locations, avoid public issue trackers, and remove them under the approved retention policy.
- Clipboard exports can be observed by other local applications; use file export only when necessary and clear clipboard according to local policy.
- Very large production exports should move to a server-side asynchronous, permission-revalidated, encrypted, expiring download. The current client export is deliberately bounded.

## Manual checklist

1. Owner/admin with `viewAuditLog`: open Community menu > Admin panel > Audit Log and verify records load.
2. Filter by actor, action, and date; verify list and exported `recordCount` match.
3. Copy and download; inspect JSON for format version and absence of secrets/private content.
4. Use a member/moderator without `viewAuditLog`; verify the section is absent and direct list/export calls are denied.
5. Insert a mock reason containing `token=...`, `Authorization: Bearer ...`, a control character, and overlong text; verify UI/export shows redaction and length bounds.
6. Verify no update/delete controls exist and database append-only/RLS tests reject mutation and cross-community reads.
7. Verify object URLs are revoked after download and repeated exports do not grow memory.

## Automated checks

- `npm run audit-logs:admin-review:test`
- `npm run audit-logs:immutability:smoke`
- Supabase RLS/pgTAP tests in an isolated project when CLI is available.
