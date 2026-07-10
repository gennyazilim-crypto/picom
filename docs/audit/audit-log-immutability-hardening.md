# Audit Log Immutability Hardening

## Enforced model

`public.audit_log` is append-only. Authenticated/public/anon roles have no INSERT, UPDATE, DELETE, or TRUNCATE table privilege. Authorized clients append through the narrow `append_community_audit_log` security-definer RPC; community owner/admin/view-audit/moderation/invite authorization is rechecked in the database.

A `BEFORE UPDATE OR DELETE` trigger rejects mutation even if a future privileged route accidentally attempts it. Corrections are new compensating entries that reference the original target; the original row remains unchanged. Table foreign keys use `ON DELETE RESTRICT`, preventing normal user/community deletion from erasing history.

No normal update/delete API or renderer service exists.

## Bounded metadata and redaction

Rows contain community/actor/action/target IDs, an allowlisted action constrained by schema, bounded safe target type, optional bounded reason, and creation time. Target type is 1-80 alphanumeric/underscore/colon/hyphen characters. Reason is at most 500 characters.

Database RPC and renderer mock/export paths remove control characters and redact Bearer credentials and secret-like `password`, `token`, `secret`, `authorization`, `cookie`, and API-key values. Do not use reason as a free-form request dump.

Never store passwords/hashes, auth/session/refresh/verification/recovery tokens, cookies/headers, Supabase/LiveKit/bot/webhook/storage/signing secrets, private keys, raw IP, device fingerprint, message/file content, signed URLs, raw storage/local paths, stack traces, or full request/response bodies.

## Trust boundary

Supabase is authoritative. The local mock log is mutable localStorage for UI development and is not compliance evidence. UI permission flags are not authorization; RLS/database RPC decides reads/writes. Service-role access does not bypass the append-only trigger without an explicit reviewed migration/maintenance action.

## Viewing

Community-scoped SELECT remains RLS-gated through `can_view_community_audit_log`. Ordinary members cannot read. App-level enterprise export/operations paths use separate app-admin controls and must not broaden community log RLS.

Account anonymization may preserve immutable actor identifiers or a stable deleted-actor reference according to approved privacy/legal design; it does not rewrite action history. Community deletion is restricted until audit disposition is explicitly handled.

## Export policy

Exports require current `viewAuditLog`/owner or app-admin authorization, re-authentication for enterprise use, bounded date/community/action scope, redaction, row limit/pagination, request audit, checksum/manifest, encrypted short-lived delivery, recipient verification, and expiry/revocation.

The renderer helper exports at most 5,000 already-authorized rows with format version and re-redacts reason/target type. It is a local JSON convenience, not signed compliance evidence. It never includes message bodies, credentials, raw private evidence, or hidden rows.

## Retention

Audit retention is independent from message/attachment retention and normal account deletion. No destructive job is enabled. Production duration, legal hold interaction, user-right response, data residency, backup restore, and eventual approved purge require legal/privacy/security review. Any future purge must be a separately authorized, audited operational process, not a normal route.

## Integrity and operations

Future tamper evidence may chain row hashes/sign periodic roots into separate protected storage, but this is not implemented and should not be claimed. Current trust relies on PostgreSQL constraints, restricted privileges, append-only trigger, RLS, backups, access logging, and change-controlled migrations.

A failed audit append for an operation that requires audit atomicity should fail the transaction; webhook delivery already performs message/audit insert together. Suspected missing/mutated rows, disabled trigger, privilege drift, restore gap, or export leak is a security incident.

## Verification

Run `npm run audit-logs:immutability:smoke`, `npm run supabase:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Staging tests:

- member cannot SELECT; owner/authorized admin sees only permitted community;
- authenticated cannot direct INSERT/UPDATE/DELETE/TRUNCATE;
- service-role UPDATE/DELETE hits trigger;
- RPC permission/action/target validation and reason redaction;
- correction creates a second row;
- account/community/message deletion does not cascade audit rows;
- export scope/redaction/limit/checksum workflow;
- backup/restore retains exact rows and indexes.

## Remaining gates

Supabase CLI is required for live pgTAP/behavior verification. Hash-chain/tamper-evident roots, final retention window, signed enterprise export, and operational access monitoring remain future work; current documentation does not claim compliance certification.
