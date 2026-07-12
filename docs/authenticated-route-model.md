# Authenticated route model

Picom uses one typed authenticated route model for global navigation and startup policy. The canonical default is `feed`; the renderer maps it to the existing `mentionFeed` workspace until internal view names are fully consolidated.

## Route inventory

| Route | Destination | Startup eligible |
| --- | --- | --- |
| `feed` | Mention Feed | Yes, authoritative default |
| `directMessages` | Direct Messages | Explicit navigation only |
| `communities` | Community workspace | Explicit navigation only |
| `radio` | Radio workspace | Explicit navigation only |
| `podcasts` | Podcasts workspace | Explicit navigation only |
| `events` | Events workspace | Explicit navigation only |
| `bookmarks` | Saved messages/bookmarks | Explicit navigation only |
| `settings` | Settings overlay | Explicit navigation only |
| `support` | Help and Support surface | Explicit navigation only |
| `profile` | Full profile | Validated deep link or explicit navigation |
| `meeting` | Meeting workspace | Validated deep link only |
| `voice` | Voice channel | Validated deep link only |

## Landing policy

- Login, registration, onboarding completion, session restoration, and desktop relaunch all land on Feed.
- Picom does not restore a previous community, DM, Settings, or Support surface as the startup destination.
- Community and channel selections remain in memory while the user navigates elsewhere; the landing policy does not erase them.
- The session router emits a landing intent once per authenticated user. Later session refreshes do not override manual navigation.
- Logout resets the session router, so the next authenticated entry starts at Feed.

## Deep links

Deep links are accepted only after authentication and only for known routes. Profile, meeting, and voice links require their identifying parameter. Unknown and deprecated routes are rejected safely; legacy `home` and `mentionFeed` aliases normalize to Feed. Existing feature-level access checks remain authoritative after route validation.

The precedence is: establish an authenticated Feed shell first, then apply an explicit validated deep-link intent. Ordinary relaunch does not manufacture or restore a deep link.
