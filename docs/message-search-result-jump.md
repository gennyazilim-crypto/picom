# Message Search Result Jump

Status: implemented as local Command Palette jump/highlight behavior

Message search results in the Command Palette now navigate to the message's community/channel and briefly highlight the target message.

## Behavior

- Selecting a message result switches to the community view.
- The target community and channel are selected.
- Unread state for the target channel is cleared.
- The target message is scrolled into view and highlighted briefly.
- If the message is hidden behind a blocked-user placeholder, the placeholder wrapper can still be highlighted safely.

## Safety boundaries

- This is local/mock-safe behavior and does not bypass private channel access.
- Future Supabase search must still enforce RLS before returning message results.
- Deleted or inaccessible messages should show a clear fallback when backend context fetching is implemented.

## Manual verification

1. Open the Command Palette.
2. Search for text from a visible message.
3. Select a result in the Messages group.
4. Confirm Picom switches to the correct community/channel.
5. Confirm the message scrolls into view with a short highlight animation.
