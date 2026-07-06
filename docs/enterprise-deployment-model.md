# Enterprise deployment model

This document describes a future enterprise deployment model for Picom, an Electron desktop community chat app for Windows, Linux, and macOS. It separates staging, beta, and production assumptions and defines verification, rollback, and known-risk areas.

## Status

Documentation-only deployment model. No production infrastructure, secrets, certificates, or deployment automation are added by this task.

## Goals

- Describe how enterprise customers could run Picom safely in controlled environments.
- Separate desktop release, Supabase backend, LiveKit/WebRTC, storage, and operational dependencies.
- Define staging, beta, and production deployment expectations.
- Keep rollback and verification requirements visible.
- Avoid hardcoding risky production values.

## Non-goals

- No managed enterprise hosting platform is implemented.
- No self-host installer is produced.
- No customer-specific infrastructure templates are added.
- No production auto-update is enabled.
- No SSO, SCIM, billing, or enterprise admin console runtime is added.

## Deployment layers

Picom enterprise deployment has several logical layers:

- Desktop clients: Windows, Linux, and macOS Electron packages.
- Supabase project: Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.
- LiveKit deployment: voice and screen share signaling/media.
- Object storage: attachment and thumbnail delivery through Supabase Storage or equivalent.
- Monitoring: backend health, desktop crash-free sessions placeholder, realtime stability, upload success, auth failures.
- Support tooling: logs export, diagnostics, incident response, rollback runbooks.

## Environment model

### Local development

- Uses local mock mode and optional Supabase development configuration.
- No production secrets.
- Destructive scripts default to dry-run or require explicit flags.
- Electron dev mode is acceptable for UI/runtime iteration.

### Staging

- Mirrors production schema and RLS as closely as possible.
- Uses staging Supabase and LiveKit credentials only.
- Requires staging smoke test before release promotion.
- Should run database migration, backup verification, auth, messages, uploads, realtime, and voice checks.
- Can use test accounts and sanitized data.

### Beta

- Uses production-like backend with controlled user access.
- Release rings should follow safe rollout guidance.
- Known issues must be documented.
- Rollback and kill-switch procedures must be ready before inviting testers.
- Support triage should be active.

### Production

- Requires signed desktop artifacts where applicable.
- Requires verified database backup and restore path.
- Requires monitoring/alerting tied to SLOs.
- Requires incident response, rollback, and Go/No-Go approval.
- Requires secret management and access review.

## Enterprise hosting options placeholder

Potential future models:

- Picom-managed cloud: Picom operates Supabase/LiveKit/storage for customers.
- Customer-dedicated cloud: separate backend project per enterprise customer.
- Customer-managed backend placeholder: customer owns infrastructure with Picom deployment guidance.

Each model changes support, compliance, data residency, backup ownership, and incident response obligations.

## Desktop release model

Enterprise desktop clients should define:

- release channel
- minimum supported backend compatibility
- checksum/provenance metadata
- platform package format
- installer smoke test status
- rollback package availability placeholder

The app should not silently run against unsupported backend versions.

## Backend deployment model

Production deployment should verify:

- environment variables
- Supabase project configuration
- RLS policies
- Edge Functions
- Storage buckets and access rules
- LiveKit token endpoint
- health/readiness endpoints
- logging redaction
- rate limits

## Verification checklist

Before enterprise production launch:

- Staging smoke test passes.
- Production deployment checklist is complete.
- RLS/private channel tests pass.
- Backup verification has been run.
- Restore drill has been run in staging.
- Windows package install smoke passes.
- Linux package install smoke passes.
- macOS package install smoke passes if distributed.
- No mobile UI is introduced.
- No Discord branding/assets/exact colors are present.

## Rollback model

Rollback must consider:

- desktop app rollback to previous signed package
- backend service rollback
- database migration rollback limitations
- feature flag/kill switch rollback
- object storage compatibility
- realtime event compatibility
- user communication and support impact

Database rollback may not be safe after destructive or shape-changing migrations. Backup verification must happen before risky migrations.

## Known risks

- Enterprise customers may need data residency before launch.
- SSO/SCIM expectations can exceed current placeholder state.
- LiveKit media quality differs by network policy and region.
- Desktop packaging behavior differs across Windows, Linux, and macOS.
- RLS mistakes can leak private community data if not tested thoroughly.
- Customer-managed deployments require stronger operational documentation.

## References

- `docs/staging-smoke-test.md`
- `docs/production-deployment-checklist.md`
- `docs/rollback-runbook.md`
- `docs/safe-rollout.md`
- `docs/go-no-go-checklist.md`
- `docs/secrets-management.md`
