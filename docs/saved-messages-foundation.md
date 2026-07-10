# Saved Messages Sync

Picom Saved Messages is a private cross-session bookmark list backed by `saved_messages`. Message context menus and Mention Feed Save actions share the same service and Saved view.

## Access and membership loss

Every snapshot joins the bookmark to a non-deleted message and rechecks `can_view_channel`. A private channel bookmark disappears after membership or channel access is lost; cached preview data is replaced by the authorized snapshot and the view independently refuses to render entries without a currently visible community/channel. Other users cannot select, insert, or delete a user's bookmarks.

## Sync behavior

Save is idempotent through `(user_id,message_id)`. Supabase Realtime watches only RLS-visible saved-row changes and reloads the authorized snapshot, enabling cross-session desktop sync. Mock mode retains a local fallback. Diagnostics and logs do not contain saved message content.

## Desktop surfaces

- Message context menu: Save/Unsave.
- Mention Feed cards: Save/Saved using the same message ID.
- Saved Messages view: accessible rows, Jump, and Unsave.
- Command Palette: open private Saved Messages view.

## manual checklist

1. Save and unsave from a message context menu.
2. Save the same message from Mention Feed and confirm one bookmark.
3. Open two sessions and verify realtime save/unsave sync.
4. Remove private channel membership and confirm its bookmark/content disappears.
5. Delete a message and confirm it is absent from the next snapshot.
6. Confirm Jump reports inaccessible instead of showing stale content.
