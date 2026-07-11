# Community invites and visitor access

## Invite lifecycle

Community owners and roles with `createInvites` can create limited invite campaigns with a 1-100 use cap and a 1-30 day expiry. Community Admin lists active, revoked, expired, and exhausted campaigns with creator, aggregate usage, creation, expiry, and last-use metadata. Invite codes are intentionally omitted from the campaign list.

Revocation requires confirmation and immediately invalidates the link. Existing memberships are retained. Invite creation, acceptance, and revocation remain audited service operations.

## Community kind landing

The preview and creator identify whether the destination is Text, Radio, or Podcast and which landing opens after acceptance. Membership is created before routing.

## Public and private access

- Public communities may enable visitor reading. Visitors see only non-private content whose public-read flag is enabled.
- Visitors cannot send, react, upload, host Radio, publish Podcast content, or access private channels. UI controls are disabled and RLS/RPC checks remain authoritative.
- Private communities require a valid invite or approved membership path and cannot use the public join RPC.
- Community and channel public-read settings must both allow access.
- Banned users and users in a blocking relationship with the owner cannot join through public or invite paths.

## Leave behavior

Leaving updates local access after the service succeeds. Owners must transfer ownership before leaving. A departed private community becomes inaccessible; a public community returns to visitor mode where permitted.

## Validation

Run `npm run community:invites-access:smoke` plus the production invite, public join, typed join, settings persistence, ownership transfer, and blocking/privacy smokes. Hosted RLS execution requires an approved Supabase environment and is not claimed locally.
