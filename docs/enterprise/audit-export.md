# Enterprise Audit Export Foundation

## Status

Production enterprise audit export is **disabled**. Picom currently has a community-scoped audit viewer/export and separate local security/account event foundations; it does not have a trusted organization-wide export job, private artifact storage, or enterprise entitlement.

`enterpriseAuditExportService` provides a bounded development-only serialization preview. It is not wired to UI, cannot run in production, does not fetch records, and cannot grant access. The backend/RLS must remain authoritative.

## Goals

- Export authorized community audit logs, enterprise admin actions, and security events for review.
- Support machine-readable JSON and spreadsheet-compatible CSV.
- Preserve append-only audit integrity and record every export lifecycle event.
- Enforce organization/community boundaries before querying or serializing data.
- Exclude secrets, message content, raw request payloads, and unnecessary personal data.

## Sources and boundaries

### Community audit logs

Examples: community/channel updates, role/member changes, moderation actions, invite lifecycle, webhook administration, and discovery review. Community owners/admins may export only communities where `viewAuditLog` is granted and RLS permits access. Moderators do not receive enterprise-wide exports.

### Enterprise/admin actions

Examples: organization policy, verified domain, SSO/SCIM provider, admin role, export, retention/legal hold, and emergency security actions. These require organization/app-admin permission and do not belong in normal community exports.

### Security events

Examples: session revocation, repeated failed login summary, rate-limit event, suspicious upload, unauthorized private-channel attempt, provisioning denial, and credential rotation. Export only safe event facts and identifiers; never export credentials or private evidence by default.

Account activity visible to a user remains separate from enterprise administrative export unless policy, permission, and privacy review explicitly include it.

## Permission model

Every request must include an authenticated actor and one exact scope:

- `community`: requires membership plus `viewAuditLog`/`exportAuditLogs` for the requested community.
- `organization`: requires active organization membership and explicit enterprise audit export permission.
- `app`: restricted to audited Picom app operators with step-up authentication.

Rules:

- Determine tenant/scope from server-side authorization, never a renderer flag alone.
- Query only rows inside that scope; do not fetch broadly and filter in Electron.
- RLS must protect source tables, and a trusted backend worker must repeat authorization at job execution time.
- Export permission does not grant message, attachment, member personal-data, or secret access.
- Legal hold/retention roles do not automatically grant export permission.
- Every request, completion, failure, download, expiry, and deletion creates an append-only audit event.

## Canonical record shape

Initial allowlisted fields:

- schema version
- event ID and source (`community_audit`, `admin_action`, `security_event`)
- normalized action and timestamp
- scoped organization/community ID where permitted
- actor pseudonymous/stable ID when required
- target type and stable target ID
- request ID
- outcome and severity
- bounded redacted reason

Do not include arbitrary metadata objects in v1. Add any future field through schema/privacy/security review.

## Redaction and exclusions

Always exclude:

- passwords, hashes, MFA/recovery/email verification values;
- access/refresh/session/LiveKit/webhook/bot/SCIM tokens or token hashes;
- cookies, authorization headers, SAML assertions, OAuth codes, IdP metadata secrets;
- Supabase service-role keys, database credentials, signing/notarization keys;
- raw IP addresses, precise location, local filesystem paths, private storage paths/URLs;
- message bodies, private channel content, attachment bytes, voice/screen content;
- full request/response bodies and stack traces;
- invite secrets and audit-internal integrity secrets.

Reason text is length-bounded and control characters are removed. CSV fields are quoted/escaped to reduce spreadsheet formula and delimiter hazards; a production exporter must additionally guard formula-leading cells and document consumer behavior.

## Formats

### JSON

Versioned object containing export timestamp, scope, scope ID, and normalized records. Production large exports should use JSON Lines or streamed chunking rather than building one renderer string.

### CSV

Fixed header/order and RFC-compatible quoted values suitable for review. UTF-8 encoding, timestamp format, null handling, and spreadsheet formula escaping must be tested across supported tooling.

Neither format includes raw source metadata by default.

## Production job lifecycle

1. Authorized user requests format, exact scope, time range, and approved categories.
2. Backend performs step-up/entitlement/permission checks and appends `audit_export_requested`.
3. A short-lived idempotent job stores immutable authorization context and bounded query criteria.
4. Worker reauthorizes, streams scoped rows, normalizes/redacts server-side, and computes checksum.
5. Artifact is encrypted/private in a tenant-correct storage region.
6. Backend appends completed/failed event with record count/checksum, never artifact contents.
7. User receives a one-time/short-lived authorized download, not a public URL.
8. Download is audited; artifact expires and is deleted according to approved retention/legal hold.

Renderer code displays job status and invokes a safe download service only. It never receives provider credentials or chooses storage paths.

## Performance and abuse controls

- Require bounded time range, categories, record count, and artifact size.
- Paginate/stream by indexed scope plus timestamp and stable ID.
- One active job per scope/user placeholder; rate limit requests/downloads.
- Reject excessively broad or repeated jobs with a clear code.
- Isolate worker resources so export cannot degrade chat/realtime.
- Detect unexpected count/size and stop before producing an overbroad artifact.

## Current safe placeholder

`src/services/enterpriseAuditExportService.ts`:

- accepts only caller-supplied, typed allowlisted records;
- requires explicit `canExport` and matching scope;
- bounds previews to 500 records;
- normalizes timestamps/text and generates JSON or CSV;
- operates only when `import.meta.env.DEV` is true;
- reports `productionEnabled: false`;
- performs no database query, download, upload, persistence, or UI action.

It is a contract/test aid, not a security enforcement layer.

## Verification requirements

- Cross-tenant community/organization/app export denial tests
- Normal member/moderator/expired-session/revoked-admin denial tests
- RLS direct query tests for every source table
- Redaction fixtures for every forbidden key/value category
- CSV injection/delimiter/newline and JSON schema tests
- Time-range/pagination/idempotency/rate-limit/large-export tests
- Private storage, signed download expiry, region, retention, and delete tests
- Append-only request/completion/failure/download audit evidence
- Restore/backup and incident response for export artifacts

## Related documents

- `docs/audit-log-immutability.md`
- `docs/enterprise/sso-saml-design.md`
- `docs/enterprise/scim-provisioning-design.md`
- `docs/data-residency.md`
- `docs/deletion-policy.md`
- `docs/privacy/data-retention-enforcement.md`

