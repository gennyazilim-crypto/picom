# Task 158 Checkpoint: Follow Suggestions V2

Status: Complete

## Delivered

- Added a reusable deterministic follow-suggestion ranking helper.
- Added mutual-community, role-relevance, bounded popularity and recent-visible-mention signals.
- Excluded current user, bots, followed users, blocked users and non-mutual candidates before ranking.
- Integrated suggestions into onboarding and Mention Feed right panel.
- Removed blocked users from popular/following panel lists.
- Added executable unit tests and Supabase/RLS assumptions documentation.

## Validation

- `npm run follow:suggestions:test`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining production work

- Candidate generation and bidirectional block/access filtering must be server/RLS enforced in Supabase mode.
- Ranking weights/reason codes need staged product, privacy and abuse review.
