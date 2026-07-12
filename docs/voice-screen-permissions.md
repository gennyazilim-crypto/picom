# Voice and Screen Permissions

## V1 access rule

Every authenticated active community member can view an existing Voice channel, join its room, publish microphone audio, start a selected Screen Share, and subscribe to remote audio/shares. This access is independent of Owner/Admin/Moderator/custom-role grants and channel permission overrides.

Denied states are unauthenticated, visitor/non-member, non-active membership, removed, banned, suspended, ended/missing room, and unavailable provider.

## Security boundary

- Supabase RLS/RPC and the livekit-token Edge Function enforce access.
- Tokens are short-lived and intent-scoped.
- Provider credentials remain server-only.
- Capture starts only after explicit user action.
- Raw microphone audio and shared-screen content are not logged, recorded, or stored.
- Rate limits and emergency kill switches fail closed.

## Moderation

Owner/Admin/Moderator moderation remains role-aware and hierarchy controlled. It is not an ordinary join/speak/share permission.

## Release state

Voice Rooms and Screen Share are IN_V1 under Task 668. Public distribution still requires the separate immutable-RC and Go/No-Go gates.
