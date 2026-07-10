# Enterprise audit export v2 plan

## Status

**Production export disabled.** Enterprise tenancy and immutable organization-wide audit sources are not approved. Existing development serialization preview remains a non-authoritative contract aid and is not exposed in the UI or production.

No audit row may be updated or deleted by export preparation, cancellation, download, expiry, or cleanup.

## Request contract

An export request must contain only:

- format: `json` or `csv`;
- exact scope type and authorized scope ID;
- inclusive start and exclusive end timestamps in UTC;
- allowlisted event categories;
- optional schema version;
- idempotency key.

The backend derives the actor and effective tenant from the authenticated session. It rejects client-supplied actor identity, unbounded time ranges, future ranges, inverted ranges, unsupported categories, and scopes the actor cannot export.

Suggested default/max window: 30/90 days, subject to legal/product approval. Large approved ranges use multiple bounded jobs rather than bypassing limits.

## Permission checks

- Community export: active membership plus `viewAuditLog` and future `exportAuditLogs` permission for that community.
- Organization export: active organization membership, enterprise entitlement, explicit `exportEnterpriseAudit`, and step-up authentication.
- App-level export: audited app-operator permission and step-up authentication.
- Moderator, BillingAdmin, support, bot, webhook, plugin, expired/revoked session, suspended tenant, or renderer feature flag alone grants no export access.

Authorization is checked when requested, when the worker begins, and before every download. RLS/source functions must return only rows inside the exact scope.

## Canonical record

- `schemaVersion`
- `eventId`
- `source`
- `action`
- `occurredAt`
- authorized organization/community scope ID
- pseudonymous/stable actor ID only when required
- `targetType` and bounded stable target ID
- `outcome`, `severity`, request ID
- optional bounded, server-redacted reason

No arbitrary metadata object is included in v1.

## JSON format

Small exports use a versioned JSON object with manifest plus records. Large exports use streamed JSON Lines with a separate manifest. UTF-8, UTC ISO timestamps, deterministic field names, schema version, record count, first/last event time, and SHA-256 checksum are mandatory.

## CSV format

CSV uses a fixed header/order, UTF-8, RFC-compatible quoting, normalized newlines, and explicit null handling. Every field beginning with `=`, `+`, `-`, or `@` is prefixed/escaped according to the approved spreadsheet-safety policy. Formula, delimiter, quote, CR/LF, Unicode, and oversized-cell tests are release gates.

## Redaction

Always exclude:

- passwords/hashes, MFA/recovery/verification values;
- access/refresh/session/LiveKit/bot/webhook/SCIM/invite tokens and hashes;
- cookies, Authorization headers, OAuth codes, SAML assertions, IdP secrets;
- Supabase service-role/database/signing/notarization credentials;
- raw IP, precise location, local/private storage path, signed URL;
- message/private-channel content, attachment bytes, voice/screen media;
- request/response bodies, stack traces, audit integrity secrets.

Redaction occurs server-side before serialization. Redaction failures stop the job; they never fall back to raw output.

## Job and artifact lifecycle

1. Validate entitlement, step-up, scope, range, category, rate limit, and idempotency.
2. Append immutable `audit_export_requested` without query contents or secrets.
3. Persist a short-lived immutable job authorization snapshot.
4. Worker reauthorizes and streams indexed `(scope, occurred_at, id)` pages.
5. Normalize/redact each record and enforce count/byte ceilings.
6. Create manifest/checksum and store encrypted artifact in private tenant-correct region.
7. Append completed/failed event with job ID, count, checksum, and reason code only.
8. Issue one-time or short-lived authorized download; audit access.
9. Expire/revoke/delete artifact under retention policy and append lifecycle event.

Source audit rows are read-only throughout. A correction is a new compensating audit event, never an edit.

## Proposed schema impact

- `enterprise_audit_export_jobs`: scope, range, categories, format, status, actor, authorization version, counts/checksum/error code, lifecycle timestamps.
- `enterprise_audit_export_artifacts`: private storage object reference, region, size, checksum, expiry/deletion state; never a public URL.
- Append-only audit lifecycle events in the authoritative audit source.
- Tenant/time/status/idempotency indexes.

Do not add foreign-key cascades that delete immutable audit evidence. Artifact cleanup is separate from source-audit retention.

## Verification

- cross-tenant and wrong-scope denial;
- revoked/suspended/expired permission denial at request, execution, download;
- time boundary, ordering, pagination, retry/idempotency, size/rate limits;
- redaction corpus and CSV injection tests;
- JSON/CSV schema and checksum reproducibility;
- private storage, region, signed-link expiry/revocation;
- source audit row update/delete denial before and after export;
- lifecycle audit completeness and no secret-bearing diagnostics.

## Approval gates

Runtime remains disabled until organization tenancy, immutable enterprise audit tables, entitlement, step-up auth, private regional storage, retention/legal review, worker operations, incident response, and independent security testing are approved.
