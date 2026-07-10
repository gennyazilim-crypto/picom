# Task 58 - Invite Links and Join Onboarding Polish

## Completed

- Preserved the existing `community_invites` table and added forward-only invite hardening.
- Added cryptographically random 144-bit invite codes and code/deep-link normalization.
- Completed `createInvite`, `getInviteByCode`, `acceptInvite`, and `revokeInvite` service operations for mock and Supabase modes.
- Connected onboarding invite choice to the existing invite acceptance modal.
- Added copy and revoke controls to the role-gated community invite creator.
- Made repeat acceptance idempotent for existing members.
- Added an RLS-protected community ban table and server-side active-ban enforcement in invite acceptance.

## Security boundaries

- Invite creation/revocation remains protected by Supabase RLS and community permissions.
- Expired, revoked, exhausted, malformed, and banned-user acceptance is rejected server-side.
- The renderer receives no service-role key and uses only the configured authenticated Supabase client.
- Private content visibility remains governed by community/channel/message RLS.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Live RLS execution still requires the optional Supabase CLI/local stack.
