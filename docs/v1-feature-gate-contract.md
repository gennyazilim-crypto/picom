# Picom V1 Feature Gate Contract

The authoritative registry is src/config/v1ReleaseScope.ts. Renderer navigation, channel filtering, authenticated route/deep link guards, Settings, Help, diagnostics, search, and release copy consume that registry.

## Voice and Screen Share

Task 668 classifies Voice Rooms and Screen Share as IN_V1.

- Voice channels are V1-visible when the user can access the text community.
- An authenticated active community member may join, publish microphone audio, subscribe to remote audio, start an explicit Screen Share, and subscribe to remote shares.
- Owner/Admin/Moderator/custom roles do not grant ordinary media access; moderation remains a separate hierarchy.
- Visitors, non-members, removed, banned, suspended, ended-room, and provider-unavailable states fail closed.
- Feature flags and emergency kill switches may temporarily disable a service for safety, but cannot grant access.
- Media permission is requested only after explicit room/share action.

## Edge boundary

The release manifest includes authenticated livekit-token and livekit-moderation functions plus the signature-verified internal livekit-webhook. Provider credentials remain server-only.

## Retained gated source

Do not delete Radio, Podcast, Events, Bookmarks, Meeting, bot, plugin, enterprise, or other post-V1 source solely because it is gated. Hidden routes and deep links must continue to fail closed without exposing data.
