# Picom Intelligence Engine — Event Schema

**Task 02 · production event tracking layer.** Typed schemas, versioning, durable offline
queue, and consent-gated retry transport. Implementation:
`src/services/analytics/eventSchema.ts` + `src/services/analytics/analyticsQueue.ts`,
sitting on top of the shipped consent gate in `src/services/analyticsService.ts`.
Classifications and forbidden data: [EVENT_INVENTORY.md](./EVENT_INVENTORY.md) /
[DATA_COLLECTION_POLICY.md](./DATA_COLLECTION_POLICY.md).

## Envelope (versioned)

```ts
type AnalyticsEnvelope = {
  schemaVersion: 1;   // ANALYTICS_SCHEMA_VERSION
  id: string;         // evt-<uuid>
  name: AnalyticsEventName;
  ts: string;         // ISO-8601
  metadata: Record<string, string | number | boolean>;
};
```

- **Versioning**: `ANALYTICS_SCHEMA_VERSION` is stamped on every envelope. The queue
  discards persisted events whose version doesn't match on read, and the flush payload is
  `{ schemaVersion, events }` so a sink can route/migrate by version. Bump the constant on
  any breaking field change; add a migration note here.
- **Typed & closed**: `AnalyticsEventName` is a closed union. `buildEnvelope(name, meta)`
  returns `null` for unknown names, so callers cannot emit an off-schema event.

## Events (this version)

| Name | Family | Allowed metadata | Tier |
|---|---|---|---|
| `session_started` | lifecycle | `runtime`, `releaseTrack` | analytics |
| `session_heartbeat` | lifecycle | `durationBucket` | analytics |
| `session_ended` | lifecycle | `durationBucket` | analytics |
| `view_opened` | navigation | `view` (allowlisted) | analytics |
| `download_started` | downloads | `kind` | analytics |
| `download_completed` | downloads | `kind`, `sizeBucket` | analytics |
| `install_activated` | downloads | `releaseTrack` | analytics |
| `feed_card_opened` | feed | `cardType`, `dwellBucket` | recommendations |
| `community_opened` | community | `mode` | analytics |
| `community_joined` | community | `mode` | analytics |
| `community_created` | community | `mode` | analytics |
| `message_activity_counted` | community | `count`, `mode` (**count only, never content**) | analytics |
| `auth_succeeded` | auth | `mode` | analytics |
| `upload_completed` | media | `kind`, `sizeBucket` | analytics |
| `upload_failed` | media | `kind` | analytics |
| `voice_joined` | voice | `mode` | analytics |
| `voice_join_failed` | voice | `mode` | analytics |
| `screen_share_started` | voice | `mode` | analytics |
| `feature_used_counted` | engagement | `feature` (allowlisted), `count` | analytics |
| `search_performed` | search | `resultBucket` (**no query text**) | analytics |

> Naming note: the release track keys are `releaseTrack` — `releaseChannel`/`channel` collide
> with the SENSITIVE blocklist (`channel`) and would be silently stripped. Enforced by
> `intelligence:taxonomy:validate`.

Every legacy `analyticsService` event now forwards to its canonical equivalent via the
`CANONICAL_BRIDGE` (see `src/services/analytics/event-registry.json` `legacyMap`); the
governed registry and this schema are kept in 1:1 lockstep by CI.

## Privacy enforcement (in the schema, not just docs)

- **Allowlist**: only the metadata keys above survive; anything else is dropped.
- **SENSITIVE blocklist**: keys matching `message|body|text|query|password|token|secret|
  channel|attachment|email|username|user_id|session_id|authorization|ip|location` are
  rejected — content and identifiers cannot enter an envelope.
- **Value hygiene**: strings capped at 40 chars, numbers clamped to `[0, 10000]` and
  truncated, `view` restricted to an allowlisted set.
- **Buckets over raw values**: `durationBucket`, `sizeBucket`, `countBucket` keep exact
  durations/sizes/counts off the wire.

## Offline queue & retry (`analyticsQueue`)

- **Consent-gated**: `enqueue`/`flush` are no-ops unless optional analytics is enabled;
  withdrawing consent (`analyticsService.setEnabled(false)`) plus `analyticsQueue.clear()`
  purges pending events.
- **Durable & capped**: persisted in `localStorage` (`picom.analytics.queue.v1`), FIFO,
  capped at 500 (oldest dropped) so a device offline for a long time can't grow unbounded.
- **Transport is OFF by default**: events leave the device only when
  `VITE_ANALYTICS_SINK_URL` (a **public HTTPS URL, never a secret**) is configured. Until
  then everything stays local — no network egress. No provider secret is bundled into the
  renderer (enforced by the env/secret smokes).
- **Batched flush with backoff**: sends up to 50 events per POST; on success drops the
  batch and continues; on failure keeps the batch and backs off exponentially
  (5s → … → 5m cap). Flor triggers on regain-online, tab-visible, and a 60s interval.

## Wiring (call sites)

Emit via `analyticsQueue.enqueue(name, meta)` from the relevant surface (session lifecycle
in app bootstrap, `view_opened` on route change, `download_*` in the update/file paths,
`feed_card_opened` in the feed, `search_performed` in search — using the bucket helpers).
Call `analyticsQueue.start()` once after consent is known.

## Verification
- Typecheck passes; the closed union + `buildEnvelope` null-guard prevent off-schema events.
- Contract smoke: `npm run intelligence:event-schema:smoke`.
- No content/identifier field is representable; transport disabled without a configured URL.
