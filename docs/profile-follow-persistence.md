# Profile follow/unfollow persistence

## Production behavior

- `follow_user` and `unfollow_user` are authenticated, idempotent security-definer RPCs with fixed search paths.
- Follow rejects self, missing, blocked and currently invisible profiles.
- Existing duplicate follows return success without creating another row.
- Unfollow returns success even if the edge is already absent.
- Normal authenticated clients no longer receive direct insert/update/delete grants on `user_follows`.
- Existing relationship-write rate-limit trigger applies to real insert/delete mutations.
- Participant-only SELECT allows users to list their follows/followers without exposing a public global social graph.

## UI/service behavior

- `relationshipService` owns mock/Supabase switching and uses RPCs in production mode.
- Follow/unfollow is optimistic, one in-flight mutation per target.
- Failure restores the previous local state and shows a safe error.
- Success reloads the authoritative following list.
- `user_follows` realtime changes refresh other Picom windows/sessions for the follower.
- Mention Feed `Takip Ettiğin Kişiler`, stories and profile buttons consume the same `followedUserIds` state.
- Current-user checks use the authenticated Supabase user ID rather than the mock fixture ID.

## Privacy and safety

- No message content, profile private fields, IP, device, referrer or token enters follow rows/logs.
- Blocking removes relationship edges and prevents re-follow through the RPC.
- Following does not grant private profile/channel/community access.
- Realtime subscriptions are filtered to the current follower and rely on participant RLS.
- Follower/following counts remain aggregate in the profile RPC; identity lists are visible only to participants under current service needs.

## Validation

Local:

- `npm run follow:persistence:smoke`
- `npm run mentions:ranking:test`
- `npm run stories:supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

Hosted/CLI required:

- `supabase test db --file supabase/tests/rls/follow_persistence.sql`
- Two-window follow/unfollow propagation.
- Block/follow race and rate-limit behavior.
- Verify unrelated authenticated users cannot enumerate relationship rows.

Supabase CLI is unavailable on this workstation, so pgTAP/hosted execution remains pending evidence.
