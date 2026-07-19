# Backend Project Map (verified 2026-07-17)

Three Supabase projects exist around this product family. Getting these confused causes
"deployed the fix but nothing changed" bugs — check this table first.

| Project ref | Serves | Access | Notes |
|---|---|---|---|
| `ufmtvqtsklqsmqxefbbs` | **THIS repo's Picom desktop app** (`VITE_SUPABASE_URL` in `.env.local`) | Codex-managed (not reachable from the Claude MCP account) | Live-verified: email auth ON, `mailer_autoconfirm=false` (verification emails required — SMTP configured by Codex), signups open. Functions deployed: `livekit-token`, `steam-auth`, `epic-auth`, `client-config`, `health`. |
| `pcvqblgzhqbramlejstl` ("piso") | The **Nexus app** (separate codebase, `/Desktop/Nexus app`, deploys `voice-token`) | Claude MCP account | The intelligence-platform migrations + security hardening (RLS fix, PII redaction, pg_cron jobs, k-anon, detectors…) are applied HERE. |
| `homeplxwjpawvelcyhuq` ("qchat") | A different app (posts/follows/likes) | Claude MCP account | Untouched. |

## Known gaps on `ufmtv` (this app's backend) — owner: Codex/operator
1. **`voice-occupancy` NOT deployed (404 verified).** The app polls it every 10s for voice-room
   occupancy; without it, "who is in the room" never loads before joining.
   Fix: `supabase functions deploy voice-occupancy --project-ref ufmtvqtsklqsmqxefbbs`
2. **Google/Apple OAuth disabled (`google:false, apple:false` in live auth settings).** The app's
   Google/Apple sign-in buttons cannot work until the providers are configured in the dashboard
   (client id/secret) — operator only.
3. **Intelligence migrations not applied here.** All migrations in `supabase/migrations/` were
   applied to `piso`; if the same hardening/analytics is wanted on `ufmtv`, run
   `supabase db push --project-ref ufmtvqtsklqsmqxefbbs` (review list first — some target
   piso-specific tables and will no-op/fail harmlessly; the RLS/hygiene ones are generic).

## SMTP verification status
Settings prove verification is REQUIRED (`mailer_autoconfirm=false`), which matches Codex's SMTP
setup. Actual delivery can only be proven by a live sign-up (1-minute test): register with a fresh
address → the branded confirm email must arrive. If it does not, check Auth → SMTP settings and
the provider dashboard (rate limits) on `ufmtv`.
