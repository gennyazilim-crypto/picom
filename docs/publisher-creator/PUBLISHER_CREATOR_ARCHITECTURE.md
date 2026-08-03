# PICOM Publisher / Creator — Architecture

**Status:** Phase 1 implemented in-repo — staging migrate/smoke PENDING  
**Date:** 2026-08-03  
**Defaults locked:** Phase-1 product scope; extend existing Live Now (`community_live_screen_sessions`); monetization runtime BLOCKED until payment provider exists.

> Companion docs: SECURITY, RLS_MATRIX, TEST_REPORT, DEPLOYMENT, READINESS in this folder.

---

## 1. Existing systems (reuse, do not clone)

### Live Now / Go-Live
- Tables: `community_live_screen_sessions`, viewers, reports, likes/reactions, Creator Studio activity
- List RPC: `list_visible_live_screen_sessions` / `can_view_live_screen_session`
- Start: `start_community_live_screen_broadcast` → LiveKit `intent: broadcast` → `confirm_…_broadcast`
- UI: `LiveWorkspace`, `GoLiveWorkspace`, `CreatorStudioWorkspace`, Feed Live Now band
- Gap: any member with `shareScreen` can go live and appear in Live Now; no creator/publisher badge gate; `visibility_mode` stored but not enforced for discovery

### Verification / badges (related but insufficient alone)
- `profile_verifications` + `verification_badges` (`creator_verified`, etc.)
- Private bucket `verification-documents`
- Reviewer gate: `can_review_verifications()` / Root RBAC
- Gap: not an account-type Creator/Publisher program; not Live Now eligibility; no 5k/3k application thresholds

### Root / roles
- `root_owners`, `platform_role_assignments`, `platform_permissions` — no email hardcoding
- Root Dashboard modules under `src/components/rootDashboard/`

### Followers / community ownership (eligibility sources)
- Follows: `user_follows` (mutations via RPC only; client insert revoked)
- Community founder: `communities.owner_id` (canonical)
- Members: `community_members` + active membership helpers
- Account signals: `profiles.is_bot`, `profiles.deactivated_at`, `deletion_requested_at`, root account status (`temporarily_banned` / `permanently_banned`)

### Notifications / email
- Inbox `notifications` + Realtime
- Outbox `email_messages` + `email-worker` (verify@ / info@ / support@ via central policy)
- Live fanout: `fanout_live_broadcast_started`
- Reminders: `event-reminder-worker` pattern (reuse for scheduled stream reminders)

### Payments
- Explicit post-V1 No-Go; no Stripe/donation/payout runtime
- Phase-1: schema stubs only if needed for Dashboard nav; UI shows **not configured**, never fake success

---

## 2. Product decisions (locked)

| Decision | Choice |
|---|---|
| Phase scope | **Phase 1:** applications + eligibility thresholds + badges + account type + Live Now/Go-Live gates + Root review + Publisher Dashboard core + stream create/schedule/start + basic moderators + follows/notifications. Monetization / full clip-replay media pipeline = BLOCKED or PARTIAL with honest readiness. |
| Live model | **Extend existing Live Now** — wire eligibility into list/start/token RPCs; require `visibility_mode = public_discovery` for Live Now discovery; do not invent a parallel `live_streams` product in Phase 1. |
| Application eligibility | **OR gate:** `active_followers >= 5000` OR `single owned community active_members >= 3000`. Server-side only; snapshot at submit; never auto-approve. |
| Badge vs verified | New program tables for publisher/creator account + badges; may reference / coexist with `verification_badges` but Live Now uses **program badges** (`creator`/`publisher`/`verified_*` + `active`). |
| Auth for Root | Existing platform permission keys + new permissions for publisher review |

---

## 3. Target domain model (Phase 1)

### Account types
`profiles` (or linked `publisher_profiles`): `account_kind ∈ {regular, creator, publisher}` — at most one active publisher kind.

### Applications
`publisher_applications` with statuses:
`draft | submitted | under_review | additional_information_required | approved | rejected | withdrawn | suspended | revoked`

Eligibility snapshot columns (server-written only):
- `eligibility_paths text[]`
- `follower_count_at_application int`
- `qualified_community_id uuid null`
- `community_member_count_at_application int`
- `eligibility_evaluated_at timestamptz`
- `eligibility_rule_version text` (e.g. `v1-5k-followers-or-3k-founder`)
- `eligibility_risk_status text`
- `eligibility_metadata jsonb`

DB check: snapshot satisfies ≥1 threshold at insert time (enforced in RPC, not client).

