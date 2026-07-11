# Podcast Cross-Surface Integration

## Canonical source

Podcast episodes, listener state, reactions, comments, saves, and playback progress remain owned by the audio service layer. Feed, Profile, Podcast Community, Search, deep links, and notifications consume service projections rather than maintaining independent episode copies. UI components do not call Supabase directly.

## Mention Feed

Published Podcast episodes can appear as Podcast mention cards. A card may highlight either an approved episode-description mention or a visible, non-deleted comment mention. It keeps the normal Mention Feed social proof: author and community context, cover, duration, listeners/views, reactions, commenter avatars, comments, read state, and save state.

`Open episode` resolves the canonical `sourceId` and opens that exact published episode. `Open community` enters the Podcast community without discarding the selected episode state. Feed reactions use the shared audio service and support add/remove behavior.

## Profile and community surfaces

Profile audio sections and Podcast Community views subscribe to the canonical catalog. They show only records returned by the service access filter. Drafts and inaccessible community episodes are not promoted into public cross-surface projections.

## Search and deep links

Advanced Search has a dedicated `Podcasts` result category. Results carry both `communityId` and `podcastEpisodeId`; local mode searches published catalog data, while Supabase mode relies on RLS-backed episode/comment queries.

The supported exact route is:

```text
picom://podcast/{communityId}/episode/{episodeId}
```

Electron main/preload code validates only this bounded route shape. The renderer then re-fetches the episode through `podcastService`, confirms that it is published and belongs to the requested community, and rechecks current-user access before navigation. A syntactically valid URL never grants access by itself.

## Notifications

`notifications.podcast_episode_id` stores an exact episode route without storing private media URLs. Database triggers inspect newly published/updated episode descriptions and visible Podcast comments, create mention notifications only for matching community members, suppress self-mentions and blocked relationships, and deduplicate by source event.

Client notification routing still applies community/channel notification preferences before inbox storage. Opening a notification uses the same access-checked exact-episode navigation path as Search and deep links.

## Privacy boundaries

- Only published episodes are eligible for Feed, Search, mention notifications, or exact public navigation.
- Supabase RLS remains authoritative for private communities and Podcast records.
- Mention producers require recipient community membership and reject blocked relationships.
- Deleted comments do not produce mention notifications.
- Private media URLs are never copied into notification metadata or deep links.
- Profile and Feed consumers receive only service-filtered records.

The SQL migration and pgTAP contract are structurally testable without credentials. Applying the migration and proving cross-account RLS behavior remain hosted Supabase evidence and must not be reported as passed when the Supabase CLI/environment is unavailable.
