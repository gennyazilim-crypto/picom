# Profile privacy settings implementation

## Desktop controls

Settings > Privacy & Safety now controls:

- Profile audience: Everyone, Shared communities or Friends only.
- Show online status/status text.
- Show location.
- Show timezone.
- Show recent activity.
- Show shared media.

Choices persist locally in mock/offline mode and through owner-only privacy RPCs in Supabase mode. Optional fields remain reversible and do not block normal app use.

## Enforcement

- `get_profile_privacy_projection_v2` derives viewer access from auth identity, block relationship, shared membership and friendship.
- Full ProfileView data is loaded through `get_profile_activity_v3` only.
- Activity/media remain independently filtered by `can_view_message` inside the underlying profile activity function.
- When online visibility is off, v3 masks status to `offline` and removes status text before the payload reaches the renderer.
- Renderer `applyProjection` repeats the projection and clears status/activity/media/location/timezone defensively.
- Self-view retains the user's own status and settings.
- A fully restricted profile keeps only its safe identity shell and private-state explanation.

## RLS and security requirements

- Privacy settings table is owner-select only; writes occur through `auth.uid()`-bound RPC.
- Profile activity v2 direct client execute is revoked; v3 is the current client boundary.
- Security-definer functions use fixed search paths and never trust viewer IDs from the renderer.
- Blocked users cannot obtain an allowed projection.
- Private-channel activity/media remain excluded regardless of profile audience.
- Settings/logs contain no messages, credentials, tokens, IPs or private attachment paths.

## Known production limitation

The baseline `profiles` table still grants shared-community clients row SELECT containing `status` and `status_text`. The new full ProfileView RPC does not expose hidden status, but platform-wide presence privacy is not complete until all member/profile consumers migrate to a masked safe profile projection/view and direct broad profile SELECT is narrowed. Until that migration:

- UI copy promises hiding from other **profile viewers**, not invisibility across every presence surface.
- Presence/member-sidebar/realtime behavior must not claim full online privacy.
- Hosted RLS review must inventory every direct `profiles` query before broad production launch.

This limitation is explicit rather than weakening existing member rendering or silently claiming enforcement that is not complete.

## Validation

- `npm run profile:privacy:smoke`
- `npm run profile:activity:supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

Hosted checks must cover self, friend, shared member, unrelated user and blocked user for every audience/field toggle. Supabase CLI is unavailable locally, so hosted RLS execution remains pending evidence.
