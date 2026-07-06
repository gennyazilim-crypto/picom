# Production Secrets Management Plan

Picom is an Electron desktop app for Windows, Linux, and macOS with Supabase, Postgres, Storage, Realtime, and LiveKit/WebRTC integrations. Secrets must never be bundled into the renderer or committed to the repository.

## What counts as a secret

Treat the following as secrets:

- `AUTH_SECRET` or any session/JWT signing secret.
- Database password or direct database connection string with credentials.
- Redis password or managed Redis token.
- Object storage access keys and secret keys.
- Supabase service-role key.
- Email provider credentials/API tokens.
- LiveKit API key and API secret.
- Signing certificates and private signing keys.
- Desktop updater keys or release signing keys.
- Crash reporting DSN if private or tied to a private project.
- OAuth client secrets.
- Admin bootstrap password or one-time setup token.
- Webhook/bot/API tokens.

Renderer-safe values such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not private secrets, but they still require RLS and backend permission enforcement.

## Where secrets should live

| Environment | Storage location | Notes |
| --- | --- | --- |
| Local development | `.env.local` copied from `.env.example` | Placeholder values only in committed files. |
| Local Supabase/LiveKit experiments | Developer-local env files or local secret store | Do not paste into docs, issues, or screenshots. |
| CI | CI secrets placeholder | Restrict access, mask logs, rotate when exposure is suspected. |
| Staging | Staging secret manager placeholder | Separate from production; never reuse production database passwords. |
| Production | Production secret manager placeholder | Access limited to operations/security owners. |
| Desktop renderer | Public `VITE_` values only | Anything here is bundled and visible to users. |

## Rotation process

1. Identify secret owner and dependent services.
2. Create replacement secret in the correct secret store.
3. Deploy configuration update to staging.
4. Run staging smoke tests.
5. Deploy production config update.
6. Verify health/readiness and affected user flow.
7. Revoke old secret.
8. Record rotation date and owner in a private operations log placeholder.

## Emergency secret rotation

Use when a secret may be exposed:

1. Open incident using `docs/incident-response.md`.
2. Preserve evidence without spreading the secret.
3. Revoke or disable the suspected secret where possible.
4. Generate replacement secret.
5. Redeploy affected services.
6. Revoke sessions/tokens if user auth could be affected.
7. Check logs for misuse.
8. Run smoke tests and monitor SLOs.
9. Complete postmortem using `docs/postmortem-template.md`.

## What must never be committed

- Real `.env`, `.env.local`, `.env.production`, or deployment env files.
- Supabase service-role keys.
- Database URLs with usernames/passwords.
- Redis/object storage/email provider credentials.
- Signing certificates/private keys.
- LiveKit API secrets.
- Admin bootstrap passwords.
- Session cookies, auth headers, JWTs, OAuth codes.
- Crash logs or diagnostics containing secrets.

## How to audit for leaked secrets

Manual checks:

```bash
git status --short
npm run secrets:smoke
```

Recommended future checks:

- Open-source secret scanner placeholder in CI.
- Search for `service_role`, `password=`, `AUTH_SECRET`, `PRIVATE KEY`, `BEGIN`, `sk_`, `Bearer `.
- Review release artifacts and diagnostics exports for redaction.
- Confirm `.env.example` contains placeholders only.
- Confirm README references `.env.example` and this plan.

## Logging and diagnostics redaction

- Do not log tokens, passwords, auth headers, cookies, or database URLs.
- Redact sensitive values before exporting diagnostics.
- Do not include private message content in operational logs.
- Abuse/security logs should store safe metadata only.

## Staging, beta, and production assumptions

- Staging may use disposable secrets, but they still must not be committed.
- Beta users should never receive production service-role secrets or private dashboards.
- Production secrets live only in approved secret manager/CI secret placeholders.
- Desktop clients must never receive private signing or service secrets.

## Remaining risks

- Renderer environment variables are visible in bundled code.
- Screenshots and diagnostics can accidentally reveal local env files.
- Manual emergency fixes can bypass normal secret-review steps under pressure.
- Provider dashboards and CI logs need separate access controls outside this repository.

## Related documents

- `.env.example`
- `README.md`
- `docs/production-deployment-checklist.md`
- `docs/incident-response.md`
- `docs/rollback-runbook.md`
