# Optimistic UI consistency audit

Picom's MVP uses a mix of local mock state, Supabase-backed mutations, and realtime reconciliation. This audit documents the current optimistic UI guarantees and the remaining production risks without changing runtime behavior.

## Scope

Reviewed flows:

- send message
- realtime message insert/update/delete reconciliation
- edit message
- delete message
- add/remove reaction
- attachment upload before message send
- mark channel read/unread
- create community
- create channel

This task does not redesign the desktop UI, change the 4-column layout, or add mobile behavior.

## Current strengths

### Message send reconciliation

- `Message` includes optional `clientMessageId`.
- `useLocalMessageState.appendLocalMessage()` deduplicates by message `id` or `clientMessageId`.
- `useLocalMessageState.upsertLocalMessage()` uses the same matching rule for server/realtime echoes.
- Messages sort by per-channel `sequence` when available and fall back to `createdAt` plus `id`.
- Realtime delete/update handling avoids restoring an older update over a locally deleted message.

### Realtime ordering

- Realtime handlers already pass message `sequence`, `createdAt`, `editedAt`, `deletedAt`, and `clientMessageId` into local state.
- Duplicate realtime inserts are ignored by the local state layer.
- Older updates are prevented from corrupting deleted messages.

### Local edits, deletes, and reactions

- Local message edits keep `editedAt`.
- Local deletes use a deleted-message placeholder pattern instead of hard-removing all context.
- Local reactions toggle by emoji and remove zero-count reactions.
- Deleted messages cannot receive new local reactions.

### Desktop layout stability

- Optimistic state updates happen inside existing state/service layers.
- Chat layout, sidebars, composer pinning, and independent message scrolling are not coupled to optimistic bookkeeping.

## Current gaps

### Pending/failed statuses are incomplete

`Message.localStatus` currently supports `sent`, `sending`, and `failed`, but most local paths set messages directly to `sent`. Production-level optimistic sending should use:

- `sending` for local optimistic rows before server confirmation
- `sent` when Supabase confirms the mutation
- `failed` when Supabase rejects the mutation
- `queued_offline` if offline queue support is enabled later

### Recovery actions are partial

Failed sends should expose clear retry/remove/copy actions in the message row. Current documentation and conflict handling prepare this, but the full UI is not consistently wired for every mutation type.

### Attachments are not fully atomic with messages

Attachment metadata can be `pending`, `attached`, or `failed`, and storage paths use a safe pending shape. The production risk is partial state:

- upload succeeds but message send fails
- message send succeeds but attachment metadata remains pending
- cleanup later removes an upload the user expected to send

Future fix: Supabase RPC or Edge Function should atomically link uploaded attachment metadata to the confirmed message row after message creation.

### Edits, deletes, and reactions need server-confirmed status

Mock/local mode applies edits/deletes/reactions immediately. Supabase mode should eventually track per-action pending state so rejected permission/RLS/rate-limit errors can restore or mark the local row safely.

### Create community/channel optimistic status is not explicit

Community and channel creation should prevent duplicate button submissions and use idempotency keys or stable client-generated ids where backend support exists. Current local creation avoids duplicate ids but does not expose pending/failed UI state for all create flows.

## Consistency rules for future implementation

1. Every optimistic record must carry a stable client id.
2. The server confirmation replaces or confirms the optimistic record rather than adding a second item.
3. Realtime echoes must reconcile by server id and client id.
4. Failed optimistic actions must be visible and recoverable.
5. Private-channel and permission errors must never reveal inaccessible message data.
6. Attachment rows must not render as normal images unless upload and scan status are safe.
7. UI should preserve local visible order while pending, then adopt server `sequence` when available.
8. Developer diagnostics may log redacted action metadata, but message contents and secrets should not be written to support logs.

## Recommended status model

```ts
type OptimisticStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "queued_offline";
```

Recommended mapping:

- message send: `pending` -> `confirmed` or `failed`
- message edit: per-message action status, not a separate duplicate row
- message delete: tombstone locally, confirm or restore on failure
- reaction add/remove: optimistic toggle with rollback on failure
- attachment upload: upload item status separate from message status
- community/channel create: disabled submit while pending, retry on failure

## Manual QA checklist

- Rapidly send several messages and confirm visible order is preserved.
- Simulate a realtime echo with the same `clientMessageId` and confirm no duplicate appears.
- Simulate a deleted message receiving an older update and confirm the deleted state wins.
- Toggle the same reaction twice and confirm counts do not go negative.
- Send with attachments and confirm unsafe/pending/suspicious attachments do not render as normal images.
- Create a channel/community twice quickly and confirm duplicate UI rows are not created.
- Trigger a mock send failure and confirm the error UX is friendly and recoverable.

## Production readiness decision

The current MVP has a solid dedupe/realtime reconciliation foundation. It is safe for mock mode and prepared for Supabase mode, but not yet production-complete for all failed mutation recovery paths.

Before stable release, prioritize:

- explicit pending/failed message status UI
- retry/remove/copy actions for failed messages
- atomic message + attachment confirmation
- idempotency keys for risky create/send actions
- Supabase RLS regression checks for failed optimistic actions
