# Task 188: Update MemberSidebar presence dots

## Scope
- Hardened MemberSidebar presence rendering without changing the desktop layout or visual direction.
- Kept all realtime, community, profile, and chat flows intact.

## Changes
- Member groups are memoized after search filtering so presence updates do not repeatedly rebuild group structure outside dependency changes.
- Added a memoized `MemberRow` component so unchanged member rows can avoid unnecessary rerenders when presence updates affect only specific members.
- Presence dots still use `data-presence`, `data-online`, semantic labels, and token-driven status colors.
- Existing online, idle, do-not-disturb, and offline visual states remain intact.

## Safety notes
- No secrets are exposed.
- No new mobile or web-first UI was introduced.
- The existing MemberSidebar search and profile/context-menu interactions remain unchanged.

## Manual test steps
1. Start the app in mock mode and confirm MemberSidebar renders Admins, Moderators, Participants, and Offline groups.
2. Search for a member and confirm matching rows still filter correctly.
3. In Supabase mode with two sessions, update presence and confirm only the affected member status dot/text changes visually.
4. Click a member row and confirm the ProfileView still opens.
5. Right-click a member row and confirm the context menu still opens.
