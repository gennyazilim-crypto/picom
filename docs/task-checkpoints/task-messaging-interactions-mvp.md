# Task Checkpoint: Messaging Interactions MVP

## Scope

Implemented local MVP message interactions for the locked Full MVP.

This task intentionally did not implement:

- Supabase persistence for edits/reactions/replies
- LiveKit
- Direct Messages
- Bot/webhook/plugin features
- Mobile UI

## Implemented

- Local edit own message.
- Local delete own message.
- Local moderator/admin/owner delete-any-message permission using existing role levels.
- Deleted messages render as a consistent `Message deleted.` placeholder.
- Inline edit editor:
  - Enter saves
  - Escape cancels
  - Shift Enter inserts a new line
- Edited messages show an `edited` indicator.
- Local reaction add/remove.
- Reaction picker with:
  - 👍
  - ❤️
  - 😂
  - 🔥
  - 👀
- Existing own reaction click removes/toggles it.
- Reply system:
  - message hover/context action sets reply target
  - composer shows reply preview
  - sent message stores reply target locally
  - message item renders reply preview
  - deleted/missing reply target shows a fallback
- Composer emoji picker inserts emoji into the message body.

## Validation

Run:

```bash
npm run typecheck
npm run mock:smoke
npm run build
```

Manual UI smoke:

```bash
npm run dev
```

Then verify:

- Login with the local seed account.
- Send a message.
- Reply to a message and send the reply.
- Edit your own message.
- Press Escape during edit to cancel.
- Press Shift Enter during edit to add a line.
- Delete your own message.
- As the owner mock user, delete another user's message.
- Add and remove reactions.
- Insert emoji from the composer.
- Confirm chat layout, titlebar, Mention Feed, and ProfileView still open.

## Notes

- This is local/mock-first interaction behavior.
- Backend/API persistence remains a later Full MVP task.