Documents: private bucket `publisher-application-documents` (pattern from `verification-documents`), signed URLs, audit.

### Badges
`publisher_badges`: types `creator | publisher | verified_creator | verified_publisher`; statuses `pending | active | suspended | revoked | expired`.

### Live eligibility (server)
Live Now / confirm-live / broadcast token require ALL of:
1. Approved application history (or approved profile state)
2. Active program badge in allowed set
3. Publisher profile `active`
4. No active live ban
5. Account not banned/deactivated/deleted
6. Session `status = live` (list) / transitions via RPC only
7. Moderation status approved (or not blocked)
8. Not deleted/hidden
9. `visibility_mode = public_discovery` for Live Now discovery surfaces

Wire into:
- `can_view_live_screen_session` / list RPCs (viewer sees only eligible streams)
- `list_go_live_broadcast_targets` / `start_*` / `confirm_*` / `authorize_live_broadcast_livekit`
- Realtime fanout recipients still ACL-gated; listing never trusts client filters

### Eligibility RPCs
- `get_publisher_application_eligibility()` → typed counts + paths + `evaluatedAt`
- `submit_publisher_creator_application(...)` → recompute inside transaction; reject `PUBLISHER_APPLICATION_NOT_ELIGIBLE`; ignore client-supplied counts/community IDs

Active follower definition (SQL):
- Row in `user_follows` where `followed_id = applicant`
- Follower profile exists, not bot, not deactivated, not deletion-requested, not banned (root account status), not blocked either direction
- Exclude revoked follows (no row)

Active community members for founder path:
- `communities.owner_id = applicant`
- Count distinct active `community_members` for **one** community (MAX over owned communities; no sum across communities)
- Exclude left/banned/pending/invited/bot/deactivated members per existing membership semantics

---

## 4. Surfaces

### User
- Settings/Account: “Creator/Publisher’a geç” → eligibility progress UI (never open form if ineligible)
- Eligible → Creator vs Publisher application forms
- Approved → Publisher Dashboard nav entry

### Publisher Dashboard (Phase 1 sections)
Overview, Streams, Create, Schedule, Live Control (ties to Creator Studio / Go Live), Moderators (basic), Followers, Notifications, Settings/Verification.  
Revenue/Ads/Subscriptions/Donations: **not configured** / BLOCKED — no fake charts.

### Root Dashboard
New nav group: Publisher & Creator Review — queue, filters (follower path / founder path / both / now below threshold / fraud review), docs, approve/reject/suspend/revoke badge, live ban, notes, eligibility snapshot vs live counts.

---

## 5. Approval transaction (atomic)
RPC `review_publisher_application` (SECURITY DEFINER, fixed search_path, permission-gated):
1. Set application approved
2. Set account kind
3. Activate publisher profile
4. Insert/activate badge
5. Audit + inbox notification + email outbox enqueue
6. Open dashboard entitlement flag

Badge suspend/revoke: force-end or hide live sessions; block new starts; notify; audit.

---

## 6. Explicit Phase-1 BLOCKED / PARTIAL
- Stripe subscriptions, donations, ads impressions, payouts (no provider)
- Full clip/replay media transcoder (no fake videos; mark failed/unavailable if no processor)
- Country-level analytics without privacy-safe aggregates
- Auto-approval from thresholds (forbidden)

---

## 7. Deliverables (docs)
- `PUBLISHER_CREATOR_ARCHITECTURE.md` (this file)
- `PUBLISHER_CREATOR_SECURITY.md`
- `PUBLISHER_CREATOR_RLS_MATRIX.md`
- `PUBLISHER_CREATOR_TEST_REPORT.md`
- `PUBLISHER_CREATOR_DEPLOYMENT.md`
- `PUBLISHER_CREATOR_READINESS.md` (honest PASS/PARTIAL/BLOCKED/NOT_IMPLEMENTED)

---

## 8. Implementation order
1. Migrations: publisher tables + eligibility helpers + RLS + RPCs
2. Wire Live Now / Go-Live / LiveKit authorize gates
3. Application UI + eligibility progress
4. Root review module + approve transaction
5. Publisher Dashboard shell + stream create/schedule against existing live sessions
6. Moderators/chat basics (extend live moderation)
7. Follow/notify reuse fanout prefs
8. Tests: eligibility boundary 4999/5000, 2999/3000, OR paths, founder-only, no sum communities, payload ignore, RLS negatives, Live Now ineligible exclusion
9. Readiness + smoke commands
