# Picom V1 Community Member Media Policy

Status date: 2026-07-12  
Policy state: **LOCKED - INCLUDED BY TASK 668; public release gates remain**

## Canonical rule

An authenticated Picom user with an accepted, active membership in a community may:

- discover that community's Voice channels;
- join a live Voice Room;
- publish microphone audio;
- subscribe to remote participant audio;
- start Screen Share after an explicit source-selection action;
- subscribe to each remote Screen Share track.

These ordinary media capabilities do not depend on Owner, Admin, Moderator, custom-role, role-position, category override, channel override, or a special Voice/Screen role.

## Active membership contract

`isActiveCommunityMember(userId, communityId)` is the future canonical service/backend decision. It is true only when all of these are true:

1. The caller is authenticated and maps to an active canonical profile.
2. The community exists and is not archived or deleted.
3. An accepted/active `community_members` row exists for that user and community.
4. No active community ban, suspension, kick/removal, safety block, or equivalent denial applies.
5. The requested Voice channel/room exists and has not ended.

A visitor, public-read user, pending applicant, rejected applicant, removed member, banned member, suspended member, or unauthenticated caller is not an active community member.

## Capability result

For an active member and an existing room:

| Capability | Result |
| --- | --- |
| `canViewVoiceChannel` | true |
| `canJoinVoiceRoom` | true |
| `canPublishMicrophone` | true |
| `canShareScreen` | true |
| `canSubscribeRemoteAudio` | true |
| `canSubscribeScreenShare` | true |

Provider capacity, rate limits, user device permission, room lifecycle, network state, and emergency kill switches may make an operation temporarily unavailable. They are technical/safety controls, not role authorization.

## Visitor and public-read boundary

Public-read access never grants media access. Visitors may see only non-private content allowed by the community's public-read policy. They must join and obtain active membership before Voice metadata, Voice Room tokens, audio publication, or Screen Share publication/subscription is available.

## Moderation remains role-aware

Ordinary access and moderation are separate decisions:

- Active members may join, speak, listen, and share.
- Owner/Admin/Moderator actions such as remote mute, remove, ban, or end-room remain permission- and hierarchy-controlled.
- A normal member cannot moderate another participant.
- Moderation grants never convert a visitor or blocked account into an active member.

## Multiple simultaneous screen shares

Every active member may publish one user-selected Screen Share track. Multiple members may share concurrently when supported by LiveKit and the desktop resource budget. The UI must render all active sharers or offer a sharer switcher; it must not reject a second sharer because of role. Capacity/rate limits may fail closed with a clear technical error.

## Security and privacy invariants

- LiveKit credentials stay in server-side secret custody.
- The Edge Function derives canonical room and participant identity server-side.
- Tokens are short lived and scoped to one authorized room.
- Renderer components use typed services and never call provider APIs ad hoc.
- Screen capture begins only after explicit user selection.
- Picom does not record, persist, upload, analyze, or log raw microphone or shared-screen content.
- Diagnostics redact tokens, credentials, device identifiers, room-sensitive metadata, and captured content.

## Release gate

Task 668 enables this policy in V1 after Tasks 658-667 supplied real provider, hosted multi-client, remote-render, packaged-Windows, security, reconnect, and cleanup evidence. `src/config/v1ReleaseScope.ts` and the release manifest now classify Voice Rooms and Screen Share as included.

