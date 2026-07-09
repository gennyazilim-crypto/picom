# Picom Supabase Production Setup

This runbook prepares a production Supabase project without committing or exposing secrets. It does not authorize a remote deployment by itself.

## 1. Ownership and region decision

1. Create a dedicated Picom production organization/project, separate from local, staging, and beta data.
2. Restrict project owner/admin access to named operations/security maintainers with MFA.
3. Select the region nearest the primary approved user population and compatible with legal/data-residency requirements.
4. Record the selected region, decision owner, date, expected user geography, backup region, and migration limitations in the private operations register.
5. Do not change region or copy production data across regions without a reviewed migration plan.

## 2. Environment boundaries

Renderer-safe public values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RELEASE_CHANNEL=stable` for stable builds, or `beta` for a controlled production-connected candidate
- Public OAuth callback/provider flags
- Public LiveKit WebSocket URL/availability flag

CI/operator secret store only:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`

Edge Function/server secret store only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Never prefix server secrets with `VITE_`. Never place the service-role key, access token, database password, or LiveKit secrets in Electron/Vite env files, logs, diagnostics, documentation, or release artifacts.

Use `.env.production.example` only as an inventory. Split values into renderer build variables, masked CI secrets, and Supabase Function secrets in the deployment system.

## 3. Create and link the project

1. Create the project in the approved region with a generated database password stored in the production secret manager.
2. Capture the project ref, project URL, and anon key in their approved stores.
3. Authenticate the CLI through a masked operator/CI token.
4. Link only after verifying the target:

```powershell
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase migration list
```

The operator must record the target project and obtain deployment approval before any remote mutation.

## 4. Auth configuration

- Decide whether public email registration is enabled at launch; if disabled, use invite/allowlist operations.
- Require email verification when public registration is enabled.
- Configure the Site URL and allowed redirect URL `picom://auth/callback`.
- Add only reviewed development/staging web callbacks to non-production projects; do not allow wildcard production redirects.
- Configure Google/Apple provider client secrets only in Supabase Auth settings.
- Set password policy, session lifetime, refresh-token rotation, abuse protection, and email rate limits.
- Review account deletion/session revocation behavior.

Email template placeholders requiring product/legal approval:

- Confirm signup.
- Reset password.
- Magic link, if enabled later.
- Email change confirmation.
- Invite/notification templates used by the approved MVP flow.

Templates must not include secrets, sensitive message content, or untrusted HTML.

## 5. Database migrations

1. Freeze the migration set for the candidate commit.
2. Back up production before applying risky migrations.
3. Compare local/staging/production migration history.
4. Apply only reviewed ordered migrations with the approved CI/operator identity:

```powershell
supabase migration list
supabase db push
supabase migration list
```

5. Verify constraints, indexes, functions, triggers, grants, and RLS after deployment.
6. Treat destructive/schema-rewrite rollback as potentially unsafe; use the rollback runbook and backup evidence.

## 6. RLS verification

- Every user-data table must have RLS enabled.
- Run the owner/admin/moderator/member/visitor matrix with distinct production-safe test accounts.
- Verify private community/channel/message/attachment denial.
- Verify visitors cannot insert messages, reactions, uploads, memberships outside allowed public join, or privileged rows.
- Verify role changes cannot self-escalate.
- Run `npm run supabase:rls:test` in an isolated validation environment before production approval.

Never use a service-role client to prove end-user RLS behavior.

## 7. Storage

- Keep `message-attachments` private.
- Confirm MIME/extension/10 MB limits and file-name sanitation.
- Verify object read policies follow visible attached messages.
- Verify private-channel files cannot be fetched by path or stale URL after access loss.
- Configure lifecycle/orphan cleanup only after dry-run review.
- Document malware scanning as inactive until a reviewed provider is integrated; do not claim files are scanned.

## 8. Realtime

- Enable publication only for the tables/events required by Full MVP.
- Confirm Realtime follows RLS for each subscribed account.
- Run two-window insert/update/delete and reconnect tests.
- Verify visitors cannot subscribe to private-channel rows.
- Monitor connection/error volume and define degraded API-only behavior where supported.

## 9. Edge Functions

Deploy only reviewed functions required by the candidate. Set secrets through Supabase secret storage:

```powershell
supabase secrets set LIVEKIT_URL=...
supabase secrets set LIVEKIT_API_KEY=...
supabase secrets set LIVEKIT_API_SECRET=...
supabase functions deploy livekit-token
```

- Protected functions must validate Supabase JWTs and authorization.
- `health` may be unauthenticated only when its response is non-sensitive.
- Placeholder functions must not be represented as complete production behavior.
- Function logs must exclude bearer tokens, service-role keys, LiveKit secrets, and private content.

## 10. Backups and recovery

- Confirm the production plan includes automated database backups/PITR appropriate for launch risk.
- Record retention, encryption, region, access owners, and restore limitations.
- Run a staging restore drill before launch and periodically thereafter.
- Back up object storage metadata and document how object data is recovered.
- Verify backup access is more restricted than normal application access.

## 11. Monitoring and access control

- Enable Supabase platform alerts for database health, auth failure spikes, storage errors, function failures, and resource limits.
- Restrict dashboard, SQL editor, logs, and secret access by least privilege.
- Use individual accounts; do not share owner credentials.
- Review project members and access tokens at release and on personnel changes.
- Export only redacted operational evidence to normal issue trackers.

## 12. Promotion gate

Production-connected promotion requires:

- Approved region/ownership record.
- Current backup and restore evidence.
- Complete migration/RLS/Storage/Realtime/Edge verification.
- Auth redirect/provider/email configuration review.
- Secret scan and artifact inspection.
- Windows/Linux/macOS client compatibility smoke for the exact build.
- Named rollback owner, incident channel, and go/no-go approval.

If credentials or Supabase CLI access are unavailable, stop after static documentation/smoke checks and record the environment blocker. Do not claim remote setup is complete.
