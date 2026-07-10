# Public API and Integration Versioning Policy

## Status

Picom does not currently expose a generally available public API. Bot API, external webhook API, developer applications, API keys, and public SDK publishing remain disabled/restricted foundations. Existing Supabase Edge Functions are Picom first-party backend contracts unless explicitly promoted through security, documentation, support, and release gates.

This policy defines the future compatibility contract; it does not publish or enable an endpoint.

## Goals

- Keep integrations and released Windows/Linux/macOS desktop clients compatible across backend changes.
- Make breaking changes deliberate, observable, documented, and time-bounded.
- Keep bot, webhook, and first-party Edge Function version semantics consistent.
- Preserve stable error/rate-limit/pagination behavior.
- Permit immediate security containment without silently leaking or corrupting data.

## API classes

| Class | Audience | Current availability | Compatibility owner |
| --- | --- | --- | --- |
| Public Bot API | Approved integration developers | Not public | Platform/API |
| Webhook delivery API | Approved channel webhook senders | Backend-restricted foundation | Platform/Security |
| Developer management API | Application/bot/webhook owners | Restricted development foundation | Platform/API |
| Picom Edge Functions | Official desktop client/backend operations | First-party/internal contracts | Desktop + Backend |
| Supabase table/RPC/realtime | Official service/data layer only | Internal implementation | Backend/Data |

Supabase table names, RPCs, buckets, Storage paths, RLS functions, realtime topics, and provider-specific errors are not public API unless a separate explicit contract says so. External integrations must never query Picom tables directly.

## Version identifier

### HTTP APIs

Major version is explicit in the route:

```text
https://api.picom.example/v1/...
```

The URL major is authoritative. Every response also includes safe headers:

```text
X-Picom-API-Version: 1
X-Picom-API-Revision: 2026-07-10
X-Picom-Request-Id: <opaque-id>
```

- `X-Picom-API-Version` is the major contract.
- `X-Picom-API-Revision` identifies the additive contract revision/date, not a server commit or secret deployment ID.
- Clients may send `X-Picom-API-Version: 1`; a conflicting route/header is rejected with `VALIDATION_ERROR` rather than guessed.
- Content type remains `application/json` unless a documented endpoint uses a media/export format.

No version is selected through a query parameter or untrusted custom host.

### First-party Edge Functions

Existing names such as `livekit-token`, `client-config`, `validate-file`, `accept-invite`, exports/deletion, moderation, notifications, health, and webhook delivery remain first-party endpoints. Before public/stable use, each function documents:

- request/response/error schema revision;
- authentication and permission/RLS boundary;
- minimum/recommended desktop version;
- idempotency and retry rules;
- body/response limit and rate limit;
- redaction and logging behavior.

Use the version headers above. A future breaking revision either creates a versioned function/path (`.../v2/...`) or keeps a compatibility adapter until minimum supported clients move beyond v1.

### Events

Bot/webhook callback and realtime event envelopes use:

```json
{
  "eventId": "opaque-id",
  "eventType": "message.created",
  "schemaVersion": 1,
  "occurredAt": "2026-07-10T12:00:00Z",
  "data": {}
}
```

Event names and `schemaVersion` are stable within a major version. Event payloads may add optional fields. Consumers must ignore unknown optional fields and unknown event types safely. Renaming/removing a field, changing meaning/type, or making an optional field required is breaking.

## What is breaking

- Removing/renaming an endpoint, action, event, field, enum value, header, scope, or error code expected by clients.
- Changing a field type, nullability, units, ordering guarantee, identifier semantics, pagination/cursor behavior, or idempotency behavior.
- Changing authentication/token placement or permission meaning.
- Returning broader private data or narrowing valid access without a migration/fallback/security exception.
- Changing rate-limit units/bucket identity in a way that breaks compliant clients.
- Changing webhook signature verification, event retry/delivery semantics, or bot event ordering/deduplication.
- Changing Edge Function request/response so a supported desktop release fails.
- Exposing provider/Postgres/Supabase/LiveKit errors in place of the Picom error contract.

Performance improvement, documentation clarification, new endpoint, new optional response field, or new optional request field with unchanged default is normally additive. A new enum value is additive only when clients have an explicit unknown fallback.

## Backward compatibility rules

- Existing fields retain meaning/type for the full major lifetime.
- New response fields are optional for clients and safe to ignore.
- New request fields are optional with documented server defaults until the next major.
- New capabilities/scopes do not expand an existing token's authority automatically.
- Missing optional values use null/absence consistently; do not switch between incompatible forms.
- Cursor tokens are opaque and must not be parsed by clients.
- Collection order is documented and stable when correctness depends on it.
- Repeated idempotent requests return the prior successful result or a stable conflict outcome.
- Server/RLS permission enforcement remains authoritative regardless of client version or feature flag.

Server implementations should support at least the current stable major and its announced predecessor during a migration window. Actual concurrent-major commitment is approved before public launch based on operational capacity.

## Bot API policy

Future routes use `/v1/bots`, `/v1/channels/{channelId}/messages`, and related resource-oriented paths after review. Bot authentication/scopes are independent of desktop sessions.

- Raw bot token is shown once; store only a secure hash.
- Bot identity, community/channel scope, permission, rate limit, and audit are backend-enforced.
- `Idempotency-Key` is required for message/create actions.
- Bot message/event DTOs exclude internal database, token, private admin, and unauthorized private-channel fields.
- Command manifest/event versions are explicit and independently deprecable within compatible rules.
- Bots must not impersonate users or execute arbitrary desktop/server code.

Bot API remains unavailable until docs, portal, credential issuance/rotation/revocation, RLS, rate limits, audit, abuse handling, SDK/contract tests, and support pass production gates.

