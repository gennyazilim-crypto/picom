# Product Health Dashboard

Status: Restricted local aggregate implementation

## Location and access

Product Health is the first section in Settings > Advanced > Admin Operations. The existing Admin Operations gate remains authoritative for UI access:

- development builds receive explicit development access;
- packaged/non-development builds require the app-admin RPC result;
- normal users do not receive the panel.

UI access is not backend authorization for future metrics APIs.

## Displayed data

- Picom app version and release channel.
- Aggregate API/network status.
- Aggregate realtime status.
- Upload pipeline status classification.
- LiveKit/voice configuration status.
- Count of recent redacted errors and warnings.
- Count of queued local redacted crash reports.
- Last network check time and the `local_aggregate` source label.

No message/reply/draft/search content, attachment data, user/community/channel identifiers, private names, email, IP, paths, URLs, tokens, cookies, authorization values, keys, provider payloads or raw logs are displayed.

## Status semantics

- API uses `mock`, `operational`, `checking`, `online/offline`, `degraded` or `backend_unreachable` states derived from the existing data-source and network services.
- Realtime mirrors the safe network-derived availability classification; it is not delivery latency or SLO proof.
- Upload is `development`, `unavailable` or `unverified`. No production storage health is invented when no protected backend signal exists.
- Voice uses the existing safe LiveKit configuration status rather than room/user details.
- Error/warning counts use the bounded recent redacted logging window.

## Limitations

- Snapshot is captured when the Admin Operations panel mounts; it is not a continuously refreshed production dashboard.
- Local counts can be incomplete and must not be used for incident scope, billing, user analytics or SLO claims.
- No network telemetry provider, metrics endpoint or credential was added.
- Upload status remains unverified until a protected backend storage/scanner health source exists.
- A future production health API must independently authorize app admins, return aggregate allowlisted fields, reject identifiers/content, expose freshness and remain rate-limited/audited.

## Manual test

1. Run Picom in development mode.
2. Open Settings > Advanced > Admin Operations.
3. Confirm Product health opens first.
4. Confirm version/channel, API, realtime, uploads, voice and aggregate error cards render.
5. Confirm no raw log message, host secret, token, user/community/channel ID or private content appears.
6. Confirm other Admin Operations sections still work.
