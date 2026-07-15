# Tasks 52–100 — Prod Coverage Audit (piso / Picom production)

Evidence-based map of what the **live `piso` project already implements** vs. each task, so
we fill genuine gaps additively instead of building conflicting duplicates. Evidence =
observed `public` tables + functions on 2026-07-15. `EXISTS` means a real prod implementation
is present (may still need hardening); `PARTIAL` = building blocks exist; `GAP` = not found.

> ⚠️ Prod was built by a different (more mature) codebase than this local repo. Any additive
> work must reference these existing objects, not re-create them.

| # | Task | Status | Evidence in prod / gap |
|---|------|--------|------------------------|
| 51 | Event taxonomy governance | DONE (client) | Added canonical registry + CI validator this session; prod has `sanitize_analytics_metadata` server-side |
| 52 | Analytics ingestion gateway | EXISTS | `record_analytics_event`, `process_analytics_event_queue`, `analytics_event_queue`, `sanitize_analytics_metadata` |
| 53 | Consent enforcement middleware | PARTIAL | `user_consents`, `cookie_consents` tables + `sanitize_analytics_metadata`; no explicit server-side consent gate on ingestion → **gap: enforce consent in record_analytics_event path** |
| 54 | PII detection & redaction | GAP | Only key-allowlist sanitization; no value-level PII scan/redaction |
| 55 | Pseudonymous identity service | GAP | No pseudonymization/salt service found |
| 56 | Data minimization enforcer | PARTIAL | `sanitize_analytics_metadata` (key allowlist) + `anonymize_analytics_for_deleted_profile`; no cross-table minimization policy |
| 57 | Warehouse bronze/silver/gold | PARTIAL | `analytics_events`(bronze) → `rollup_piso_daily_analytics` → `daily_metrics`/`community_metrics`/`revenue_metrics`/`moderation_metrics` (gold). No explicit silver layer |
| 58 | Warehouse access control | EXISTS | RLS across analytics/metrics tables; `get_piso_analytics_center` gated |
| 59 | Metric definition registry | GAP | Metrics computed ad-hoc in rollups; no governed metric registry |
| 60 | Data quality monitoring | GAP | No freshness/volume/null-rate checks found |
| 61 | Experiment assignment | PARTIAL | `algorithm_experiments`, `algorithm_versions` tables; assignment service unclear |
| 62 | Experiment analysis | GAP | No analysis pipeline found |
| 63 | Feature flag control plane | EXISTS | `feature_flags`, `update_release_feature_flag`, `release_channel_assignments`, `beta_settings` |
| 64 | Recommendation feature store | GAP | `recommendation_settings` only; no feature store |
| 65 | Feed candidate generation | EXISTS | `get_feed_discover`, `get_feed_following`, `get_piso_feed`, `feed_events` |
| 66 | Feed ranking service | EXISTS | `piso_feed_weight`, `piso_active_feed_weights`, `piso_freshness_score`, `feed_item_scores`, `feed_algorithm_settings` |
| 67 | Feed ranking evaluation | GAP | No offline eval / metrics on ranking quality |
| 68 | Community recommendation | PARTIAL | `get_piso_trending`, `community_metrics`; no dedicated rec service |
| 69 | Friend recommendation | GAP | `follows` graph exists; no rec service |
| 70 | Notification ranking | PARTIAL | `notifications`, `notify_*`; no ranking/prioritization |
| 71 | Smart digest engine | GAP | Not found |
| 72 | Trend detection | PARTIAL | `get_piso_trending`, `trend_settings`, `sponsored_trends`; no anomaly detector |
| 73 | Content quality model | GAP | Not found |
| 74 | Creator reputation | GAP | Not found (badges/verification exist, not reputation) |
| 75 | Community health pipeline | PARTIAL | `community_metrics`, `get_community_insights` |
| 76 | T&S case management | EXISTS | `moderation_reports`, `moderation_actions`, `appeals`, `user_reports`, `community_reports` |
| 77 | Moderation decision engine | PARTIAL | `community_moderation_settings`, `community_blocked_words`, `community_spam_logs`, `community_message_spam_guard` |
| 78 | Coordinated abuse detection | GAP | Not found |
| 79 | Account takeover detection | PARTIAL | `security_events`, `risk_scores`, `security_risk_level`, `two_factor_settings`; no ATO model |
| 80 | Security event pipeline | EXISTS | `record_security_event`, `security_audit_logs`, `rate_limit_events`, `check_security_rate_limit`, `review_security_event` |
| 81 | Realtime stream processing | GAP (infra) | No stream processor; queue-based batch only |
| 82 | Batch orchestration | PARTIAL | `rollup_piso_daily_analytics`, `finalize_community_deletions` (cron?); no orchestrator |
| 83 | Model registry & versioning | PARTIAL | `algorithm_versions` for feed weights; no ML model registry |
| 84 | Model serving platform | GAP (infra) | Heuristic SQL scoring only; no model server |
| 85 | Model monitoring & drift | GAP | Not found |
| 86 | Bias & fairness review | GAP | Not found |
| 87 | AI explainability | GAP | Not found |
| 88 | Feedback learning loop | GAP | Not found |
| 89 | Data-subject request automation | PARTIAL | `data_export_requests`, `account_deletion_requests`, `user_account_deletion_requests` tables; automation depth unclear |
| 90 | Deletion propagation | PARTIAL | `anonymize_analytics_for_deleted_profile`, `finalize_community_deletions`; no full cross-table propagation map |
| 91 | Privacy budget & aggregation | GAP | No k-anon/DP enforcement found |
| 92 | Third-party processor governance | GAP (doc) | No registry of processors |
| 93 | Data residency strategy | PARTIAL (infra) | Region eu-central-1; no documented strategy |
| 94 | Backup & disaster recovery | PARTIAL (infra) | Supabase managed backups; no DR runbook |
| 95 | Observability & SLOs | PARTIAL | `service_health_logs`, `root_service_health`, `crash_reports`, `desktop_update_events`; no SLO defs |
| 96 | Cost governance / FinOps | GAP | `revenue_metrics` only; no cost tracking |
| 97 | Root intelligence dashboard v2 | EXISTS | `get_root_control_center`, `root_security_states`, `root_audit_logs` |
| 98 | Intelligence admin controls | EXISTS | `get_piso_{analytics,algorithm,security,search,release,monetization,verified,beta}_center` |
| 99 | Hosted multi-user acceptance | BLOCKED | Requires live multi-user test on hosted env (cannot run from here) |
| 100 | Final readiness audit | THIS DOC + follow-up | Consolidates the above into go/no-go |

