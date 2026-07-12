# Task 615 - Global Navigation Badges, Notifications, and Deep Links

## Result

- Global badge values now come from one pure derivation service over existing state; no new realtime subscription was introduced.
- DM unread excludes duplicate, archived, muted, expired-mute-aware, and blocked-user conversations.
- Communities aggregate visible channel mentions first and unread channels second, excluding muted or inaccessible channels.
- Radio counts only visible realtime rooms in Radio communities. Mock occupancy and community counts do not create a live badge.
- Events count unique, non-cancelled, relevant events in the next seven days. DND suppresses attention-oriented Radio/Event badges while preserving inbox-style DM and mention unread state.
- Bookmarks and Podcasts intentionally have no synthetic badge.
- Notification and native deep-link routing revalidates authentication, membership/public access, channel visibility, block state, and community kind before navigation.
- Notification items are marked read only after a destination passes local policy validation.

## Evidence

- `node scripts/global-navigation-badges-notifications-deep-links-smoke.mjs`
- `node scripts/global-navigation-shell-smoke.mjs`
- `npm run protocol-handler:smoke`
- `npm run notifications:routing:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Hosted two-client badge propagation remains BLOCKED until protected Supabase staging evidence is run. The implementation deliberately reuses existing read-state, notification inbox, and voice discovery subscriptions rather than opening duplicate channels.
