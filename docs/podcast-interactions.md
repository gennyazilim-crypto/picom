# Podcast interactions

Podcast social actions remain scoped to an existing Podcast community and episode. Picom does not create a separate follower graph or uncontrolled public comment network for episodes.

## Supported listener actions

- Save and unsave a visible published episode.
- Add one idempotent emoji reaction per user/episode/emoji and remove the current user's reaction.
- Create a moderated comment in a joined Podcast community.
- Edit the current user's own visible comment.
- Soft-delete the current user's own comment.
- Mark an episode listened or clear listener progress.
- Continue normal player-driven progress persistence.

Counts and previews are rebuilt from the canonical audio data source. Mock writes publish the same catalog snapshot used by Community, Feed, and Profile surfaces. Supabase writes refresh that source, and Podcast Realtime changes trigger the same debounced refresh path.

## Permission boundary

`can_use_podcast_listener_state` requires an authenticated user, a published visible episode, and no blocking relationship with the episode author. It allows private save/progress state for an authenticated public viewer without granting community participation.

`can_interact_with_podcast_episode` additionally requires active community membership. Reactions and comments use this stricter permission. Draft and archived episodes reject new reactions, comments, edits, saves, and progress writes. Users may still remove their own reaction, saved item, progress row, or soft-delete their own comment.

RLS remains authoritative. Frontend disabled states and mock checks are user-experience mirrors, not security controls.

## Moderation and privacy

- Blocking hides blocked comment/reaction authors and denies new interaction with a blocked episode author.
- Podcast comments use the community blocked-word, mention-limit, link, and slow-mode settings.
- Comment identity fields are immutable after creation.
- Editing requires the original author and an interactive published episode.
- Own delete is a soft delete; moderation retains its existing manager delete permission.
- Deleted comments do not contribute to preview or count.
- Reactors and commenters outside the viewer's RLS scope are never returned to the renderer.

## Realtime

The Podcast Realtime service watches episode, reaction, comment, saved-item, and playback-progress tables. Events are deduplicated and reconnect with bounded backoff. UI components never subscribe to raw Supabase channels and never call `supabase.from` directly.

## Validation limitation

Local structural smokes validate migration and service contracts. A configured Supabase CLI/staging project is required to execute pgTAP identities, cross-user block tests, and two-client Realtime evidence.
