# V1 active-member Voice and Screen authorization

## Policy

Ordinary Voice discovery, room join, audio publication, and screen publication are community-membership capabilities. An accepted, active community member receives them without an Owner, Admin, Moderator, custom-role, private-channel, or channel-override grant.

The canonical server gate is `public.is_active_community_media_member`. It requires an authenticated profile with an accepted `community_members` row, no deletion request, no active community ban, and no active community timeout. A removed member has no membership row and is denied. Visitors and public-read users are denied Voice metadata and LiveKit authorization.

The gate is community-scoped. Membership in one community never authorizes a room in another community, and the requested channel must be a Voice channel belonging to the requested community.

## Deliberate separation

Ordinary member media access does not use role permission or channel override evaluation. Historical permission definitions remain available for UI/admin catalog compatibility, but they are not an authorization boundary for ordinary Voice or Screen access.

Moderation remains role-aware. Mute and remove operations continue through `authorize_livekit_voice_moderation`, including permission checks and strict actor-above-target role hierarchy. This change does not grant members moderation, ban, room-management, or meeting-management authority.

## Client contract

The renderer uses `CommunityAccess.isActiveMember` only as an early UX gate. LiveKit token issuance remains authoritative and calls the server RPC. UI checks never replace database/RPC enforcement.

## Validation

`scripts/smoke-voice-screen-permissions.mjs` verifies the structural separation between ordinary member access and role-aware moderation. `scripts/v1-voice-permissions-hosted-validation.mjs` includes Owner, Admin, Moderator, Member, and roleless Member grants plus Visitor, blocked member, and unauthorized-user denials. Hosted execution remains blocked until staging-only synthetic credentials and fixture IDs are supplied.
