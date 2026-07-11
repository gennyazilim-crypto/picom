# Friendship schema, RLS, and privacy foundation

## Relationship model

Picom keeps two intentionally separate social edges:

- **Follow** is a one-way `user_follows` edge used for feed personalization. Following does not create a friendship.
- **Friend** starts as a directional request and becomes one symmetric `friendships` row after acceptance. Friendship does not automatically create follow edges.

Friend request states are `pending`, `accepted`, `declined`, and `cancelled`. Only `pending` is active. Terminal rows are retained as security/audit history and cannot return to another state through normal application flows.

## Integrity and race handling

- Friendships use normalized `user_low_id` / `user_high_id` pairs.
- A partial unique index permits only one pending request for a normalized user pair, including reverse-direction races.
- An insert trigger takes a transaction advisory lock before checking pending requests, existing friendships, and bilateral blocks.
- Existing RPC cancellation and block flows retain their stable API while a delete trigger records pending requests as `cancelled` and protects terminal history.
- Sender, recipient, and creation time are immutable after insertion.

## Privacy and authorization

- RLS exposes request metadata only to the requester and recipient.
- RLS exposes a friendship only to either participant.
- Authenticated clients have read privileges but no direct insert, update, or delete privileges on request/friendship tables.
- Request, response, cancellation, and removal mutations remain security-definer RPC operations with authenticated-user checks.
- A bilateral block prevents new friend requests, removes the active friendship, cancels pending requests, removes follow edges, and prevents new DM conversations/messages through the existing DM access functions.
- Muting is not an authorization edge and never grants access.

## Mock and Supabase parity

Mock requests carry the same canonical status. Accept/decline is incoming-only, cancellation is outgoing-only, terminal transitions are retained in local history, and local blocks prevent both friend requests and new DM conversations.

The static smoke tests verify schema, RLS, service, and DM contracts without credentials. Live pgTAP/RLS execution still requires a configured local or hosted Supabase test environment; absence of the Supabase CLI is reported as blocked, never as hosted evidence passed.
