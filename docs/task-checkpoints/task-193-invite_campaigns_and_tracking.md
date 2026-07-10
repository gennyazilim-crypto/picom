# Task 193 Checkpoint: Invite Campaigns and Tracking

- Moved invite create/revoke to permission-checked atomic RPCs with server-generated codes.
- Preserved atomic acceptance, ban checks, expiry, revocation, and maximum-use enforcement.
- Added bounded campaign labels, aggregate usage, last-used time, creator, and status summaries without returning invite codes.
- Added append-only audit facts for create, revoke, and acceptance.
- Revoked direct renderer writes to invite rows.
- Explicitly excluded IP, device, referrer, fingerprint, and redemption-identity tracking.

Validation: `npm run invites:campaigns:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
