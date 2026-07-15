# Task 24 — ML Pipeline

Trains/serves the small, explainable models behind recommendations, ranking, and risk —
**only** on content-blind, consented features from the warehouse feature store.

## Architecture
```
feature store (23) ──► training job (offline) ──► model registry (versioned) ──► serving
                                                          │
                                    evaluation (offline metrics) ─► promote/rollback
```

## Models (deliberately simple/explainable)
- Recommendation/feed ranking weights, trust/risk scorers, trend/quality signals. Linear /
  gradient-boosted on tabular **features**, not deep content models. No content/audio/vision
  models on user data.

## Data & privacy
- Features are counts/buckets/affinities — **no** message/DM/audio/video, no identity.
  Training data is pseudonymous, k-suppressed. **No model trains on private messages**
  (hard invariant, audited Task 48/49).

## Registry & serving
- `ml_models(name, version, metrics, status, created_at)`; serving reads active version;
  deterministic, versioned; rollback supported. Weights also expressible as remote config
  for the linear models.

## APIs / jobs
- Scheduled training + eval jobs; serving via RPC/edge; shadow-eval before promote.

## Dashboard metrics
- Offline metrics (AUC/precision proxies), online CTR/accept (aggregate), drift, rollback
  events.

## Tests
- Reproducible training from fixed features; no content/identity in training set; promote
  gated by eval threshold; rollback works.

## Validation checklist
- [ ] content-blind features · [ ] no training on private messages · [ ] versioned + rollback
- [ ] eval-gated promotion · [ ] drift monitored

## Risks / blockers
- Bias/drift → simple models + monitoring + human oversight (12/18). Depends on Warehouse
  (23), Anonymization (25).

**Next:** Task 25 — Anonymization Layer.
