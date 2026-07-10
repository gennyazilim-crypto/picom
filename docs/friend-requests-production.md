# Friend Requests Production

Picom friend requests use authenticated, security-definer RPCs. The renderer cannot write relationship rows directly.

## Lifecycle

- `send_friend_request` enforces block state, recipient privacy, existing friendship, duplicate pending requests, a 24-hour resend cooldown, and the shared server-side relationship rate limiter.
- `respond_friend_request` is recipient-only and atomically accepts or declines. Acceptance creates the normalized friendship pair.
- `cancel_friend_request` is sender-only for pending requests.
- `remove_friend` removes the normalized friendship and completed request pair so a future request can follow the normal cooldown path.
- Blocking is persisted through `blocked_users`; the client also removes the friendship and clears local relationship UI.

## Privacy

`profiles.friend_request_privacy` supports `everyone`, `community_members`, `friends_of_friends`, and `nobody`. This preference is enforced by PostgreSQL, not only hidden in the renderer.

## Notifications and logging

`friend_request_notifications` stores only recipient, actor, request identifier, event type, and timestamps. It never stores message content, credentials, tokens, raw IP data, or private profile fields. Realtime events update the desktop notification inbox and may produce a native notification through the existing notification routing service.

Client logs use generic event/error metadata and never log friend notes, auth headers, or secrets.

## Verification

Run `npm run friends:production:smoke`. Apply migrations in a disposable Supabase environment and verify privacy modes, block state, duplicate requests, cooldown, accept/decline, cancel, remove, and recipient-only notification visibility.
