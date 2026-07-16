# Operator Runbook — Infra / ML tasks (51–100 that cannot run from the code environment)

These tasks require external infrastructure, ML training/serving, a paid Supabase tier, or
human sign-off. They cannot be "completed as running systems" from the code/SQL environment, so
this is the complete, implementation-ready deliverable: concrete steps an operator (or Codex with
deploy access) executes. Each is scoped to Picom's live `piso` project.

## T81 — Realtime stream processing
Current: queue + `pg_cron` batch (1/min) already deployed. For true realtime:
- Option A (low-lift): keep pg_cron but add a `pg_net`-backed webhook from `record_analytics_event`
  to an Edge Function for near-real-time fan-out. `pg_net` is available (verified).
- Option B: external stream (e.g., a lightweight consumer reading Supabase Realtime on
  `analytics_events` inserts) computing sliding-window counters into `realtime_counters`.
Deliverable to add when infra chosen: `realtime_counters(metric,window,value,updated_at)` (short TTL).

## T83 / T84 — Model registry & serving
Current: heuristic SQL scoring (`piso_feed_weight`, `get_content_quality_scores`, risk detectors).
- **T83 registry: ✅ DEPLOYED** — `model_registry` + `model_deployments` (admin-read RLS) +
  `register_model()` writer applied to prod.
- **T84 serving:** requires an external inference service (Supabase Edge Function calling a hosted
  model, or a separate container). Wire the app to call it behind a feature flag; fall back to the
  existing SQL heuristics when unavailable (matches the graceful-degradation pattern already used).

## T85 — Model monitoring & drift
DB side **✅ DEPLOYED**: `model_drift_metrics(model_key,metric,value,window_label,computed_at)`
(admin-read). Populating it needs a served model (T84): log prediction inputs/outputs (pseudonymized
via `pseudonymize_actor`), compute population-stability index vs a baseline window, alert on drift.

## T87 — AI explainability
DB side **✅ DEPLOYED**: `model_predictions(model_key, subject_hash, score, explanation jsonb)`
(admin-read). Heuristic scorers already return their components; any ML model (T84) must populate
`explanation` with top feature attributions.

## T88 — Feedback learning loop
DB side **✅ DEPLOYED**: `feedback_events` + `record_feedback_signal()`. Capture accept/dismiss /
report outcomes, then recompute `recommendation_features` (T64, deployed). Closing into a trained
model needs T84.

## T86 — Bias & fairness review
Process + artifacts (not a running system). **✅ Template delivered:**
[`docs/intelligence/fairness-review-template.md`](../fairness-review-template.md) — privacy-safe
cohort-parity review (no special-category data), run and signed at each model release, attached to the
`model_registry` version and the DPIA (Task 49).

## T92 — Third-party processor governance
**✅ Deliverable delivered:** [`docs/legal/subprocessors.md`](../../legal/subprocessors.md) — sub-processor
register (Supabase, LiveKit, email/SMTP, Steam/Epic OAuth) with purpose, data categories, region, DPA.
Review quarterly. Links to Consent/Compliance (Task 48/49). Open operator items noted in that file.

## T93 — Data residency strategy
Current: `piso` is in `eu-central-1` (EU). Deliverable: document the residency posture (EU-only
processing, no cross-border transfer of personal data without SCCs), confirm LiveKit/email region
alignment, and pin future services to EU regions. No code change; an operator/legal decision.

## T94 — Backup & disaster recovery
Supabase provides managed daily backups (plan-dependent) + PITR on paid tiers. Deliverable (operator):
document RPO/RTO targets, verify backup restore into a scratch project quarterly, keep a written DR
runbook (restore steps, DNS/secret re-issue, comms). Enabling PITR requires the Pro plan (same tier gate
that blocked branching).

## T99 — Hosted multi-user acceptance
Requires a live, multi-account test on the hosted app (real sign-ins, real voice/DM across users).
Deliverable (operator): an acceptance checklist run against the deployed build — sign-up→verify→join
community→post→DM→voice→moderation→delete-account (verify `deletion_propagation_status` shows 0 residual).
Cannot be executed from the code environment.

---

## Ready-to-apply (blocked only by the auto-mode safety review, not by infra)
These are complete migration files in `supabase/migrations/`; apply after review via `supabase db push`
or MCP `apply_migration` outside auto-mode:
- `20260715141000_add_recommendation_reputation_digest.sql` — T68/69/70/71/74/62 (user-facing
  SECURITY DEFINER functions held for review).
- `20260715141500_add_data_minimization_enforcer.sql` — T56 (irreversible bulk minimization; review
  retention window, then run/schedule deliberately).
