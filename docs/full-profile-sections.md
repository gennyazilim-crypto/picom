# Full Profile Sections

Picom's Full Profile view combines only service-layer data the viewer may access.

## Data sources

- Identity, bio, details, privacy, aggregate stats, activity, and media come from `get_profile_domain_v1` in connected mode.
- Mutual communities are derived from the viewer's already access-filtered community catalog.
- Friendship and follow summaries use the existing relationship state plus privacy-projected profile counts.
- Hosted Radio, published Podcast episodes, and current-user saved audio use `audioDataSource`; private communities are absent from the visible catalog.
- Mock mode retains typed mock data. Supabase loading/error states never present mock zeroes as connected production evidence.

## Visibility

- Private profiles show a limited-profile state.
- Activity and media are returned by the profile domain RPC only from accessible source channels.
- Mutual communities require both users to be members of a community already visible to the viewer.
- Saved audio is rendered only on the current user's profile.
- Published Podcast episodes only are shown publicly.

## Interaction contract

- Gallery/shared images open the existing image preview.
- Activity opens its source community/channel.
- Radio opens the existing Radio context or mini player.
- Podcast opens the existing episode detail/player.
- Community rows navigate through the existing access-aware community switcher.
- Profile and audio source failures offer deterministic retry controls.
