# Task 41 — Radio Analytics

Aggregate listening analytics for live audio ("radio"-style rooms built on the LiveKit voice
stack) — tune-in/out, concurrent listeners, session length — without tracking who listened
to what.

## Architecture
```
radio_tune (roomId, action=join/leave, Task 02) ──► listening rollup ──► radio dashboard
LiveKit room presence (voice stack) ────────────────┘
```

## Metrics
- Concurrent listeners (bucketed), tune-in/out rate, average listen duration (bucket),
  peak-concurrency, retention across a broadcast — all aggregate per room.

## Data & privacy
- Room-grain counts + duration buckets; **no per-user listening history**, no content/audio.
  Small audiences k-suppressed. Consent-gated like all analytics.

## Database / infra
- `radio_sessions(room_id, listeners_bucket, window, ts)`; derived from voice presence, not
  a new tracking surface.

## APIs / jobs
- Presence → listening rollup; realtime concurrent count (via Task 26).

## Dashboard metrics
- Live listeners, peak, avg listen time, tune-out curve (creator/admin, aggregate).

## Tests
- No per-user listening record; duration buckets; k-suppressed; consent-gated.

## Validation checklist
- [ ] room-grain aggregate only · [ ] no per-user history · [ ] no audio/content
- [ ] k-suppressed · [ ] consented

## Risks / blockers
- Depends on the voice/LiveKit stack being provisioned (currently beta-gated). Uses
  Realtime (26), Warehouse (23).

**Next:** Task 42 — Podcast Analytics.
