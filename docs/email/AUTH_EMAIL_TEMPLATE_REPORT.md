# Auth Email Template Report

**Status:** IMPLEMENTED; HOSTED INSTALLATION SCHEDULED IN THIS CHECKPOINT

**Reviewed:** 2026-07-15

## Result

Branded templates exist for signup confirmation, invitation, magic link, password recovery, email change, reauthentication, and security notice. The hosted Auth configuration is updated through the Supabase Management API in this checkpoint; end-to-end link delivery still requires custom SMTP credentials and inbox acceptance.

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
