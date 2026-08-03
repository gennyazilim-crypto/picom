# Publisher / Creator — RLS / RPC matrix

**Date:** 2026-08-03  
**Migrations:** `20260803140000_publisher_creator_program_core.sql`, `20260803141000_publisher_livekit_broadcast_gate.sql`

| Object | anon | authenticated direct | RPC path | Notes |
|---|---|---|---|---|
| `publisher_profiles` | deny | SELECT own / limited public display | create/update via review RPC | Writes not open to clients |
| `publisher_badges` | deny | SELECT active for display | activate via review RPC | One active badge per user (partial unique index) |
| `publisher_applications` | deny | SELECT own | `submit_publisher_creator_application`, review RPCs | Eligibility snapshot server-only |
| `publisher_application_documents` | deny | own metadata | upload via storage policies | Bucket private |
| `publisher_application_review_actions` | deny | reviewers via RPC | `review_publisher_application` | Audit trail |
| `publisher_live_bans` | deny | deny / self-read limited | `set_publisher_live_ban` | Reviewer/moderation |
| `publisher_stream_schedules` | deny | owner CRUD when can broadcast | owner insert gated by RLS using broadcast helper | Phase-1 schedule |
| `storage.publisher-application-documents` | deny | owner + reviewer | — | MIME/size limited |
| Live Now view ACL | — | via `can_view_live_screen_session` | list RPCs | `public_discovery` requires publisher discovery eligibility |
| Go-Live start/confirm | — | via existing live RPCs | gates call `user_can_broadcast_on_picom_live` | Fail closed |
| LiveKit broadcast authorize | — | — | `authorize_live_broadcast_livekit` | Requires publisher broadcast helper |

## Permission keys

- `publisher.review` — approve / reject / suspend / revoke
- `publisher.moderate_live` — live bans
- `dashboard.read` — **list/read only** via `can_list_publisher_applications()` (does **not** approve)

Seeded onto catalog roles: `root_owner`, `platform_admin`, `trust_safety_manager`, `moderator` (when present in `platform_role_catalog`).
