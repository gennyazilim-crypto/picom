# Task 431 - Message History Export Placeholder

## Summary

Prepared a safe channel message history export placeholder without enabling real exports or downloads.

## Completed

- Added `messageHistoryExportService`.
- Added channel context menu entry: `Export message history placeholder`.
- Added `docs/message-history-export.md`.
- Added `message:history-export:smoke`.

## Safety notes

- No message content is exported in this task.
- No real download URL is generated.
- The placeholder requires community management permission.
- Future backend export must enforce permissions and private-channel access through RLS/trusted server logic.

## Validation

- `npm run message:history-export:smoke`
- `npm run typecheck`
- `npm run build`

