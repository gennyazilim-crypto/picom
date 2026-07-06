# Enterprise legal hold placeholder

Picom may support enterprise legal hold in a future compliance track. Legal hold is a preservation control for scoped data. It must not become a shortcut for broader data access, private channel bypass, or hidden surveillance.

## Status

Placeholder only. No legal hold runtime, admin UI, database schema, or destructive job override is implemented by this task.

## Goals

- Define how legal hold should interact with retention, exports, audit logs, and deletion workflows.
- Preserve scoped data when legally required.
- Keep access controls and RLS boundaries intact.
- Prevent accidental destructive deletion while a hold is active.
- Document risks before implementation.

## Non-goals

- No legal hold creation endpoint is added.
- No enterprise admin console UI is exposed.
- No messages, attachments, or audit logs are copied.
- No private data access is expanded.
- No legal advice or compliance guarantee is provided.

## Legal hold principles

- Preservation is not authorization.
- Legal hold must pause deletion/purge for scoped records only.
- Users and admins still need proper permissions to view data.
- Legal hold changes must be auditable.
- Legal hold scope, owner, reason, and review dates must be explicit.
- Secrets, passwords, tokens, and private keys must never be stored in hold metadata.

## Scope model placeholder

Future legal hold records may include:

- holdId
- organizationId
- communityId optional
- userIds optional
- channelIds optional
- messageDateRange optional
- attachmentScope optional
- reasonCode
- descriptionRedacted
- createdById
- approvedById placeholder
- startsAt
- expiresAt optional
- releasedAt optional
- releaseReason placeholder
- createdAt
- updatedAt

Raw legal documents should not be stored in the normal app database unless a separate secure document retention system is designed.

## Data affected by legal hold

Potentially preserved:

- messages and deleted-message metadata
- attachments and thumbnails
- audit logs
- abuse events
- account activity
- membership and role history
- export metadata

Not preserved through normal legal hold metadata:

- passwords
- tokens
- private keys
- raw auth headers
- local desktop cache
- ephemeral typing/presence state

## Retention interaction

Legal hold should override destructive retention for matching data, but only after the backend confirms hold scope.

Behavior:

- Retention dry run must mark held records as excluded.
- Purge jobs must fail closed if hold lookup is unavailable.
- Hold release should not immediately delete data without a normal retention job review.
- Hold state changes must create audit entries.

## Export interaction

Legal hold may require future export support, but exports remain permission-protected.

Rules:

- Export requests must still be authorized.
- Exported artifacts must be redacted according to export policy.
- Signed URLs must expire.
- Export creation and download must be audited.

## Desktop behavior

The desktop app should not enforce legal hold locally. Future UI may show limited enterprise admin status, but:

- normal users should not see hold metadata unless policy allows it
- local cache clearing should remain allowed for non-essential client cache
- desktop diagnostics must not include held private content
- offline clients should not perform destructive retention actions

## Audit events

Future events:

- legal_hold_created
- legal_hold_updated
- legal_hold_released
- legal_hold_scope_changed
- legal_hold_retention_override_applied
- legal_hold_export_requested
- legal_hold_export_completed

Audit metadata must be redacted and must not include legal secrets or privileged legal advice.

## Verification checklist

- Retention job excludes held records.
- Hold release is audited.
- Unauthorized users cannot create, view, update, release, or export holds.
- Private channel access rules still apply.
- Held records are not exposed through normal search to unauthorized users.
- Local desktop cache operations do not modify server legal hold state.

## Risks and TODOs

- Legal hold requirements vary by jurisdiction and contract.
- Overbroad holds can retain more private data than necessary.
- Poor access controls can leak sensitive legal metadata.
- Retention and export policies must be finalized before production legal hold.
- A lawyer-reviewed compliance process is required before offering this feature.
