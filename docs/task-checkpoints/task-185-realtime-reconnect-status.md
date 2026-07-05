# Task 185: Implement realtime reconnect status

## Scope
- Hardened Supabase message realtime connection status for the active community/channel subscription.
- Kept the existing Electron desktop UI, custom titlebar, community layout, Mention Feed, and Profile Page unchanged.

## Changes
- Unexpected `CLOSED` realtime channel status after a successful connection now maps to `reconnecting` instead of immediately appearing permanently disconnected.
- `useSupabaseMessageRealtime` stores realtime callbacks in refs so message insert/update/delete handlers can update without resubscribing the active channel.
- Added browser/Electron renderer online/offline listeners for the message realtime hook so the ChatHeader status pill can show `disconnected` and recover to `reconnecting` safely.

## Safety notes
- The hook still subscribes only to the active community/channel message room.
- Cleanup still removes the Supabase channel on channel/community change and unmount.
- Existing message id/clientMessageId dedupe and event ordering guard remain in place.
- No Supabase service_role, LiveKit secrets, tokens, or passwords are exposed.

## Manual test steps
1. Start the app in Electron dev mode.
2. Sign in or use Supabase mode with two windows.
3. Open the same community/channel in both windows.
4. Send messages from one window and confirm the other receives them without duplicates.
5. Switch channels repeatedly and confirm no duplicate messages appear after returning.
6. Temporarily disconnect network or stop/restart the realtime backend and confirm the ChatHeader status changes to disconnected/reconnecting without crashing.
