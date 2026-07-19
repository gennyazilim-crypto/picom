# Final Email Production Readiness

**Status:** NO-GO - EXTERNAL SECRETS AND DELIVERY EVIDENCE

**Reviewed:** 2026-07-15

## Result

Code, queue schema, authoritative event hooks, worker, API, UI, CI contracts, and deployment assets are ready. The queue migration and email-api are deployed, SPF/DKIM pass, hosted Auth URLs/templates are configured in this checkpoint, and the Ubuntu Docker image is staged. Production release remains blocked until the SMTP password is installed in Supabase Auth and the Ubuntu worker, DMARC and Turnstile are configured, the worker is running, and real multi-provider delivery acceptance passes.

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
