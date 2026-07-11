# Meeting Invite and Share-Link Experience

## Lifecycle

Authorized hosts and cohosts can create bounded meeting invitations with an expiry of up to 30 days, a maximum of 100 uses, and either authenticated participant or signed-in guest access. The Info dock lists lifecycle metadata without exposing token hashes, raw secrets, or redemption records. Revoke and regenerate require confirmation; regeneration atomically revokes the old database record before creating the replacement.

The raw invite credential exists only long enough to build and copy the deep link. It is never rendered, logged, persisted, or returned by list/preview RPCs. If clipboard access fails, the renderer retains one in-memory retry value and clears it after success or unmount.

## Join preview and routing

Meeting links use the validated `picom://meeting/{community}/.../room/{room}/session/{session}?invite={64-hex}` route. The parser accepts only the `invite` query key and emits a sanitized URL without the credential. The transient action passes the credential to the meeting gateway in memory.

The gateway requests a server-authoritative preview containing room, community, host, schedule, capabilities, status, join policy, and waiting-room policy. Allowed links configure the existing PreJoin service. Waiting-room policy remains visible before media access. The invite is redeemed immediately before join authorization, so a link revoked or expired while PreJoin is open fails safely.

Expired, revoked, exhausted, blocked, locked, ended, membership-required, invite-required, and not-started outcomes use explicit user-safe states. They do not open the media workspace or expose participants.

## Security boundaries

- RPC authorization is authoritative; UI capability checks are UX only.
- Raw invite secrets are never stored in Postgres.
- Authenticated clients cannot select the invite table directly.
- Invite regeneration is transactional and permission checked.
- Custom protocols are parsed by `deepLinkService`; no renderer component invokes native shell APIs directly.
