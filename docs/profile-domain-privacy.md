# Profile Domain and Privacy

## Canonical model

`UserProfile` is Picom's canonical renderer domain. It contains identity, avatar/cover, bio/status, location/timezone, preferred language, tags, community roles, derived stats, verification, relationship state, onboarding state, privacy projection, media, and activity.

`ProfileSummary` is only an editor projection derived from `UserProfile`; it is not a second identity model.

## Storage and repository boundary

- Core public identity remains in `profiles`.
- Extended fields (`cover_url`, `preferred_language`, `tags`) live in owner-private `profile_details`.
- Location/timezone and visibility choices remain in owner-private `profile_privacy_settings`.
- Components never query Supabase directly.
- Reads use `get_profile_domain_v1`; writes use `update_own_profile_domain`.

## Visibility controls

- Profile audience: everyone, shared communities, or friends.
- Online status, location, timezone, activity, shared media, communities/roles, friendship context, follow counts, and Radio/Podcast sections have independent controls.
- Activity and media still require `can_view_message` for every source message. Private channel content is never exposed by profile settings.
- Community and relationship summaries require a trusted viewer relationship when enabled.
- Blocking fails the entire profile projection closed.

## Mock parity

Mock profiles use the same `UserProfile` and `ProfilePrivacyProjection` shapes. Supabase mode does not fall back to mock activity/media while remote profile data is loading or unavailable.

## Hosted evidence

Structural smoke tests verify schema/RPC/RLS contracts locally. Live multi-user privacy/RLS execution requires protected Supabase staging identities and is not claimed by this document.
