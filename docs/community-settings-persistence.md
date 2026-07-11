# Community settings persistence

Community Admin persists identity, controlled icon/banner uploads, visibility, public read, default notifications, versioned join rules, and Text/Radio/Podcast defaults through service-layer operations. UI components never call Supabase directly.

`update_community_settings` locks the active community, validates every field and kind-specific JSON shape, replaces published rules, synchronizes audio settings, updates the community row, and appends one redacted audit event in a single transaction. A failure rolls back all database changes. Newly uploaded assets are removed by the service when the settings RPC fails.

## Type behavior

- Text: maximum message length, attachment availability, and reaction availability are restrictive RLS insert guards.
- Radio: default host role, schedule timezone/visibility, listener chat, and listener rules are synchronized to `radio_community_settings`; schedule visibility is RLS-enforced.
- Podcast: default publisher role, comment policy, explicit-content default, and comment rules are synchronized to `podcast_community_settings`; comment creation and explicit defaults are database-enforced.

## Branding controls

The public `community-branding` bucket accepts PNG/JPG/WEBP only, with a 6 MB server cap. The desktop service applies a stricter 2 MB icon cap and 6 MB banner cap. Only users with effective `manageCommunity` permission can mutate assets under that community's UUID path.

Hosted RLS and Storage execution remains blocked without an approved Supabase CLI/staging context; repository smoke tests do not fabricate that evidence.
