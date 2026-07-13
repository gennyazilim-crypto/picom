# Picom Live System Audit (Task 001 baseline)

Date: 2026-07-13
Branch: `feat/community-rebuild`
Hosted project: `picom-staging` (`ufmtvqtsklqsmqxefbbs`)
Data source: Supabase (renderer `VITE_DATA_SOURCE=supabase`), no mock fallback.

## Runtime baseline

| Check | Result |
|---|---|
| `tsc --noEmit` | PASS (0 errors) |
| `vite build` (renderer) | PASS (built ~1.3s) |
| `session-management-smoke` | PASS |
| `v1-core-scope-smoke` | PASS |
| `supabase-auth-onboarding-production-smoke` | PASS (stale guard-ordering assertion updated to the refactored, separated auth-loading/login guards) |
| Dev server (`127.0.0.1:5173`) startup | PASS |
| Refresh / session restore | PASS — `if (!authReady)` renders a loading screen before the signed-out login guard, so refresh does not flash login |
| Fallback IDs in hosted queries | FIXED — community data loaders now skip non-UUID placeholder ids (`fallback-community` / `fallback-channel`) via `isSupabaseEntityId()` guard; previously emitted 400 error toasts on reload |

## Per-subsystem status (live-verified against picom-staging this session)

| Subsystem | Status | Evidence |
|---|---|---|
| Auth (login/session restore) | WORKING | `auth/v1/user` → 200; session restores logged-in user without login flash |
| Profile | WORKING | `profiles` reads → 200; `user_settings` hydration → 200 |
| Friendship / follow / presence | WORKING (single-user reads) | `list_friend_relationship_state`, `list_friend_suggestions`, `list_friend_presence` → 200 |
| Community / channel / chat | WORKING | communities/channels/categories/members load; message + reaction reads → 200; private-channel feature removed (members see all channels) |
| Direct Messages | WORKING | `direct_messages`, `direct_conversation_participants`, `list_direct_shared_media`, `direct_message_attachments`, `direct_message_reactions` → 200 |
| Feed / mentions | WORKING | `list_ranked_unified_feed`, `list_mention_feed`, `list_followed_content_stories` → 200 |
| Storage (attachments) | WORKING (reads) | attachment reads → 200; upload/lifecycle covered by Task 004/009 |
| Realtime | PRESENT | DM/messages realtime migrations applied; subsystem review is Task 009 |
| LiveKit voice / screen share | TOKEN + SECRETS READY | `livekit-token` Edge Function deployed; `LIVEKIT_URL/API_KEY/API_SECRET` secrets set; voice authorize relaxed to active-member access. Client connection fix landed (Codex). Two-client audio/screen-share evidence pending (Task 010/012) |
| Presence RPC | ONE KNOWN GAP | `set_my_presence_session` → 404 (migration `20260712180000_global_presence_sessions` pending on remote; see Task 002) |

## Known blockers / notes

- **Migration divergence (feeds Task 002):** remote has 6 migrations not in the repo (`20260712166xxx`) and the repo has ~26 pending. `supabase db push` is blocked here (auto-mode guards writes to the shared project). Forward migrations must be applied by the operator via `npx supabase db push` (or reconciled with `migration repair` first).
- **Two-user / hosted evidence (feeds Task 003/005/006/007/010/012):** creating auth accounts and entering passwords is out of scope for the automation, so multi-user acceptance and RLS negative-path proofs require the operator to sign in the test users; verified single-user this session.
- **`supabase db dump`** cannot run locally (bundled `pg_dump` 15.8 vs hosted Postgres 17.6), so remote schema reconciliation relies on `supabase migration list` and the SQL editor.

## Task 002 — SQL / migration / RLS reconciliation

Hosted history is now nearly aligned (the operator applied the previously-pending
migrations during this session).

- **Pending local → remote (1):** `20260713010000_open_all_community_channels_to_members`
  (this session's private-removal migration). Apply with `npx supabase db push`.
- **Remote-only, not in repo (~10):** `20260712166xxx` (6) and `20260712206xxx` (4),
  applied directly to the hosted project. Bring them into the repo with
  `supabase db pull` — currently blocked locally by a `pg_dump` version mismatch
  (15.8 vs hosted 17.6); upgrade the local Postgres client tools, then pull.
- **Schema presence (via `supabase gen types typescript --linked`, 10.3k lines):**
  `channel_categories`, `communities`, `community_members`, `audit_log`,
  `set_my_presence_session`, `authorize_livekit_room`, `can_view_channel` all PRESENT.
  The earlier `set_my_presence_session` 404 is **RESOLVED** (presence migration applied).
- **Generated types:** the repo's `src/services/supabase/database.types.ts` is a
  hand-curated subset (1049 lines) that typechecks clean; it is intentionally not the
  full 10.3k-line auto-generated file, so it is left as maintained rather than replaced.
- Idempotency: the pending forward migration uses `create or replace`, `drop policy if
  exists` + `create policy`, and guarded `update ... where ... is distinct from` — safe
  to apply and re-apply.

## Task 011 — fake-runtime / anti-pattern scan (whole app)

Comprehensive scan of production/Supabase paths — the codebase is clean:

- **Admin from email:** none found (roles come from protected tables/claims, per Task 003).
- **React components calling Supabase directly:** none (all `.from`/`.rpc` matches were
  `Array.from` etc.; components go through the service/repository layer).
- **Fake-ID queries** (`welcome`/`general`/`focus-room`/`fallback-*`): none. The
  `welcome`/`general` reference in `communityJoinRoutingService` is a landing-channel
  heuristic over already-loaded real channels (uses real ids), not a query by fake id.
  Community loaders skip non-UUID placeholders (`isSupabaseEntityId`).
- **Fake success toasts:** none. Settings saves either check a real service result with
  rollback on failure (`saveProfileSettings`, friend-request privacy, unblock) or are
  honestly labelled "saved locally"; notification/appearance settings sync to the
  `user_settings` account row (asserted by the auth-onboarding smoke).
- **Silent empty catches:** ~21, predominantly benign `localStorage`/`JSON.parse`/
  clipboard guards; none observed swallowing a real Supabase/service error path.
- **Mock in Supabase mode:** mock stores (invites, insights, audit) are gated to
  `dataSourceService.getStatus().isMock`; Supabase mode uses real RPCs/queries.

## Startup fixes applied this session
- Community loaders skip placeholder (non-UUID) community/channel ids (removes reload 400 error toasts).
- Auth-loading guard separated from the signed-out login guard (no login flash on refresh).
- Stale auth-onboarding smoke assertion updated to the refactored guard structure.
