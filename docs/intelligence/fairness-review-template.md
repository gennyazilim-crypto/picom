# Model Fairness & Bias Review Template (T86)

Run this review at each release of any scoring/ranking model (feed ranking, risk/fraud scoring,
recommendations, content/creator scoring). Attach the completed review to the model version in
`model_registry` (metrics jsonb) and link it from the DPIA (Task 49). Keep it privacy-safe:
**no special-category data is collected**, so fairness is assessed on coarse, non-sensitive proxies
only, over aggregates.

## 1. Model under review
- Model key / version:
- Purpose & decision it informs (advisory vs automated):
- Owner:

## 2. Data & features
- Feature list + PII class each (from the event/feature registry). Confirm no forbidden/
  special-category inputs.
- Training/window and known coverage gaps:

## 3. Cohort parity (non-sensitive proxies)
Evaluate score/outcome distribution across coarse cohorts that are **not** special-category —
e.g. account tenure buckets, activity-level buckets, community-size buckets, locale/region-off.
| Cohort dimension | Buckets | Score/positive-rate parity (max−min) | Acceptable? |
|---|---|---|---|
| Account tenure | new / 30-90d / 90d+ | | |
| Activity level | low / med / high | | |
| Community size | small / medium / large | | |

Flag any parity gap beyond the agreed threshold (e.g. > 20% relative) for mitigation.

## 4. Adverse-action safeguards
- Are adverse actions (restriction/removal) human-reviewed and appealable? (required)
- Reason codes / explanation exposed? (link to `model_predictions.explanation`)
- Reversibility of automated throttles:

## 5. Decision
- [ ] Approved for production
- [ ] Approved with mitigations (list):
- [ ] Rejected — reason:
- Reviewer / date:

## Notes
- Fairness here is a **process artifact**, not a running system: it is completed and signed per
  model release. See [platform/OPERATOR_RUNBOOK_INFRA_ML_TASKS.md](platform/OPERATOR_RUNBOOK_INFRA_ML_TASKS.md).
