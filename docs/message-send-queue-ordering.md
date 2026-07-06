# Message Send Queue Ordering

Picom must preserve user message order during rapid sends, offline/reconnect paths, and future Supabase realtime echoes. This document records the MVP ordering policy and the small local queue foundation.

## Current implementation

- `src/services/messageSendQueueService.ts` maintains a FIFO queue per `communityId:channelId`.
- `App.sendMessage` routes send operations through the queue.
- Each outgoing message gets a per-channel `localOrder` value.
- `useLocalMessageState` preserves display order using server `sequence` first, then `localOrder`, then `createdAt`/`id` fallback.
- Failed sends do not permanently block later messages; the queue continues after failure.

## Ordering rules

1. Server `sequence` is authoritative when present.
2. `localOrder` preserves local visible order while server sequence is missing.
3. `createdAt` remains fallback for existing mock/seed data.
4. `clientMessageId` remains the duplicate-prevention key.
5. Realtime echo should reconcile by message `id` or `clientMessageId` rather than appending duplicates.

## Failure behavior

For MVP, a failed queued message does not stop subsequent messages forever. The user sees the existing send failure toast/error path, and later sends continue in channel order.

Future offline queue can choose stricter behavior per channel:

- Continue after failure for independent messages.
- Pause after failure when ordering is semantically important.
- Let user retry/remove failed messages.

## Offline/reconnect placeholder

Future offline queue should:

- Store queued actions per channel.
- Flush in ascending `localOrder` per channel.
- Preserve message text for copy/retry.
- Reconcile confirmations using `clientMessageId`.
- Avoid retrying unsafe operations without idempotency.

## Testing checklist

- Send three messages rapidly in the same channel.
- Confirm visible order matches typed order.
- Trigger one send failure and confirm later sends can still proceed.
- Confirm duplicate realtime echo with the same `clientMessageId` does not duplicate messages.
- Confirm existing mock messages still sort by sequence/createdAt.
