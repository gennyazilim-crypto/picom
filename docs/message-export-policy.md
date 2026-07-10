# Message export admin policy

Status: **policy draft; production export is not approved or enabled**. Picom's existing local placeholder must not generate files, query broad message history, create signed URLs, or imply that an administrator may export content. Implementation requires product, privacy/legal, security and operations approval plus hosted authorization tests.

## Purpose and separation

An administrative message export is a narrowly scoped operational workflow for an approved community purpose. It is separate from a user's account data export, audit-log export, backup/restore, moderation evidence access and ordinary search. Community ownership does not create an unrestricted surveillance or bulk-download right.

Before access is granted, the owner must document purpose, target channel(s), date range, format, recipients, retention, lawful basis/notice where applicable and a responsible operator. Exports for employee monitoring, profiling, advertising, credential discovery, unrelated investigations or cross-community aggregation are prohibited.

## Authorization

- Requester must be authenticated, an active member of the target community and hold a dedicated backend-enforced `exportMessages` permission. `manageCommunity` alone is not sufficient for production.
- Owner/admin UI visibility is only a convenience. A trusted backend/Edge Function must check the effective role and channel overrides at request, job execution and download.
- A private-channel export requires current `canViewChannel` access to every selected channel. Being owner/admin must not silently bypass explicit private-channel denial or tenant boundaries.
- Suspended, banned, deleted, session-revoked or downgraded requesters cannot request or download. Permission loss cancels pending access.
- Large, multi-channel, sensitive or extended-range exports should require a second authorized approver and step-up authentication after those controls exist.
- App-admin/support access is not implied. Emergency access requires a separately audited support/security process.

## Scope and private-channel boundaries

The backend resolves channel IDs from the authorized community and ignores client-supplied community identity. It uses bounded date ranges, cursor reads, explicit row/byte caps and a stable policy version. Every message, reply and attachment is included only when the requester can still view its channel. No private channel name, topic, member list, message count or existence may leak in errors or job metadata.

Threads inherit the parent channel boundary. Deleted/archived channels remain unavailable unless a separately approved restoration/evidence workflow authorizes them. Public-read visitor access never grants export permission. Direct messages are outside this community export policy.

## Content and redaction

Allowed output after approval may contain the minimum necessary message ID, channel label, author display name or `Deleted User`, visible body, created/edited timestamp, deleted marker, visible reply context and safe attachment metadata. IDs should be omitted or pseudonymized when not operationally necessary.

Always exclude:

- deleted message bodies, hidden reactions/polls and removed attachment URLs;
- content from inaccessible channels, blocked/quarantined attachments and private profile/activity fields;
- password/token/key/session/cookie/authorization-header/invite/webhook/signing material;
- Supabase/LiveKit/provider internals, raw storage paths, signed URLs, IP addresses, device fingerprints and internal moderation notes;
- report/appeal identity or audit/security evidence not explicitly authorized by a separate workflow.

Automated secret/PII redaction is defense in depth, not permission to export excessive content. Redaction failures fail the job closed. CSV formula injection, HTML/script injection and spreadsheet encoding require format-specific escaping. HTML stays disabled until sanitization and CSP review are complete.

## Audit without content

Append-only audit events record request, approval/denial, job start/completion/failure/cancellation, permission re-check and download/expiry. Audit metadata is limited to opaque job ID, requester/approver IDs, community/channel IDs or safe counts, bounded date range, format, policy version, result code and timestamps. It never stores message text, filenames, attachment URLs, secrets, the generated archive or broad user lists.

Normal users cannot edit/delete audit events. Message retention/deletion must not cascade into audit logs; audit retention has its own approved schedule.

## Export artefact lifecycle

Generated archives must use private regional storage with encryption, malware-safe generation, integrity checksum and non-guessable object paths. Download uses a short-lived, single-purpose signed URL after a fresh authorization check; URLs never enter logs or analytics. No public bucket, email attachment or renderer-side archive generation is permitted.

Jobs and artefacts have explicit expiry, cancellation and secure cleanup. Backups, retries, failed partial files and CDN caches must follow the same disposition. Operators receive only safe status/error codes. A suspected leak revokes access, deletes/restricts the artefact where lawful, preserves limited incident evidence and follows the incident-response process.

## Approval and rollout gates

Production remains blocked until all are complete:

1. Privacy/legal approval of purpose, lawful basis, community/member notice, data-subject rights, jurisdiction, retention and administrator responsibilities.
2. Dedicated permission and step-up/approval design; no `manageCommunity` fallback.
3. Trusted asynchronous job, private storage, bounded output, expiry, cleanup and audit implementation.
4. RLS/backend adversarial tests for owner/admin/moderator/member/visitor, private channels, permission changes, cross-community IDs and revoked sessions.
5. Redaction/injection tests, attachment access tests, load/cost limits, monitoring, incident response and restore/deletion review.
6. Clear desktop confirmation and status UI that states scope, purpose, expiry and sensitive-data handling without exposing content in notifications/logs.

Until these gates pass, the existing menu action remains explicitly labeled as a placeholder and must not produce a downloadable artefact.
