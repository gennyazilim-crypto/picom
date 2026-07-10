# Invite Campaigns and Tracking

Picom invite campaigns expose operational aggregate counts without invasive attribution.

- Creator, bounded campaign label, maximum uses, aggregate uses, expiry, revoked state, creation time, and last-used time are visible to users with `createInvites` permission.
- Invite code generation, create, revoke, acceptance, usage increment, membership creation, ban checks, and audit writes run in database transactions.
- Campaign list results never include invite codes or redemption identities.
- Picom does not collect IP addresses, device IDs, browser fingerprints, referrers, campaign source URLs, or cross-community behavior for invite analytics.
- Banned users, expired/revoked/exhausted codes, missing default roles, and duplicate membership are handled before usage is incremented.
- `invite_create`, `invite_revoke`, and `invite_accept` append audit facts without including the invite code.

Run `npm run invites:campaigns:smoke`, then validate concurrency and ban behavior in a disposable Supabase project.
