# Task 157 Checkpoint: Mention Feed Ranking V2

Status: Complete

## Delivered

- Added a pure deterministic Mention Feed ranking helper.
- Ranking inputs are followed authors/mentions, bounded popularity, recency, unread state, reaction totals and reply/comment totals.
- Access filtering occurs before tab filtering and scoring.
- Feed and Following tabs now use the same tested helper while quick filters remain unchanged.
- Added executable unit tests for private-item exclusion, follow boost, unread, engagement, recency and following-tab filtering.

## Privacy and access

- Message body, attachment content, names and private-channel data do not influence the score.
- `App` continues to pass only channel-accessible mention items; the helper also requires an explicit access predicate.
- No external ranking service, telemetry, user profile or persistent behavior history was added.

## Validation

- `npm run mentions:ranking:test`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining production work

- Supabase-backed feed queries must enforce channel/community access server-side before returning candidates.
- Ranking weights require transparent product review, abuse/gaming evaluation and staged validation before production use.
