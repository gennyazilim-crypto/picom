# Task 682 Checkpoint: Access-Aware Feed RPC Ranking and Cursor Pagination

Status: Complete (structural); hosted query evidence pending Task 688  
Date: 2026-07-12

## Delivered

- Authenticated `get_feed_page` RPC for `feed` and `friends` only.
- Access materialization before signals, thresholding, scoring, diversity, or output.
- Source visibility, account/bot, block, community archive, moderation, deletion, source filter, and optional community-scope controls.
- Direct accessible mention guarantee independent of popularity support.
- Exact normal threshold (`raw_score >= 4`, supporter count >= 1).
- Accepted-friend author and meaningful-support relevance without a follow dependency or visibility bypass.
- Unread/save/recent-community relevance and exact 48-hour query-time decay.
- Stable keyset cursor fields and deterministic ID tie-breaker under one returned `ranking_as_of`.
- Normal-card author/community/consecutive-community diversity caps with direct-mention bypass.
- Generated RPC types, pgTAP contract, static smoke, index additions, and staging-safe EXPLAIN command.

## Validation

- `npm run feed:rpc:v1:smoke`
- `npm run feed:rollup:events:smoke`
- `npm run feed:score:v1:smoke`
- `npm run typecheck`

## Evidence state

- Local structural/type checks: required here.
- Real pgTAP, two-page fixture query, and EXPLAIN ANALYZE: **BLOCKED** pending configured disposable/hosted Supabase in Task 688.
- No performance pass is claimed without the real plan.
