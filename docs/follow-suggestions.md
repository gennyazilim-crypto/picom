# Follow Suggestions V2

## Ranking inputs

Picom ranks only eligible users from communities the current user has joined:

- mutual community count, capped;
- relevant matching role in mutual communities, capped;
- recent mentions already visible to the current user;
- bounded popularity attached to those visible mentions.

Current user, bots, already-followed users, blocked users and users without a mutual joined community are excluded before scoring. Message body and private/inaccessible mentions are not scoring inputs.

## Product integration

- First-run onboarding uses ranked suggestions and falls back to filtered safe mock suggestions when no eligible result exists.
- Mention Feed's right panel shows up to four suggested follows.
- Blocked users are also removed from Popular People and Following rows.
- Selecting a suggestion opens the existing profile flow; follow state remains managed by the existing relationship service.

## Supabase and RLS assumptions

- Production candidate generation belongs in a backend/RPC query with RLS-enforced mutual-community visibility.
- Private membership, role and mention data must not be returned merely to explain a suggestion.
- Block relationships must be checked in both directions server-side before returning candidates.
- Recent mention candidates must already pass community/channel/message access policies.
- The response should contain safe profile DTOs and short reason codes, not raw member graphs, message IDs/content or popularity internals.
- Requests require auth, pagination, rate limits, deterministic versioned ranking and abuse/privacy review.

The current helper operates on already-loaded accessible app data. It does not replace Supabase authorization and does not send data externally.

## Safety and fairness

- No persistent behavioral profile, contact import, precise activity timeline or sensitive attribute is used.
- Popularity is bounded so it cannot dominate mutual context.
- Reasons are explainable: mutual communities, relevant role and recent visible mentions.
- Results are deterministic for equal inputs and limited to 20.
- Future production ranking needs block/mute/report safety review, gaming controls, diversity/repetition review, opt-out and transparent reason copy.
