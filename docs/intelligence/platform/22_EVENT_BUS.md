# Task 22 — Event Bus

The backbone that carries consented, typed events from the client queue (Task 02) to
consumers (analytics, ML, security, warehouse) with at-least-once delivery and ordering by
key. Preserves the privacy invariants at the transport layer.

## Architecture
```
client analyticsQueue (Task 02) ──HTTPS──► ingest Edge Function (validate + version)
   │                                            │  (consent + schema re-checked server-side)
   ▼                                            ▼
Supabase Realtime / durable topic  ──►  consumers: warehouse(23), ML(24), security(13/35-37),
                                                    realtime analytics(26)
```

## Guarantees
- **Schema-validated ingest**: server re-validates `schemaVersion` + allowlist; rejects
  content/identifier fields (defense in depth over the client).
- **At-least-once** with idempotency key (`envelope.id`); consumers dedupe.
- **Ordering by key** (e.g., per-session) where needed; otherwise unordered for throughput.
- **Backpressure**: bounded topics; overflow drops **oldest optional** events, never
  security-required ones.

## Data & privacy
- Only versioned envelopes cross the bus. **No** message/DM/audio/video ever enters it —
  enforced by the same allowlist/blocklist as the schema (Task 02) plus server re-check.

## Database / infra
- Topics as Supabase Realtime channels or a durable table `event_log(id, name, version,
  payload jsonb, received_at, consumed_by)` with partitioning + TTL (Task 27/09).

## APIs / jobs
- Ingest function (JWT + rate-limited); consumer workers (background) with retry/DLQ.

## Dashboard metrics
- Ingest rate, reject rate (by reason), lag per consumer, DLQ size.

## Tests
- Idempotency/dedupe; schema-reject of content fields; backpressure drops optional not
  required; ordering by key.

## Validation checklist
- [ ] server-side schema+consent re-check · [ ] idempotent/at-least-once · [ ] no content/identity
- [ ] backpressure protects required events · [ ] observable lag

## Risks / blockers
- Delivery guarantees vs cost → tiered topics. Needs ingest function + consumer infra.

**Next:** Task 23 — Data Warehouse.
