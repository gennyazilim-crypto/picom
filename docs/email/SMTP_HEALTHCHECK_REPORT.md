# SMTP Healthcheck Report

**Status:** TLS PASS / AUTH BLOCKED

**Reviewed:** 2026-07-15

## Result

Use npm run email:smtp:health for certificate and protocol validation. Add SMTP_USER and SMTP_PASSWORD only in the operator environment to verify authentication. Set EMAIL_SMOKE_SEND=true and an approved recipient only for a deliberate acceptance message.

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
