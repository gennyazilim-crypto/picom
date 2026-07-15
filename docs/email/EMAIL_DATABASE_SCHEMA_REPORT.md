# Email Database Schema Report

**Status:** LIVE MIGRATION APPLIED

**Reviewed:** 2026-07-15

## Result

Migration `20260715150000_email_operations_production.sql` was applied to linked project `ufmtvqtsklqsmqxefbbs`. It defines templates, versions, preferences, messages, attempts, events, suppressions, contact submissions, rate buckets, admin actions, and worker heartbeats with indexes, constraints, RLS, audit immutability, and retention RPCs.

## Production contract

- Sender identity: **Picom <info@picom.gg>**.
- Default Reply-To: **info@picom.gg**.
- SMTP credentials are server-only and must never use a VITE_ variable.
- Renderer code submits named intents to the protected Edge API; it cannot select arbitrary From addresses or relay raw email.
- Delivery state is recorded by the durable PostgreSQL queue and Ubuntu worker.

## Security and privacy

RLS denies direct client access to operational email records. Queue claims and completion are service-role-only. Logs and admin views expose domains, status, correlation identifiers, and stable error codes rather than message bodies or credentials.

## Evidence and next action

Repository evidence is covered by `npm run email:smoke` and `npm run email:sender:scan`. Live claims remain blocked unless this report explicitly records verified provider or hosted evidence.
