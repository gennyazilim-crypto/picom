# Picom Intelligence Engine — Analytics Dashboard

**Task 07 · product analytics dashboards.** Built from the **opt-in, count/bucket-only**
event stream (Task 02 schema + `analyticsService`). All metrics are **aggregate and
pseudonymous** — no per-user content, no identifiers, no message data.

## Data source & privacy
- Metrics derive only from consented, typed envelopes (Task 02) and the count-only legacy
  events. Users without the `analytics` consent contribute **nothing**.
- Aggregation uses **pseudonymous device/session counters**, never user identity
  (`analyticsService.identifyUserPlaceholder` returns `identified: false`).
- The user-facing snapshot (`getPrivacyDashboardSnapshot`) shows the device its own totals;
  the operator dashboard shows population aggregates only.

## Metrics

### Engagement
| Metric | Definition | Source events |
|---|---|---|
| **DAU / WAU / MAU** | distinct active pseudonymous sessions in 1/7/30 days | `session_started` |
| **Stickiness** | DAU ÷ MAU | derived |
| **Session duration** | median/percentiles of `durationBucket` | `session_heartbeat` / `session_ended` |
| **Sessions per user (bucketed)** | session count distribution | `session_started` |

### Retention
| Metric | Definition |
|---|---|
| **N-day retention** | % of a signup cohort with a session on day N (1/7/30) |
| **Rolling retention** | active on/after day N |
| **Cohort curves** | retention by signup week |

Cohorts are pseudonymous (cohort = signup week bucket); no user is singled out.

### Growth & conversion
| Metric | Definition | Source |
|---|---|---|
| **Community growth** | new communities & joins over time | `community_joined`, `community_opened` |
| **Download → activation** | installs that reach first session | `download_completed` → `install_activated` → `session_started` |
| **Funnel conversion** | step-through rate | download funnel events |

### Feature adoption
| Metric | Definition | Source |
|---|---|---|
| **Feature adoption** | % of active users using feature X | `feature_usage_count_only`, `view_opened` |
| **Feature frequency** | uses per active user (bucketed) | same |
| **Search usage** | searches per session, result-bucket mix | `search_performed` |

### Safety (aggregate, from Task 06)
Spam/bot/report **counts** and enforcement **rates** — no target identities in the
dashboard.

## Architecture
1. **Collection** — Task 02 queue (consented) → optional sink.
2. **Aggregation** — server-side rollups into pseudonymous daily/weekly aggregates; raw
   events short-retention, aggregates longer (Task 09). No per-user drill-down to content.
3. **Presentation** — operator dashboard (aggregates) + the in-app privacy snapshot
   (device's own totals). Time-series, cohort tables, funnels.

## Guarantees
- Every metric is computable from count/bucket events; **no metric requires content or
  identity**. A metric that would need message data, precise timestamps, or user identity
  is out of scope.
- Retention windows in [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09).
- Consent management + export/delete in [PRIVACY_CENTER.md](./PRIVACY_CENTER.md) (Task 08).
- Audited in Task 10.
