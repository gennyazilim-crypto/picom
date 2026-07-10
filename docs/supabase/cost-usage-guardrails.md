# Supabase Cost and Usage Guardrails

## Objective

Prevent accidental Supabase overuse during internal beta, public beta, and production without weakening auth, RLS, realtime, storage, or diagnostics. Limits are product safeguards, not authorization controls.

## Governance

- Operations owns the monthly Supabase budget and project usage review.
- Engineering owns query, realtime, storage, and Edge Function efficiency.
- Product approval is required before increasing a hard client/server limit.
- Alert thresholds use percentages of the approved monthly budget because vendor plan limits and pricing may change.
- Never place billing credentials, service-role keys, database passwords, or provider secrets in renderer configuration or alert payloads.

## Environment budgets

| Environment | Usage policy | Alert thresholds | Action |
| --- | --- | --- | --- |
| Local | Local Supabase only where possible | N/A | Reset disposable data as needed |
| Staging | Small representative datasets; no load test without approval | 50%, 75%, 90% of staging budget | Pause load jobs at 75%; investigate at 90% |
| Beta | Invite-only cohorts and feature flags | 50%, 70%, 85%, 95% | Review growth, disable optional traffic, pause cohort expansion |
| Production | Approved SLO/capacity plan | 60%, 75%, 90%, forecasted overrun | Scale/optimize deliberately; use kill switches for optional features |

## Usage dimensions

### Auth user growth

Track daily/weekly/monthly active accounts, signup rate, verification rate, session refresh volume, failed login rate, and inactive-account growth.

Guardrails:

- Rate-limit signup/login/reset flows at the trusted backend/gateway.
- Do not create anonymous profiles on every app launch.
- Alert on signup or failed-login growth outside the beta cohort forecast.
- Review dormant-account retention before automatic deletion.

### Database size and query load

Track total database size, table/index growth, message/attachment metadata growth, row counts, slow queries, connection usage, and cache hit ratio.

Guardrails:

- Cursor pagination for messages, DMs, notifications, audit logs, reports, and search.
- Bounded list limits and indexed channel/conversation ordering.
- No renderer polling loop for data already supplied by realtime.
- Query plans reviewed before broad beta for search, feed, moderation, and admin summaries.
- Alert when daily growth or connection saturation exceeds the approved forecast.

### Realtime volume

Track concurrent connections, channel subscriptions, messages/sec, broadcast/presence events, reconnect rate, and duplicate-event rate.

Existing safeguards:

- Typing events are throttled.
- Message and DM subscriptions remove/unsubscribe on cleanup.
- Hooks scope message subscriptions by active destination.
- Event IDs/client message IDs support dedupe foundations.

Additional guardrails:

- One active subscription per logical room per client.
- Backoff with jitter for reconnect; no custom infinite immediate retry loop.
- Coalesce typing/presence and drop stale low-priority events.
- Load tests target staging only and require a fixed client/message cap.
- Alert on reconnect storms, duplicate rate, or sustained traffic above baseline.

### Storage

Track bucket bytes, object count, upload/download bandwidth, orphaned pending objects, thumbnail ratio, and quarantined files.

Existing safeguards:

- Images only: PNG, JPEG, WebP, GIF.
- Maximum image size: 10 MiB in renderer, native picker, remote config default, and trusted validation helper.
- Maximum composer/native selection: 4 images.
- MIME, extension, size, and image signature validation.
- Private bucket/RLS and signed URL foundation.

Additional guardrails:

- Server-side scanning/quarantine before broad production.
- Daily orphan cleanup dry run; destructive cleanup needs explicit approval.
- Thumbnail delivery for feed/chat previews.
- Per-user/community upload quotas and abuse rate limits.
- Alert on object/bandwidth growth and repeated rejected uploads.

### Edge Functions

Track invocations, error rate, execution duration, cold starts, outbound calls, and per-function traffic.

Guardrails:

- Functions validate auth and payload size before work.
- Keep functions short and idempotent; long jobs move to controlled workers.
- Webhook/bot/provider functions remain disabled until rate limits and audit exist.
- Notification fanout uses bounded batches and user preferences.
- Alert per function, not only project total, so abuse is attributable.

### Bandwidth

Track database API egress, realtime traffic, storage downloads, signed image delivery, and Edge Function response bytes.

Guardrails:

- Select only required columns.
- Paginate and cap responses.
- Prefer thumbnails over full images.
- Cache immutable public assets safely; never public-cache private signed content beyond its access policy.
- Avoid refetch on every focus/reconnect; debounce resume handling.

### Logs

Track log ingestion volume, retention, error cardinality, and repeated noisy events.

Existing safeguards:

- Renderer log buffer is capped at 250 entries.
- Messages are truncated and sensitive fields/JWTs/bearer values are redacted.

Additional guardrails:

- Remote diagnostics remains opt-in and sampled.
- No message bodies, tokens, cookies, authorization headers, or private attachment contents.
- Aggregate repetitive errors before transport.
- Define retention and deletion by environment.

### Project region

- Select the production region based on primary user geography, legal review, storage/backup locality, and LiveKit latency.
- Keep database, storage, realtime, and backups regionally aligned where possible.
- Region migration requires a tested export/restore plan and maintenance communication.
- Do not create extra regions/projects as a cost workaround without tenancy and residency design.

## App-side defensive limits

| Limit | Current value | Enforcement |
| --- | --- | --- |
| Image upload size | 10 MiB | Renderer file service, native picker, remote config default, Edge Function helper |
| Attachments per composer message | 4 | Composer and native picker |
| Allowed image formats | PNG/JPEG/WebP/GIF | MIME, extension, signature, trusted helper |
| Local logs | 250 records | Bounded logging service |
| Search and list results | Bounded per service | Client/API service limits and cursor plans |
| Typing events | Throttled | Realtime service constant |

The backend remains authoritative. Client limits prevent accidental overuse but cannot stop a malicious client.

## Budget alert placeholders

Create dashboard alerts for:

- Forecasted monthly bill above approved budget.
- Database size at 60/75/90% of planned capacity.
- Realtime concurrent connections or message volume at 70/85/95% of test capacity.
- Storage bytes, object count, or bandwidth at 60/80/90% of budget.
- Edge Function invocation/error/duration anomaly.
- Auth signup or failed-login anomaly.
- Log ingestion anomaly.

Each alert needs owner, severity, threshold window, runbook, notification channel, acknowledgement SLA, and rollback/kill-switch action.

## Kill-switch order for overuse

1. Disable optional analytics/crash transport.
2. Reduce discovery/feed refresh and optional background queries.
3. Disable uploads if storage or scanning is degraded.
4. Disable webhook/bot delivery.
5. Degrade realtime to API refresh only if necessary.
6. Preserve auth, core message reads, and user data access wherever safe.

Security or data-integrity incidents take precedence over cost continuity.

## Open TODOs

- Record the approved beta/production numeric budgets after the Supabase plan is selected.
- Add server-side per-user/community upload quotas.
- Add provider-backed usage dashboards and alerts.
- Measure query/realtime baselines in staging load tests.
- Add cost attribution tags/metadata where the provider supports them without personal data.
- Verify log retention and export costs before enabling remote crash/analytics providers.