## Summary
- **EXISTS (real prod impl):** 52, 58, 63, 65, 66, 76, 80, 97, 98 (~9)
- **PARTIAL (building blocks, needs gap-fill):** 53, 56, 57, 61, 68, 70, 72, 75, 77, 79, 82, 83, 89, 90, 93, 94, 95 (~17)
- **GAP (genuine new work):** 54, 55, 59, 60, 62, 64, 67, 69, 71, 73, 74, 78, 84, 85, 86, 87, 88, 91, 92, 96 (~20)
- **Infra/blocked (cannot deploy/provision from here):** 81, 84, 93, 94, 99

## Recommended additive gap-fill order (safe, no duplication)
Prioritize privacy/quality gaps that build on existing analytics infra and need no new infra:
1. **T53** consent enforcement in the ingestion path (harden `record_analytics_event`).
2. **T60** data quality monitoring (freshness/volume/null checks on `analytics_events`/marts).
3. **T59** governed metric registry (like the event registry, over `daily_metrics`).
4. **T54/55/56** PII redaction + pseudonymization + minimization service.
5. **T90/89** deletion-propagation completeness map + DSAR automation gaps.
6. **T91** k-anonymity/privacy-budget on marts.
Governance/doc-only (no code): T92, T93, T94, T86, T87 → specs for operator/Codex.
Infra (cannot do from here): T81, T84, T99 → operator/Codex.

Each code/migration gap-fill is applied to prod **additively, one at a time, with approval**.
