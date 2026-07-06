# Message Delivery Receipts Placeholder

Picom now has a small delivery receipt foundation for the current user's messages.

## Statuses

- `sending`: optimistic send is in progress.
- `sent`: the server or mock service accepted the message.
- `delivered`: future recipient delivery confirmation placeholder.
- `failed`: send failed and the user should be able to recover the message text.
- `queued_offline`: message is queued locally until the app reconnects.

## Current behavior

- Current user's messages show a compact status pill in `MessageItem`.
- Successful local/mock sends currently resolve to `sent`.
- Realtime/server confirmation can later promote messages to `sent` or `delivered`.
- Offline queue work can later set `queued_offline`.
- Failed send queue work can later set `failed`.

## Recoverable failure placeholder

For `failed` and `queued_offline` states, `MessageItem` exposes compact recovery actions:

- Retry placeholder
- Copy text
- Remove placeholder

Only copy is fully wired today through `clipboardService`. Retry/remove stay as safe placeholder toasts until the offline queue mutation layer owns those actions.

## Future backend/realtime path

- Server confirmation marks a message `sent`.
- Future delivery receipts can be emitted over Supabase Realtime or a dedicated receipts table.
- Read receipts remain separate from delivery receipts and must respect privacy settings.
- Backend and RLS remain the source of truth for whether a message exists and who can see it.

## Test steps

Run:

```bash
npm run message:delivery-receipts:smoke
npm run typecheck
npm run build
```

Manual checks:

1. Send a local message.
2. Confirm your own message shows a subtle `Sent` status.
3. Confirm other users' messages do not show your delivery status.
4. Temporarily set a mock own message to `failed` or `queued_offline` and confirm recovery actions render.
5. Confirm no layout shift or horizontal overflow appears.

