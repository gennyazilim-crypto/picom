# Meeting reconnect and resource lifecycle

## Connection policy

Picom treats LiveKit's built-in reconnect as the first recovery layer. If the provider reports an unrecoverable disconnect, the meeting client performs at most three application-level attempts with 500 ms, 1.5 s, and 3.5 s backoff. Only one reconnect operation and one wait timer may exist at a time. Offline attempts wait for the browser online signal for a bounded period and then surface a readable retry state.

Every application-level attempt calls the meeting authorization service again. The renderer never stores a provider secret and never manufactures a token. A fresh short-lived credential is obtained through the existing Supabase Edge Function path before a new LiveKit Room is connected.

## Terminal and recoverable outcomes

- Duplicate identity stops access and explains that another Picom window replaced the session.
- Participant removal stops access; automatic rejoin is forbidden.
- Room deletion or closure transitions the meeting to ended without retry.
- Join failure or token rejection requests fresh backend authorization within the bounded retry policy.
- Server shutdown, signal closure, timeout, media failure, or offline network permits bounded retry.
- Retry exhaustion shows a recoverable failure and requires explicit user action.

## Resource ownership

A single disposal path stops local microphone, camera, and screen tracks, detaches every Room listener, clears remote screen-track handlers, and awaits provider disconnect. A generation guard prevents a stale connect promise from publishing media after leave, navigation, room switch, or shutdown.

Meeting leave cancels pending reconnect waits, drains repository, signal, and device subscriptions, releases the screen-share lease, deactivates Noise Shield, clears participant/media state, and disconnects LiveKit. Sleep/wake recovery owns one cancellable timer. Electron renderer shutdown invokes meeting leave through a paired beforeunload listener.

## Reconciliation

A provider snapshot replaces the media participant set instead of appending stale identities. Supabase participant snapshots enrich matching identities with roles, avatars, verification, waiting-room state, and moderation state. Layout and dock preferences remain in the meeting store across reconnect.

## Evidence boundaries

The structural smoke verifies retry bounds, token refresh routing, terminal disconnect classification, timer/listener cleanup, generation cancellation, and ghost-participant removal. Hosted LiveKit interruption, token-expiry, kick/ban, room-delete, sleep/wake, and long-session heap evidence remain **BLOCKED** until an authorized staging room and native runners are available.
