# Task 137 - Offline Cache and Queue Production

## Result

Completed. Message sends are optimistic, carry visible sending/queued/failed state, wait in a per-channel memory-only FIFO while offline, flush on reconnect, reconcile by stable client ID, and expose real retry/copy/remove recovery actions. Private chat data is not persisted to a custom disk cache.

## Changed files

- `src/services/messageSendQueueService.ts`
- `src/state/useLocalMessageState.ts`
- `src/components/MessageItem.tsx`
- `src/components/MessageList.tsx`
- `src/components/ChatMain.tsx`
- `src/App.tsx`
- `src/services/cacheManagementService.ts`
- `scripts/message-send-queue-ordering-smoke-test.mjs`
- `docs/offline/offline-cache-queue-production.md`
- `docs/task-checkpoints/task-137-offline-cache-queue-production.md`

## Verification

- `npm run message:send-queue:smoke`
- `npm run offline:conflicts:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Durable encrypted offline storage is intentionally not implemented. Live Supabase response-loss, concurrency, session-revocation, and two-window reconnect tests remain production gates.
