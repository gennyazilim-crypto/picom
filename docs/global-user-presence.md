# Global user presence

Picom exposes one presence control in the authenticated global user card. Verification remains adjacent to the display name, while the avatar dot represents derived presence only.

## Preference and display

- The local preference is one of `online`, `idle`, `dnd`, or `invisible` and is persisted under the existing local-settings policy.
- A disconnected or reconnecting client displays `Offline`, regardless of its saved preference.
- Invisible displays `Invisible` to the current user but publishes `Offline` and `share_presence=false` to other users.
- Do Not Disturb remains separate from notification policy, although the current renderer uses it to activate DND notification behavior.

## Session lifecycle

- Each renderer session receives a random UUID and publishes a 30-second heartbeat.
- Supabase Realtime Presence supplies connection and reconnect state without publishing user identifiers in the channel topic.
- The `user_presence_sessions` table stores private, expiring session heartbeats through security-definer RPCs only.
- Active sessions are aggregated into the existing friend-visible `friend_presence` row. One closing window cannot mark another active session offline.
- Logout, user change, renderer teardown, and `pagehide` request explicit cleanup. A 100-second expiry is the fallback for abrupt process or network loss.
- Custom profile status text is never included in public presence payloads.

## Hosted evidence

The local mock and structural RLS contracts cover derivation and policy shape. Cross-client Supabase Realtime behavior remains blocked until the migration is applied to a configured hosted staging project and two authenticated clients are available.
