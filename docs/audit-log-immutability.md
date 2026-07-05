# Audit log immutability plan

Picom needs trustworthy audit logs for moderation, app-operator actions, ownership changes, security events, and future enterprise review. Audit logs are not fully production-implemented in the MVP, so this document defines the required immutability model before enabling broad admin/moderation actions.

## Goals

- Make audit logs append-only.
- Prevent normal app flows from editing or deleting audit entries.
- Keep sensitive fields out of audit metadata.
- Preserve audit integrity across soft delete, account deletion, moderation, and community ownership changes.
- Keep user-facing errors separate from redacted developer diagnostics.

## Append-only policy

Audit logs should be created once and never updated by normal application routes.

Allowed operation:

- `insert` through trusted SQL RPC, Edge Function, or backend service boundary.

Disallowed operations:

- direct client-side `update`
- direct client-side `delete`
- destructive cleanup jobs
- user-triggered account deletion erasing audit rows
- community deletion cascading audit rows

If a correction is required, create a new compensating audit entry instead of mutating the original entry.

## Suggested audit log fields

- `id`
- `community_id` nullable
- `actor_user_id` nullable
- `target_type`
- `target_id` nullable
- `action`
- `reason` nullable
- `metadata` jsonb with redacted safe values only
- `request_id` nullable
- `created_at`

Do not store:

- passwords
- password reset tokens
- session tokens
- auth headers
- cookies
- Supabase service-role keys
- LiveKit secrets
- raw invite tokens beyond a short redacted preview
- private message content unless a moderation workflow explicitly requires a safe excerpt policy

## RLS and permissions

Future audit log RLS should enforce:

- app operators can view app-level audit summaries only after app-admin authorization exists
- community owners/admins can view audit entries for their own community if permitted
- normal members cannot read audit logs
- users cannot insert arbitrary audit rows from the renderer
- no authenticated user can update/delete audit entries

## Database protection notes

When the table is added:

- enable RLS immediately
- grant `select` narrowly through policies
- do not grant client `update` or `delete`
- prefer `security definer` SQL functions for writes
- keep audit table foreign keys `on delete set null` or store immutable identifiers to avoid accidental cascade deletion
- add indexes for `(community_id, created_at desc)`, `(actor_user_id, created_at desc)`, and `(target_type, target_id, created_at desc)` only when runtime query patterns need them

## Relationship to loggingService

`loggingService` is for renderer diagnostics and support logs. It already redacts passwords, tokens, cookies, authorization headers, private keys, LiveKit/Supabase secret-like values, and session-like values.

Audit logs should use the same redaction principle:

- developer diagnostics may include redacted technical context
- user-facing errors must stay friendly and non-technical
- audit metadata must not become a secret dump

## Retention

Audit retention should be separate from message retention:

- message retention jobs must not purge audit logs
- account deletion should anonymize user-facing profile data while preserving audit integrity
- production retention windows require legal/privacy review before enforcement

## Export placeholder

Future audit export should:

- require app-admin or community-owner/admin permission
- redact sensitive metadata
- include export request audit entries
- produce checksummed artifacts if used for compliance review
- avoid exporting raw private messages unless explicitly approved by policy

## Implementation checklist before production

- Add `audit_logs` schema with append-only design.
- Add insert-only trusted function.
- Add RLS policies.
- Add tests proving normal authenticated clients cannot update/delete audit rows.
- Add redaction tests for metadata.
- Add admin/community audit viewer only after authorization is ready.
- Add backup/retention policy.

## Current MVP status

- Audit log policy is documented.
- `loggingService` redaction is centralized.
- Runtime audit log table and viewer are not production-enabled yet.
- Placeholder moderation/report/community ownership features must not claim immutable audit coverage until the backend table and policies exist.
