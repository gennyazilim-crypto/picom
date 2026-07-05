# Message Drafts Per Channel

Status: implemented as local MVP-safe foundation

Picom now preserves composer text per community/channel using local client storage. This is intentionally limited to text drafts so stale file object URLs or sensitive binary data are not persisted.

## Behavior

- Draft key scope: `communityId + channelId`.
- Composer text is saved locally while typing.
- Switching channels restores that channel's saved draft.
- Sending a message clears the active channel draft.
- Empty drafts are removed from local storage.
- Attachment previews are not persisted.
- Attachment object URLs are revoked when switching channels.

## Safety boundaries

- No auth tokens, passwords, session data, files, or binary attachment data are stored.
- Draft persistence is best-effort and never blocks message sending.
- Corrupted draft data falls back to an empty draft.
- Drafts are local to the desktop client and are not synced through Supabase.

## Manual verification

1. Type text in one channel without sending.
2. Switch to another channel and type different text.
3. Switch back to the first channel and confirm the first draft is restored.
4. Send the message and confirm the draft clears.
5. Attach an image, switch channels, and confirm stale previews are not restored.
