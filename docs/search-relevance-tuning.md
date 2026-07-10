# Search Relevance Tuning

## Local ranking rules

Global search now applies deterministic relevance after access filtering:

1. exact label match;
2. label prefix;
3. token prefix;
4. label substring;
5. all query tokens present;
6. weaker detail match;
7. category weight for equal text quality: people, channels, communities, messages, mentions, saved and media.

Queries are lowercased, Unicode-normalized, stripped of control characters, whitespace-collapsed and capped at 80 characters. Results that do not match a non-empty query are excluded. Stable input order breaks equal scores.

## Access boundary

Relevance never grants access:

- communities require membership or public-view permission;
- channels are filtered with `canViewChannel`;
- messages and attachments require a visible channel and deleted messages are excluded;
- members require public/permitted member-list access;
- mentions and saved messages recheck community/channel visibility;
- jump-to-message revalidates community, channel, message and deletion state;
- Supabase remote search uses the `search_accessible_entities` RPC, which must enforce RLS/server authorization.

The ranking helper receives only results created after these checks. UI hiding remains secondary to RLS/backend enforcement.

## Debounce decision

Local search is synchronous over bounded in-memory mock/loaded data and does not issue network calls, so a debounce was not added to the command palette. Remote Supabase full-text search is not currently wired into keystroke rendering.

When remote search is connected:

- debounce 200-300 ms after at least two normalized characters;
- cancel the previous request with an abort signal/request generation;
- ignore stale responses;
- cap result count and request duration;
- rate limit server-side;
- do not send empty queries, private context, raw filters or telemetry content.

## Supabase/full-text gaps

- The RPC needs a reviewed migration with per-entity RLS-safe query branches.
- PostgreSQL full-text/`pg_trgm` indexes and locale behavior need measured staging plans.
- Ranking should return a bounded server score/reason class without leaking hidden-row existence.
- Deleted/anonymized/blocked/private content and revoked memberships must be excluded transactionally.
- Pagination/cursor, typo tolerance, stemming, language configuration and highlight snippets remain incomplete.
- Snippets must be plain text, length-bounded and authorized; no unsafe HTML.
- Search logs/analytics must not retain query text.

## Testing

`npm run search:relevance:test` verifies exact/prefix/contains ordering, category tie-breaking, Unicode/control normalization, irrelevant exclusion and source access-boundary markers.

Production requires live RLS adversarial tests for owner/admin/member/visitor, private channels, revoked membership, deleted messages, blocked users and cross-tenant IDs.
