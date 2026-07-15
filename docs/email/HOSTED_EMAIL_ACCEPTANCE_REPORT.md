# Hosted Email Acceptance Report

**Status:** NO-GO

**Reviewed:** 2026-07-15

## Result

The queue migration and email-api are live. Hosted smoke confirmed `401 AUTH_REQUIRED` for unauthenticated preferences and `403 EMAIL_CHALLENGE_REQUIRED` for anonymous contact without Turnstile. SPF and DKIM are live. Hosted Auth URLs and templates are applied through the Management API in this checkpoint. Full acceptance remains blocked by missing SMTP authentication, missing DMARC, missing Turnstile configuration, a non-running worker, and absence of multi-provider delivery results.

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
