# Friend request services, realtime, and notifications

## Service boundary

`friendRequestService` is the canonical friend lifecycle boundary. React consumes the `relationshipService` facade and never calls Supabase directly. Follow remains in the facade as a separate one-way relationship.

Both mock and Supabase data sources implement send, accept, decline, cancel, remove, block, list, state subscription, and notification subscription operations. Failures expose stable typed codes while preserving the existing user-facing `error` string contract.

## Realtime state

Supabase mode listens to both directions of `friend_requests` and both normalized columns of `friendships`. Events are coalesced before reloading the RLS-filtered state RPC, so incoming, outgoing, pending, and friend counts stay consistent without applying untrusted payloads directly.

Mock mode emits the same normalized `FriendState` snapshot after every lifecycle mutation. Every subscription returns cleanup that removes channels/listeners and cancels pending refresh timers.

## Notifications

`friend_request_notifications` is recipient-private, RPC/server-written, idempotent per request/event/recipient, and enabled for Realtime. Routing is centralized and respects:

- global desktop notification settings
- mute and Quiet Hours policy
- the Friend requests preference
- the Friend request acceptances preference

Disabling a friend preference prevents both the local inbox item and desktop interruption for that friend event. No private request content is placed in the notification body.

## Race and privacy enforcement

The Task 460 symmetric pending index and advisory transaction lock reject reverse-direction races. RLS and security-definer RPCs enforce requester/recipient access, blocks, privacy audience, response direction, cooldown, and normalized friendship uniqueness. Client checks are UX only.

Static smoke and pgTAP contracts are credential-free. Live Realtime/RLS validation requires a configured Supabase test environment and must remain BLOCKED when that environment is unavailable.
