# Task 092 - Enter and Shift+Enter behavior

MessageComposer now has explicit keyboard handling for desktop chat input.

## Behavior

- Enter sends the current message.
- Shift+Enter keeps the default textarea newline behavior.
- Empty messages are ignored unless attachments are present.
- IME/composition input is respected so composing text does not accidentally send.

## Manual verification

1. Type a message and press Enter.
2. Confirm the message sends locally.
3. Type a message, press Shift+Enter, and confirm a newline is added.
4. Confirm the send button remains disabled when there is no text or attachment.