## Webhook API policy

Inbound webhooks are a narrow authenticated delivery API, not a full bot API.

- Versioned route/contract and bounded content/attachment references.
- Credential is sent in an approved header or one-time generated endpoint design after threat review; never logged or returned after creation.
- Token hash, revocation, channel send permission, message origin, idempotency, rate limit, abuse and audit checks are mandatory.
- Response does not reveal whether a guessed webhook ID/token/community exists.
- Webhook-origin messages are clearly identified in safe DTOs.
- Outbound webhook/event delivery (if introduced) has signed requests, timestamp/replay protection, event schema version, retries with jitter, dead-letter visibility, and endpoint disable controls.

The current backend-only webhook foundation does not constitute a public SLA/API launch.

## Error contract

Every HTTP failure uses:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request could not be completed.",
  "details": {},
  "requestId": "optional-opaque-id"
}
```

- `code` is stable, machine-readable, and documented in `docs/error-codes.md`.
- `message` is safe/user-facing and may improve without exposing stack/provider detail.
- `details` is optional, structured, redacted, and versioned additively.
- `requestId` correlates restricted server logs without encoding user/tenant/secrets.
- Status code and error code mapping remain stable within a major.
- Unknown internal errors map to `SERVER_ERROR`; raw stack, SQL, RLS policy, provider response, token, path, or private content is never returned.

New error codes are additive only when clients treat unknown codes as a safe category fallback. Removal/semantic repurpose is breaking.

## Rate-limit contract

Rate limits are per endpoint class and may additionally scope by credential, user/bot/webhook, tenant/community, channel, and safe network-risk signal. Documentation states unit/window/burst and whether limits are shared.

Successful and limited responses may include:

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1752148800
```

HTTP `429` includes `Retry-After` plus `RATE_LIMITED`. Values never reveal other tenants' traffic or internal capacity. Clients respect `Retry-After`, use bounded exponential backoff with jitter, and do not retry unsafe POST automatically unless a stable idempotency key is present. Login/register and uploads are not aggressively retried.

Reducing limits for abuse/service safety is allowed when documented and does not discriminate across tenants unpredictably; severe emergency restrictions follow incident/deprecation exception rules.

## Deprecation policy

### Notice headers

Deprecated HTTP responses include:

```text
Deprecation: true
Sunset: Wed, 10 Jul 2027 00:00:00 GMT
Link: <https://docs.picom.example/api/migrations/v2>; rel="deprecation"
X-Picom-Min-Client-Version: 1.2.0
```

The documentation/replacement link is public and contains no private deployment data. Deprecation is also announced in API docs, developer portal, release notes/changelog, dashboard/email contact where approved, and support known issues.

### Default windows

- Public stable API major: target at least 12 months notice before removal, subject to final launch terms/SLA.
- Beta API: target at least 90 days when risk allows; beta status is explicit.
- First-party Edge Function: keep compatible until all supported desktop clients have moved past the affected version plus a monitored migration window.
- Individual field/event deprecation follows the same major-window rule unless an adapter preserves compatibility.

Do not promise a public window before commercial/legal/support approval. Once published, track it as a customer commitment.

### Removal gate

Removal requires replacement documentation, usage/contact inventory, client/server telemetry without sensitive content, migration test/SDK, zero or approved residual usage, minimum-client update, support readiness, rollback, security/release approvals, and completed sunset date. Keep a tombstone response with a stable error/document link when safe rather than silently returning an unrelated result.

## Security emergency exception

A vulnerable endpoint/capability may be restricted or disabled immediately when required to protect users/data. The incident owner must:

1. pause/kill-switch both backend and UI availability where relevant;
2. return a stable safe error instead of leaking details;
3. preserve unaffected compatible behavior when possible;
4. notify affected developers/users through approved channels;
5. update minimum client/version/known issue and provide migration/hotfix;
6. document why normal deprecation was unsafe and complete post-incident review.

Emergency action never bypasses RLS, authentication, or audit.

## Change and release process

1. Classify additive/deprecated/breaking/security before implementation.
2. Update reviewed OpenAPI/JSON schema/shared DTO/event contract when those sources exist.
3. Add old/new client/provider contract tests, error/rate-limit/idempotency tests, RLS isolation, and redaction tests.
4. Update docs, SDK wrappers, changelog, release notes, compatibility metadata, and deprecation headers.
5. Canary in staging/beta with request/version/error metrics and no message content/secrets.
6. Obtain API, Security, Desktop, Operations, Support, and Product approval.
7. Roll out by channel/ring with pause/rollback.
8. Remove only through the documented removal gate.

## Version-support registry

Maintain a public-safe registry:

| Surface | Major/revision | Status | Introduced | Deprecated | Sunset | Replacement | Min desktop |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bot API | v1 placeholder | not public | - | - | - | - | - |
| Webhook delivery | v1 placeholder | restricted foundation | - | - | - | - | - |
| First-party Edge Functions | current internal | supported for app | repository history | - | - | versioned per function | current compatibility config |

Do not list private hosts, keys, project refs, unpublished vulnerabilities, or internal infrastructure in the public registry.

## Acceptance gate before public launch

- Approved API scope, owner, terms/SLA/support, authentication/scopes, and threat model
- Versioned OpenAPI/event/error/pagination/rate-limit/idempotency contracts
- Backend-only credentials, RLS/tenant isolation, audit/abuse/revocation
- Developer portal/docs/SDK and migration/deprecation process
- Load/security/contract/cross-version tests and monitoring
- Rollout/pause/rollback/incident readiness
- No public route merely because a Supabase Edge Function or migration exists

