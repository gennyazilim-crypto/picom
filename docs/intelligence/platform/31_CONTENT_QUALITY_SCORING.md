# Task 31 — Content Quality Scoring

Scores **channels/communities** (not people, not message text) on engagement-health signals
so surfacing/ranking favors healthy spaces — metadata only.

## Architecture
```
message/reaction/read metadata (Task 02) ──► channel-health features ──► quality score
                                                                          └─► ranking/surfacing
```

## Signals (content-blind)
Reply depth, reaction rate, read-through, active-participant spread, recency — all counts.
**No** message text, **no** per-user quality/reputation, **no** sentiment on content.

## Data & privacy
- Aggregated at channel/community grain; k-suppressed for tiny spaces; never scores an
  individual. No content is read.

## Database / infra
- `channel_quality(channel_id, score, features, computed_at)` (admin-scoped read).

## APIs / jobs
- Nightly scoring job; ranking read.

## Dashboard metrics
- Score distribution, healthiest/at-risk channels (aggregate), trend.

## Tests
- No content/text used; no per-user scoring; k-suppressed; score reproducible from features.

## Validation checklist
- [ ] scores spaces not people · [ ] metadata only · [ ] no content/sentiment on text
- [ ] k-suppressed

## Risks / blockers
- Feedback loops (rich-get-richer) → include recency/newcomer factors. Uses Warehouse (23),
  Anonymization (25).

**Next:** Task 32 — Trend Detection.
