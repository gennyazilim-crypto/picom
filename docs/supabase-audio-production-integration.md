# Supabase Radio and Podcast Production Integration

## Runtime boundary

Radio and Podcast UI surfaces consume the `src/services/audio` layer. Components do not query Supabase directly. `audioDataSource` keeps mock mode deterministic and switches to the configured Supabase client for production catalog, listener, save, reaction, comment, draft, and publication operations.

Radio covers use the private `audio-covers` bucket. Podcast audio uses the private `podcast-audio` bucket and Podcast covers use `audio-covers`. The service layer validates type and size, writes community/type-scoped object paths, stores only object metadata, and resolves short-lived signed URLs for playback or preview.

## Authorization and data visibility

- Radio settings, programs, sessions, schedules, and announcements reject non-Radio community relationships through table-level database kind guards, including privileged migration/service writes.
- Podcast tables reject non-Podcast community relationships through database kind guards.
- Radio listener, host, save, and reaction writes remain current-user or permission scoped through RLS/RPC boundaries.
- Podcast drafts are visible only to their authorized production team; published episodes follow community visibility.
- Podcast comments, reactions, saves, and playback progress remain RLS scoped.
- Storage policies reuse the same Radio/Podcast visibility and management helpers as metadata reads and writes.

## Realtime lifecycle

`useAudioCatalogState` owns the Radio and Podcast Realtime subscriptions. Insert, update, and delete events trigger one debounced service refresh. The transports deduplicate events, reconnect with bounded backoff, ignore stale generations, and remove Supabase channels after the final subscriber leaves.

## Evidence boundary

Local contracts cover service routing, UI decoupling, kind guards, private buckets, RLS policy presence, Realtime publication membership, deduplication, and cleanup. Real multi-client Radio listener counts, Podcast comment/reaction propagation, signed media playback, and hosted RLS execution remain **BLOCKED** until Supabase CLI or protected staging credentials and synthetic accounts are available. No hosted PASS is claimed.
