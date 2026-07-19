# Offline and recovery contract

## Implemented today

- Community message sends are serialized per channel.
- The queue waits for the browser `online` event and limits pending operations.
- Duplicate `clientMessageId` operations share one promise.
- A conflict classifier maps network, permission, deleted-channel/message, attachment, rate and queue errors to safe user actions.
- Feed query cache can return an explicitly stale page while the backend is unreachable.

## Not implemented yet

- The mutation queue is not persisted through renderer/app restart.
- DM sends/edits/reactions and Feed mutations do not share a durable replay journal.
- Attachments cannot safely resume without persisted upload state and file reauthorization.
- There is no user-facing recovery center listing queued/failed operations.

## Required durable design

Use a user-scoped IndexedDB journal containing operation ID, entity ID, idempotency key, sanitized payload, dependency IDs, attempt count and next retry time. Never persist access tokens, signed URLs or raw secrets. Encrypt sensitive drafts using an OS-backed key when available, clear records on logout, and require explicit resolution for permission or deletion conflicts.

## Release gate

Do not claim restart-safe offline support until process-kill/relaunch tests prove exactly-once reconciliation for community and DM messages. Until then, the UI must describe offline sends as pending only for the current app session.
