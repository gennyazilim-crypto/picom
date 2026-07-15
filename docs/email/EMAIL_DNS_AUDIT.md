# Email DNS Audit

**Status:** SPF AND DKIM PASS / DMARC MISSING

**Reviewed:** 2026-07-15

## Result

picom.gg resolves to 23.254.166.240. MX points to mx1.spacemail.com and mx2.spacemail.com. SPF includes spf.spacemail.com. DKIM is published at `spacemail._domainkey.picom.gg` with an RSA public key. `_dmarc.picom.gg` is still missing, so domain authentication remains incomplete until a reviewed DMARC policy is published.

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
