# Offline Cache and Queue Production

## Implemented behavior

Picom keeps the current community/channel/message view in application memory. It does not persist private message bodies, attachment URLs, member lists, or channel history into a custom disk cache. Supabase remains authoritative after reconnect/restart.

Outgoing messages receive a stable `clientMessageId` and per-channel `localOrder`, appear optimistically as `sending` or `queued_offline`, and enter an in-memory FIFO queue. If Chromium reports offline, the head operation waits for the next `online` event. Each channel flushes in order; different channels do not block each other. A failed operation is marked failed and later messages continue.

Server/realtime confirmation reconciles by `clientMessageId`, preventing a second visible message and replacing the optimistic ID/state. Sequence is preferred when available, then local order, then creation time.

The v2 hardening pass returns the same in-flight promise when the same `clientMessageId` is queued again, caps pending sends at 25 per channel and 100 per renderer, and rejects excess work with a recoverable queue-full state. Removing a queued local message marks its pending operation canceled so it cannot silently send after reconnect.

## Recovery

- **Queued offline:** Retry remains available; automatic in-memory flush starts on `online`.
- **Failed send:** Retry reuses the same `clientMessageId` and local order, reducing duplicates when the original server response was lost.
- **Copy text:** uses `clipboardService`; no direct native API.
- **Remove:** deletes only the failed/queued local record, never a confirmed server message.
- **Queue capacity:** preserve/copy text and wait for pending work to settle; Picom does not evict older sends silently.
- **Permission/channel deletion/slow mode/rate limit/duplicate:** `offlineSyncConflictService` supplies bounded, actionable copy.
- **Failed uploads:** composer retains retry/remove controls; send waits for successful uploads.

Subsequent messages continue after a failed message instead of being permanently blocked. Retry is user-driven for backend-unreachable, rate-limit, slow-mode, and unknown failures; no aggressive retry loop is added.

## Privacy and storage

The queue is memory-only by design because message text and attachment references are private content. It is lost when Picom exits or crashes; users can copy failed text before removal/restart. Auth sessions and drafts are not cleared by cache actions. Chromium HTTP/image cache remains browser-managed.

Cache settings report the number of memory-only pending sends. Image/log/message-cache actions preserve auth sessions, drafts, and pending sends; only an explicit message Remove action cancels a queued send. No token, password, authorization header, session payload, or private message body is written by Picom's custom cache layer.

A future durable queue requires encrypted OS-backed storage, account/tenant partitioning, bounded retention/size, logout/session-revocation wipe, attachment staging rules, migration/corruption recovery, and a privacy/security review. LocalStorage is not approved for durable message queue content.

## Conflicts and safety

- Channel deleted or permission lost: do not retarget automatically; preserve text for copy/remove.
- Duplicate client ID: treat existing server result as authoritative and do not send a new identity automatically.
- Message deleted before edit/reaction: remove the stale queued action.
- Slow mode/rate limit: show wait guidance and require controlled retry.
- Attachment failure: do not send until required uploads succeed.
- Session revoked: stop flush, clear auth safely, and do not replay under another account.

## Reconnect sequence

1. Browser `online` releases the per-channel queue head.
2. Normal authenticated service/RLS checks run again.
3. Success reconciles optimistic record using `clientMessageId`.
4. Failure classifies conflict and exposes recovery actions.
5. Realtime echo is deduplicated by existing event/client message logic.

## Verification

Run `npm run message:send-queue:smoke`, `npm run offline:conflicts:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Manual two-window/API checks:

- rapid sends preserve visible/server order;
- offline sends display queued and flush in order after reconnect;
- response-lost retry does not duplicate;
- one failure does not block later sends;
- retry/copy/remove act on failed local messages;
- deleted channel, permission loss, session revoke, slow mode, and rate limit fail safely;
- failed/canceled upload cannot send;
- restart loses memory-only queue without corrupting cache/session;
- Supabase realtime confirmation replaces optimistic message.

## Remaining production gates

Browser `online` does not prove backend reachability, so backend-unreachable failures remain manual retry. No encrypted durable cache exists. Live Supabase concurrency, response-loss, session-revocation, and two-window tests remain required before claiming offline durability.
