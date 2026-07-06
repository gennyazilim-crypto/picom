# Enterprise data retention policy

Picom may offer enterprise-specific data retention controls in a future enterprise/compliance track. This document defines retention principles, safe defaults, and implementation guardrails. It does not enable destructive retention jobs and does not delete any data.

## Status

Policy placeholder only. Existing MVP data behavior remains unchanged. No production purge, archive, or irreversible deletion workflow is enabled by this task.

## Goals

- Define enterprise retention categories before implementation.
- Separate message/content retention from audit/security retention.
- Prevent accidental destructive deletion.
- Preserve legal hold and incident-response needs.
- Keep desktop clients predictable across Windows, Linux, and macOS.

## Non-goals

- No runtime retention enforcement is added.
- No destructive background job is enabled.
- No enterprise admin UI is exposed.
- No customer-specific legal promise is made.
- No data is deleted, archived, exported, or moved.

## Data categories

Enterprise retention should define categories separately:

- messages
- message edits/deletions metadata
- attachments
- thumbnails and image derivatives
- reactions
- read states
- notifications
- audit logs
- abuse events
- account activity
- community membership and roles
- invites
- exports
- local desktop cache and diagnostics

## Default policy stance

Initial enterprise defaults should be conservative:

- Do not hard-delete messages by default.
- Soft-delete user-visible deleted messages where needed.
- Keep audit logs append-only and retained separately.
- Keep security events longer than normal notifications.
- Expire temporary exports and signed URLs quickly.
- Never use local desktop cache as the retention source of truth.

## Retention settings placeholder

Future organization-level settings may include:

- messageRetentionDays
- attachmentRetentionDays
- deletedMessageRetentionDays
- notificationRetentionDays
- auditLogRetentionDays
- abuseEventRetentionDays
- exportArtifactRetentionDays
- legalHoldEnabled
- retentionPolicyVersion
- updatedById
- updatedAt

Values should be validated server-side. The desktop app may display policy information but must not be trusted to enforce retention.

## Legal hold interaction

Legal hold must pause destructive retention for scoped data.

Rules:

- Legal hold should override normal deletion timers for relevant records.
- Legal hold changes must be audited.
- Users should not be able to bypass legal hold by local cache clearing.
- Legal hold should not expose private data to unauthorized users.
- Legal hold scope must be explicit and reviewable.

## Destructive job requirements

Before enabling any purge/archive job:

- Policy must be approved.
- Backup and restore drill must pass.
- Dry-run mode must be available.
- Deletion candidate counts must be reviewed.
- Legal hold exclusions must be verified.
- Audit entries must be written.
- Rollback limitations must be documented.

Production destructive jobs should default to disabled until explicitly enabled with a deployment flag and operator approval.

## Desktop behavior

The desktop app should:

- show policy information in enterprise/admin settings later
- avoid promising that local cache controls delete server data
- clear local non-essential cache only on user action
- not store secrets in local retention metadata
- handle missing/deleted content with clear fallback copy

## Security and privacy requirements

- Retention jobs must not log message bodies or attachment contents.
- Deletion reports should contain counts and IDs only where necessary.
- Audit logs should exclude secrets and tokens.
- Private channel access rules still apply to retained or archived data.
- Export artifacts must expire according to export retention policy.

## Verification checklist

- Retention policy changes are restricted to authorized admins.
- Retention dry run reports candidate counts without deleting data.
- Legal hold prevents destructive purge of scoped records.
- Audit logs remain available according to audit retention policy.
- Deleted/anonymized users do not break audit integrity.
- Desktop cache clear does not affect server retention state.

## Risks and TODOs

- Retention laws vary by region and customer contract.
- Aggressive deletion can break moderation, audit, and incident response.
- Long retention increases privacy and breach impact risk.
- Attachment derivatives and thumbnails require separate cleanup rules.
- Enterprise legal review is required before offering production retention guarantees.
