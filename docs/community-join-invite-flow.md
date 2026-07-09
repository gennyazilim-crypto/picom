# Picom Community Join and Invite Flow

## Public join

Authenticated visitors may join a public community. Picom inserts the current user with the default Member role. Postgres RLS only allows self-join for public communities and only with the Member role.

Visitors can read public, non-private channels when both community and channel public-read flags permit it. They cannot send messages, react, upload, or see private channels. The composer states: `Join this community to send messages.`

## Invite creation

Owners, admins, and moderators with `createInvites` can create bounded invite codes. The MVP supports an optional use limit and expiry. Invite links use `picom://invite/{code}` and are copied through `clipboardService`.

The community menu also copies `picom://community/{communityId}` through the same centralized clipboard service. It does not claim success when native/browser clipboard access fails.

The frontend permission check is UX only. Supabase RLS calls `can_create_community_invite`, which checks ownership, role level, or the role permission JSON.

## Invite acceptance

`accept_community_invite` is a security-definer Postgres function that:

1. requires an authenticated user;
2. locks and validates the invite;
3. rejects invalid, expired, revoked, or exhausted codes;
4. assigns the default Member role;
5. inserts membership without duplication;
6. increments use count only for a new membership.

Private communities can only be joined through this validated RPC. Invite rows are not directly readable by visitors.

## Leaving

Members, moderators, and admins can delete their own membership. Owners must transfer ownership first. A former member may retain public visitor access to a public community; a private community becomes inaccessible.

## Testing

- Mock mode persists created invites under `picom:community-invites:v1`.
- Test owner/admin/mod invite creation, copy, acceptance, expiry/use limit errors, public visitor join, owner leave denial, and private-channel hiding.
- Supabase tests require applying `20260704002800_community_invites.sql` to staging.
