# Reply system production persistence

## Data contract

`messages.reply_to_message_id` stores an optional self-reference to the original message. Message send, queue retry, list pagination, optimistic reconciliation, and realtime mapping all preserve this field.

The reference is immutable after insert. A reply target must:

- exist and not be soft-deleted when the reply is created;
- belong to the exact same channel and community;
- not be the reply message itself.

These checks run in a trigger in the same transaction as the message write. Renderer checks are UX only.

## Privacy and RLS

Cross-channel references are rejected before persistence, which prevents a public message from carrying a private-channel target ID. Existing message RLS remains authoritative: a user who cannot view the reply channel cannot retrieve either the reply row or its target identifier.

No target body, author, or other private metadata is copied into the reply row. The client resolves previews only from messages already returned by the permission-filtered channel query.

## Deleted and unavailable targets

Normal deletion is soft deletion. Existing replies retain their target ID, while channel queries omit the deleted target; `MessageItem` therefore renders `Original message was deleted.` or `Original message unavailable.` without leaking content. Hard deletion uses `ON DELETE SET NULL` for referential safety.

## Optimistic and offline behavior

- The composer passes the selected target into the optimistic message.
- The per-channel send queue preserves the target across offline wait and retry.
- Server confirmation replaces the optimistic field with the persisted value.
- Supabase list and realtime row mappers carry the field back to normalized local state.

## Validation

- `npm run replies:production:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP: `supabase test db supabase/tests/rls/reply_system_production.sql`

The pgTAP fixture must never run against production.
