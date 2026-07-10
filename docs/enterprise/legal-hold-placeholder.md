# Legal Hold Placeholder

## Status

Legal hold is not part of Picom's consumer MVP and no hold can currently be created or enforced. This document is architecture and risk guidance for a possible future enterprise capability. Implementation requires jurisdiction-specific legal, privacy, security, records-management, and customer-contract review.

## Meaning

A legal hold is an authorized instruction to preserve narrowly defined potentially relevant records when litigation, investigation, regulatory inquiry, or another formal duty makes ordinary deletion/retention rules inappropriate. It is not a general archive, employee-monitoring feature, backup substitute, or unrestricted administrator export.

Only a validated enterprise organization with reviewed contractual controls could use it. Picom must not let a community owner create a legally represented hold merely because they manage a community.

## Potentially preserved records

A reviewed hold scope may cover:

- messages and immutable edit/delete state;
- attachment objects, metadata, scan/quarantine state, and integrity identifiers;
- relevant append-only audit records;
- bounded membership/role/channel metadata needed to interpret the records;
- export manifests and chain-of-custody events.

Passwords, auth/session/bot/webhook/LiveKit tokens, service credentials, signing keys, authorization headers, unrelated private communities, raw diagnostic logs, and data outside the approved matter scope must never be included.

Deleted content should not silently reappear in normal user UI. Preservation storage and access are separate from product-visible restore behavior. Audit logs have their own retention and integrity policy and must not be mutated to represent a hold.

## Scope model placeholder

A hold would need an immutable matter ID, organization, legal basis/reference, authorized requester/approver, start/effective dates, reviewed custodians or community/channel/time ranges, record categories, jurisdiction/region, status, reason, periodic review date, release authorization, and append-only lifecycle events.

Scope must be least-privilege and explicit. Broad wildcards, retroactive expansion, cross-tenant selection, and private-channel inclusion require additional approval. Data residency constraints apply to preserved copies and keys.

## Admin controls

Controls belong in a restricted enterprise compliance console, not the normal community menu. Required controls include dual approval, strong re-authentication, explicit scope preview, conflict warnings, case-reference validation, start/suspend/release workflow, periodic review, export approval, access revocation, and content-free operational status.

Normal app admins, community owners, moderators, support staff, bots, webhooks, plugins, and desktop renderer code cannot manage or query holds. Backend authorization and tenant isolation are mandatory; frontend hiding is not enforcement.

## Preservation and deletion behavior

- Normal retention/purge jobs consult a backend hold decision before final deletion.
- Held records are preserved in immutable or write-protected storage with encryption and integrity checks.
- Non-held records continue normal minimization and deletion.
- Account deletion/export workflows return clear legally reviewed status without exposing the matter or other users' data.
- Releasing a hold resumes normal retention; it does not necessarily delete immediately and requires documented disposition review.
- Backups require documented hold coverage and expiration strategy; indefinite backup retention is not acceptable.

## Audit and chain of custody

Append-only records cover proposal, approval, scope/version changes, preservation jobs, failed preservation, access, export, transfer, integrity verification, and release. Record actor, matter ID, bounded target identifiers, timestamp, result, and request/export identifiers. Never log preserved content, secrets, or unrestricted query text.

Exports require encrypted delivery, short-lived access, recipient verification, manifest/hash, region controls, download/access audit, and expiration/revocation.

## Privacy and user rights

Legal hold conflicts with minimization, retention promises, access/deletion requests, employee privacy, confidentiality, and cross-border transfer duties. Legal review determines lawful basis, notice, disclosure restrictions, duration, subject rights, processor/subprocessor terms, and whether notification may be delayed. Picom must not promise secrecy or override rights without approved legal authority.

Access is need-to-know, time-bounded, regularly reviewed, and separated from product administration. Metrics contain only safe aggregate job health, never matter content or custodian identity.

## Failure and incident handling

Fail closed on unclear scope, authorization, tenant boundary, region, or storage integrity. A preservation miss, over-collection, unauthorized access, premature deletion, leaked export, or broken chain of custody is a security/legal incident requiring containment and counsel escalation. Do not auto-repair or expand scope silently.

## Implementation gates

- Final legal requirements and customer contract/DPA.
- Enterprise organization and SSO/admin control maturity.
- Tenant/data-residency model and retention enforcement.
- Dedicated hold schema, immutable storage, encryption/key ownership, and restore semantics.
- Dual-control authorization, append-only audit, export custody, monitoring, and incident runbooks.
- RLS/backend boundary, cross-tenant negative tests, backup/restore/retention tests, and independent security review.
- Support/compliance operating process with trained named owners.

Until every gate is met, UI, API, retention jobs, and exports must not claim legal hold support.
