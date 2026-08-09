# Publisher Analytics Privacy

## Collected
- stream_id, publisher_user_id
- viewer_user_id (authenticated viewers only)
- viewer_session_id
- event timestamps, platform/locale allowlists
- watch_seconds aggregates
- opaque notification_delivery_id when present

## Never collected
- email, phone
- IP addresses
- LiveKit/auth tokens
- stream keys
- chat message bodies in analytics events
- arbitrary hardware fingerprints

## Access
- Raw event/session tables: service_role only (no authenticated table grants)
- Publisher RPCs return aggregates for own streams only
- `dashboard.read` does not grant analytics
- Root may use include_internal on stream analytics RPC

## Retention
RETENTION_POLICY_PENDING — no automatic deletion worker introduced by TASK29.

## Internal test exclusion
Profiles listed in `platform_stats_exclusions` (test/seed/system/bot) set `internal_test` and are excluded from public aggregates.
