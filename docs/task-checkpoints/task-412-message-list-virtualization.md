# Task 412: MessageList virtualization

## Scope
- Prepared the MessageList virtualization architecture without changing runtime rendering.
- Preserved the premium desktop chat layout and existing scroll behavior.

## Completed
- Documented current MessageList behavior and scroll guarantees.
- Documented why full virtualization is deferred until a dedicated variable-height implementation.
- Defined a future virtual row model for messages, unread divider, blocked placeholders, and typing indicator.
- Added manual QA criteria for large message lists.

## Verification
- Run `Test-Path docs/message-list-virtualization.md`.
- Run `npm run typecheck`.

## Manual test steps
1. Open the app and confirm MessageList still scrolls independently.
2. Confirm the composer stays pinned.
3. Send a local/mock message and confirm auto-scroll still works.
4. Use message search jump/highlight if available.
5. Confirm no horizontal overflow appears.

## Notes
- Runtime virtualization is intentionally deferred because current messages have variable heights and search jump/editing/attachments must remain stable.
