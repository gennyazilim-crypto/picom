# Feed Algorithm V1 Gap Map

Date: 2026-07-12  
Baseline: `1c8d2b2`

## Contract-to-implementation map

| V1 contract | Current implementation | Gap | Owner task |
| --- | --- | --- | --- |
| Canonical text/image/video/radio/podcast classification | Source types exist, but message media is not classified into the required combinations and radio child content is named `radio_chat` | Define one source/content classifier and compatibility mapping | 678 |
| Base scores 1/2/3/4/5/5/6 | No shared Score V1 configuration | Add a pure calculator and shared constants used by SQL/TypeScript fixtures | 679 |
| External unique reactors +1, max 10 | Query-time source-specific counts | Add actor-qualified rollups and caps | 680, 681 |
| Unique commenters +2, max 20 | Partial comments/replies, no unified actor rollup | Normalize parent/source identity and actor qualification | 680, 681 |
| Genuine extra replies +0.5, max +2 per commenter | Not represented | Add bounded reply contribution | 679, 681 |
| Unique saves +2, max 10 | Message and audio save domains are separate | Add source-neutral save events/rollups | 680, 681 |
| Unique views +0.1, max 3 | No canonical message unique-view source | Add privacy-minimal unique view events and rollups | 680, 681 |
| Self engagement excluded | Not guaranteed across every source | Enforce actor != author before rollup | 681, 687 |
| Bot/deleted/moderated/banned/deactivated excluded | Partial source deletion filters | Centralize eligibility and recomputation/removal behavior | 681, 687 |
| Normal threshold `raw_score >= 4` | No Score V1 raw score | Apply threshold in candidate RPC | 682 |
| At least one external supporter | Not enforced | Add external supporter rollup and predicate | 680-682 |
| Accessible direct mentions always candidates | Mention rows exist, but no explicit priority group contract | Add guaranteed direct-mention candidate group | 682 |
| Accepted-friend author +2 | Feed uses one-way follows | Join normalized accepted friendships | 682 |
| Accepted friend engaged +1 | Not represented | Join qualified friend engagement without access escalation | 682 |
| Unread +1 | Partial source-specific read projections | Add source-neutral unread projection | 682, 686 |
| Recent community +1 | Not represented consistently | Define bounded recent-community signal | 682 |
| Freshness half-life 48h | Legacy linear/window freshness | Apply exact exponential query-time decay | 679, 682 |
| Cursor includes group, score, time, ID, `as_of` | Old score/time/ID cursor and ranking epoch | Replace DTO and RPC cursor contract | 682, 683 |
| Friends tab | `following` tab and follow filters | Rename semantics and query accepted friends only | 683, 685 |
| Stories not follow-based | Followed-user stories | Use accessible friend/community story inputs or remove unavailable stories | 685 |
| Unified cards | Separate mention/unified render paths | One DTO/card adapter for text/radio/podcast | 683, 684 |
| Realtime rollup reconciliation | Old mention/follow invalidation | Subscribe to eligible source/rollup/read/save changes | 686 |
| Diversity per 20 normal cards | No author/community caps | Apply author max 2, community max 4, consecutive community max 2 | 687 |
| Production Supabase never silently mocks | Services mostly comply; App initializes mock state | Add explicit loading/error/empty states and remove production mock bootstrap | 683, 685 |
| Hosted proof | No evidence for new contract | Run migrations/RLS/fixtures/two-session E2E and record blockers truthfully | 688 |

## Intended data flow

1. Source adapters classify an eligible text, radio, or podcast source without copying its full body.
2. Idempotent event handlers update source-neutral rollups for qualified external reactions, comments/replies, saves, and views.
3. The Feed RPC builds only rows the caller can currently view.
4. Accessible direct mentions enter the guaranteed group.
5. Other rows must pass raw-score and external-support thresholds.
6. The RPC adds relevance, applies 48-hour freshness at a stable `as_of`, and returns deterministic keyset fields.
7. The service maps RPC rows into one renderer DTO and never substitutes mock rows in Supabase mode.
8. UI tabs, read/save state, realtime reconciliation, and diversity rules operate on that DTO.

## Schema gap decisions

- Keep `content_mentions` as the direct-mention index; do not misuse it as the complete popularity candidate table.
- Add minimal source-neutral rollup/event structures rather than adding engagement columns to every source table.
- A view event must store identifiers and timestamps only, not message bodies or private payloads.
- Normalize `radio_chat` to the approved radio-comment classification through an adapter/compatibility path.
- Use `friendships` for friend relevance. Do not add any new dependency on `user_follows`.
- Preserve source-of-truth tables for reactions/comments/saves; rollups are derived and repairable.

## Query and security gap decisions

- Candidate visibility is a SQL/RLS responsibility; renderer filtering is only defensive UX.
- Friendship and relevance never grant visibility.
- Direct mentions bypass popularity thresholds, not access controls.
- Moderated/deleted content and ineligible actors must be removed from rollup contribution, not merely hidden in the UI.
- Cursor ordering must be deterministic across Windows/Linux clients and repeated page calls with the same `as_of`.

## Delivery gates

| Gate | Required proof |
| --- | --- |
| Classification | Fixtures cover all seven base-score combinations plus radio/podcast child sources |
| Calculator | TypeScript and SQL fixtures agree on Score V1 values and caps |
| Rollups | Duplicate events do not double count; self/ineligible events do not count |
| Access | Private/inaccessible/blocked content is absent before ranking |
| Pagination | No duplicates or omissions across stable keyset pages |
| UI | Feed and Friends tabs use production service DTOs with no follow language |
| Realtime | Insert/update/delete/read/save changes converge without duplicate cards |
| Fairness | Diversity caps apply only to normal cards; direct mentions remain guaranteed |
| Hosted | Supabase migration/RLS/algorithm fixtures and desktop E2E evidence pass |

Until every gate is evidenced, the production algorithm remains intentionally incomplete rather than silently simulated.

