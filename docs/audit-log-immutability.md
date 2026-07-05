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

## Centralized error and diagnostics boundary

Audit logging must not replace the existing user-facing error flow.

Required separation:

- user-facing UI shows concise, friendly messages through the shared error formatting path
- renderer/developer diagnostics go through `loggingService` with redaction applied
- future backend/Edge Function diagnostics should use the same redaction rules before persistence
- immutable audit rows store event facts and safe identifiers, not stack traces or raw request payloads

Audit entries may reference:

- `request_id`
- `actor_user_id`
- `community_id`
- `target_type`
- `target_id`
- normalized action names
- safe enum/status values
- redacted metadata

Audit entries must not include:

- full authorization headers
- cookies
- Supabase JWTs
- LiveKit tokens
- password reset or email verification tokens
- raw uploaded file paths that expose private storage internals
- full private message bodies unless a reviewed moderation evidence policy exists

## Immutability enforcement plan

When `audit_logs` is implemented, immutability should be enforced in multiple layers:

- database grants: no renderer/client role receives `update` or `delete`
- RLS: no authenticated user policy allows mutation after insert
- insert boundary: writes happen through trusted RPC, Edge Function, or backend service only
- service code: no generic update/delete helper should target audit logs
- migrations: avoid `on delete cascade` from users, communities, messages, or moderation targets into audit logs
- operations: cleanup scripts must explicitly skip audit log tables unless a separately approved retention job exists

Correction model:

- incorrect audit entry remains stored
- a follow-up `audit_correction_recorded` entry explains the correction
- viewer UI should show correction chains instead of editing original rows

## RLS test expectations

Future Supabase RLS tests should prove:

- normal authenticated users cannot select audit rows outside permitted scope
- normal authenticated users cannot insert arbitrary audit rows
- normal authenticated users cannot update audit rows
- normal authenticated users cannot delete audit rows
- community admins can read only community-scoped rows they are allowed to view
- app admins can read app-level rows only after app-admin authorization exists
- service-role or Edge Function insertion redacts sensitive metadata before write

These tests must use safe fake values only. Do not add real tokens, cookies, secrets, or private user data to fixtures.

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
- Add a release-gate check that audit log mutation policies are still deny-by-default.
- Add incident-response notes for suspected audit tampering.

## Current MVP status

- Audit log policy is documented.
- `loggingService` redaction is centralized.
- Runtime audit log table and viewer are not production-enabled yet.
- Placeholder moderation/report/community ownership features must not claim immutable audit coverage until the backend table and policies exist.
