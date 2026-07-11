# Profile Access and Cross-Community Privacy

## Canonical decision

`get_profile_privacy_projection_v3` is the single server decision for profile basics and section visibility. It evaluates:

- authenticated owner
- symmetric block state
- shared community membership
- accepted friendship
- target visibility (`everyone`, `shared_communities`, `friends`)
- per-section privacy switches

Visitors may read basics only when the target policy allows it. Activity, media, community roles, friend/follow counts, and mutual-community sections require an owner/shared/friend trust relationship. Public Radio and Podcast data may appear only through their existing community-kind RLS.

## Resource-level enforcement

- `get_profile_activity_v3`/`v2` rechecks every message with `can_view_message`.
- Media requires a visible source message, attached state, accepted scan state, and a renderable URL.
- Removing shared membership immediately makes the projection untrusted and removes activity/media from future RPC responses.
- Direct `profile_details` reads remain owner-only.
- Follow/friend rows retain participant-only RLS and public profile output exposes only gated aggregate counts.
- Active verification badges are returned only if the badge subject itself is visible. Pending/rejected/revoked request metadata remains owner/reviewer-only.
- Blocked viewers receive no profile payload, activity, media, or verification discovery signal.

## Test matrix

`supabase/tests/rls/profile_access_cross_community_privacy.sql` is a transaction-local pgTAP matrix for visitor, shared member, friend, owner, blocked viewer, membership removal, and friends-only visibility. It is included in `supabase:rls:smoke` and in real `supabase:rls:test` execution when the Supabase CLI is available.

Hosted execution is not claimed until the test runs against an isolated local/staging Supabase database.
