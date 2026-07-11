# Notification Preferences Full MVP

Picom keeps notification decisions in `notificationService`; React surfaces and feature services do not call Electron notification APIs directly.

## Preference ownership

- Account-synced settings: master enable, native desktop delivery, sounds, mentions, replies, reactions, direct messages, community announcements, friend events, Radio alerts/reminders, Podcast releases, event reminders, digest behavior, and Quiet Hours.
- Device policy: do-not-disturb plus muted community/channel identifiers remain in the guarded local notification policy store.
- Runtime permission: the operating system or browser owns native notification permission. Picom can request it but cannot bypass a denial.

The local settings document is schema version 9. Migration `8 -> 9` adds category preferences and converts the former sounds-only placeholder value into the supported `sounds_only` mode. Supabase mode stores the account preference document in the owner-only `user_settings` row; mock mode uses the same normalized local model.

## Routing order

1. Master enable and category preference.
2. Do-not-disturb and temporary mute policy.
3. Quiet Hours and mentions-only behavior.
4. Community/channel mute policy.
5. Visible active-context suppression.
6. Native desktop delivery preference and runtime permission.

The inbox and native notification paths share the same category decision. Native notifications use a short tag-based deduplication window so duplicate realtime delivery does not create repeated operating-system alerts. A focused conversation at its readable bottom suppresses both the desktop alert and duplicate inbox/unread work.

## Semantic categories

`mention`, `reply`, `reaction`, `direct_message`, `community_announcement`, `friend_request`, `friend_acceptance`, `radio_live`, `radio_reminder`, `podcast_release`, and `event_reminder` map to independent preferences. `system` remains reserved for essential Picom status notices; general `message` behavior remains compatible with mentions-only and digest routing.

## Safety

- Muted or disabled categories do not generate a public/native alert.
- Quiet Hours use local system time and support overnight ranges.
- Sounds can be disabled without disabling visual native notifications.
- Native payloads contain display copy and routing identifiers only; no auth tokens, credentials, or private diagnostic metadata are included.
- Community/channel visibility and DM participation remain backend/RLS responsibilities before any event reaches this client policy layer.
