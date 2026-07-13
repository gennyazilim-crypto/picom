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

## Startup fixes applied this session
- Community loaders skip placeholder (non-UUID) community/channel ids (removes reload 400 error toasts).
- Auth-loading guard separated from the signed-out login guard (no login flash on refresh).
- Stale auth-onboarding smoke assertion updated to the refactored guard structure.
