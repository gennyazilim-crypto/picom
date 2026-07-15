# Task 21 — Feature Flags

Extends the shipped `featureFlagService` + `v1ReleaseScope` + `client-config` Edge Function
into a full remote flag/rollout system with kill switches. Preserves existing gating.

## Architecture
```
client-config Edge Function (per-channel flags) ──► featureFlagService (renderer) ──► gates
remote config (flags, %rollout, targeting) ──┘         │
kill switches (emergencyKillSwitchService) ────────────┘
```

## Capabilities
- Boolean flags, **percentage rollout** (deterministic hash), channel/segment targeting,
  and **kill switches** (already `emergencyKillSwitchService`). Server-authored; renderer
  never selects a raw config URL.

## Data & privacy
- Targeting uses non-PII segments (channel, platform, pseudonymous bucket). **No** content
  or identity for flag decisions.

## Database / config
- Flags in remote config served by `client-config`; audit table `flag_changes(actor, key,
  value, ts)` (admin-scoped) for change history.

## APIs / jobs
- `client-config` returns resolved flags; admin RPC to set flags (audited, rate-limited).

## Dashboard metrics
- Flag exposure counts, rollout coverage, kill-switch activations.

## Tests
- Deterministic rollout bucketing; kill switch overrides everything; default-off safety;
  no PII in targeting. (Reuses existing `voice-screen:beta-gate:smoke` pattern.)

## Validation checklist
- [ ] server-authored · [ ] deterministic rollout · [ ] kill switch wins · [ ] no PII targeting
- [ ] change audit

## Risks / blockers
- Flag sprawl → ownership + expiry. Foundation for A/B (20) and staged rollouts.

**Next:** Task 22 — Event Bus.
