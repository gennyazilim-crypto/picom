# Publisher Team Management

Tables: `publisher_team_members`, `publisher_team_invitations`, `publisher_studio_roles`.

## Invitations
- Cryptographically random token; only SHA-256 `token_hash` stored
- Bounded expiry, one-time accept, rate limit (20/hour/publisher)
- Accept requires authenticated matching invitee user/email
- OWNER cannot be invited/demoted/removed via team UI

## Limits
`publisher_team_member_limit()` = 50 (operational abuse bound, not a commercial plan entitlement)
