# Profile Relationship Actions

## State model

- Follow uses an optimistic local update, rolls back on service error, then refreshes the authoritative following list and profile-domain counts.
- Friendship uses one state-aware action: Add, Cancel outgoing, Accept incoming, or Remove existing friendship.
- Message is unavailable while either side is blocked; the DM service retains its own enforcement.
- Blocking removes the visible DM conversation, refreshes friends, removes an existing follow, and reloads profile-domain state.
- Report opens the existing rate-limited safety report flow with an accessible community context.
- Verification opens the request/status UI. Approval and revocation remain restricted admin operations enforced by RLS/RPC.

## Safety

- Current users see Edit and Verification instead of relationship actions.
- Mock and connected services reject self-follow and self-friend requests.
- Block/privacy/rate-limit errors come from existing services and are shown without optimistic drift.
- Repeated profile mutations are disabled while the target user has an action in flight.
- Components do not query Supabase directly.

## Cross-surface synchronization

Following and friendship subscriptions remain the source for Feed and Friends. Profile actions refresh those same stores, while DM block handling removes inaccessible local conversation state. Connected profile counts are reloaded from `get_profile_domain_v1` after successful mutations.
