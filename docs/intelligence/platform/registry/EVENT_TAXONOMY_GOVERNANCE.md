# Task 051 — Event Taxonomy Governance

A governed, versioned event taxonomy for Picom analytics, enforced in CI. This replaces
ad-hoc event creation with a single reviewed source of truth that classifies the privacy
risk of every field.

## Source of truth
- **`src/services/analytics/event-registry.json`** — canonical taxonomy data (events,
  owners, status, version, per-property PII class, legacy map).
- **`src/services/analytics/eventRegistry.ts`** — typed accessors + governance helpers
  (`isCanonicalEventName`, `listActiveEvents`, `resolveCanonicalName`, `getEventOwner`).
- **`src/services/analytics/eventSchema.ts`** (Task 02) — the runtime schema that actually
  builds/sanitizes envelopes. The registry's **active** events must mirror this exactly.
- **`scripts/intelligence-event-taxonomy-validate.mjs`** — CI validator.

## Naming convention
- Canonical events and properties are `snake_case`: `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`.
- Shape: `<subject>_<verb>` past-tense where natural (`community_joined`, `session_started`).
- Property keys are also snake_case; enum-like values are allowlisted in `eventSchema.ts`.
- **No property key may match the SENSITIVE blocklist** (`message|body|text|query|password|
  token|secret|channel|attachment|email|username|user_id|session_id|authorization|ip|
  location`) — such keys are silently stripped at runtime, so they are rejected at review
  time instead. (This rule caught the real `releaseChannel` / `channel` bug — see the
  legacy map.)

## Ownership, versioning & deprecation
- Every event declares an **owner** team (`growth`, `platform`, `trust-safety`, `product`),
  a **status** (`active` | `deprecated` | `proposed`), and a **since** schema version.
- **Deprecation:** set `status: deprecated` + `replacedBy` (a canonical name). Never delete;
  keep the mapping so historical data stays interpretable and emitters can migrate.
- **New events** are added as `proposed` first, reviewed, then promoted to `active` in the
  same PR that adds them to `eventSchema.ts` (parity is enforced).

## PII classification
Each property carries a `pii` class:
- `none` — buckets, counts, allowlisted enums (all current properties).
- `pseudonymous` — salted/hashed quasi-identifiers (must go through the Anonymization Layer,
  Task 25; none currently collected client-side).
- `forbidden` — content/direct identifiers. **Never** a collectable property; the validator
  rejects it. Documents the boundary so reviewers can point at it.

## Event review & approval workflow
1. Author adds/edits the event in `event-registry.json` (+ `eventSchema.ts` if activating).
2. Author sets owner, status, `since`, and a `pii` class for every property.
3. `npm run intelligence:taxonomy:validate` must pass locally.
4. Data-governance owner reviews naming, ownership, and PII classes in the PR.
5. CI runs the validator (see below) — merge is blocked on failure.

## CI validation plan
`npm run intelligence:taxonomy:validate` enforces:
1. Canonical snake_case for all event/property names.
2. **Parity**: active registry events ⇄ `eventSchema.ts` ALLOWED_METADATA (no drift, no
   uncontrolled event that exists in code but not the registry).
3. Every property is PII-classified; none is `forbidden`; no active property key collides
   with the SENSITIVE blocklist.
4. Governance metadata complete (owner ∈ allowlist, valid status, `since` present, deprecated
   ⇒ `replacedBy`).
5. Legacy mapping complete (every legacy event → `replacedBy` or `proposedName`).

Wire it alongside `intelligence:event-schema:smoke` in the CI test job.

## Migration map (legacy → canonical)
See [legacy-event-map.md](legacy-event-map.md). Summary: the older `analyticsService.ts`
vocabulary (`app_started`, `login_success`, …) is mapped to canonical events; where no
canonical equivalent exists yet, a `proposedName` is recorded for review.

## Architecture
```
authors ─► event-registry.json (canonical data) ─┬─► eventRegistry.ts (typed helpers, app)
                                                  ├─► eventSchema.ts (runtime build/sanitize)  ← parity enforced
                                                  └─► taxonomy validator (CI gate)
legacy analyticsService.ts events ─► legacyMap ─► canonical / proposed names
```

## Validation checklist
- [x] canonical naming enforced in CI
- [x] registry ⇄ runtime schema parity enforced (no uncontrolled events)
- [x] every property PII-classified; SENSITIVE-key collisions rejected
- [x] owner/status/version required per event
- [x] legacy events mapped to canonical/proposed names
- [x] validator proven to fail on drift + collision (negative-tested)

## Status (all original blockers closed)
- ✅ **Proposed canonicals promoted**: all 9 are now ACTIVE in `eventSchema.ts` + registry
  (20 ⇄ 20 lockstep enforced in CI). Every legacy event maps via `replacedBy`.
- ✅ **Legacy service bridged**: `analyticsService.trackEvent` forwards every legacy event to
  the canonical queue (`CANONICAL_BRIDGE`, validator-enforced), including the
  `releaseChannel` → `releaseTrack` safe-key mapping.
- ✅ **CI wired**: `qa.yml` runs `intelligence:event-schema:smoke` + `intelligence:taxonomy:validate`
  (activates on the next push of this branch).

**Next task:** 052 — Analytics Ingestion Gateway.
