# Production Deployment Checklist

This checklist covers backend and production operations for Picom, an Electron desktop community chat app for Windows, Linux, and macOS. It is separate from desktop packaging and installer smoke tests.

Do not deploy with production secrets in local files. Do not run production migrations without verified backups and rollback review.

## Decision legend

- `[BLOCKER]` Must pass before production promotion.
- `[VERIFY]` Required release verification.
- `[INFO]` Documented state or known risk.

## Environment variables

- [ ] `[BLOCKER]` Production `SUPABASE_URL` and anon/service role usage are correctly scoped.
- [ ] `[BLOCKER]` Auth/session secrets are configured in the production secret manager placeholder.
- [ ] `[BLOCKER]` Database, Redis, storage, email, LiveKit, and Edge Function environment variables are present.
- [ ] `[BLOCKER]` No real secrets are committed to Git, docs, release notes, or diagnostic examples.
- [ ] `[VERIFY]` `.env.example` remains placeholder-only.

## Database migration

- [ ] `[BLOCKER]` Migration diff reviewed.
- [ ] `[BLOCKER]` Migration tested in staging.
- [ ] `[BLOCKER]` RLS policies reviewed for private channel/community isolation.
- [ ] `[BLOCKER]` Migration rollback limitations documented.
- [ ] `[VERIFY]` Desktop client/server compatibility checked for the migration.

## Database backup verified

- [ ] `[BLOCKER]` Fresh production backup completed before risky migration.
- [ ] `[BLOCKER]` Backup verification or restore drill completed recently; see `docs/backup-verification.md`.
- [ ] `[VERIFY]` Backup location and retention are documented without exposing credentials.
- [ ] `[INFO]` Restore owner and approval path are known.

## Redis connectivity

- [ ] `[BLOCKER]` Redis is reachable if required in production mode.
- [ ] `[VERIFY]` Realtime scaling/pub-sub path is healthy.
- [ ] `[INFO]` Optional Redis fallback/degraded behavior is documented.

## Object storage connectivity

- [ ] `[BLOCKER]` Supabase Storage/object storage is reachable.
- [ ] `[BLOCKER]` Attachment bucket policies do not expose private channel attachments.
- [ ] `[VERIFY]` Upload/download smoke test passes with safe staging-like images.
- [ ] `[VERIFY]` File size and MIME validation are enforced.

## Backend health

- [ ] `[BLOCKER]` `/health` returns safe combined status.
- [ ] `[BLOCKER]` `/health/live` confirms process liveness.
- [ ] `[BLOCKER]` `/health/ready` confirms required dependencies are ready.
- [ ] `[VERIFY]` Health responses do not expose secrets or private admin config.

## Readiness endpoint

- [ ] `[BLOCKER]` Readiness fails when database is unavailable.
- [ ] `[VERIFY]` Optional service degradation is represented safely.
- [ ] `[VERIFY]` Deployment orchestrator/load balancer uses readiness, not liveness, for traffic decisions.

## Realtime gateway

- [ ] `[BLOCKER]` Supabase Realtime/socket path works with two desktop clients.
- [ ] `[VERIFY]` Reconnect/degraded banner behavior is acceptable.
- [ ] `[VERIFY]` Unauthorized/private channel realtime room joins are rejected.

## Upload validation

- [ ] `[BLOCKER]` Allowed types are limited to approved image formats for MVP.
- [ ] `[BLOCKER]` Max file size is enforced.
- [ ] `[VERIFY]` Suspicious/quarantined attachment placeholders do not render as normal images.

## Rate limits

- [ ] `[BLOCKER]` Auth, message send, upload, webhook placeholder, and realtime high-volume events have documented limits.
- [ ] `[VERIFY]` Rate-limited errors are user-friendly and do not expose stack traces.

## CORS and origin policy

- [ ] `[BLOCKER]` Production API origins are restricted to approved desktop app/webview origins where applicable.
- [ ] `[VERIFY]` Development origins are not accidentally allowed in production.
- [ ] `[VERIFY]` Deep links and external links are validated through service layers.

## Logging redaction

- [ ] `[BLOCKER]` Logs redact tokens, passwords, auth headers, private message content, and secrets.
- [ ] `[VERIFY]` Diagnostics export is redacted.
- [ ] `[VERIFY]` Abuse/security events store safe metadata only.

## Admin bootstrap

- [ ] `[BLOCKER]` Admin bootstrap does not run automatically in production.
- [ ] `[BLOCKER]` Admin password is not logged.
- [ ] `[VERIFY]` App admin panel visibility requires app-admin placeholder/flag.

## Monitoring

- [ ] `[BLOCKER]` Health/readiness monitoring is active.
- [ ] `[VERIFY]` SLO plan reviewed: `docs/slo.md`.
- [ ] `[VERIFY]` Incident response runbook reviewed: `docs/incident-response.md`.
- [ ] `[VERIFY]` Postmortem template available: `docs/postmortem-template.md`.

## Rollback plan

- [ ] `[BLOCKER]` Backend rollback command/path identified.
- [ ] `[BLOCKER]` Database rollback limitations reviewed.
- [ ] `[BLOCKER]` Emergency kill switches are ready for risky feature disablement.
- [ ] `[VERIFY]` Desktop client/server compatibility checked before rollback.
- [ ] `[INFO]` Rollback runbook reviewed: `docs/rollback-runbook.md`.

## Desktop client compatibility

- [ ] `[BLOCKER]` Minimum supported desktop version is compatible with deployed backend.
- [ ] `[VERIFY]` Windows desktop app connects to production-compatible API.
- [ ] `[VERIFY]` Linux desktop app connects to production-compatible API.
- [ ] `[VERIFY]` macOS desktop app connects if macOS is in the release ring.
- [ ] `[VERIFY]` No mobile UI is introduced.

## Release notes

- [ ] `[BLOCKER]` Release notes include known limitations and supported platforms.
- [ ] `[VERIFY]` No Discord branding/assets/colors are claimed or used.
- [ ] `[VERIFY]` Known issues are written in user-understandable language.

## Support communication placeholder

- [ ] `[VERIFY]` Support has the release summary, known issues, and escalation path.
- [ ] `[VERIFY]` Incident response communication owner is identified.
- [ ] `[VERIFY]` Status page/support URL placeholders are accurate or clearly marked as future.

## Final production gate

Production promotion should be blocked if any `[BLOCKER]` item is incomplete, unknown, or failed. Non-blocking known issues must have owner, severity, user impact, and follow-up date.
