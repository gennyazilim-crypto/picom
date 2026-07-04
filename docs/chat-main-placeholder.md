# ChatMain placeholder

Task 043 extracts the central desktop chat column into a dedicated component.

## Behavior

- ChatHeader remains fixed at the top of the center column.
- MessageList scrolls independently.
- MessageComposer stays pinned at the bottom.
- Local message send, attachment previews, image preview opening, and member toggle behavior remain intact.
- Voice channels continue to show a placeholder instead of real audio.

## Manual verification

- Launch Picom.
- Switch text channels and send a local message.
- Toggle the member sidebar from the chat header.
- Open image attachments from the message list.
- Switch to a voice channel and confirm the placeholder view appears.