# Data residency plan

Picom currently targets a Windows, Linux, and macOS desktop MVP backed by Supabase and LiveKit. The MVP should be treated as a single-region deployment until production infrastructure, legal review, and customer requirements define otherwise.

This document is a planning artifact. It does not implement multi-region routing, data movement, or regional compliance guarantees.

## Current assumption

- Picom operates from one primary backend region.
- Supabase Auth, Postgres, Storage, Realtime, and Edge Functions are assumed to live in the same primary Supabase project region.
- LiveKit voice and screen sharing are assumed to use one configured deployment/region or provider default.
- Desktop clients connect to the configured API/realtime/storage/voice endpoints without region selection.
- Backups, logs, diagnostics, and exported support bundles may inherit the region of the service that stores them.

## Data categories

User and community data includes:

- account profile data
- community membership and roles
- channel metadata
- messages and replies
- reactions and mentions
- image attachment metadata
- Supabase Storage objects
- audit/security events
- diagnostics and redacted logs
- LiveKit session metadata placeholder

Data that must never be treated as portable without review:

- authentication secrets or session tokens
- password reset or verification tokens
- private channel messages
- private channel attachments
- audit logs
- moderation evidence
- account deletion/export records

## Future regional model

A future data residency design may introduce:

- community-level `region` assignment
- organization/workspace-level region assignment for enterprise customers
- per-region Supabase projects or databases
- per-region object storage buckets
- per-region LiveKit deployments
- region-aware Edge Functions and API routing
- restricted cross-region analytics/diagnostics exports
- region-aware backup and restore workflows

The default future rule should be:

- community data stays in the community assigned region
- user account identity may remain global only if legal review accepts that model
- private messages and attachments must not be replicated across regions unless explicitly required and documented
- audit logs should stay with the region of the community/action they describe

## Supabase considerations

Supabase Auth:

- Verify whether auth metadata can be region-bound in the chosen architecture.
- Avoid storing unnecessary personal data in auth user metadata.
- Keep profile data in region-controlled tables where possible.

Supabase Postgres:

- Define one source of truth per community region.
- Avoid cross-region joins for private/community data.
- Use RLS policies consistently in every regional database.
- Ensure migrations are applied per region with the same release process.

Supabase Storage:

- Use region-specific buckets or projects for attachments if required.
- Private channel attachments must follow the same region and access rules as their channel messages.
- Signed URL generation must happen in the region that owns the object.

Supabase Realtime:

- Realtime channels should connect to the region that owns the community/channel.
- Cross-region presence should be avoided until a clear global presence design exists.

Edge Functions:

- Functions that read or write regional data should execute against the correct regional project.
- Do not pass service-role secrets to the desktop renderer.

## LiveKit considerations

Voice and screen sharing may require a different regional strategy than messages:

- choose LiveKit regions close to participants when possible
- document whether media packets leave the community data region
- keep voice room metadata minimal
- avoid recording by default unless retention and residency policies are defined
- document macOS/Windows/Linux permission behavior separately from residency

## Backups and restore

Backup policy must document:

- backup storage region
- backup retention period
- encryption expectations
- who can restore backups
- restore drill frequency
- whether backups can cross regions
- how account deletion interacts with backup retention

Before production multi-region support:

- verify backup restore in staging for each region
- document rollback limitations for regional migrations
- ensure audit logs are included without allowing normal mutation/deletion

## Logs and diagnostics

Logs and diagnostics should be privacy-minimized:

- use `loggingService` redaction rules in the desktop app
- do not log passwords, tokens, cookies, authorization headers, Supabase service-role keys, or LiveKit secrets
- support diagnostics exports should be user-controlled and redacted
- production logs should be tagged with service region if available
- avoid sending private message content to centralized logging

## Migration risks

Moving from single-region to multi-region can break assumptions around:

- user identity lookup
- community switching
- realtime room naming
- private channel access checks
- attachment signed URLs
- message search
- notification fanout
- audit log queries
- account deletion/export workflows

Mitigation plan:

- introduce region metadata before routing changes
- keep read-only migration reports before moving data
- test with staging communities first
- maintain compatibility for older desktop clients during migration windows
- document rollback limits before moving production data

## Legal and compliance review placeholders

Before claiming data residency support, Picom needs review for:

- applicable user regions and customer requirements
- data processor/subprocessor list
- backup retention and deletion obligations
- law enforcement/data request handling
- audit/export requirements
- incident notification timelines
- LiveKit/media routing disclosures

This document is not legal advice.

## MVP status

- Data residency is documented as a future architecture concern.
- No multi-region routing is implemented.
- No production residency guarantee is claimed.
- Current MVP remains single-region by configuration.
- Future implementation must keep Supabase RLS, storage access controls, logging redaction, and desktop compatibility intact.
