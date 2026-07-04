# Task 170 Checkpoint: Implement composer attachment preview

## Completed

- Wired composer attach button to a hidden native file input.
- Preserved drag/drop and paste attachment flows.
- Added cleanup for removed and overflow preview object URLs.
- Kept preview styling within existing Picom desktop tokens.

## Changed files

- `src/components/MessageComposer.tsx`
- `src/styles.css`
- `docs/composer-attachment-preview.md`
- `docs/task-checkpoints/task-170-composer-attachment-preview.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: attach an image from the composer, remove it, attach again, and send it as a local message.