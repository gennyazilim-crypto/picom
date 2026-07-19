# Task 18 — AI Moderation

Assists **human** moderators; never fully-automated removal of speech. Content is scanned
only transiently for policy matching, not stored, profiled, or used for training.

## Architecture
```
report / detector signal ──► moderation queue (priority = severity·trust·health)
                                   │  optional transient classifier (policy match only)
                                   ▼
                        human moderator decision ─► action (audit-logged, reversible)
```

## Data & privacy
- Reports carry a **redacted excerpt only** (existing report flow). Any classifier runs
  **transiently** on the reported item for the moderator's review — **no** persistence of
  content, **no** training, **no** profiling of authors by content.
- Destructive actions are **human-made**; AI only ranks/flags/queues.

## Database
- Reuse report tables + community audit log. `moderation_queue(item_ref, severity, status,
  assigned_to, created_at)` — moderator-scoped RLS.

## APIs / jobs
- RPC `list_moderation_queue(community)` (mod-scoped); `resolve_moderation_item(action)`
  (audit-logged). Priority recompute job.

## Dashboard metrics
- Queue depth, time-to-action, action mix, appeal/overturn rate, FP rate.

## Tests
- Human-in-the-loop enforced (no auto-remove of speech); redacted excerpts only; no content
  persisted by the classifier; audit + reversibility.

## Config & deploy
- Classifier is optional/kill-switchable. Migration for queue.

## Validation checklist
- [ ] human-in-the-loop · [ ] transient scan, no storage/training · [ ] redacted excerpts
- [ ] audit-logged + reversible · [ ] mod-scoped

## Risks / blockers
- Over-blocking / bias → human review, appeals, transparency reports. Uses Trust (12),
  Spam/Bot (13).

**Next:** Task 19 — Growth Analytics.
