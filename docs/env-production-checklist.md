# Picom Production Environment Checklist

## Target identity

- [ ] Production project ref and region were independently confirmed.
- [ ] Deployment is tied to an approved source commit and release candidate.
- [ ] Staging and production use different projects, databases, users, storage, LiveKit projects, and secrets.

## Renderer build variables

- [ ] `npm run supabase:env:validate` passes for committed examples.
- [ ] The ignored release env passes `node scripts/validate-supabase-environment.mjs --target production --file <env-file>`.
- [ ] `VITE_SUPABASE_URL` is the intended production public URL.
- [ ] `VITE_SUPABASE_ANON_KEY` is the anon key, never service-role.
- [ ] `VITE_RELEASE_CHANNEL` matches `beta` or `stable` approval.
- [ ] OAuth callback/provider flags match dashboard configuration.
- [ ] Public LiveKit/status/remote-config URLs contain no credentials or signed private query data.
- [ ] The built renderer bundle contains no server-only variable values.

## CI/operator secrets

- [ ] `SUPABASE_PROJECT_REF` is stored as protected deployment configuration.
- [ ] `SUPABASE_ACCESS_TOKEN` is masked, least privilege, and rotation-owned.
- [ ] Database password is stored only in the approved secret manager.
- [ ] CI logs and artifacts do not print environment dumps.

## Edge Function secrets

- [ ] `SUPABASE_SERVICE_ROLE_KEY` remains platform/server-only and is used only where explicitly reviewed.
- [ ] `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are configured through Function secret storage.
- [ ] Function errors/logs do not expose secrets or bearer tokens.
- [ ] Secret rotation and emergency revocation owners are named.

## Auth and email

- [ ] `picom://auth/callback` is allowlisted without broad wildcards.
- [ ] Email/password, verification, session, and abuse settings match launch policy.
- [ ] Auth SMTP Sender email is `info@picom.gg` (display name Picom) with SPF/DKIM for `picom.gg`.
- [ ] Google/Apple credentials are stored only in provider settings.
- [ ] Email templates are reviewed for links, privacy, localization, and safe HTML.
- [ ] Terms/Privacy text and consent behavior have product/legal approval.

## Data services

- [ ] Migration history is current and backed up.
- [ ] All user-data tables have RLS enabled and tested with non-privileged accounts.
- [ ] Storage bucket is private and attachment policies are tested.
- [ ] Realtime private-row denial and reconnect behavior are tested.
- [ ] Required Edge Functions are deployed and version-recorded.

## Operations

- [ ] Automated backup/PITR settings and restore drill evidence exist.
- [ ] Monitoring, incident response, and rollback owners are available.
- [ ] Project admin membership follows least privilege and MFA.
- [ ] `npm run secrets:smoke`, `npm run supabase:smoke`, and real RLS tests pass.
- [ ] No populated `.env.production` or secret file is committed.
- [ ] `npm run env:placeholders:check` passes for all committed environment examples.
- [ ] `npm run secrets:smoke` confirms no server-only Supabase key crossed into renderer/runtime source.
