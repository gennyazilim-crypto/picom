# Task 440 Checkpoint: Read Receipts Placeholder

## Summary

Connected the existing Privacy & Safety read receipt preference to a compact, opt-in read receipt placeholder on the current user's messages.

## Scope

- Added a subscribe API to `userSafetyCenterService`.
- App now tracks safety settings changes.
- ChatMain and MessageList pass read receipt preference to MessageItem.
- MessageItem shows a compact `Reads on` placeholder only for current user's messages when enabled.
- Documented privacy boundaries and future Supabase path.
- Added smoke verification.

## Files changed

- `src/services/userSafetyCenterService.ts`
- `src/App.tsx`
- `src/components/ChatMain.tsx`
- `src/components/MessageList.tsx`
- `src/components/MessageItem.tsx`
- `src/styles.css`
- `docs/read-receipts-placeholder.md`
- `scripts/read-receipts-placeholder-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-440-read-receipts-placeholder.md`

## Validation

- `npm run read-receipts:smoke`
- `npm run react:hooks:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- Read receipts remain local/placeholder only.
- No detailed reader list or Supabase receipt table was added.
- No mobile UI or layout redesign was added.

