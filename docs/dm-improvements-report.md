# Direct Messages production improvements report

## Current implementation

- Participant-only conversations, messages, attachments and reactions are represented in migrations and service APIs.
- Message sends use `client_message_id` and an idempotent database RPC.
- Cursor pagination, read cursors, reply previews, attachment metadata and reactions are implemented.
- Active conversation and conversation-list subscriptions are separated.
- Active subscription cleanup is generation-safe and Realtime events are bounded/deduplicated.
- Typing uses private broadcast channels with expiry and cleanup.

## Change in this pass

- Corrected the voice invite hook call from the nonexistent `cancel` API to `cancelOutgoing`.
- Normalized optional camera state before exposing the required DM runtime contract.
- Corrected device settings subscription and React effect cleanup semantics.

## Remaining work

- Persist unsent DM text/mutations across process restart; current service behavior is online-first.
- Prove background/non-active conversation notifications with two users.
- Prove read markers, typing expiry, presence and reaction deduplication under reconnect.
- Extend old-history reaction/attachment routing beyond the latest 500 preloaded message IDs.
- Run blocked-user, removed-participant, attachment URL and search privacy negative tests against hosted RLS.

## Production decision

The local DM source contract is coherent after the build fix. Hosted two-user privacy and reconnect evidence is still mandatory.
