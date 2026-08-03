# Publisher / Creator — Security

**Date:** 2026-08-03  
**Scope:** Phase 1 program (applications, eligibility, badges, Live Now/Go-Live gates, Root review)

## Threat model (Phase 1)

| Threat | Mitigation |
|---|---|
| Client forges follower/member counts | Eligibility computed only in SECURITY DEFINER RPCs; snapshot columns written by server; table INSERT revoked for authenticated |
| Client forges `eligibility_paths` | Same — RPC sets paths from `user_follows` / `communities.owner_id` + active member helpers |
| Auto-approve / self-approve | `review_publisher_application` requires `can_review_publisher_applications()` (platform permission / Root) |
| Non-publisher appears on Live Now | `can_view_live_screen_session` + discovery eligibility for `public_discovery`; start/confirm + LiveKit broadcast gate |
| Banned broadcaster continues | `publisher_live_bans` checked in `user_can_broadcast_on_picom_live` |
| Document exfiltration | Private bucket `publisher-application-documents`; owner + reviewer policies only |
| Privilege escalation via role seed | Permissions granted only via `platform_role_permissions` + existing Root RBAC; no email hardcoding |

## AuthZ surfaces

- **Apply / withdraw / list own:** authenticated user, RPC-only
- **Review / ban:** `publisher.review` / Root review helpers
- **Broadcast:** approved application + active `publisher_profiles` + active badge + no live ban + account active
- **LiveKit mint (broadcast):** `authorize_live_broadcast_livekit` requires `user_can_broadcast_on_picom_live`

## Data classification

- Application legal/corporate fields: sensitive PII — RLS deny direct client write; Root review read via RPC
- Documents: private storage objects
- Badges/profiles: public-ish display fields readable to authenticated where needed for UI; mutations RPC-only

## Explicit non-goals (BLOCKED)

- Payment / payout / donation fraud controls (no payment provider)
- ML abuse scoring
- Cross-region residency automation beyond existing Picom posture
