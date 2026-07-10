# Profile activity and media Supabase integration

## Production read boundary

`get_profile_activity_v2(target_user_id, result_limit)` is the sole new production read boundary. It returns:

- privacy-projected safe profile fields from `profiles`;
- role names only for communities shared with the viewer (or all own memberships);
- authored message/media and reaction activity only when `can_view_message` passes;
- clean/development-skipped media with an approved URL and no storage path;
- aggregate visible posts, mentions and reactions;
- aggregate followers/following after the profile projection allows access.

The function uses a fixed search path and security-definer access only where aggregate relationship data requires it. Every message/reaction/attachment row is independently constrained through `can_view_message`; security-definer status never authorizes a private channel by itself.

## Renderer/service behavior

- `profileActivityService` owns mock/Supabase switching and typed mapping.
- Profile components do not call Supabase.
- Supabase profile navigation clears stale remote data before loading another subject.
- While loading/failing, Picom uses the safe profile shell with empty activity/media/stats rather than fake mock records.
- `profilePrivacyService.applyProjection` remains the final renderer privacy projection.
- The authenticated Supabase user ID is used for current-user profile behavior instead of the mock fixture ID.

## Privacy exclusions

- No activity from channels the viewer cannot currently access.
- No deleted message, suspicious/pending attachment or raw storage path.
- No private message/DM activity.
- No per-community follower graph, follower identities or member timeline.
- No IP, device, precise location, message analytics or voice transcript.
- Profile activity/media are empty when their privacy flags deny them.

## Intentional TODOs

- Reply activity is not derived because the current production message schema does not expose a trusted reply reference; do not infer from text.
- Voice activity requires a trusted, privacy-reviewed voice event source.
- Private attachments requiring signed URLs need provider-aware delivery rather than embedding a path.
- Skills/tags, preferred language, cover image and activity score lack approved production tables; Supabase mode does not present mock values as real data.
- Follow counts need product/privacy review if profile visibility becomes broader than shared-community access.
- Hosted RLS tests must verify shared/private/cross-community/block scenarios; Supabase CLI is unavailable locally.

## Required hosted checks

1. Self sees own visible activity under own privacy choices.
2. Shared-community viewer sees only channels they can access.
3. Member without private-channel access cannot receive private activity/media/count contribution.
4. Visitor/unrelated/blocked viewer receives a private projection.
5. `showActivity=false` and `showMedia=false` return empty arrays.
6. Suspicious/failed/pending/private-delivery-only attachment returns no URL.
7. Direct RPC calls with another user's ID cannot bypass projection/channel checks.
8. Role/community stats do not reveal unshared private memberships.

## Local validation

- `npm run profile:activity:supabase:smoke`
- `npm run profile:privacy:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
