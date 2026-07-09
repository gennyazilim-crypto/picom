# Picom Production Realtime Verification

## Prepared behavior

- `public.messages` is added to `supabase_realtime` by migration.
- Channel subscriptions filter by `channel_id` and handle INSERT, UPDATE, and DELETE.
- Subscription cleanup calls `channel.unsubscribe()` when the active channel effect is disposed.
- Optimistic inserts reconcile by message ID/client message ID.
- Event ordering guards reject duplicate event IDs and stale updates/deletes.
- Typing and presence constants/throttles exist; production behavior must be verified only where the UI currently publishes/subscribes them.

RLS remains the source of truth. Publication membership is not authorization by itself.

## Publication check

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

Confirm only reviewed Full MVP tables are present and `public.messages` appears once.

## Two-window message smoke

Use two normal authenticated desktop windows with separate approved test accounts:

1. Join the same visible channel.
2. Send a message in A; B receives one insert and A reconciles one optimistic item.
3. Edit the message in A; both windows show the newest body and edited state.
4. Delete the message in A; both windows keep it deleted even if an older update is replayed.
5. Add/remove reactions where Realtime is wired; counts do not duplicate.
6. Disconnect B, send in A, reconnect B, and verify refetch/reconnect yields one ordered message.
7. Send rapidly/offline and verify `clientMessageId` prevents duplicate echoes.

## Channel switch cleanup

1. Open channel A and observe one subscription.
2. Switch A-B-A repeatedly.
3. Confirm prior channels unsubscribe and only the active channel continues updating.
4. Send to inactive B from another client; A must not render the event while viewing A.
5. Inspect diagnostics/network logs for duplicate subscription callbacks or listener growth.

## Typing and presence

- If typing UI is enabled, verify start/stop events are throttled and stale indicators clear.
- If presence UI is enabled, verify online/idle updates are debounced and resync after sleep/wake.
- Do not claim production typing/presence readiness when only local placeholders are active.
- High-volume events must not block message rendering or create unbounded queues.

## Access isolation

- Visitor can receive only rows readable through public channel policy.
- Visitor/unauthorized member cannot subscribe to private-channel messages.
- Membership/permission revocation stops future events after token/subscription refresh.
- Mention Feed and notifications must not derive private snippets from inaccessible events.

## Failure/degraded behavior

- Connection status moves through connecting/connected/disconnected/reconnecting.
- API message operations remain the source of truth when Realtime is degraded.
- Reconnect refetch/reconciliation must not duplicate or resurrect deleted messages.
- Record connection IDs/timestamps/request IDs only; do not log access tokens or message bodies.

## Release gate

Duplicate messages, missing delete/update propagation, stale subscription leakage, unauthorized private events, or reconnect data corruption blocks production-connected release.
