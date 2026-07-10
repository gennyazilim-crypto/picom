# Task 243 checkpoint: offline cache and sync hardening

- Kept private message bodies and credentials out of custom disk storage; Supabase remains authoritative after restart.
- Deduplicated in-flight sends by stable `clientMessageId`, bounded memory queues, and added a recoverable queue-full conflict.
- Canceling/removing a queued message now prevents it from being sent invisibly after reconnect.
- Cache settings report pending memory-only sends and preserve auth sessions, drafts, and queued messages during cache clearing.
- Added a reconnect/cache/privacy hardening contract alongside existing FIFO and conflict checks.

Validation: `npm run offline:cache-sync:hardening:test`, `npm run message:send-queue:smoke`, `npm run offline:conflicts:smoke`, `npm run disk-cache:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.
