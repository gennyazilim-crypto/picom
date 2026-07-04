# Task 171 Checkpoint: Upload image before sending message

## Completed

- Added original `File` reference to local attachment previews.
- Routed composer send through `uploadService.uploadImageAttachment()` before message send.
- Added sending state to prevent double submits.
- Passed `communityId` into `MessageComposer` through `ChatMain`.
- Kept MVP local preview rendering intact.

## Changed files

- `src/components/MessageComposer.tsx`
- `src/components/ChatMain.tsx`
- `src/services/fileService.ts`
- `docs/upload-image-before-message.md`
- `docs/task-checkpoints/task-171-upload-image-before-message.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: attach an image and send a message in mock mode. The image should upload through mock service first, then render in MessageList.