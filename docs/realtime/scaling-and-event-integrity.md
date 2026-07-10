# Realtime Scaling and Event Integrity

## Scope

Picom uses Supabase Realtime for community messages, Direct Messages, typing, and presence. Managed fanout scales the transport; Picom remains responsible for scoped subscriptions, RLS, cleanup, dedupe, ordering, backpressure, and safe reconnect behavior.

## Channel naming

All runtime names are centralized in `realtimeChannelNames`:

- `room:community:{communityId}:channel:{channelId}`
- `typing:community:{communityId}:channel:{channelId}`
- `presence:community:{communityId}`
- `dm:conversation:{conversationId}`
- `dm:reactions:{currentUserId}`

Channel names are routing identifiers, not authorization. RLS controls row visibility and membership checks run before DM subscriptions.

## Subscription ownership

| Subscription | Owner | Scope | Cleanup |
| --- | --- | --- | --- |
| Community messages | `useSupabaseMessageRealtime` | Active community/channel | `removeChannel` on switch/unmount |
| Typing | `useSupabaseTypingBroadcast` | Active community/channel | stop/clear/remove on switch/unmount |
| Presence | `useSupabasePresenceChannel` | Active community | untrack/remove on switch/unmount |
| DM messages | `useDirectMessageRealtime` | RLS-verified conversation IDs | remove every created channel on dependency change/unmount |
| DM reactions | `useDirectMessageRealtime` | RLS-visible reaction rows | remove shared reaction channel on cleanup |

Every effect uses a canceled flag around asynchronous membership verification. Callback refs prevent subscription recreation when callback identities change.

## Duplicate prevention

- Community INSERT events use message ID and `clientMessageId` dedupe.
- Community update/delete events use deterministic event IDs and timestamp/delete ordering.
- DM INSERT events use message/client ID dedupe.
- DM update/delete/reaction events use a bounded event-ID cache.
- Optimistic confirmations replace the matching client record instead of appending.
- Dedupe caches are bounded and cleared when subscription ownership changes.

## Ordering rules

1. Server sequence orders messages when available.
2. `createdAt` is the fallback display order.
3. Update/delete freshness uses server/row timestamps.
4. Deleted state wins over older updates.
5. Duplicate inserts, updates, deletes, and reactions are ignored.
6. Reconnect refetch must reconcile before rendering a duplicate realtime echo.

DM reaction counts remain derived client state. Production scale should move toward idempotent reaction entities keyed by reaction row ID and a scoped server query rather than blind count deltas.

## Typing and presence backpressure

- Typing sends are throttled and remote typing records expire after a TTL.
- Presence tracks are throttled and stale records are replaceable.
- Typing/presence payloads are parsed and length-limited.
- Low-priority events may be coalesced/dropped; message events may not.

## Reconnect behavior

- Browser online/offline updates the visible connection state.
- Supabase channel states map to connecting/connected/reconnecting/disconnected.
- Picom does not implement an immediate custom retry loop on top of the provider.
- Subscription effects are recreated only when their stable scope key changes.
- Resume handling must debounce refetch/reconnect/queue flush to avoid storms.

## Diagnostics

DM subscription setup/removal logs only counts:

- conversation subscription count
- reaction subscription count
- total/removed subscription count

No message content, conversation ID, user ID, token, or channel name is added to these diagnostics. Duplicate logs include event type only.

## Scaling limits and mitigations

| Risk | Mitigation |
| --- | --- |
| Large DM conversation list creates many channels | Subscribe recent/active conversations or add user-scoped server envelope after measurement |
| Global visible reaction stream | RLS limits rows; dedupe now protects counts; future server aggregation/filtering recommended |
| Reconnect burst | Provider backoff, bounded dedupe, refetch reconciliation, no immediate loop |
| Out-of-order update/delete | Event ordering guard and deleted-state precedence |
| Stale listeners | Effect cleanup and callback refs |
| Presence/typing flood | Throttle, TTL, coalescing |
| Multi-instance backend fanout | Supabase-managed realtime; future external broker must preserve event IDs/RLS |

## Verification

Automated:

```powershell
npm run realtime:ordering:smoke
npm run realtime:backpressure:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

Manual two-window staging test:

1. Rapidly send messages with stable client IDs; each appears once.
2. Edit/delete during reconnect; older state never returns.
3. Add/remove a reaction and simulate duplicate delivery; count changes once.
4. Switch channels/communities repeatedly; old rooms stop updating UI.
5. Switch DM conversations and sign out; subscription removal counts return to zero ownership.
6. Confirm typing expires and presence does not multiply after reconnect.

## Remaining work

- Add provider-backed active-channel metrics in staging.
- Scope/aggregate DM reaction delivery at the server for very large DM lists.
- Add deterministic out-of-order fixtures for DM update/delete/reaction events.
- Test reconnect bursts under the approved realtime load simulator.
- Never replace RLS with channel-name secrecy.
