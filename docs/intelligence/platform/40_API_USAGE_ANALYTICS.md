# Task 40 — API Usage Analytics

Observability for internal API / Edge Function usage (endpoint volume, latency, error and
rate-limit rates) to inform capacity, deprecation, and abuse response — endpoint metadata,
no payloads.

## Architecture
```
edge/function access logs (endpoint, status, latency) ──► warehouse ──► API usage dashboard
rate-limit counters (existing) ─────────────────────────┘
```

## Metrics
- Calls per endpoint (`livekit-token`, `steam-auth`, `epic-auth`, `client-config`,
  analytics sink, etc.), status-code mix, latency buckets, rate-limit-hit rate, top
  consumers (by service/community grain, not individuals).

## Data & privacy
- Endpoint + status + timing only. **No request/response bodies**, no tokens, no PII. User
  grain avoided; aggregate by endpoint/community. Security anomalies routed to Fraud (37).

## Database / infra
- `api_usage(endpoint, status, latency_bucket, count, period)`; reuses rate-limit tables.

## APIs / jobs
- Log ingestion rollups; deprecation/capacity report; anomaly hand-off to Trend (32)/Fraud.

## Dashboard metrics
- Endpoint volume, error/latency by endpoint, rate-limit saturation, deprecated-endpoint use.

## Tests
- No bodies/tokens logged; aggregate by endpoint; rate-limit metrics correct.

## Validation checklist
- [ ] endpoint metadata only · [ ] no bodies/tokens/PII · [ ] aggregate grain
- [ ] rate-limit visibility

## Risks / blockers
- Log volume/cost → sample + retain aggregates. Pairs with Cost (39), Performance (38).

**Next:** Task 41 — Radio Analytics.
