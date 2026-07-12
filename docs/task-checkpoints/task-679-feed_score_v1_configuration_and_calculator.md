# Task 679 Checkpoint: Feed Score V1 Configuration and Calculator

Status: Complete  
Date: 2026-07-12

## Delivered

- One immutable `FEED_SCORE_V1` configuration for base scores, source defaults, engagement weights/caps, relevance, thresholds, freshness, diversity, group priority, and score precision.
- Pure calculators for base, qualified engagement rollup, raw score, relevance, freshness, final score, eligibility, and group priority.
- Actor/event eligibility that excludes self, bots, system users, banned/deactivated users, invalid events, deleted events, moderated events, duplicate events, duplicate reactors, duplicate saves, and repeated viewers.
- Per-commenter additional-reply scoring capped at +2.
- Direct accessible mention eligibility independent of popularity support.
- Deterministic fixtures covering the seven base kinds, score caps, eligibility examples, 48-hour half-life, relevance, and all four result groups.
- Score-version migration documentation.

## Validation

- `npm run feed:score:v1:smoke`
- `npm run feed:classification:smoke`
- `npm run typecheck`

## Boundaries

- No UI component or existing legacy ranking function was changed.
- No database schema/RPC was changed; SQL parity begins in Tasks 680-682.
- No hosted evidence is claimed in this checkpoint.
