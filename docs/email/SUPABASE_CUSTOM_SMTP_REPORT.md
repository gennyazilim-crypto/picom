# Supabase Custom SMTP Report

**Status:** BLOCKED BY MAILBOX SECRET

**Reviewed:** 2026-07-15

## Result

Supabase production Auth must use custom SMTP: host mail.spacemail.com, port 465, username/sender info@picom.gg, sender name Picom. The Management API helper exists, but live configuration cannot be certified without the mailbox password and a protected access token/dashboard save.

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
