# Task 186: Create typing indicator via broadcast

## Scope
- Hardened the existing Supabase broadcast typing indicator for the active community/channel.
- Kept the Electron desktop layout, titlebar, community UI, Mention Feed, and Profile Page unchanged.

## Changes
- Typing broadcast events continue to use `typing:community:{communityId}:channel:{channelId}`.
- Current user typing payloads are ignored in the receiving hook so users do not see themselves typing.
- Typing start events remain throttled through `shouldThrottleRealtimeSend` and composer-level throttling.
- Added typing event timestamp parsing and per-user ordering guard so stale stop/start events do not override newer typing state.
- Added renderer online/offline listeners so typing realtime connection status can transition through `disconnected` and `reconnecting` safely.
- Cleanup still sends a best-effort typing stop event and removes the Supabase channel on channel/community change and unmount.

## Safety notes
- No secrets are exposed in renderer code.
- The hook subscribes only to the active community/channel typing broadcast.
- Mock mode remains unaffected because Supabase broadcast only runs when Supabase mode is active.

## Manual test steps
1. Start two Electron windows in Supabase mode.
2. Open the same community and text channel in both windows.
3. Type in one window and confirm the other window shows the typing indicator.
4. Confirm the typing user does not see their own typing indicator.
5. Stop typing or switch channels and confirm the indicator disappears.
6. Disconnect/reconnect network and confirm typing status does not crash or leave stale indicators.
