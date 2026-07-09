# Picom Supabase Staging Setup

This runbook prepares a separate Supabase project for Picom beta testing. Do not use a production project or production user data for staging.

## Security boundary

Renderer-safe values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DATA_SOURCE=supabase`
- `VITE_RELEASE_CHANNEL=beta`
- provider availability flags from `.env.example`

Server/Edge Function secrets only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

CLI/operator values only:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`

The service-role key, database password, LiveKit API key, and LiveKit secret must never use a `VITE_` prefix, enter Electron renderer code, appear in logs, or be committed.

## 1. Install and authenticate the CLI

Install the open-source Supabase CLI using an official supported method for the workstation. Confirm it is available:

```powershell
supabase --version
supabase login
npm run supabase:status
```

If the CLI is unavailable, stop at documentation/static smoke checks. Do not claim migrations, RLS, Storage, Realtime, or functions were deployed.

## 2. Create and link staging

1. Create a new Supabase project named clearly as Picom staging.
2. Record the project reference, public project URL, and anon key in a local `.env.local` only.
3. Link this checkout:

```powershell
supabase link --project-ref <staging-project-ref>
supabase migration list
```

Do not commit `.env.local`, the database password, access tokens, or generated secret files.

## 3. Apply database migrations

Review migrations and create a staging backup/snapshot before future destructive changes. Apply the ordered migrations:

```powershell
supabase db push
supabase migration list
npm run supabase:db:push
```

The current migration chain covers profiles, communities, roles, membership, channels, messages, attachments, reactions, read state, RLS, Storage, Realtime publication, public visitor boundaries, first-run onboarding, and community invites.

Verify in SQL Editor:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every user-data table must have RLS enabled. Confirm private-channel messages and attachments are not readable by visitors.

## 4. Configure Auth

1. Enable email/password registration and choose the staging email-confirmation policy.
2. Add `picom://auth/callback` to Authentication redirect URLs.
3. Configure Google using [auth-social-login.md](./auth-social-login.md), then set `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED=true` in the local staging renderer env.
4. Configure Apple only when Apple credentials are available, then set `VITE_SUPABASE_APPLE_OAUTH_ENABLED=true`.
5. Keep provider client secrets in Supabase Auth provider settings, never in the renderer.

## 5. Verify Storage

Migrations create the message attachment bucket and policies. Verify:

- accepted MIME types remain png, jpg/jpeg, webp, and gif;
- file size limits match the app upload validator;
- only authorized senders can upload;
- private-channel attachments follow message/channel visibility;
- suspicious/quarantined metadata is not exposed as a normal attachment.

Do not make the attachment bucket broadly public to work around RLS failures.

## 6. Verify Realtime

Migration `20260704002400_enable_messages_realtime.sql` prepares message publication. In two authenticated desktop windows, verify insert/update/delete and typing/presence behavior without duplicates. Realtime authorization must match Postgres visibility; a visitor must not join private channel data.

## 7. Configure Edge Function secrets

Set secrets directly on the linked staging project:

```powershell
supabase secrets set LIVEKIT_URL=<wss-url>
supabase secrets set LIVEKIT_API_KEY=<server-key>
supabase secrets set LIVEKIT_API_SECRET=<server-secret>
```

Supabase-managed runtime variables such as the project URL and service-role key should be consumed server-side only. Never copy the service-role key into `.env.local` used by Vite/Electron.

## 8. Deploy Edge Functions

Deploy only functions required for the staging beta:

```powershell
supabase functions deploy health --no-verify-jwt
supabase functions deploy livekit-token
supabase functions deploy accept-invite
supabase functions deploy validate-file
supabase functions deploy moderation-helper
supabase functions deploy notification-fanout
supabase functions deploy client-config
npm run supabase:functions:deploy
```

Confirm `livekit-token`, invite, upload-validation, moderation, notification, and client config functions reject unauthenticated or unauthorized requests as designed.

The package script deploys only `livekit-token` as the Full MVP staging token function. Deploy any additional reviewed function explicitly; do not turn an undocumented bulk deployment into a release step.

## 9. Generate TypeScript types

From the linked staging schema:

```powershell
supabase gen types typescript --linked --schema public | Set-Content -Encoding utf8 src/services/supabase/database.types.ts
npm run typecheck
```

Review generated changes before committing. Never generate types from a project containing unreviewed production-only objects.

## 10. Seed safe staging data

Use synthetic accounts and communities only. Do not copy production messages, member personal data, tokens, invite secrets, or private attachments. The local `supabase/seed.sql` is a development reference and must be reviewed before remote execution.

## 11. Run smoke and RLS checks

Static/local checks:

```powershell
npm run supabase:smoke
npm run qa:supabase
npm run typecheck
npm run build
```

Real staging checks:

1. Register and sign in with email/password.
2. Complete first-run onboarding.
3. Create/join a community and create a channel.
4. Send/edit/delete a message in two desktop windows.
5. Upload and open an image attachment.
6. Verify visitor public-read behavior and private-channel denial.
7. Create and accept an invite, including a private community.
8. Join voice through the deployed LiveKit token function.
9. Run the SQL cases in `supabase/tests/rls` using staging-only test identities.
10. Export diagnostics and confirm no secrets are present.

## Promotion gate

Do not use staging for beta distribution until migrations are current, all public tables have reviewed RLS, Storage and Realtime checks pass, Edge Functions are deployed with server-only secrets, and Windows/Linux/macOS desktop clients connect using the beta env without exposing credentials.
