# Analytics Event Schema (Task 06)

## Purpose

Contract for product analytics events that feed root dashboard aggregates (DAU/WAU/MAU, funnels). Warehouse metrics appear in Overview only when `analytics_available` is true from `get_root_dashboard_overview_v1`; otherwise UI shows unavailable — never invented series.

## Core tables / functions (existing)

| Object | Role |
|--------|------|
| `analytics_events` | Stored events with consent category |
| `analytics_event_queue` | Ingest buffer / processor backlog |
| `sanitize_analytics_metadata(jsonb)` | PII key denylist / redaction |
| `record_analytics_event` (and callers) | Write path |
| `run_analytics_data_quality()` | Freshness, volume, queue stuck, consent checks |
| `analytics_data_quality_runs` | DQ run history (admin read policy) |

## Event envelope (logical)

| Field | Type | Notes |
|-------|------|-------|
| `event_name` | text | Stable taxonomy key |
| `occurred_at` / `created_at` | timestamptz | Event time |
| `actor_pseudonym` / user refs | text/uuid | Prefer pseudonymous where possible |
| `session_id` | text | Optional |
| `consent_category` | text | `necessary` \| `analytics` \| `ads` |
| `metadata` | jsonb | Passed through sanitizer — no emails, phones, raw message bodies |
| `community_id` / `surface` | optional | Dimension keys |

## Consent & minimization

- Events without valid consent category fail DQ checks.
- Metadata must not include message content, exact GPS, government IDs, or payment PANs.
- Dashboard exports of analytics must be aggregate-first.

## Dashboard consumers

- Overview: DAU / WAU / MAU when warehouse contract present.
- Analytics module page: exploration UI bound to real aggregates.
- DQ: ops can run quality checks via service role / scheduled jobs.

## Versioning

Schema changes are additive migrations only. Do not break `record_analytics_event` callers without compatibility.
