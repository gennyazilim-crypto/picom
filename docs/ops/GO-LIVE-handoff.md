# GO-LIVE Handoff — exact steps to a fully working live system

Live-verified 2026-07-17 against the app's real backend `ufmtvqtsklqsmqxefbbs` (Codex-managed;
not reachable from Claude's Supabase account). Everything below is what remains between the
current build and a fully-working live system, grouped by who can do it. Repo code for every
"Codex" item is already written and committed — only deploy is left.

## 🔴 Codex — deploy to ufmtv (repo code ready; each is a one-liner)
```bash
# 1) Account deletion (GDPR "delete my account") — client calls it, live returns 404
supabase functions deploy account-deletion --project-ref ufmtvqtsklqsmqxefbbs
# 2) Direct/DM voice call authorization — client calls it, live returns 404
supabase functions deploy voice-call-authorize --project-ref ufmtvqtsklqsmqxefbbs
# 3) client-config — flips enableDiscovery + enableDeveloperPortal to true (repo already true).
#    Needed because remote flags override client defaults; discovery UI already shows via
#    release-scope, but the Developer Portal stays hidden until this redeploy.
supabase functions deploy client-config --project-ref ufmtvqtsklqsmqxefbbs
```
Verify after:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/account-deletion    # expect 204
curl -s https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/client-config \
  -H "apikey: <ANON>" | grep -o '"enableDeveloperPortal":true'              # expect a hit
```
Optional: if the intelligence platform (analytics/RLS hardening/pg_cron) should also run on the
app's own backend, `supabase db push --project-ref ufmtvqtsklqsmqxefbbs` (those migrations were
applied to `piso`, not `ufmtv`).

## 🟣 Discovery — why it shows empty, and the 3-step flow to populate it
Discovery is enabled (UI on stable; `list_public_discovery_communities` + `join_or_request_...`
are deployed and working — the list RPC returns `[]`, not an error). It is empty because a
community only appears when `visibility='public'` AND `public_read_enabled=true` AND
`discovery_listed=true` AND it has an **approved** row in `community_discovery_reviews`. Nothing
ever set `discovery_listed=true` (no owner control existed), so the review queue is always empty.

Missing piece added this session: `set_community_discovery_listing(...)` RPC
(migration `20260717100000_community_discovery_listing_optin.sql`). To finish, Codex:
1. `supabase functions`/`db push` the migration to ufmtv:
   `supabase db push --project-ref ufmtvqtsklqsmqxefbbs` (or apply that one migration).
2. **Client call** — add to `communityDiscoveryService` (needs the RPC in regenerated
   `database.types.ts` first, so run `supabase gen types` after the migration):
   ```ts
   await client.rpc("set_community_discovery_listing", {
     target_community_id, next_listed: true, next_category: "gaming", next_join_policy: "open",
   });
   ```
3. **UI toggle** — a "List this community in Discovery" switch (+ category + join policy) in the
   community management/settings surface, calling the above for owners/admins.
Then: owner lists community → server auto-enqueues a pending review (existing trigger) →
moderator approves it in Admin Operations → **Discovery Review Queue** → it appears in Discovery.

## 🟠 Operator — Supabase dashboard (ufmtv), not code
1. **Google + Apple sign-in**: Auth → Providers → enable Google and Apple, add client id/secret.
   Live auth settings currently report `google:false, apple:false`, so those login buttons cannot
   work until configured. (Steam/Epic functions are already deployed.)
2. **SMTP delivery**: `mailer_autoconfirm=false` is set (verification required, matches Codex's
   SMTP setup). Prove delivery with one real signup (below). If no mail arrives, check Auth → SMTP
   + the provider's rate limits.
3. **Backups**: enable PITR (needs the Pro plan) to bring RPO from 24h down to minutes.

## 🔵 You (owner) — local, one command each
1. **Push the branch** (nothing is on GitHub yet; the classifier blocks Claude's push):
   ```bash
   git push -u origin feat/community-rebuild
   ```
2. **Live signup email test**: register with a fresh address in the running app → the branded
   verification email must arrive (proves SMTP end to end).
3. **Voice cross-community check**: restart the app (`npm run dev`), join voice in community A,
   open community B's voice channel → it must show "Join room", not "Connected".
4. **T56 minimization schedule** (piso, optional privacy hygiene — function already deployed):
   ```sql
   select cron.schedule('analytics-minimization','30 3 * * 0',
     $$select public.enforce_analytics_minimization(180);$$);
   ```

## ✅ Already working / verified live (no action)
- Backend healthy; realtime, voice, screen-share, DM, friends enabled.
- LiveKit server `wss://voice.picom.gg` is UP (HTTP 200).
- Deployed & client-used: livekit-token, voice-occupancy, livekit-moderation, meeting-token/
  join/captions, user-data-export, email-api, admin-health, steam-auth, epic-auth.
- No secret leak: only the public anon key ships in the client (RLS-protected); no service_role /
  LiveKit secret in source or bundle.
- Discovery enabled on stable (release-scope); voice/screen already enabled on stable.
- Version-compatibility gate wired (banner + confirmed-remote blocking overlay; app reports 1.0.0 =
  backend minimum, so it reads "supported").

## Backend map (do not confuse — see backend-projects.md)
`ufmtv…` = THIS app (Codex-managed) · `piso` = Nexus app (Claude MCP; intelligence platform lives
here) · `qchat` = unrelated.
