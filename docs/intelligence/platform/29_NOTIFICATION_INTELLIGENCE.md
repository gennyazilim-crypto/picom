# Task 29 — Notification Intelligence

Optimizes **when** and **whether** to notify (batching, timing, priority) using engagement
metadata — never notification content — on top of the shipped `notificationService`
routing, DND, and Quiet Hours.

## Architecture
```
notification routed/opened/dismissed (Task 02) ──► engagement model (per-category rates)
                                                          │
active-hours (Task 03) + DND/Quiet Hours ─────────────────┼─► send-time + batch decision
                                                          ▼
                                              digest (Task 05) vs immediate
```

## Signals (content-blind)
Per-category open/dismiss **rates**, active-hours, DND/Quiet-Hours state, channel mute.
**No** notification body text, no message content.

## Decisions
- Suppress low-value categories the user consistently dismisses; batch into a digest during
  quiet periods; deliver mentions/calls immediately (respecting DND); pick send-time from
  active-hours.

## Data & privacy
- Reuses `decideNotificationRoute`; adds engagement-rate features (consented). Body text is
  never stored or modeled.

## Database / infra
- `notification_engagement(user_id, category, decision, ts)` (owner RLS, decisions only).

## APIs / jobs
- Rate rollups; send-time scheduler (respects DND/Quiet Hours).

## Dashboard metrics
- Open/dismiss rate by category, digest adoption, opt-out rate.

## Tests
- DND/Quiet-Hours always honored; mentions/calls not suppressed; no body text stored;
  owner-scoped.

## Validation checklist
- [ ] content-blind · [ ] DND/Quiet Hours honored · [ ] critical alerts never suppressed
- [ ] owner-scoped · [ ] consented

## Risks / blockers
- Over-suppression → never suppress mentions/calls/security. Uses AI Assistant (05).

**Next:** Task 30 — Smart Onboarding.
