# Task 187: Create presence channel for online status

## Scope
- Hardened the existing Supabase presence channel for online/member status in the active community.
- Kept the desktop UI layout, titlebar, community menu, Mention Feed, Profile Page, and chat flow unchanged.

## Changes
- Presence continues to use `presence:community:{communityId}`.
- Presence payload includes `userId`, `displayName`, `avatarUrl`, `status`, and `lastSeen`.
- The presence hook now keeps one subscription per active community/user instead of reconnecting when display name, avatar, or status changes.
- Profile/status changes re-track the current presence payload over the existing channel.
- Added online/offline, focus, and visibility resume handlers to refresh presence after reconnect or laptop sleep/wake style transitions.
- Connection status can transition through `connecting`, `connected`, `disconnected`, and `reconnecting` safely.
- Presence map equality checks remain in place to avoid unnecessary member list state churn.

## Safety notes
- No secrets are exposed in renderer code.
- Mock mode remains unaffected because Supabase presence only runs when Supabase mode is active.
- Cleanup untracks presence and removes the Supabase channel on community/user change and unmount.

## Manual test steps
1. Start two Electron windows in Supabase mode with two sessions/users.
2. Open the same community in both windows.
3. Confirm online dots update in MemberSidebar.
4. Change status from the tray/user state and confirm presence refreshes without duplicate listeners.
5. Switch communities and confirm old presence subscriptions do not keep updating the previous community.
6. Sleep/wake, focus, or reconnect network and confirm presence refreshes without crashing.
