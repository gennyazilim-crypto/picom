# Direct Messages Desktop UI

Picom exposes Direct Messages as a separate ServerRail destination next to Home. Home remains the Mention Feed product surface; opening DM never changes or replaces that decision.

## Layout and behavior

- Fixed desktop conversation list with participant status, last preview, draft marker, and unread count.
- Flexible chat view with participant profile entry, independently scrolling message list, and pinned composer.
- No mobile navigation, responsive phone drawer, or group-DM controls.
- Conversation selection clears the local unread indicator and records a backend read timestamp in Supabase mode.

## Send reliability

The composer waits for the backend result. While sending, duplicate submit is blocked. Successful sends clear the per-conversation draft; failures remove the optimistic row, retain draft text, and show a compact inline error plus the existing toast. Realtime echoes reconcile by message/client ID.

## Privacy states

Blocked or privacy-denied conversations fail safely without raw backend details. No private body appears in native notifications. Empty states explain how to start from a profile without exposing unavailable users.

## Manual checks

1. Open DM from ServerRail and confirm Home still opens Mention Feed.
2. Switch conversations and verify unread/draft indicators.
3. Send successfully and confirm the draft clears once.
4. Simulate backend rejection and confirm text remains with an inline error.
5. Open two windows and verify one realtime message, no duplicate.
