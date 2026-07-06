# Enterprise audit export

Picom may support enterprise audit log export in a future enterprise operations track. This document defines the safe export model, security boundaries, and verification requirements. It does not expose a production export endpoint and does not change current audit log behavior.

## Status

Placeholder architecture only. Existing audit logs remain append-oriented and should not be deleted or mutated by normal application flows.

## Goals

- Allow authorized enterprise administrators to export audit events later.
- Preserve audit log integrity and immutability expectations.
- Exclude secrets, tokens, passwords, raw authorization headers, and unnecessary private content.
- Support incident response, compliance review, and customer security reviews.
- Keep export behavior compatible with Windows, Linux, and macOS desktop support workflows.

## Non-goals

- No export endpoint is implemented in this task.
- No enterprise admin console is exposed.
- No audit log mutation or deletion path is added.
- No third-party SIEM integration is enabled.
- No real customer data, credentials, or production secrets are included.

## Future permission model

Audit export should require one of:

- app-level admin permission
- enterprise organization owner permission
- explicit exportAuditLogs permission

Community moderators should not receive full enterprise audit exports. Community-level audit views must remain scoped to communities the user is allowed to manage.

## Export scope

Allowed export categories:

- authentication events
- session revocation events
- community admin actions
- role and permission changes
- moderation actions
- invite lifecycle events
- upload safety events
- abuse event summaries
- webhook/bot security events placeholder
- SCIM/SSO administrative events placeholder

Excluded export content:

- passwords and password hashes
- access tokens and refresh tokens
- webhook tokens and token hashes
- SAML assertions or SCIM authorization headers
- private message bodies unless explicitly covered by a future legal/compliance policy
- raw uploaded file contents
- private keys, signing certificates, and production secrets

## Export formats

Initial formats should be simple and reviewable:

- JSON Lines for machine ingestion
- CSV for compliance review
- ZIP bundle placeholder for multi-file exports

Each record should include:

- eventId
- eventType
- actorId placeholder
- targetId placeholder
- organizationId or communityId
- timestamp
- requestId placeholder
- redacted metadata
- source service

## Redaction policy

Metadata must be redacted before export. Redaction should remove or mask:

- tokens
- passwords
- authorization headers
- IP addresses if privacy policy requires hashing/masking
- email addresses where not required
- raw message content unless explicitly permitted
- file paths from local machines

Redaction must happen server-side before data reaches the desktop renderer.

## Export lifecycle

Future flow:

1. Authorized user requests export.
2. Backend records audit_export_requested.
3. Backend creates an export job with a scoped query.
4. Export worker streams redacted records into private storage.
5. Backend records audit_export_completed or audit_export_failed.
6. User receives a short-lived signed download URL.
7. Export expires automatically.

Normal users should never receive export download URLs for enterprise audit bundles.

## Storage and retention

- Exports should be private by default.
- Signed URLs should expire quickly.
- Export artifacts should have a defined retention window.
- Export deletion should be audited.
- Legal hold may override export artifact cleanup only when explicitly configured.

## Security assumptions

- Database RLS and backend service authorization must scope query access.
- Desktop UI is not trusted for export filtering.
- Export jobs must enforce organization/community boundaries server-side.
- Export artifacts must not be stored in public buckets.
- Download URLs must not appear in logs or diagnostics.

## Verification checklist

- Unauthorized users cannot request exports.
- Moderator cannot export enterprise-wide logs.
- Export contains redacted metadata only.
- Export excludes tokens, passwords, secrets, and raw auth headers.
- Export job creates audit events for requested/completed/failed states.
- Expired export links no longer work.
- Private community boundaries are respected.

## Risks and TODOs

- Overbroad exports can leak private community data.
- Retention laws may conflict with customer deletion expectations.
- SIEM integrations require rate limiting and delivery retry policies.
- Export performance must be tested against large audit tables.
- Legal hold policy should be finalized before long-term enterprise export retention.
