# Picom Community Member Media Policy

Status: **CANONICAL FOR V1**
Hosting: **SELF_HOSTED_LIVEKIT**

## Ordinary access

Every authenticated active community member may:

- see existing Voice channels;
- join a Voice Room;
- publish microphone audio;
- subscribe to remote participant audio;
- start Screen Share after explicit user action;
- subscribe to remote Screen Share tracks.

Owner, Admin, Moderator, custom-role, role position, category override, channel override, or a special Voice role is not required for ordinary media access.

## Denied states

A Visitor, public-read user, unauthenticated user, non-member, pending/rejected applicant, removed/kicked member, banned member, suspended member, safety-blocked user, or caller targeting an invalid/ended room is denied.

## Moderation

Moderation remains a separate role and hierarchy decision. Authorized Owner/Admin/Moderator actors may mute, remove, ban, or end a room according to policy. An ordinary member cannot moderate another participant.

## Privacy and safety

- Capture starts only after explicit user action.
- Provider credentials remain server-side.
- Tokens are short-lived and room-scoped.
- Raw microphone audio and shared-screen frames are not recorded, persisted, uploaded, analyzed, or logged.
- Diagnostics exclude credentials, participant tokens, private room identifiers, device identifiers, and captured content.
- Rate limits, provider capacity, network state, emergency kill switches, and room lifecycle may make media temporarily unavailable but do not alter membership authorization.

## Release boundary

Voice Rooms and Screen Share remain IN_V1 and visible. Self-hosted infrastructure certification is a public-release blocker until Tasks 658-673 pass; it is not permission to hide or remove the feature.
