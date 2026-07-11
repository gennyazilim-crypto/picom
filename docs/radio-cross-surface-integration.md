# Radio cross-surface integration

Task 451 connects Radio to the same production-facing navigation and state contracts used across Picom.

## Surfaces

- Mention Feed presents live, scheduled, and ended Radio sessions with source context, listener/view counts, reactions, read state, saved state, and an exact **Open in Radio** action.
- Profile **Hosted Radio** and **Saved audio** sections use the shared Radio/Podcast services rather than a separate mock-only save path.
- Advanced search returns only sessions visible through the current community access model locally and Supabase RLS remotely.
- `picom://radio/{communityId}/session/{sessionId}` and Radio notifications retain the exact session target.
- Radio cards use the canonical approved verification helper for host identity.

## Privacy boundary

Local results require membership or public-content access. Connected-mode queries remain subject to `radio_sessions` RLS. Per-user read records are private and can only reference an audio item the user may view. Profile audio is assembled only from communities already visible to the viewer.

Draft and cancelled Radio sessions are excluded from feed and search. Private sessions are never made visible merely because a deep link or notification contains an identifier.
