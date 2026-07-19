# Task 42 — Podcast Analytics

Aggregate analytics for on-demand recorded audio (podcast-style episodes) — plays,
completion, drop-off curve — measured as anonymous engagement, not per-listener histories.

## Architecture
```
podcast_play (episodeId, positionBucket, Task 02) ──► completion/drop-off rollup ──► podcast dashboard
```

## Metrics
- Plays per episode, completion rate, average listen depth (position **buckets**, e.g.
  0-25/25-50/…), drop-off curve, replays — aggregate per episode.

## Data & privacy
- Episode-grain counts + position buckets; **no per-user play history**, no audio content
  analysis. k-suppressed for low-play episodes. Consent-gated.

## Database / infra
- `podcast_engagement(episode_id, position_bucket, plays, completions, period)`.

## APIs / jobs
- Play-event rollup; drop-off curve builder.

## Dashboard metrics
- Plays, completion %, drop-off heat curve, top episodes (aggregate).

## Tests
- No per-user history; position buckets only; k-suppressed; consent-gated; no audio content.

## Validation checklist
- [ ] episode-grain aggregate · [ ] position buckets only · [ ] no per-user history
- [ ] no audio content · [ ] consented

## Risks / blockers
- Requires a recorded-audio feature surface (roadmap); analytics ready to attach when it
  ships. Uses Warehouse (23), Growth Analytics (19).

**Next:** Task 43 — Download Funnel.
