# Ubuntu Email Deployment

**Status:** READY FOR OPERATOR

**Reviewed:** 2026-07-15

## Result

Create the picom-email system user, install Node 24 and production dependencies under /opt/picom, place secrets under /etc/picom, install the systemd unit, enable it, and verify localhost:8787/health. Restrict outbound traffic to DNS/HTTPS/SMTP as operations allow.

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
